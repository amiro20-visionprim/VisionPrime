<?php
/**
 * Required tests for the Integration Hub (Master Spec §27).
 */
class VPOS_Integration_Test extends WP_UnitTestCase {

	public function test_delivery_without_a_registered_provider_is_logged_only() {
		$result = ( new VPOS_Integration_Repository() )->deliver( 'sms', '09180000001', array( 'body' => 'hello' ) );

		$this->assertTrue( $result );
		$logs = ( new VPOS_Integration_Repository() )->paginate( array( 'channel' => 'sms' ) );
		$this->assertSame( 'logged', $logs['items'][0]['status'] );
	}

	public function test_delivery_uses_a_registered_provider_when_present() {
		add_filter( 'vpos_integration_provider_email', function () {
			return function ( $payload ) {
				return true;
			};
		} );

		$result = ( new VPOS_Integration_Repository() )->deliver( 'email', 'a@b.com', array( 'body' => 'hi' ) );

		$this->assertTrue( $result );
		$logs = ( new VPOS_Integration_Repository() )->paginate( array( 'channel' => 'email' ) );
		$this->assertSame( 'sent', $logs['items'][0]['status'] );
	}

	public function test_notification_dispatch_hook_is_delivered_and_marked_sent() {
		$customer_id = ( new VPOS_Customer_Repository() )->create_customer( array( 'primary_mobile' => '09180000002' ) );
		$id          = ( new VPOS_Notification_Repository() )->queue( $customer_id, 'sms', 'Hi', 'Body' );

		$notification = ( new VPOS_Notification_Repository() )->find( $id );
		$this->assertSame( 'sent', $notification['status'] );
	}

	public function test_club_otp_generation_is_delivered_via_sms_channel() {
		VPOS_Club_Session::request_otp( '09180000003' );

		$logs = ( new VPOS_Integration_Repository() )->paginate( array( 'channel' => 'sms', 'recipient' => '09180000003' ) );
		$this->assertNotEmpty( $logs['items'] );
	}
}
