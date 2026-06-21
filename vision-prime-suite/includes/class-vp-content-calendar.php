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
		add_action( 'wp_ajax_vp_calendar_smart_plan', array( $this, 'ajax_smart_plan' ) );
	}

	public static function default_smart_prompt() {
		return 'تو یک سردبیر و استراتژیست محتوای فارسی هستی. بر اساس بریف زیر، یک برنامه‌ی محتوایی یک‌روزه طراحی کن. خروجی را فقط و فقط به‌صورت یک آرایه‌ی JSON معتبر بده (بدون توضیح اضافه، بدون مارک‌داون)، که هر آیتم شامل این فیلدها باشد: topic (موضوع دقیق و قابل‌نوشتن)، keyword (کلمه‌ی کلیدی هدف سئو)، job_type ("article" یا "product"). موضوعات باید متنوع، غیرتکراری، و واقعاً قابل تولید باشند.';
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

	/**
	 * Turns a single free-text brief into a full day's worth of calendar
	 * entries. Asks the AI for a strict JSON list of {topic, keyword,
	 * job_type}, then spreads the resulting entries evenly across the
	 * given date's working hours (09:00–21:00) so VP_Cron's normal
	 * process_due() picks them up exactly like manually-added entries.
	 *
	 * @return array|WP_Error array('count' => int, 'entries' => array) or error.
	 */
	public static function generate_day_plan( $brief, $date, $count, $auto_publish, $provider, $model ) {
		$count = max( 1, min( 30, (int) $count ) );

		$system_prompt = VP_Settings::get( 'calendar_smart_prompt' ) ?: self::default_smart_prompt();
		$user_prompt    = sprintf( "بریف: %s\nتعداد آیتم مورد نیاز: %d\nتاریخ برنامه: %s", $brief, $count, $date );

		$messages = array(
			array( 'role' => 'system', 'content' => $system_prompt ),
			array( 'role' => 'user', 'content' => $user_prompt ),
		);

		$raw = VP_Api_Manager::chat_with_fallback( 'content', $messages, $provider, $model );
		if ( is_wp_error( $raw ) ) {
			return $raw;
		}

		$json = trim( $raw );
		// Models sometimes wrap JSON in ```json fences despite instructions; strip them defensively.
		$json = preg_replace( '/^```(json)?|```$/m', '', $json );
		$items = json_decode( trim( $json ), true );

		if ( ! is_array( $items ) || empty( $items ) ) {
			return new WP_Error( 'vp_calendar_plan_parse', __( 'پاسخ هوش مصنوعی قابل تفسیر به برنامه‌ی روزانه نبود.', 'vp-suite' ) );
		}

		$items     = array_slice( $items, 0, $count );
		$start     = strtotime( $date . ' 09:00:00' );
		$end       = strtotime( $date . ' 21:00:00' );
		$step      = count( $items ) > 1 ? floor( ( $end - $start ) / ( count( $items ) - 1 ) ) : 0;
		$created   = array();

		foreach ( $items as $i => $item ) {
			$topic   = sanitize_text_field( $item['topic'] ?? '' );
			$keyword = sanitize_text_field( $item['keyword'] ?? '' );
			$type    = 'product' === ( $item['job_type'] ?? '' ) ? 'product' : 'article';

			if ( '' === $topic ) {
				continue;
			}

			$scheduled_at = date( 'Y-m-d H:i:s', $start + ( $i * $step ) );

			$id = self::add_entry(
				array(
					'job_type'     => $type,
					'topic'        => $topic,
					'keyword'      => $keyword,
					'provider'     => $provider,
					'model'        => $model,
					'scheduled_at' => $scheduled_at,
					'auto_publish' => $auto_publish ? 1 : 0,
				)
			);

			$created[] = array( 'id' => $id, 'topic' => $topic, 'scheduled_at' => $scheduled_at );
		}

		VP_Logger::log( 'content_calendar', count( $created ) . " آیتم با برنامه‌ی هوشمند روزانه به تقویم اضافه شد.", 'info' );

		return array( 'count' => count( $created ), 'entries' => $created );
	}

	public function ajax_smart_plan() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		$brief = sanitize_textarea_field( $_POST['brief'] ?? '' );
		$date  = sanitize_text_field( $_POST['date'] ?? '' );
		$count = absint( $_POST['count'] ?? 5 );

		if ( empty( $brief ) || empty( $date ) ) {
			wp_send_json_error( array( 'message' => __( 'بریف و تاریخ الزامی است.', 'vp-suite' ) ) );
		}

		$provider = sanitize_key( $_POST['provider'] ?? VP_Settings::get( 'default_provider' ) );
		$model    = sanitize_text_field( $_POST['model'] ?? '' );
		$auto     = empty( $_POST['auto_publish'] ) ? 0 : 1;

		$result = self::generate_day_plan( $brief, $date, $count, $auto, $provider, $model );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}

		wp_send_json_success( $result );
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
