<?php
/**
 * Required tests for Loyalty + Reward (Master Spec §32 "Loyalty" /
 * "Reward") and a basic Customer Club OTP login smoke test.
 */
class VPOS_Loyalty_Test extends WP_UnitTestCase {

	private function customer( $mobile ) {
		return ( new VPOS_Customer_Repository() )->create_customer( array( 'primary_mobile' => $mobile ) );
	}

	public function test_earning_points_increases_balance_and_lifetime() {
		$loyalty = new VPOS_Loyalty_Repository();
		$id      = $this->customer( '09140000001' );

		$loyalty->earn( $id, 50 );

		$this->assertEquals( 50, $loyalty->balance( $id ) );
		$this->assertEquals( 50, $loyalty->lifetime_points( $id ) );
	}

	public function test_spending_points_cannot_exceed_balance() {
		$loyalty = new VPOS_Loyalty_Repository();
		$id      = $this->customer( '09140000002' );
		$loyalty->earn( $id, 30 );

		$result = $loyalty->spend( $id, 100 );

		$this->assertWPError( $result );
		$this->assertSame( VPOS_Response::ERROR_BUSINESS, $result->get_error_code() );
	}

	public function test_spending_points_does_not_reduce_lifetime_tier_eligibility() {
		$loyalty = new VPOS_Loyalty_Repository();
		$id      = $this->customer( '09140000003' );
		$loyalty->create_tier( array( 'name' => 'Gold', 'min_points' => 100, 'multiplier' => 2 ) );
		$loyalty->earn( $id, 150 );

		$loyalty->spend( $id, 100 );

		$tier = $loyalty->current_tier( $id );
		$this->assertSame( 'Gold', $tier['name'] );
		$this->assertEquals( 50, $loyalty->balance( $id ) );
	}

	public function test_redeeming_reward_debits_points_and_decrements_stock() {
		$loyalty   = new VPOS_Loyalty_Repository();
		$rewards   = new VPOS_Reward_Repository();
		$id        = $this->customer( '09140000004' );
		$loyalty->earn( $id, 100 );
		$reward_id = $rewards->create_reward( array( 'name' => 'Sunglasses', 'points_cost' => 60, 'stock' => 2 ) );

		$redemption_id = $rewards->redeem( $id, $reward_id );

		$this->assertIsInt( $redemption_id );
		$this->assertEquals( 40, $loyalty->balance( $id ) );
		$reward = $rewards->find( $reward_id );
		$this->assertSame( 1, (int) $reward['stock'] );
	}

	public function test_redeeming_reward_fails_when_points_insufficient() {
		$rewards   = new VPOS_Reward_Repository();
		$id        = $this->customer( '09140000005' );
		$reward_id = $rewards->create_reward( array( 'name' => 'Frame', 'points_cost' => 500 ) );

		$result = $rewards->redeem( $id, $reward_id );

		$this->assertWPError( $result );
	}

	public function test_redeeming_out_of_stock_reward_is_rejected() {
		$loyalty   = new VPOS_Loyalty_Repository();
		$rewards   = new VPOS_Reward_Repository();
		$id        = $this->customer( '09140000006' );
		$loyalty->earn( $id, 1000 );
		$reward_id = $rewards->create_reward( array( 'name' => 'Limited', 'points_cost' => 10, 'stock' => 0 ) );

		$result = $rewards->redeem( $id, $reward_id );

		$this->assertWPError( $result );
		$this->assertSame( VPOS_Response::ERROR_BUSINESS, $result->get_error_code() );
	}

	public function test_completed_order_points_are_reversed_on_cancellation() {
		( new VPOS_Brand_Settings_Repository() )->update_settings( array( 'settings' => array( 'points_rate' => 1 ) ) );

		$customer_id = $this->customer( '09140000007' );
		$orders      = new VPOS_Order_Repository();
		$order_id    = $orders->create_order(
			array( 'customer_id' => $customer_id ),
			array( array( 'product_name' => 'Lens', 'quantity' => 1, 'unit_price' => 40 ) )
		);

		$orders->complete( $order_id );
		$loyalty = new VPOS_Loyalty_Repository();
		$this->assertEquals( 40, $loyalty->balance( $customer_id ) );

		$orders->cancel( $order_id );
		$this->assertEquals( 0, $loyalty->balance( $customer_id ) );

		( new VPOS_Brand_Settings_Repository() )->update_settings( array( 'settings' => array() ) );
	}

	public function test_club_otp_login_creates_customer_and_session() {
		$mobile = '09140000008';
		VPOS_Club_Session::request_otp( $mobile );
		$code = get_transient( 'vpos_club_otp_' . $mobile );

		$customer = VPOS_Club_Session::verify_otp( $mobile, $code );

		$this->assertIsArray( $customer );
		$this->assertSame( $mobile, $customer['primary_mobile'] );
		$this->assertSame( 'customer_club', $customer['source'] );
	}

	public function test_club_otp_rejects_wrong_code() {
		$mobile = '09140000009';
		VPOS_Club_Session::request_otp( $mobile );

		$result = VPOS_Club_Session::verify_otp( $mobile, '000000' );

		$this->assertWPError( $result );
	}
}
