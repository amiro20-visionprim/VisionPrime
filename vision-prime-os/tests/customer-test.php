<?php
/**
 * Required tests for the Customer/Order module (Master Spec §32
 * "Customer" + "Order" minus wallet-specific ones, which land in Phase 3).
 */
class VPOS_Customer_Test extends WP_UnitTestCase {

	public function test_duplicate_mobile_detection_is_rejected() {
		$customers = new VPOS_Customer_Repository();
		$first     = $customers->create_customer( array( 'primary_mobile' => '09120000001', 'first_name' => 'Ali' ) );
		$this->assertIsInt( $first );

		$second = $customers->create_customer( array( 'primary_mobile' => '09120000001', 'first_name' => 'Reza' ) );
		$this->assertWPError( $second );
		$this->assertSame( VPOS_Response::ERROR_CONFLICT, $second->get_error_code() );
	}

	public function test_cannot_create_customer_without_mobile() {
		$result = ( new VPOS_Customer_Repository() )->create_customer( array() );
		$this->assertWPError( $result );
		$this->assertSame( VPOS_Response::ERROR_VALIDATION, $result->get_error_code() );
	}

	public function test_duplicate_detection_is_brand_scoped() {
		if ( ! is_multisite() ) {
			$this->markTestSkipped( 'Requires Multisite.' );
		}
		$org_id  = ( new VPOS_Organization_Repository() )->create( array( 'name' => 'Org Cust' ) );
		$brands  = new VPOS_Brand_Repository();
		$brand_1 = $brands->find( $brands->create_brand( $org_id, array( 'name' => 'Brand X1', 'slug' => 'brand-x1' ) ) );
		$brand_2 = $brands->find( $brands->create_brand( $org_id, array( 'name' => 'Brand X2', 'slug' => 'brand-x2' ) ) );

		switch_to_blog( $brand_1['blog_id'] );
		$first = ( new VPOS_Customer_Repository() )->create_customer( array( 'primary_mobile' => '09120000002' ) );
		restore_current_blog();

		switch_to_blog( $brand_2['blog_id'] );
		$second = ( new VPOS_Customer_Repository() )->create_customer( array( 'primary_mobile' => '09120000002' ) );
		restore_current_blog();

		$this->assertIsInt( $first );
		$this->assertIsInt( $second );
	}

	public function test_customer_merge_writes_merge_log_and_sums_metrics() {
		$customers  = new VPOS_Customer_Repository();
		$primary_id = $customers->create_customer( array( 'primary_mobile' => '09120000003' ) );
		$merged_id  = $customers->create_customer( array( 'primary_mobile' => '09120000004' ) );
		$customers->update_customer( $primary_id, array( 'purchase_count' => 2, 'total_spent' => 100 ) );
		$customers->update_customer( $merged_id, array( 'purchase_count' => 3, 'total_spent' => 50 ) );

		$result = $customers->merge( $primary_id, $merged_id );

		$this->assertSame( 5, (int) $result['purchase_count'] );
		$this->assertEquals( 150, (float) $result['total_spent'] );

		global $wpdb;
		$table = VPOS_Migrator::table( 'vpos_customer_merge_logs' );
		$log   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE primary_customer_id = %d AND merged_customer_id = %d", $primary_id, $merged_id ), ARRAY_A );
		$this->assertNotNull( $log );

		$merged = $customers->find( $merged_id );
		$this->assertNotEmpty( $merged['deleted_at'] );
	}

	public function test_creating_order_requires_existing_customer() {
		$result = ( new VPOS_Order_Repository() )->create_order( array( 'customer_id' => 999999 ) );
		$this->assertWPError( $result );
		$this->assertSame( VPOS_Response::ERROR_NOT_FOUND, $result->get_error_code() );
	}

	public function test_completed_order_updates_customer_metrics() {
		$customers   = new VPOS_Customer_Repository();
		$customer_id = $customers->create_customer( array( 'primary_mobile' => '09120000005' ) );
		$orders      = new VPOS_Order_Repository();
		$order_id    = $orders->create_order(
			array( 'customer_id' => $customer_id ),
			array( array( 'product_name' => 'Frame', 'quantity' => 2, 'unit_price' => 50 ) )
		);

		$orders->complete( $order_id );

		$customer = $customers->find( $customer_id );
		$this->assertSame( 1, (int) $customer['purchase_count'] );
		$this->assertEquals( 100, (float) $customer['total_spent'] );
		$this->assertSame( 'active', $customer['status'] );
	}

	public function test_cancelling_completed_order_reverses_customer_metrics() {
		$customers   = new VPOS_Customer_Repository();
		$customer_id = $customers->create_customer( array( 'primary_mobile' => '09120000006' ) );
		$orders      = new VPOS_Order_Repository();
		$order_id    = $orders->create_order(
			array( 'customer_id' => $customer_id ),
			array( array( 'product_name' => 'Lens', 'quantity' => 1, 'unit_price' => 80 ) )
		);
		$orders->complete( $order_id );

		$orders->cancel( $order_id );

		$customer = $customers->find( $customer_id );
		$this->assertSame( 0, (int) $customer['purchase_count'] );
		$this->assertEquals( 0, (float) $customer['total_spent'] );
	}

	public function test_customer_360_aggregates_notes_tags_and_orders() {
		$customers   = new VPOS_Customer_Repository();
		$customer_id = $customers->create_customer( array( 'primary_mobile' => '09120000007' ) );
		$customers->add_note( $customer_id, 'VIP candidate' );
		$customers->add_tag( $customer_id, 'vip' );
		( new VPOS_Order_Repository() )->create_order( array( 'customer_id' => $customer_id ), array() );

		$rest     = new VPOS_Customer_REST();
		$request  = new WP_REST_Request( 'GET', '/visionprime/v1/customers/' . $customer_id . '/360' );
		$request->set_url_params( array( 'id' => $customer_id ) );
		$response = $rest->get_customer_360( $request );
		$data     = $response->get_data()['data'];

		$this->assertCount( 1, $data['notes'] );
		$this->assertContains( 'vip', $data['tags'] );
		$this->assertCount( 1, $data['orders'] );
	}
}
