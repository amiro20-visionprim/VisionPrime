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

	const BULK_MAX_TITLES   = 2000;
	const BULK_BATCH_SIZE   = 5;

	public function __construct() {
		add_action( 'wp_ajax_vp_generate_content', array( $this, 'ajax_generate' ) );
		add_action( 'wp_ajax_vp_bulk_enqueue', array( $this, 'ajax_bulk_enqueue' ) );
		add_action( 'wp_ajax_vp_bulk_status', array( $this, 'ajax_bulk_status' ) );
		add_action( 'wp_ajax_vp_bulk_list', array( $this, 'ajax_bulk_list' ) );
		add_action( 'wp_ajax_vp_bulk_process_now', array( $this, 'ajax_bulk_process_now' ) );
		add_action( 'wp_ajax_vp_bulk_retry', array( $this, 'ajax_bulk_retry' ) );
		add_action( 'wp_ajax_vp_bulk_delete', array( $this, 'ajax_bulk_delete' ) );
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

		$brand_voice = VP_Settings::get( 'brand_voice' );
		if ( ! empty( $brand_voice ) ) {
			$system_prompt .= "\n\nلحن و هویت برند این سایت (حتما رعایت شود): " . $brand_voice;
		}

		$user_prompt = sprintf(
			"موضوع: %s\nکلمه‌ی کلیدی هدف: %s\nخروجی را در قالب HTML تمیز (بدون توضیح اضافه، فقط محتوای نهایی) بده.",
			$topic,
			$keyword ?: $topic
		);

		$messages = array(
			array( 'role' => 'system', 'content' => $system_prompt ),
			array( 'role' => 'user', 'content' => $user_prompt ),
		);

		$response = VP_Api_Manager::chat_with_fallback( 'content', $messages, $provider, $model );

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

	/**
	 * Accepts a newline-separated textarea of up to BULK_MAX_TITLES titles
	 * and queues each as a 'pending' row in vp_bulk_titles. Actual generation
	 * happens gradually via VP_Cron (small batches per tick) so a 2000-title
	 * paste never has to run synchronously inside one HTTP request.
	 */
	public function ajax_bulk_enqueue() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		$type     = sanitize_key( $_POST['content_type'] ?? 'article' );
		$provider = sanitize_key( $_POST['provider'] ?? VP_Settings::get( 'default_provider' ) );
		$model    = sanitize_text_field( $_POST['model'] ?? '' );
		$raw      = (string) ( $_POST['titles'] ?? '' );

		$lines = array_filter( array_map( 'trim', preg_split( '/\r\n|\r|\n/', $raw ) ) );
		$lines = array_values( array_unique( $lines ) );

		if ( empty( $lines ) ) {
			wp_send_json_error( array( 'message' => __( 'حداقل یک عنوان وارد کنید.', 'vp-suite' ) ) );
		}

		if ( count( $lines ) > self::BULK_MAX_TITLES ) {
			$lines = array_slice( $lines, 0, self::BULK_MAX_TITLES );
		}

		global $wpdb;
		$batch_id = 'b' . time() . wp_generate_password( 6, false );
		$now      = current_time( 'mysql' );

		foreach ( $lines as $title ) {
			$title = sanitize_text_field( $title );
			if ( '' === $title ) {
				continue;
			}
			$wpdb->insert(
				$wpdb->prefix . 'vp_bulk_titles',
				array(
					'batch_id'   => $batch_id,
					'job_type'   => $type,
					'title'      => $title,
					'provider'   => $provider,
					'model'      => $model,
					'status'     => 'pending',
					'created_at' => $now,
				)
			);
		}

		VP_Logger::log( 'content_generator', count( $lines ) . " عنوان به صف انبوه (بسته‌ی $batch_id) اضافه شد.", 'info' );

		// Process the first batch synchronously right away — relying purely
		// on WP-Cron's 5-minute tick leaves the queue looking inert on hosts
		// where cron only fires on real traffic, which is exactly what felt
		// "just for show". This also nudges WP-Cron for the rest.
		self::process_bulk_batch();
		if ( function_exists( 'spawn_cron' ) ) {
			spawn_cron();
		}

		wp_send_json_success( array( 'batch_id' => $batch_id, 'count' => count( $lines ) ) );
	}

	public function ajax_bulk_status() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		wp_send_json_success( self::bulk_summary() );
	}

	/**
	 * Per-item visibility into the queue (title, status, error), filterable
	 * by batch — this is what turns the queue from an opaque counter into
	 * something an operator can actually audit and act on.
	 */
	public function ajax_bulk_list() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		global $wpdb;
		$table   = $wpdb->prefix . 'vp_bulk_titles';
		$batch   = sanitize_text_field( $_POST['batch_id'] ?? '' );
		$status  = sanitize_key( $_POST['status'] ?? '' );
		$limit   = min( 200, max( 1, absint( $_POST['limit'] ?? 50 ) ) );

		$where  = array( '1=1' );
		$params = array();
		if ( $batch ) {
			$where[]  = 'batch_id = %s';
			$params[] = $batch;
		}
		if ( $status ) {
			$where[]  = 'status = %s';
			$params[] = $status;
		}

		$sql = "SELECT id, batch_id, job_type, title, status, job_id, error, created_at, processed_at FROM $table WHERE " . implode( ' AND ', $where ) . ' ORDER BY id DESC LIMIT %d';
		$params[] = $limit;

		$rows = $wpdb->get_results( $wpdb->prepare( $sql, $params ) );

		wp_send_json_success( array( 'rows' => $rows, 'summary' => self::bulk_summary() ) );
	}

	/**
	 * Lets an operator manually drain the queue instead of waiting for the
	 * next cron tick — runs several batches back-to-back within a sane time
	 * budget so even a large backlog visibly moves on demand.
	 */
	public function ajax_bulk_process_now() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		$processed = 0;
		$deadline  = time() + 20;
		do {
			$count      = self::process_bulk_batch();
			$processed += $count;
		} while ( $count > 0 && time() < $deadline );

		wp_send_json_success( array( 'processed' => $processed, 'summary' => self::bulk_summary() ) );
	}

	public function ajax_bulk_retry() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		global $wpdb;
		$wpdb->update(
			$wpdb->prefix . 'vp_bulk_titles',
			array( 'status' => 'pending', 'error' => null, 'processed_at' => null ),
			array( 'id' => absint( $_POST['id'] ?? 0 ) )
		);

		wp_send_json_success();
	}

	public function ajax_bulk_delete() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		global $wpdb;
		$wpdb->delete( $wpdb->prefix . 'vp_bulk_titles', array( 'id' => absint( $_POST['id'] ?? 0 ) ) );

		wp_send_json_success();
	}

	public static function bulk_summary() {
		global $wpdb;
		$table = $wpdb->prefix . 'vp_bulk_titles';
		$rows  = $wpdb->get_results( "SELECT status, COUNT(*) AS c FROM $table GROUP BY status", ARRAY_A );

		$summary = array( 'pending' => 0, 'done' => 0, 'failed' => 0 );
		foreach ( $rows as $row ) {
			$summary[ $row['status'] ] = (int) $row['c'];
		}
		return $summary;
	}

	/**
	 * Processes a small batch of pending bulk titles. Called from VP_Cron on
	 * its 5-minute tick so a 2000-title paste drains gradually instead of
	 * hammering the AI provider (and the request timeout) all at once.
	 *
	 * @return int Number of titles processed in this tick.
	 */
	public static function process_bulk_batch() {
		global $wpdb;
		$table = $wpdb->prefix . 'vp_bulk_titles';

		$rows = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM $table WHERE status = 'pending' ORDER BY id ASC LIMIT %d", self::BULK_BATCH_SIZE )
		);

		foreach ( $rows as $row ) {
			$result = self::generate( $row->job_type, $row->title, $row->keyword ?: $row->title, $row->provider ?: VP_Settings::get( 'default_provider' ), $row->model ?: '' );

			if ( is_wp_error( $result ) ) {
				$wpdb->update(
					$table,
					array( 'status' => 'failed', 'error' => $result->get_error_message(), 'processed_at' => current_time( 'mysql' ) ),
					array( 'id' => $row->id )
				);
				continue;
			}

			$wpdb->update(
				$table,
				array( 'status' => 'done', 'job_id' => $result['job_id'], 'processed_at' => current_time( 'mysql' ) ),
				array( 'id' => $row->id )
			);
		}

		return count( $rows );
	}
}
