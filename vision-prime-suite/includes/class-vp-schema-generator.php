<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Auto-generates FAQ/HowTo JSON-LD schema from the actual published
 * content (only when the content really contains Q&A or step-by-step
 * sections — never fabricated), and prints it in <head> so the post is
 * eligible for rich results without manual schema markup.
 */
class VP_Schema_Generator {

	const META_KEY = '_vp_schema_json';

	public function __construct() {
		add_action( 'wp_head', array( $this, 'print_schema' ) );
	}

	public function print_schema() {
		if ( ! is_singular() ) {
			return;
		}
		$json = get_post_meta( get_the_ID(), self::META_KEY, true );
		if ( empty( $json ) ) {
			return;
		}
		echo '<script type="application/ld+json">' . $json . '</script>' . "\n";
	}

	/**
	 * Asks the AI to extract real FAQ/HowTo structure already present in
	 * the content (it's instructed to return an empty result if none
	 * exists) and stores the resulting JSON-LD as post meta.
	 */
	public static function maybe_generate_and_store( $post_id, $content, $title ) {
		$provider = VP_Settings::get( 'default_provider' );
		$model    = VP_AI_Providers::get_provider( $provider )['models'][0] ?? '';

		$messages = array(
			array(
				'role'    => 'system',
				'content' => 'تو یک متخصص داده‌ساختاریافته‌ی schema.org هستی. فقط اگر متن واقعاً شامل بخش سوالات متداول یا مراحل گام‌به‌گام باشد، schema معتبر JSON-LD از نوع FAQPage یا HowTo بساز. اگر چنین بخشی در متن نیست، دقیقاً {} برگردان. هیچ سوال یا مرحله‌ای را از خودت نساز.',
			),
			array(
				'role'    => 'user',
				'content' => "عنوان: $title\n\nمحتوا:\n" . wp_strip_all_tags( $content ),
			),
		);

		$raw = VP_Api_Manager::chat_with_fallback( 'seo', $messages, $provider, $model );
		if ( is_wp_error( $raw ) ) {
			VP_Logger::log( 'schema_generator', $raw->get_error_message(), 'error', array( 'post_id' => $post_id ) );
			return;
		}

		$start = strpos( $raw, '{' );
		$end   = strrpos( $raw, '}' );
		if ( false === $start || false === $end ) {
			return;
		}

		$json   = substr( $raw, $start, $end - $start + 1 );
		$decoded = json_decode( $json, true );

		if ( ! is_array( $decoded ) || empty( $decoded['@type'] ) ) {
			return;
		}

		update_post_meta( $post_id, self::META_KEY, wp_json_encode( $decoded ) );
		VP_Logger::log( 'schema_generator', "اسکیمای {$decoded['@type']} برای پست #$post_id ثبت شد.", 'info' );
	}
}
