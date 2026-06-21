<?php
/**
 * Required tests for the Wallet Ledger Engine (Master Spec §32 "Wallet").
 * Every assertion here is ultimately checking the one non-negotiable
 * rule: balances are derived from confirmed ledger entries, never
 * mutated directly.
 */
class VPOS_Wallet_Test extends WP_UnitTestCase {

	private function customer( $mobile ) {
		return ( new VPOS_Customer_Repository() )->create_customer( array( 'primary_mobile' => $mobile ) );
	}

	public function test_credit_increases_balance() {
		$wallet = new VPOS_Wallet_Repository();
		$id     = $this->customer( '09130000001' );

		$wallet->credit( $id, 100, 'manual' );

		$this->assertEquals( 100, $wallet->balance( $id ) );
	}

	public function test_debit_cannot_exceed_balance() {
		$wallet = new VPOS_Wallet_Repository();
		$id     = $this->customer( '09130000002' );
		$wallet->credit( $id, 50 );

		$result = $wallet->debit( $id, 100 );

		$this->assertWPError( $result );
		$this->assertSame( VPOS_Response::ERROR_BUSINESS, $result->get_error_code() );
		$this->assertEquals( 50, $wallet->balance( $id ) );
	}

	public function test_reversal_writes_opposite_entry_instead_of_mutating() {
		$wallet   = new VPOS_Wallet_Repository();
		$id       = $this->customer( '09130000003' );
		$entry_id = $wallet->credit( $id, 80 );

		$wallet->reverse( $entry_id, 'mistake' );

		global $wpdb;
		$table = VPOS_Migrator::table( 'vpos_wallet_ledger' );
		$rows  = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table} WHERE account_id = %d", $id ), ARRAY_A );
		$this->assertCount( 2, $rows );
		$this->assertEquals( 0, $wallet->balance( $id ) );
	}

	public function test_reversing_an_already_reversed_entry_is_rejected() {
		$wallet   = new VPOS_Wallet_Repository();
		$id       = $this->customer( '09130000004' );
		$entry_id = $wallet->credit( $id, 20 );
		$reversal_id = $wallet->reverse( $entry_id, 'mistake' );

		$result = $wallet->reverse( $reversal_id, 'double mistake' );

		$this->assertIsInt( $reversal_id );
		$this->assertWPError( $result );
	}

	public function test_wallet_disabled_blocks_credit() {
		$settings = ( new VPOS_Brand_Settings_Repository() )->get_for_current_site();
		( new VPOS_Brand_Settings_Repository() )->update_settings( array( 'wallet_enabled' => 0 ) );

		$id     = $this->customer( '09130000005' );
		$result = ( new VPOS_Wallet_Repository() )->credit( $id, 10 );

		( new VPOS_Brand_Settings_Repository() )->update_settings( array( 'wallet_enabled' => 1 ) );

		$this->assertWPError( $result );
		$this->assertSame( VPOS_Response::ERROR_BUSINESS, $result->get_error_code() );
	}

	public function test_completed_order_cashback_is_reversed_on_cancellation() {
		( new VPOS_Brand_Settings_Repository() )->update_settings( array( 'settings' => array( 'cashback_rate' => 0.1 ) ) );

		$customer_id = $this->customer( '09130000006' );
		$orders      = new VPOS_Order_Repository();
		$order_id    = $orders->create_order(
			array( 'customer_id' => $customer_id ),
			array( array( 'product_name' => 'Frame', 'quantity' => 1, 'unit_price' => 200 ) )
		);

		$orders->complete( $order_id );
		$wallet = new VPOS_Wallet_Repository();
		$this->assertEquals( 20, $wallet->balance( $customer_id ) );

		$orders->cancel( $order_id );
		$this->assertEquals( 0, $wallet->balance( $customer_id ) );

		( new VPOS_Brand_Settings_Repository() )->update_settings( array( 'settings' => array() ) );
	}
}
