<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Content calendar automation: operators plan topics/keywords ahead of
 * time with a target date; VP_Cron walks due entries and triggers real
 * generation automatically, landing the result in the publishing queue
 * (or auto-publishing it, if requested) without manual clicking.
 */
class VP_Content_Calendar {

	public function __construct() {
		add_action( 'wp_ajax_vp_calendar_add', array( $this, 'ajax_add' ) );
		add_action( 'wp_ajax_vp_calendar_delete', array( $this, 'ajax_delete' ) );
	}

	public static function add_entry( $args ) {
		global $wpdb;
		$now = current_time( 'mysql' );

		$wpdb->insert(
			$wpdb->prefix . 'vp_calendar_entries',
			array_merge(
				array(
					'job_type'     => 'article',
					'topic'        => '',
					'keyword'      => '',
					'provider'     => VP_Settings::get( 'default_provider' ),
					'model'        => '',
					'scheduled_at' => $now,
					'auto_publish' => 0,
					'status'       => 'pending',
					'created_at'   => $now,
				),
				$args
			)
		);

		return $wpdb->insert_id;
	}

	public static function get_entries( $status = '', $limit = 100 ) {
		global $wpdb;
		$table = $wpdb->prefix . 'vp_calendar_entries';

		if ( $status ) {
			return $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $table WHERE status = %s ORDER BY scheduled_at ASC LIMIT %d", $status, $limit ) );
		}
		return $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $table ORDER BY scheduled_at ASC LIMIT %d", $limit ) );
	}

	public static function delete_entry( $id ) {
		global $wpdb;
		return $wpdb->delete( $wpdb->prefix . 'vp_calendar_entries', array( 'id' => absint( $id ) ), array( '%d' ) );
	}

	/**
	 * Generates content for every due ('pending', scheduled_at <= now)
	 * calendar entry. Called hourly by VP_Cron. Each entry becomes a
	 * vp_jobs row via VP_Content_Generator::generate(); if auto_publish
	 * is set, the job is immediately approved & published too.
	 *
	 * @return int Number of entries processed successfully.
	 */
	public static function process_due() {
		global $wpdb;
		$now = current_time( 'mysql' );

		$due = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}vp_calendar_entries WHERE status = 'pending' AND scheduled_at <= %s ORDER BY scheduled_at ASC LIMIT 10",
				$now
			)
		);

		$count = 0;
		foreach ( $due as $entry ) {
			$provider = $entry->provider ?: VP_Settings::get( 'default_provider' );
			$model    = $entry->model ?: ( VP_AI_Providers::get_provider( $provider )['models'][0] ?? '' );

			$result = VP_Content_Generator::generate( $entry->job_type, $entry->topic, $entry->keyword, $provider, $model );

			if ( is_wp_error( $result ) ) {
				VP_Logger::log( 'content_calendar', "تولید خودکار برای «{$entry->topic}» ناموفق: " . $result->get_error_message(), 'error' );
				continue;
			}

			if ( $entry->auto_publish ) {
				VP_Queue::approve_and_publish( $result['job_id'], true );
			}

			$wpdb->update(
				$wpdb->prefix . 'vp_calendar_entries',
				array( 'status' => 'done', 'job_id' => $result['job_id'] ),
				array( 'id' => $entry->id ),
				array( '%s', '%d' ),
				array( '%d' )
			);

			$count++;
		}

		if ( $count > 0 ) {
			VP_Logger::log( 'content_calendar', "$count مورد از تقویم محتوایی به‌صورت خودکار تولید شد.", 'info' );
		}

		return $count;
	}

	public function ajax_add() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		$topic = sanitize_text_field( $_POST['topic'] ?? '' );
		$when  = sanitize_text_field( $_POST['scheduled_at'] ?? '' );

		if ( empty( $topic ) || empty( $when ) ) {
			wp_send_json_error( array( 'message' => __( 'موضوع و زمان الزامی است.', 'vp-suite' ) ) );
		}

		$id = self::add_entry(
			array(
				'job_type'     => sanitize_key( $_POST['job_type'] ?? 'article' ),
				'topic'        => $topic,
				'keyword'      => sanitize_text_field( $_POST['keyword'] ?? '' ),
				'provider'     => sanitize_key( $_POST['provider'] ?? '' ),
				'scheduled_at' => str_replace( 'T', ' ', $when ) . ':00',
				'auto_publish' => empty( $_POST['auto_publish'] ) ? 0 : 1,
			)
		);

		VP_Logger::log( 'content_calendar', "مورد جدید «$topic» به تقویم محتوایی اضافه شد.", 'info' );

		wp_send_json_success( array( 'id' => $id ) );
	}

	public function ajax_delete() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		self::delete_entry( absint( $_POST['id'] ?? 0 ) );
		wp_send_json_success();
	}
}
