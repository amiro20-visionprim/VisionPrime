<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Title A/B testing on REAL Search Console CTR. Every time a post's title
 * changes, the previous title's period is closed and a new period starts.
 * Comparing periods later pulls actual clicks/impressions for that exact
 * page URL within each title's date range from GSC — no simulated traffic,
 * no guessing which title "should" perform better.
 */
class VP_Title_AB {

	public function __construct() {
		add_action( 'post_updated', array( $this, 'maybe_log_title_change' ), 10, 3 );
		add_action( 'wp_ajax_vp_title_ab_history', array( $this, 'ajax_history' ) );
		add_action( 'wp_ajax_vp_title_ab_compare', array( $this, 'ajax_compare' ) );
	}

	/**
	 * Hooked to post_updated. Only logs a new period when the title actually
	 * changed and the post is in a public, indexable status — log noise for
	 * drafts/autosaves would pollute the CTR comparison with periods that
	 * were never actually live for Google to measure.
	 */
	public function maybe_log_title_change( $post_id, $post_after, $post_before ) {
		if ( wp_is_post_autosave( $post_id ) || wp_is_post_revision( $post_id ) ) {
			return;
		}
		if ( 'publish' !== $post_after->post_status ) {
			return;
		}
		if ( $post_after->post_title === $post_before->post_title ) {
			return;
		}

		self::log_title( $post_id, $post_after->post_title );
	}

	public static function log_title( $post_id, $title ) {
		global $wpdb;
		$table = $wpdb->prefix . 'vp_title_history';
		$now   = current_time( 'mysql' );

		$last = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM $table WHERE post_id = %d ORDER BY id DESC LIMIT 1", $post_id )
		);
		if ( $last && $last->title === $title ) {
			return;
		}

		if ( $last ) {
			$wpdb->update( $table, array( 'ended_at' => $now ), array( 'id' => $last->id ) );
		}

		$wpdb->insert(
			$table,
			array(
				'post_id'    => $post_id,
				'title'      => $title,
				'started_at' => $now,
				'ended_at'   => null,
				'created_at' => $now,
			)
		);
	}

	public static function get_history( $post_id ) {
		global $wpdb;
		return $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$wpdb->prefix}vp_title_history WHERE post_id = %d ORDER BY started_at ASC", $post_id )
		);
	}

	/**
	 * For every logged title period, pulls the REAL total clicks/impressions
	 * for that exact page URL from GSC, bounded to that period's date range
	 * (capped to "yesterday" since GSC has no same-day data).
	 */
	public static function compare( $post_id ) {
		if ( ! class_exists( 'VP_Search_Console' ) || ! VP_Search_Console::is_connected() ) {
			return new WP_Error( 'vp_gsc_not_connected', __( 'به Google Search Console متصل نشده‌اید.', 'vp-suite' ) );
		}

		$conn = VP_Search_Console::get_connection();
		if ( empty( $conn['site_url'] ) ) {
			return new WP_Error( 'vp_gsc_no_site', __( 'ابتدا یک پراپرتی را انتخاب کنید.', 'vp-suite' ) );
		}

		$page_url = get_permalink( $post_id );
		$periods  = self::get_history( $post_id );
		if ( empty( $periods ) ) {
			return array();
		}

		$yesterday = gmdate( 'Y-m-d', time() - DAY_IN_SECONDS );
		$results   = array();

		foreach ( $periods as $period ) {
			$start = gmdate( 'Y-m-d', strtotime( $period->started_at ) );
			$end   = $period->ended_at ? gmdate( 'Y-m-d', strtotime( $period->ended_at ) ) : $yesterday;
			if ( $end > $yesterday ) {
				$end = $yesterday;
			}
			if ( $start > $end ) {
				$results[] = array(
					'title'        => $period->title,
					'started_at'   => $period->started_at,
					'ended_at'     => $period->ended_at,
					'clicks'       => 0,
					'impressions'  => 0,
					'ctr'          => 0,
					'note'         => __( 'هنوز داده‌ی کافی برای این بازه ثبت نشده.', 'vp-suite' ),
				);
				continue;
			}

			$rows = VP_Search_Console::query_analytics(
				$conn['site_url'],
				array(
					'startDate'             => $start,
					'endDate'               => $end,
					'dimensions'            => array(),
					'dimensionFilterGroups' => array(
						array(
							'filters' => array(
								array( 'dimension' => 'page', 'operator' => 'equals', 'expression' => $page_url ),
							),
						),
					),
				)
			);

			if ( is_wp_error( $rows ) ) {
				return $rows;
			}

			$clicks = 0;
			$impr   = 0;
			foreach ( $rows as $row ) {
				$clicks += (int) ( $row['clicks'] ?? 0 );
				$impr   += (int) ( $row['impressions'] ?? 0 );
			}

			$results[] = array(
				'title'       => $period->title,
				'started_at'  => $period->started_at,
				'ended_at'    => $period->ended_at,
				'clicks'      => $clicks,
				'impressions' => $impr,
				'ctr'         => $impr > 0 ? round( ( $clicks / $impr ) * 100, 2 ) : 0,
			);
		}

		usort( $results, fn( $a, $b ) => $b['ctr'] <=> $a['ctr'] );

		return array(
			'page_url' => $page_url,
			'periods'  => $results,
		);
	}

	public function ajax_history() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}
		$post_id = absint( $_POST['post_id'] ?? 0 );
		wp_send_json_success( self::get_history( $post_id ) );
	}

	public function ajax_compare() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}
		$post_id = absint( $_POST['post_id'] ?? 0 );
		$data    = self::compare( $post_id );
		if ( is_wp_error( $data ) ) {
			wp_send_json_error( array( 'message' => $data->get_error_message() ) );
		}
		wp_send_json_success( $data );
	}
}
