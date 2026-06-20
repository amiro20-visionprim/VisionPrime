<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Deep on-page SEO scoring/optimization engine, independent of Rank Math
 * (works even if Rank Math isn't installed) but designed to feed every
 * field Rank Math exposes via VP_Rankmath_Sync.
 */
class VP_SEO_Engine {

	public function __construct() {
		add_action( 'wp_ajax_vp_seo_audit', array( $this, 'ajax_audit' ) );
	}

	public static function default_prompt() {
		return "تو یک متخصص سئوی تکنیکال و محتوایی فارسی هستی. متن داده‌شده را تحلیل کن و خروجی JSON با کلیدهای focus_keyword, meta_title (حداکثر ۶۰ کاراکتر), meta_description (حداکثر ۱۶۰ کاراکتر), slug, headings_outline, internal_link_suggestions, readability_notes, seo_score (0 تا 100) بده. عمیق و واقعی تحلیل کن، نه سطحی.";
	}

	public function ajax_audit() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		$post_id = absint( $_POST['post_id'] ?? 0 );
		$post    = $post_id ? get_post( $post_id ) : null;
		$content = $post ? $post->post_content : sanitize_textarea_field( $_POST['content'] ?? '' );

		$result = self::audit( $content, $post ? $post->post_title : '' );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}

		if ( $post_id && VP_Settings::get( 'rankmath_sync' ) ) {
			VP_Rankmath_Sync::apply( $post_id, $result );
		}

		wp_send_json_success( $result );
	}

	public static function audit( $content, $title = '' ) {
		$provider = VP_Settings::get( 'default_provider' );
		$model    = VP_AI_Providers::get_provider( $provider )['models'][0] ?? '';

		$messages = array(
			array( 'role' => 'system', 'content' => VP_Settings::get( 'seo_prompt' ) ),
			array(
				'role'    => 'user',
				'content' => "عنوان: $title\n\nمحتوا:\n" . wp_strip_all_tags( $content ),
			),
		);

		$raw = VP_Api_Manager::chat( $provider, $model, $messages, 'seo' );
		if ( is_wp_error( $raw ) ) {
			return $raw;
		}

		$json = json_decode( self::extract_json( $raw ), true );
		if ( ! is_array( $json ) ) {
			return new WP_Error( 'vp_seo_parse', __( 'تحلیل سئو قابل پارس نبود.', 'vp-suite' ) );
		}

		VP_Logger::log( 'seo_engine', 'تحلیل سئو انجام شد.', 'info', array( 'score' => $json['seo_score'] ?? null ) );

		return $json;
	}

	private static function extract_json( $text ) {
		$start = strpos( $text, '{' );
		$end   = strrpos( $text, '}' );
		if ( false === $start || false === $end ) {
			return '{}';
		}
		return substr( $text, $start, $end - $start + 1 );
	}
}
