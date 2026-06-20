<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Watches real, already-collected metrics (GSC clicks from rank snapshots,
 * system error rate, social send failures) for sudden drops/spikes and
 * fires an immediate email — separate from the daily digest, since a
 * traffic crash or a broken social integration shouldn't wait until the
 * next scheduled report to surface. Every comparison is against the
 * site's own recent history, not a hardcoded number.
 */
class VP_Anomaly_Alerts {

	const OPTION_LAST_ALERT = 'vp_anomaly_last_alert';

	public function __construct() {
		add_action( 'wp_ajax_vp_anomaly_check', array( $this, 'ajax_check' ) );
	}

	/**
	 * Runs the full set of anomaly checks and emails the operator if any
	 * fired. Cheap to call repeatedly — each check only queries already
	 * stored tables (no external API calls beyond what's already cached).
	 */
	public static function check_and_alert() {
		$alerts = array_merge(
			self::check_click_drop(),
			self::check_error_spike(),
			self::check_social_failures()
		);

		if ( empty( $alerts ) ) {
			return $alerts;
		}

		self::send_alert_email( $alerts );
		foreach ( $alerts as $alert ) {
			VP_Logger::log( 'anomaly', $alert['message'], 'warning' );
		}

		return $alerts;
	}

	/**
	 * Real GSC click totals: last 7 days vs the 7 days before that, from
	 * the same vp_rank_snapshots data the decay detector uses.
	 */
	private static function check_click_drop( $decline_ratio = 0.3 ) {
		if ( ! class_exists( 'VP_Search_Console' ) || ! VP_Search_Console::is_connected() ) {
			return array();
		}

		global $wpdb;
		$table = $wpdb->prefix . 'vp_rank_snapshots';

		$recent_start = gmdate( 'Y-m-d', time() - 7 * DAY_IN_SECONDS );
		$prior_start  = gmdate( 'Y-m-d', time() - 14 * DAY_IN_SECONDS );

		$recent = (int) $wpdb->get_var( $wpdb->prepare( "SELECT SUM(clicks) FROM $table WHERE snapshot_date >= %s", $recent_start ) );
		$prior  = (int) $wpdb->get_var( $wpdb->prepare( "SELECT SUM(clicks) FROM $table WHERE snapshot_date >= %s AND snapshot_date < %s", $prior_start, $recent_start ) );

		if ( $prior < 10 ) {
			return array();
		}

		$drop = ( $prior - $recent ) / $prior;
		if ( $drop >= $decline_ratio ) {
			return array(
				array(
					'type'    => 'click_drop',
					'message' => sprintf(
						'افت %s%% در کل کلیک‌های ارگانیک سایت طی ۷ روز گذشته (از %d به %d) نسبت به ۷ روز قبل از آن.',
						round( $drop * 100, 1 ),
						$prior,
						$recent
					),
				),
			);
		}

		return array();
	}

	/** System error rate: last 24h vs the prior 7-day daily average. */
	private static function check_error_spike( $spike_multiplier = 3 ) {
		global $wpdb;
		$table = $wpdb->prefix . 'vp_logs';

		$last_24h_start = gmdate( 'Y-m-d H:i:s', time() - DAY_IN_SECONDS );
		$baseline_start = gmdate( 'Y-m-d H:i:s', time() - 8 * DAY_IN_SECONDS );

		$recent = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM $table WHERE level IN ('error','critical') AND created_at >= %s", $last_24h_start )
		);
		$baseline_total = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM $table WHERE level IN ('error','critical') AND created_at >= %s AND created_at < %s", $baseline_start, $last_24h_start )
		);
		$baseline_daily_avg = $baseline_total / 7;

		if ( $baseline_daily_avg < 1 && $recent < 5 ) {
			return array();
		}

		if ( $recent >= max( 5, $baseline_daily_avg * $spike_multiplier ) ) {
			return array(
				array(
					'type'    => 'error_spike',
					'message' => sprintf(
						'افزایش غیرعادی خطاهای سیستم: %d خطا در ۲۴ ساعت گذشته در مقابل میانگین روزانه‌ی %s در هفته‌ی قبل.',
						$recent,
						round( $baseline_daily_avg, 1 )
					),
				),
			);
		}

		return array();
	}

	/** Social distribution failures in the last 24h — a broken token/permission usually shows up as a sudden run of failures. */
	private static function check_social_failures( $min_failures = 3 ) {
		global $wpdb;
		$table = $wpdb->prefix . 'vp_social_posts';
		$since = gmdate( 'Y-m-d H:i:s', time() - DAY_IN_SECONDS );

		$failed = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM $table WHERE status = 'failed' AND created_at >= %s", $since )
		);
		$sent = (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM $table WHERE status = 'sent' AND created_at >= %s", $since )
		);

		if ( $failed < $min_failures ) {
			return array();
		}
		if ( $sent > 0 && $failed / max( 1, $sent + $failed ) < 0.5 ) {
			return array();
		}

		return array(
			array(
				'type'    => 'social_failures',
				'message' => sprintf(
					'%d ارسال ناموفق به شبکه‌های اجتماعی در ۲۴ ساعت گذشته (موفق: %d) — اتصال یا توکن یکی از کانال‌ها را بررسی کنید.',
					$failed,
					$sent
				),
			),
		);
	}

	private static function send_alert_email( $alerts ) {
		$recipients = VP_Settings::get( 'report_recipients' );
		$recipients = $recipients ? array_filter( array_map( 'trim', explode( ',', $recipients ) ) ) : array( get_option( 'admin_email' ) );

		$lines = array_map(
			function ( $a ) {
				return '<li>' . esc_html( $a['message'] ) . '</li>';
			},
			$alerts
		);

		$html = sprintf(
			'<div style="font-family:Tahoma,sans-serif;direction:rtl;max-width:640px;margin:auto;"><h2 style="color:#b91c1c;">⚠️ هشدار ناهنجاری VisionPrime — %s</h2><ul>%s</ul></div>',
			esc_html( get_bloginfo( 'name' ) ),
			implode( '', $lines )
		);

		wp_mail(
			$recipients,
			sprintf( 'هشدار ناهنجاری VisionPrime — %s', get_bloginfo( 'name' ) ),
			$html,
			array( 'Content-Type: text/html; charset=UTF-8' )
		);
	}

	public function ajax_check() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}
		wp_send_json_success( self::check_and_alert() );
	}
}
