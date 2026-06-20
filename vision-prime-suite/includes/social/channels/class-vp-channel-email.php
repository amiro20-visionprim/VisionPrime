<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once VP_SUITE_DIR . 'includes/social/channels/class-vp-channel-base.php';

/**
 * Email broadcast channel using wp_mail (or an SMTP plugin already
 * configured on the site). config expects {"to":"list@..","subject":"..."}
 */
class VP_Channel_Email extends VP_Channel_Base {

	public function get_key() {
		return 'email';
	}

	public function get_label() {
		return 'ایمیل';
	}

	public function send( $account, $message ) {
		$config  = json_decode( $account->config, true );
		$to      = $config['to'] ?? '';
		$subject = $config['subject'] ?? __( 'به‌روزرسانی جدید از ویژن پرایم', 'vp-suite' );

		if ( empty( $to ) ) {
			return new WP_Error( 'vp_email_config', __( 'آدرس گیرنده تنظیم نشده است.', 'vp-suite' ) );
		}

		$sent = wp_mail( $to, $subject, wpautop( $message ), array( 'Content-Type: text/html; charset=UTF-8' ) );

		if ( ! $sent ) {
			return new WP_Error( 'vp_email_failed', __( 'ارسال ایمیل ناموفق بود.', 'vp-suite' ) );
		}

		return array( 'sent_to' => $to );
	}
}
