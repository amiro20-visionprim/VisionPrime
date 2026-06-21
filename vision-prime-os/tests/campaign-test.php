<?php
/**
 * Required tests for Segments, Campaigns, and Notifications
 * (Master Spec §32 "Segments" / "Campaigns" / "Notifications").
 */
class VPOS_Campaign_Test extends WP_UnitTestCase {

	private function customer( $mobile, array $extra = array() ) {
		return ( new VPOS_Customer_Repository() )->create_customer( array_merge( array( 'primary_mobile' => $mobile ), $extra ) );
	}

	public function test_segment_resolves_customers_matching_rules() {
		$customers = new VPOS_Customer_Repository();
		$matching  = $this->customer( '09150000001' );
		$customers->update_customer( $matching, array( 'total_spent' => 500 ) );
		$not_matching = $this->customer( '09150000002' );
		$customers->update_customer( $not_matching, array( 'total_spent' => 10 ) );

		$segments   = new VPOS_Segment_Repository();
		$segment_id = $segments->create_segment( array( 'name' => 'Big Spenders', 'rules' => array( 'min_total_spent' => 100 ) ) );

		$ids = $segments->resolve_customer_ids( $segment_id );

		$this->assertContains( $matching, $ids );
		$this->assertNotContains( $not_matching, $ids );
	}

	public function test_segment_resolves_customers_matching_tags() {
		$customers = new VPOS_Customer_Repository();
		$tagged    = $this->customer( '09150000003' );
		$customers->add_tag( $tagged, 'vip' );
		$untagged = $this->customer( '09150000004' );

		$segments   = new VPOS_Segment_Repository();
		$segment_id = $segments->create_segment( array( 'name' => 'VIPs', 'rules' => array( 'tags' => array( 'vip' ) ) ) );

		$ids = $segments->resolve_customer_ids( $segment_id );

		$this->assertContains( $tagged, $ids );
		$this->assertNotContains( $untagged, $ids );
	}

	public function test_sending_a_campaign_queues_one_notification_per_segment_match() {
		$customers = new VPOS_Customer_Repository();
		$id        = $this->customer( '09150000005' );
		$customers->add_tag( $id, 'newsletter' );

		$segments   = new VPOS_Segment_Repository();
		$segment_id = $segments->create_segment( array( 'name' => 'Newsletter', 'rules' => array( 'tags' => array( 'newsletter' ) ) ) );

		$campaigns   = new VPOS_Campaign_Repository();
		$campaign_id = $campaigns->create_campaign( array( 'name' => 'Promo', 'segment_id' => $segment_id, 'message' => 'Hello!' ) );

		$campaign = $campaigns->send_now( $campaign_id );

		$this->assertSame( 'sent', $campaign['status'] );
		$this->assertEquals( 1, $campaign['recipient_count'] );
		$notifications = ( new VPOS_Notification_Repository() )->get_for_customer( $id, 1, 10 );
		$this->assertCount( 1, $notifications['items'] );
		$this->assertSame( 'Hello!', $notifications['items'][0]['body'] );
	}

	public function test_sending_an_already_sent_campaign_is_rejected() {
		$campaigns   = new VPOS_Campaign_Repository();
		$campaign_id = $campaigns->create_campaign( array( 'name' => 'Once', 'message' => 'Hi' ) );
		$campaigns->send_now( $campaign_id );

		$result = $campaigns->send_now( $campaign_id );

		$this->assertWPError( $result );
		$this->assertSame( VPOS_Response::ERROR_BUSINESS, $result->get_error_code() );
	}

	public function test_cancelling_a_draft_campaign_prevents_it_from_being_sent() {
		$campaigns   = new VPOS_Campaign_Repository();
		$campaign_id = $campaigns->create_campaign( array( 'name' => 'Dropped', 'message' => 'Hi' ) );

		$campaigns->cancel( $campaign_id );
		$result = $campaigns->send_now( $campaign_id );

		$this->assertWPError( $result );
	}

	public function test_scheduling_a_campaign_enqueues_a_background_job() {
		$campaigns   = new VPOS_Campaign_Repository();
		$campaign_id = $campaigns->create_campaign( array( 'name' => 'Later', 'message' => 'Hi' ) );

		$campaign = $campaigns->schedule( $campaign_id, time() + HOUR_IN_SECONDS );

		$this->assertSame( 'scheduled', $campaign['status'] );
		$this->assertNotEmpty( $campaign['scheduled_at'] );
	}

	public function test_marking_a_notification_read_is_scoped_to_its_owning_customer() {
		$notifications = new VPOS_Notification_Repository();
		$id            = $this->customer( '09150000006' );
		$other         = $this->customer( '09150000007' );
		$notification_id = $notifications->queue( $id, 'in_app', 'Hi', 'Body' );

		$notifications->mark_read( $notification_id, $other );
		$this->assertEquals( 1, $notifications->unread_count( $id ) );

		$notifications->mark_read( $notification_id, $id );
		$this->assertEquals( 0, $notifications->unread_count( $id ) );
	}

	public function test_customer_360_includes_notifications_section() {
		$id = $this->customer( '09150000008' );
		( new VPOS_Notification_Repository() )->queue( $id, 'in_app', 'Hi', 'Body' );

		$rest    = new VPOS_Customer_REST();
		$request = new WP_REST_Request( 'GET', '/visionprime/v1/customers/' . $id . '/360' );
		$request->set_url_params( array( 'id' => $id ) );
		$response = $rest->get_customer_360( $request );
		$data     = $response->get_data()['data'];

		$this->assertSame( 1, $data['notifications']['unread_count'] );
	}
}
