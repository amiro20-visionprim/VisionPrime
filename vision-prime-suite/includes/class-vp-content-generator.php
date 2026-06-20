<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Core generation engine for articles and products. Each content type has
 * its own editable system prompt (the "two separate textboxes" requirement)
 * so operators can change tone/strategy per content type without touching code.
 */
class VP_Content_Generator {

	public function __construct() {
		add_action( 'wp_ajax_vp_generate_content', array( $this, 'ajax_generate' ) );
	}

	public static function default_prompt( $type ) {
		if ( 'product' === $type ) {
			return "تو یک کپی‌رایتر حرفه‌ای محصول و متخصص سئو هستی. برای محصول زیر یک توضیح فروش‌محور، دقیق و سئو‌شده بنویس؛ روی مزایای کاربر، کلمات کلیدی هدف، و ساختار اسکن‌پذیر (تیتر، بولت، CTA) تمرکز کن. از ادعای غیرواقعی پرهیز کن.";
		}
		return "تو یک استراتژیست محتوا و سئوی فارسی هستی. یک مقاله‌ی عمیق، ساختاریافته (H2/H3)، طبیعی برای خواننده‌ی ایرانی، و کاملاً سئوشده بر اساس کلمه‌ی کلیدی هدف بنویس. هدف رتبه گرفتن سریع و حفظ خواننده تا انتهای مقاله است.";
	}

	public function ajax_generate() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		$type     = sanitize_key( $_POST['content_type'] ?? 'article' );
		$topic    = sanitize_text_field( $_POST['topic'] ?? '' );
		$keyword  = sanitize_text_field( $_POST['keyword'] ?? '' );
		$provider = sanitize_key( $_POST['provider'] ?? VP_Settings::get( 'default_provider' ) );
		$model    = sanitize_text_field( $_POST['model'] ?? '' );

		if ( empty( $topic ) ) {
			wp_send_json_error( array( 'message' => __( 'موضوع الزامی است.', 'vp-suite' ) ) );
		}

		$result = self::generate( $type, $topic, $keyword, $provider, $model );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}

		wp_send_json_success( array( 'content' => $result['content'], 'job_id' => $result['job_id'] ) );
	}

	public static function generate( $type, $topic, $keyword, $provider, $model ) {
		$prompt_key    = 'product' === $type ? 'product_prompt' : 'article_prompt';
		$system_prompt = VP_Settings::get( $prompt_key );

		$user_prompt = sprintf(
			"موضوع: %s\nکلمه‌ی کلیدی هدف: %s\nخروجی را در قالب HTML تمیز (بدون توضیح اضافه، فقط محتوای نهایی) بده.",
			$topic,
			$keyword ?: $topic
		);

		$messages = array(
			array( 'role' => 'system', 'content' => $system_prompt ),
			array( 'role' => 'user', 'content' => $user_prompt ),
		);

		$response = VP_Api_Manager::chat( $provider, $model, $messages, 'content' );

		if ( is_wp_error( $response ) ) {
			VP_Logger::log( 'content_generator', $response->get_error_message(), 'error', compact( 'type', 'topic' ) );
			return $response;
		}

		$job_id = VP_Queue::create_job(
			array(
				'job_type'         => $type,
				'title'            => $topic,
				'status'           => 'pending_review',
				'provider'         => $provider,
				'model'            => $model,
				'prompt_snapshot'  => $system_prompt . "\n---\n" . $user_prompt,
				'content_snapshot' => $response,
			)
		);

		VP_Logger::log( 'content_generator', "محتوای $type برای «$topic» تولید شد.", 'info', array( 'job_id' => $job_id ) );

		return array( 'content' => $response, 'job_id' => $job_id );
	}
}
