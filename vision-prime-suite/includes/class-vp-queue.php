<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Publishing queue / job tracker. Generated drafts land here as
 * 'pending_review' before becoming real WP posts, giving the operator a
 * single dashboard to approve, schedule, or reject AI output.
 */
class VP_Queue {

	const STATUSES = array( 'draft', 'pending_review', 'approved', 'scheduled', 'published', 'rejected' );

	public function __construct() {
		add_action( 'wp_ajax_vp_queue_action', array( $this, 'ajax_action' ) );
	}

	public static function create_job( $args ) {
		global $wpdb;
		$now = current_time( 'mysql' );

		$wpdb->insert(
			$wpdb->prefix . 'vp_jobs',
			array_merge(
				array(
					'job_type'         => 'article',
					'title'            => '',
					'status'           => 'draft',
					'provider'         => null,
					'model'            => null,
					'prompt_snapshot'  => '',
					'content_snapshot' => '',
					'target_post_id'   => null,
					'scheduled_at'     => null,
					'created_by'       => get_current_user_id() ?: null,
					'created_at'       => $now,
					'updated_at'       => $now,
				),
				$args
			)
		);

		return $wpdb->insert_id;
	}

	public static function get_jobs( $status = '', $limit = 50 ) {
		global $wpdb;
		$table = $wpdb->prefix . 'vp_jobs';

		if ( $status ) {
			return $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $table WHERE status = %s ORDER BY id DESC LIMIT %d", $status, $limit ) );
		}
		return $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $table ORDER BY id DESC LIMIT %d", $limit ) );
	}

	public static function approve_and_publish( $job_id, $publish_now = true ) {
		global $wpdb;
		$job = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}vp_jobs WHERE id = %d", $job_id ) );
		if ( ! $job ) {
			return new WP_Error( 'vp_job_missing', __( 'این آیتم در صف یافت نشد.', 'vp-suite' ) );
		}

		$post_type = 'product' === $job->job_type && post_type_exists( 'product' ) ? 'product' : 'post';

		$post_id = wp_insert_post(
			array(
				'post_type'    => $post_type,
				'post_title'   => $job->title,
				'post_content' => $job->content_snapshot,
				'post_status'  => $publish_now ? 'publish' : 'draft',
			)
		);

		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}

		if ( VP_Settings::get( 'rankmath_sync' ) ) {
			$seo = VP_SEO_Engine::audit( $job->content_snapshot, $job->title );
			if ( ! is_wp_error( $seo ) ) {
				VP_Rankmath_Sync::apply( $post_id, $seo );
			}
		}

		$wpdb->update(
			$wpdb->prefix . 'vp_jobs',
			array(
				'status'         => 'published',
				'target_post_id' => $post_id,
				'updated_at'     => current_time( 'mysql' ),
			),
			array( 'id' => $job_id ),
			array( '%s', '%d', '%s' ),
			array( '%d' )
		);

		VP_Logger::log( 'queue', "آیتم #$job_id منتشر شد (پست #$post_id).", 'info' );

		return $post_id;
	}

	public static function update_status( $job_id, $status ) {
		global $wpdb;
		if ( ! in_array( $status, self::STATUSES, true ) ) {
			return false;
		}
		return $wpdb->update(
			$wpdb->prefix . 'vp_jobs',
			array( 'status' => $status, 'updated_at' => current_time( 'mysql' ) ),
			array( 'id' => $job_id ),
			array( '%s', '%s' ),
			array( '%d' )
		);
	}

	/**
	 * Marks a job for automatic publishing at a future time. The actual
	 * publish is performed by VP_Cron on the scheduled WP-Cron tick.
	 *
	 * @param int    $job_id       Job id.
	 * @param string $scheduled_at MySQL datetime (site timezone).
	 */
	public static function schedule( $job_id, $scheduled_at ) {
		global $wpdb;
		return $wpdb->update(
			$wpdb->prefix . 'vp_jobs',
			array(
				'status'       => 'scheduled',
				'scheduled_at' => $scheduled_at,
				'updated_at'   => current_time( 'mysql' ),
			),
			array( 'id' => absint( $job_id ) ),
			array( '%s', '%s', '%s' ),
			array( '%d' )
		);
	}

	/**
	 * Publishes every scheduled job whose time has arrived. Called from
	 * VP_Cron; safe to run repeatedly (only picks 'scheduled' rows that
	 * are due, and each becomes 'published' on success).
	 *
	 * @return int Number of jobs published.
	 */
	public static function run_due_scheduled() {
		global $wpdb;
		$now = current_time( 'mysql' );

		$due = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT id FROM {$wpdb->prefix}vp_jobs WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= %s ORDER BY scheduled_at ASC LIMIT 20",
				$now
			)
		);

		$count = 0;
		foreach ( $due as $job_id ) {
			$result = self::approve_and_publish( (int) $job_id, true );
			if ( ! is_wp_error( $result ) ) {
				$count++;
			} else {
				VP_Logger::log( 'queue', "انتشار زمان‌بندی‌شده‌ی #$job_id ناموفق: " . $result->get_error_message(), 'error' );
			}
		}

		if ( $count > 0 ) {
			VP_Logger::log( 'queue', "$count آیتم زمان‌بندی‌شده به‌صورت خودکار منتشر شد.", 'info' );
		}

		return $count;
	}

	public function ajax_action() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'publish_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		$job_id = absint( $_POST['job_id'] ?? 0 );
		$action = sanitize_key( $_POST['queue_action'] ?? '' );

		switch ( $action ) {
			case 'approve':
				$result = self::approve_and_publish( $job_id, true );
				break;
			case 'schedule_draft':
				$result = self::approve_and_publish( $job_id, false );
				break;
			case 'schedule':
				$when = sanitize_text_field( $_POST['scheduled_at'] ?? '' );
				if ( empty( $when ) ) {
					wp_send_json_error( array( 'message' => __( 'زمان انتشار را وارد کنید.', 'vp-suite' ) ) );
				}
				$result = self::schedule( $job_id, str_replace( 'T', ' ', $when ) . ':00' );
				break;
			case 'reject':
				$result = self::update_status( $job_id, 'rejected' );
				break;
			default:
				wp_send_json_error( array( 'message' => __( 'عملیات نامعتبر.', 'vp-suite' ) ) );
		}

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}

		wp_send_json_success( array( 'result' => $result ) );
	}
}
