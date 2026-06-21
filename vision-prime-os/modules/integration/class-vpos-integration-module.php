<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Final consumer of the two hooks Phases 4 and 5 deferred: notification
 * dispatch (SMS/email/push) and Customer Club OTP delivery. Like Wallet/
 * Loyalty/Automation, this module is purely hook-based — Notification and
 * Club Session fire their hooks without knowing Integrations exists.
 */
class VPOS_Integration_Module {

	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_rest' ) );
		add_action( 'vpos_admin_menu', array( $this, 'register_admin_menu' ) );
		add_action( 'vpos_notification_dispatch', array( $this, 'on_notification_dispatch' ), 10, 2 );
		add_action( 'vpos_club_otp_generated', array( $this, 'on_otp_generated' ), 10, 2 );
	}

	public function register_rest() {
		( new VPOS_Integration_REST() )->register_routes();
	}

	public function on_notification_dispatch( $id, array $notification ) {
		$result = ( new VPOS_Integration_Repository() )->deliver(
			$notification['channel'],
			(string) $notification['customer_id'],
			array( 'title' => $notification['title'], 'body' => $notification['body'] )
		);
		$notifications = new VPOS_Notification_Repository();
		if ( is_wp_error( $result ) ) {
			$notifications->mark_failed( $id, $result->get_error_message() );
		} else {
			$notifications->mark_sent( $id );
		}
	}

	public function on_otp_generated( $mobile, $code ) {
		( new VPOS_Integration_Repository() )->deliver( 'sms', $mobile, array( 'code' => $code ) );
	}

	public function register_admin_menu( $parent ) {
		add_submenu_page( $parent, __( 'Integration Logs', 'vpos' ), __( 'Integration Logs', 'vpos' ), 'read', 'vpos-integration-logs', array( $this, 'render_logs' ) );
	}

	public function render_logs() {
		$page   = max( 1, (int) ( $_GET['paged'] ?? 1 ) );
		$result = ( new VPOS_Integration_Repository() )->paginate( array(), $page, 20 );
		include VPOS_DIR . 'modules/integration/views/logs.php';
	}
}
