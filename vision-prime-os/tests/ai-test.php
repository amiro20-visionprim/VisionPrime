<?php
/**
 * Required tests for the AI Intelligence Layer (Master Spec §33).
 */
class VPOS_Ai_Test extends WP_UnitTestCase {

	private function customer( $mobile, array $extra = array() ) {
		return ( new VPOS_Customer_Repository() )->create_customer( array_merge( array( 'primary_mobile' => $mobile ), $extra ) );
	}

	public function test_churn_risk_is_suggested_for_an_inactive_customer() {
		$customer_id = $this->customer( '09190000001' );
		( new VPOS_Customer_Repository() )->update_customer( $customer_id, array( 'last_purchase_at' => gmdate( 'Y-m-d H:i:s', time() - 120 * DAY_IN_SECONDS ) ) );

		( new VPOS_Ai_Repository() )->generate_churn_risk_insights();

		$insights = ( new VPOS_Ai_Repository() )->paginate( array( 'customer_id' => $customer_id ) );
		$this->assertCount( 1, $insights['items'] );
		$this->assertSame( 'suggested', $insights['items'][0]['status'] );
	}

	public function test_churn_risk_is_not_suggested_twice_while_one_is_open() {
		$customer_id = $this->customer( '09190000002' );
		( new VPOS_Customer_Repository() )->update_customer( $customer_id, array( 'last_purchase_at' => gmdate( 'Y-m-d H:i:s', time() - 120 * DAY_IN_SECONDS ) ) );

		$ai = new VPOS_Ai_Repository();
		$ai->generate_churn_risk_insights();
		$ai->generate_churn_risk_insights();

		$insights = $ai->paginate( array( 'customer_id' => $customer_id ) );
		$this->assertCount( 1, $insights['items'] );
	}

	public function test_approving_an_insight_executes_its_non_financial_action() {
		$customer_id = $this->customer( '09190000003' );
		( new VPOS_Customer_Repository() )->update_customer( $customer_id, array( 'last_purchase_at' => gmdate( 'Y-m-d H:i:s', time() - 120 * DAY_IN_SECONDS ) ) );

		$ai = new VPOS_Ai_Repository();
		$ai->generate_churn_risk_insights();
		$insight = $ai->paginate( array( 'customer_id' => $customer_id ) )['items'][0];

		$result = $ai->approve( $insight['id'], 1 );

		$this->assertTrue( $result );
		$this->assertSame( 'approved', $ai->find( $insight['id'] )['status'] );
		$notifications = ( new VPOS_Notification_Repository() )->get_for_customer( $customer_id );
		$this->assertNotEmpty( $notifications['items'] );
	}

	public function test_rejecting_an_insight_takes_no_action() {
		$customer_id = $this->customer( '09190000004' );
		( new VPOS_Customer_Repository() )->update_customer( $customer_id, array( 'last_purchase_at' => gmdate( 'Y-m-d H:i:s', time() - 120 * DAY_IN_SECONDS ) ) );

		$ai = new VPOS_Ai_Repository();
		$ai->generate_churn_risk_insights();
		$insight = $ai->paginate( array( 'customer_id' => $customer_id ) )['items'][0];

		$ai->reject( $insight['id'], 1 );

		$this->assertSame( 'rejected', $ai->find( $insight['id'] )['status'] );
		$notifications = ( new VPOS_Notification_Repository() )->get_for_customer( $customer_id );
		$this->assertEmpty( $notifications['items'] );
	}

	public function test_an_already_reviewed_insight_cannot_be_approved_again() {
		$customer_id = $this->customer( '09190000005' );
		( new VPOS_Customer_Repository() )->update_customer( $customer_id, array( 'last_purchase_at' => gmdate( 'Y-m-d H:i:s', time() - 120 * DAY_IN_SECONDS ) ) );

		$ai = new VPOS_Ai_Repository();
		$ai->generate_churn_risk_insights();
		$insight = $ai->paginate( array( 'customer_id' => $customer_id ) )['items'][0];
		$ai->approve( $insight['id'], 1 );

		$result = $ai->approve( $insight['id'], 1 );

		$this->assertWPError( $result );
	}

	public function test_unsupported_action_type_is_rejected_and_never_touches_balances() {
		$customer_id = $this->customer( '09190000006' );
		$ai          = new VPOS_Ai_Repository();
		$insight_id  = $this->insertRawInsight( $customer_id );

		$result = $ai->approve( $insight_id, 1 );

		$this->assertWPError( $result );
		$this->assertEquals( 0, ( new VPOS_Loyalty_Repository() )->balance( $customer_id ) );
		$this->assertEquals( 0, ( new VPOS_Wallet_Repository() )->balance( $customer_id ) );
	}

	private function insertRawInsight( $customer_id ) {
		global $wpdb;
		$table = VPOS_Migrator::table( 'vpos_ai_insights' );
		$now   = current_time( 'mysql', true );
		$wpdb->insert(
			$table,
			array(
				'type'             => 'churn_risk',
				'customer_id'      => $customer_id,
				'suggested_action' => wp_json_encode( array( 'type' => 'wallet_credit', 'params' => array( 'amount' => 100 ) ) ),
				'status'           => 'suggested',
				'created_at'       => $now,
				'updated_at'       => $now,
			)
		);
		return (int) $wpdb->insert_id;
	}
}
