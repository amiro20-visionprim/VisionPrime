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

	const AUTO_BATCH_SIZE = 3;

	public function __construct() {
		add_action( 'wp_ajax_vp_competitor_scan', array( $this, 'ajax_scan' ) );
	}

	/**
	 * Automatic mode: pulls real keywords already present in Search Console
	 * data (the "content gap" and "striking distance" buckets — keywords
	 * with real impressions that aren't ranking well yet) and runs the same
	 * scan() used by the manual UI, so reports look identical regardless of
	 * how the keyword was sourced. Requires GSC to be connected and the
	 * toggle enabled; does nothing otherwise (no invented keywords).
	 *
	 * @return int Number of automatic reports created in this run.
	 */
	public static function run_auto_scan() {
		if ( ! VP_Settings::get( 'competitor_auto_scan' ) ) {
			return 0;
		}
		if ( ! class_exists( 'VP_Search_Console' ) || ! VP_Search_Console::is_connected() ) {
			return 0;
		}

		$conn = VP_Search_Console::get_connection();
		if ( empty( $conn['site_url'] ) ) {
			return 0;
		}

		$opportunities = VP_Search_Console::find_opportunities( $conn['site_url'] );
		if ( is_wp_error( $opportunities ) ) {
			VP_Logger::log( 'competitor_analysis', 'دریافت داده‌ی GSC برای تحلیل خودکار رقبا ناموفق: ' . $opportunities->get_error_message(), 'error' );
			return 0;
		}

		$candidates = array_merge( $opportunities['content_gap'], $opportunities['striking_distance'] );
		if ( empty( $candidates ) ) {
			return 0;
		}

		global $wpdb;
		$already_done = $wpdb->get_col( "SELECT DISTINCT keyword FROM {$wpdb->prefix}vp_competitor_reports WHERE created_at > DATE_SUB(NOW(), INTERVAL 14 DAY)" );

		$count = 0;
		foreach ( $candidates as $item ) {
			if ( $count >= self::AUTO_BATCH_SIZE ) {
				break;
			}
			$keyword = $item['query'] ?? '';
			if ( '' === $keyword || in_array( $keyword, $already_done, true ) ) {
				continue;
			}

			self::scan( $keyword, '' );
			$already_done[] = $keyword;
			$count++;
		}

		if ( $count > 0 ) {
			VP_Logger::log( 'competitor_analysis', "$count تحلیل رقبا به‌صورت خودکار بر اساس کلمات کلیدی واقعی Search Console اجرا شد.", 'info' );
		}

		return $count;
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
