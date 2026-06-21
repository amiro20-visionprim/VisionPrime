<?php
/**
 * Required tests for Reports (Master Spec §29).
 */
class VPOS_Report_Test extends WP_UnitTestCase {

	private function customer( $mobile, array $extra = array() ) {
		return ( new VPOS_Customer_Repository() )->create_customer( array_merge( array( 'primary_mobile' => $mobile ), $extra ) );
	}

	public function test_revenue_summary_counts_only_completed_orders() {
		$customer_id = $this->customer( '09170000001' );
		$orders      = new VPOS_Order_Repository();
		$order_id    = $orders->create_order(
			array( 'customer_id' => $customer_id ),
			array( array( 'product_name' => 'Frame', 'quantity' => 1, 'unit_price' => 50 ) )
		);
		$orders->complete( $order_id );
		$orders->create_order(
			array( 'customer_id' => $customer_id ),
			array( array( 'product_name' => 'Lens', 'quantity' => 1, 'unit_price' => 200 ) )
		);

		$summary = ( new VPOS_Report_Repository() )->revenue_summary();

		$this->assertEquals( 1, $summary['order_count'] );
		$this->assertEquals( 50, $summary['revenue'] );
	}

	public function test_customer_growth_counts_new_customers() {
		$this->customer( '09170000002' );
		$this->customer( '09170000003' );

		$growth = ( new VPOS_Report_Repository() )->customer_growth();

		$this->assertGreaterThanOrEqual( 2, $growth['new_customers'] );
	}

	public function test_wallet_liability_reflects_confirmed_credits() {
		$customer_id = $this->customer( '09170000004' );
		( new VPOS_Wallet_Repository() )->credit( $customer_id, 30 );

		$this->assertEquals( 30, ( new VPOS_Report_Repository() )->wallet_liability() );
	}

	public function test_top_customers_orders_by_lifetime_value() {
		$low  = $this->customer( '09170000005' );
		$high = $this->customer( '09170000006' );
		( new VPOS_Customer_Repository() )->update_customer( $low, array( 'lifetime_value' => 10 ) );
		( new VPOS_Customer_Repository() )->update_customer( $high, array( 'lifetime_value' => 1000 ) );

		$top = ( new VPOS_Report_Repository() )->top_customers( 5 );

		$this->assertEquals( $high, $top[0]['id'] );
	}
}
