<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Historical rank tracking + content decay detection, both built on real
 * weekly snapshots of actual Search Console data (no estimation). Each
 * snapshot stores per-query/page position, impressions, clicks, CTR for
 * the prior 7 days, which both a trend table and a decay comparison can
 * be built from later without re-querying the GSC API every time.
 */
class VP_Rank_Tracker {

	public function __construct() {
		add_action( 'wp_ajax_vp_rank_history', array( $this, 'ajax_history' ) );
		add_action( 'wp_ajax_vp_rank_decay', array( $this, 'ajax_decay' ) );
	}

	/**
	 * Pulls the last 7 days of Search Analytics rows and stores them as
	 * one dated snapshot batch. Safe to call repeatedly — skips if today's
	 * snapshot for this site already exists. Called weekly by VP_Cron.
	 */
	public static function snapshot_now() {
		if ( ! class_exists( 'VP_Search_Console' ) || ! VP_Search_Console::is_connected() ) {
			return 0;
		}

		$conn = VP_Search_Console::get_connection();
		if ( empty( $conn['site_url'] ) ) {
			return 0;
		}

		global $wpdb;
		$today = current_time( 'Y-m-d' );

		$already = $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}vp_rank_snapshots WHERE snapshot_date = %s", $today ) );
		if ( $already > 0 ) {
			return 0;
		}

		$rows = VP_Search_Console::query_analytics(
			$conn['site_url'],
			array(
				'startDate'  => gmdate( 'Y-m-d', time() - 7 * DAY_IN_SECONDS ),
				'endDate'    => gmdate( 'Y-m-d', time() - DAY_IN_SECONDS ),
				'dimensions' => array( 'query', 'page' ),
				'rowLimit'   => 5000,
			)
		);

		if ( is_wp_error( $rows ) ) {
			VP_Logger::log( 'rank_tracker', 'گرفتن اسنپ‌شات ناموفق: ' . $rows->get_error_message(), 'error' );
			return 0;
		}

		$count = 0;
		foreach ( $rows as $row ) {
			$wpdb->insert(
				$wpdb->prefix . 'vp_rank_snapshots',
				array(
					'query'         => $row['keys'][0] ?? '',
					'page'          => $row['keys'][1] ?? '',
					'position'      => round( $row['position'] ?? 0, 1 ),
					'impressions'   => (int) ( $row['impressions'] ?? 0 ),
					'clicks'        => (int) ( $row['clicks'] ?? 0 ),
					'ctr'           => round( ( $row['ctr'] ?? 0 ) * 100, 2 ),
					'snapshot_date' => $today,
					'created_at'    => current_time( 'mysql' ),
				)
			);
			$count++;
		}

		VP_Logger::log( 'rank_tracker', "$count ردیف اسنپ‌شات رتبه ثبت شد.", 'info' );

		return $count;
	}

	public static function get_history( $query = '', $page = '', $limit = 24 ) {
		global $wpdb;
		$table = $wpdb->prefix . 'vp_rank_snapshots';

		$where  = array();
		$params = array();
		if ( $query ) {
			$where[]  = 'query = %s';
			$params[] = $query;
		}
		if ( $page ) {
			$where[]  = 'page = %s';
			$params[] = $page;
		}

		$sql = "SELECT * FROM $table";
		if ( $where ) {
			$sql .= ' WHERE ' . implode( ' AND ', $where );
		}
		$sql     .= ' ORDER BY snapshot_date DESC LIMIT %d';
		$params[] = $limit;

		return $wpdb->get_results( $wpdb->prepare( $sql, $params ) );
	}

	/**
	 * Compares total clicks per page between two windows of stored
	 * snapshots (recent vs prior) to flag pages whose organic traffic is
	 * decaying — a real, measured decline rather than a guess.
	 *
	 * @param int   $window_days   Size of each comparison window.
	 * @param float $decline_ratio Minimum drop (e.g. 0.25 = 25%) to flag.
	 */
	public static function detect_decay( $window_days = 30, $decline_ratio = 0.25 ) {
		global $wpdb;
		$table = $wpdb->prefix . 'vp_rank_snapshots';

		$recent_start = gmdate( 'Y-m-d', time() - $window_days * DAY_IN_SECONDS );
		$prior_start  = gmdate( 'Y-m-d', time() - 2 * $window_days * DAY_IN_SECONDS );

		$recent = $wpdb->get_results(
			$wpdb->prepare( "SELECT page, SUM(clicks) AS clicks FROM $table WHERE snapshot_date >= %s GROUP BY page", $recent_start ),
			OBJECT_K
		);
		$prior = $wpdb->get_results(
			$wpdb->prepare( "SELECT page, SUM(clicks) AS clicks FROM $table WHERE snapshot_date >= %s AND snapshot_date < %s GROUP BY page", $prior_start, $recent_start ),
			OBJECT_K
		);

		$decayed = array();
		foreach ( $prior as $page => $row ) {
			$prior_clicks  = (int) $row->clicks;
			$recent_clicks = isset( $recent[ $page ] ) ? (int) $recent[ $page ]->clicks : 0;

			if ( $prior_clicks < 5 ) {
				continue;
			}

			$drop = ( $prior_clicks - $recent_clicks ) / $prior_clicks;
			if ( $drop >= $decline_ratio ) {
				$decayed[] = array(
					'page'          => $page,
					'prior_clicks'  => $prior_clicks,
					'recent_clicks' => $recent_clicks,
					'drop_percent'  => round( $drop * 100, 1 ),
				);
			}
		}

		usort(
			$decayed,
			function ( $a, $b ) {
				return $b['drop_percent'] <=> $a['drop_percent'];
			}
		);

		return $decayed;
	}

	public function ajax_history() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}
		wp_send_json_success( self::get_history( sanitize_text_field( $_POST['query'] ?? '' ), sanitize_text_field( $_POST['page'] ?? '' ) ) );
	}

	public function ajax_decay() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}
		$window_days   = isset( $_POST['window_days'] ) ? absint( $_POST['window_days'] ) : 30;
		$decline_ratio = isset( $_POST['decline_ratio'] ) ? ( (float) $_POST['decline_ratio'] ) / 100 : 0.25;
		wp_send_json_success( self::detect_decay( $window_days ?: 30, $decline_ratio > 0 ? $decline_ratio : 0.25 ) );
	}
}
