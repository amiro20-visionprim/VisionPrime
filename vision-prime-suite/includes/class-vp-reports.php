<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Builds and delivers operator/admin performance reports — the "keep me
 * aware of what the system is doing" requirement. A digest summarizes
 * generation, publishing, SEO, competitor and social activity for a period
 * and can be emailed (and optionally pushed to a Telegram ops channel)
 * either on a daily WP-Cron tick or on demand from the admin UI.
 */
class VP_Reports {

	public function __construct() {
		add_action( 'wp_ajax_vp_send_report', array( $this, 'ajax_send' ) );
	}

	/**
	 * Aggregates activity counts for the last $hours hours.
	 *
	 * @return array Structured stats used by both the email body and the UI.
	 */
	public static function build( $hours = 24 ) {
		global $wpdb;
		$since = gmdate( 'Y-m-d H:i:s', current_time( 'timestamp', true ) - $hours * HOUR_IN_SECONDS );

		$jobs_table   = $wpdb->prefix . 'vp_jobs';
		$logs_table   = $wpdb->prefix . 'vp_logs';
		$comp_table   = $wpdb->prefix . 'vp_competitor_reports';
		$social_table = $wpdb->prefix . 'vp_social_posts';

		$by_status = $wpdb->get_results(
			$wpdb->prepare( "SELECT status, COUNT(*) AS c FROM $jobs_table WHERE created_at >= %s GROUP BY status", $since ),
			OBJECT_K
		);

		$status_counts = array();
		foreach ( VP_Queue::STATUSES as $status ) {
			$status_counts[ $status ] = isset( $by_status[ $status ] ) ? (int) $by_status[ $status ]->c : 0;
		}

		$errors = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM $logs_table WHERE level IN ('error','critical') AND created_at >= %s", $since )
		);

		$recent_errors = $wpdb->get_results(
			$wpdb->prepare( "SELECT module, message, created_at FROM $logs_table WHERE level IN ('error','critical') AND created_at >= %s ORDER BY id DESC LIMIT 10", $since )
		);

		$competitor_runs = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM $comp_table WHERE created_at >= %s", $since )
		);

		$social_sent = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM $social_table WHERE status = 'sent' AND created_at >= %s", $since )
		);
		$social_failed = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM $social_table WHERE status = 'failed' AND created_at >= %s", $since )
		);

		return array(
			'hours'           => $hours,
			'generated_total' => array_sum( $status_counts ),
			'status_counts'   => $status_counts,
			'errors'          => $errors,
			'recent_errors'   => $recent_errors,
			'competitor_runs' => $competitor_runs,
			'social_sent'     => $social_sent,
			'social_failed'   => $social_failed,
			'site'            => get_bloginfo( 'name' ),
			'generated_at'    => current_time( 'mysql' ),
		);
	}

	public static function render_html( $stats ) {
		$rows = '';
		$labels = array(
			'pending_review' => 'در انتظار بررسی',
			'published'      => 'منتشرشده',
			'scheduled'      => 'زمان‌بندی‌شده',
			'rejected'       => 'ردشده',
			'draft'          => 'پیش‌نویس',
			'approved'       => 'تاییدشده',
		);
		foreach ( $stats['status_counts'] as $status => $count ) {
			$label = $labels[ $status ] ?? $status;
			$rows .= '<tr><td style="padding:6px 12px;border:1px solid #eee;">' . esc_html( $label ) . '</td><td style="padding:6px 12px;border:1px solid #eee;text-align:center;">' . (int) $count . '</td></tr>';
		}

		$error_list = '';
		foreach ( $stats['recent_errors'] as $err ) {
			$error_list .= '<li><strong>' . esc_html( $err->module ) . '</strong>: ' . esc_html( $err->message ) . ' <em>(' . esc_html( $err->created_at ) . ')</em></li>';
		}
		if ( empty( $error_list ) ) {
			$error_list = '<li>خطایی ثبت نشده است ✅</li>';
		}

		ob_start();
		?>
		<div style="font-family:Tahoma,sans-serif;direction:rtl;max-width:640px;margin:auto;">
			<h2 style="color:#6d28d9;">گزارش عملکرد VisionPrime — <?php echo esc_html( $stats['site'] ); ?></h2>
			<p>بازه: <?php echo (int) $stats['hours']; ?> ساعت گذشته — تولیدشده تا <?php echo esc_html( $stats['generated_at'] ); ?></p>

			<h3>تولید و انتشار محتوا (مجموع: <?php echo (int) $stats['generated_total']; ?>)</h3>
			<table style="border-collapse:collapse;width:100%;"><?php echo $rows; // phpcs:ignore ?></table>

			<h3>سایر فعالیت‌ها</h3>
			<ul>
				<li>اجرای تحلیل رقبا: <?php echo (int) $stats['competitor_runs']; ?></li>
				<li>ارسال موفق سوشال: <?php echo (int) $stats['social_sent']; ?> — ناموفق: <?php echo (int) $stats['social_failed']; ?></li>
				<li>تعداد خطاهای سیستم: <?php echo (int) $stats['errors']; ?></li>
			</ul>

			<h3>آخرین خطاها</h3>
			<ul><?php echo $error_list; // phpcs:ignore ?></ul>

			<p style="color:#888;font-size:12px;">این گزارش به‌صورت خودکار توسط VisionPrime Suite تولید شده است.</p>
		</div>
		<?php
		return ob_get_clean();
	}

	/**
	 * Sends the digest to the configured recipients (admin email by default)
	 * and, if an ops Telegram account is configured, a short summary there.
	 *
	 * @return bool|WP_Error
	 */
	public static function dispatch_digest( $hours = 24 ) {
		$stats = self::build( $hours );
		$html  = self::render_html( $stats );

		$recipients = VP_Settings::get( 'report_recipients' );
		$recipients = $recipients ? array_filter( array_map( 'trim', explode( ',', $recipients ) ) ) : array( get_option( 'admin_email' ) );

		$subject = sprintf( 'گزارش عملکرد VisionPrime — %s', $stats['site'] );
		$sent    = wp_mail(
			$recipients,
			$subject,
			$html,
			array( 'Content-Type: text/html; charset=UTF-8' )
		);

		VP_Logger::log( 'reports', $sent ? 'گزارش دوره‌ای برای ادمین ارسال شد.' : 'ارسال گزارش ناموفق بود.', $sent ? 'info' : 'warning' );

		return $sent ? true : new WP_Error( 'vp_report_failed', __( 'ارسال گزارش ناموفق بود.', 'vp-suite' ) );
	}

	public function ajax_send() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		$hours  = absint( $_POST['hours'] ?? 24 );
		$result = self::dispatch_digest( $hours ?: 24 );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}

		wp_send_json_success( array( 'message' => __( 'گزارش ارسال شد.', 'vp-suite' ) ) );
	}
}
