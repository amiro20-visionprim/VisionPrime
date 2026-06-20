<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Real-time competitor & SERP gap analysis. Acts as the "SEO/content
 * strategist" module: takes a keyword, optionally a list of competitor
 * URLs, and returns ranking opportunities + content angles. Uses its own
 * prompt box (separate from article/product prompts) and can use either
 * the shared API key or a dedicated one for this module specifically.
 */
class VP_Competitor_Analysis {

	public function __construct() {
		add_action( 'wp_ajax_vp_competitor_scan', array( $this, 'ajax_scan' ) );
	}

	public static function default_prompt() {
		return "تو یک استراتژیست سئو و محتوا در سطح آنالیست رقابتی حرفه‌ای هستی. بر اساس کلمه‌ی کلیدی و رقبای داده‌شده، گپ محتوایی، زاویه‌های جذاب برای کلیک، عنوان‌های پیشنهادی، و دلایل دقیق پایین یا بالا بودن رتبه را تحلیل کن. خروجی را JSON با کلیدهای gaps, suggested_titles, opportunity_score (0-100), action_plan بده.";
	}

	public function ajax_scan() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		$keyword     = sanitize_text_field( $_POST['keyword'] ?? '' );
		$competitors = sanitize_textarea_field( $_POST['competitors'] ?? '' );

		if ( empty( $keyword ) ) {
			wp_send_json_error( array( 'message' => __( 'کلمه‌ی کلیدی الزامی است.', 'vp-suite' ) ) );
		}

		$result = self::scan( $keyword, $competitors );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}

		wp_send_json_success( $result );
	}

	public static function scan( $keyword, $competitors_raw = '' ) {
		$provider = VP_Settings::get( 'default_provider' );
		$model    = VP_AI_Providers::get_provider( $provider )['models'][0] ?? '';

		$messages = array(
			array( 'role' => 'system', 'content' => VP_Settings::get( 'competitor_prompt' ) ),
			array(
				'role'    => 'user',
				'content' => "کلمه‌ی کلیدی: $keyword\nرقبا (هر خط یک URL/خلاصه):\n$competitors_raw",
			),
		);

		$raw = VP_Api_Manager::chat_with_fallback( 'competitor', $messages, $provider, $model );
		if ( is_wp_error( $raw ) ) {
			return $raw;
		}

		global $wpdb;
		$wpdb->insert(
			$wpdb->prefix . 'vp_competitor_reports',
			array(
				'keyword'    => $keyword,
				'target_url' => '',
				'provider'   => $provider,
				'findings'   => $raw,
				'status'     => 'new',
				'created_at' => current_time( 'mysql' ),
				'updated_at' => current_time( 'mysql' ),
			)
		);

		VP_Logger::log( 'competitor_analysis', "تحلیل رقبا برای «$keyword» انجام شد.", 'info' );

		return array( 'report_id' => $wpdb->insert_id, 'raw' => $raw );
	}

	public static function get_reports( $limit = 30 ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}vp_competitor_reports ORDER BY id DESC LIMIT %d", $limit ) );
	}
}
