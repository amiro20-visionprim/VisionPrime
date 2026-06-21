<?php
/**
 * Required tests for the Tenant module (Master Spec §32 "Tenant" +
 * Part 01 §32 1-12 minus reward/order-specific ones).
 */
class VPOS_Tenant_Test extends WP_UnitTestCase {

	public function test_can_create_organization() {
		$id = ( new VPOS_Organization_Repository() )->create( array( 'name' => 'Prime Holding' ) );
		$this->assertIsInt( $id );
		$this->assertGreaterThan( 0, $id );
	}

	public function test_cannot_create_organization_without_name() {
		$result = ( new VPOS_Organization_Repository() )->create( array() );
		$this->assertWPError( $result );
		$this->assertSame( VPOS_Response::ERROR_VALIDATION, $result->get_error_code() );
	}

	public function test_cannot_create_brand_with_duplicate_slug() {
		$org_id = ( new VPOS_Organization_Repository() )->create( array( 'name' => 'Org A' ) );
		$brands = new VPOS_Brand_Repository();

		$first = $brands->create_brand( $org_id, array( 'name' => 'Brand A', 'slug' => 'brand-dup' ) );
		$this->assertIsInt( $first );

		$second = $brands->create_brand( $org_id, array( 'name' => 'Brand A2', 'slug' => 'brand-dup' ) );
		$this->assertWPError( $second );
		$this->assertSame( VPOS_Response::ERROR_CONFLICT, $second->get_error_code() );
	}

	public function test_creating_brand_automatically_creates_brand_settings() {
		$org_id = ( new VPOS_Organization_Repository() )->create( array( 'name' => 'Org B' ) );
		$brand_id = ( new VPOS_Brand_Repository() )->create_brand( $org_id, array( 'name' => 'Brand B', 'slug' => 'brand-b' ) );
		$brand    = ( new VPOS_Brand_Repository() )->find( $brand_id );

		switch_to_blog( $brand['blog_id'] );
		$settings = ( new VPOS_Brand_Settings_Repository() )->get_for_current_site();
		restore_current_blog();

		$this->assertNotEmpty( $settings );
		$this->assertSame( (string) $brand_id, (string) $settings['brand_id'] );
		$this->assertSame( 1, (int) $settings['wallet_enabled'] );
	}

	public function test_cannot_create_duplicate_branch_code_inside_same_brand() {
		$branches = new VPOS_Branch_Repository();
		$first    = $branches->create_branch( array( 'name' => 'Valiasr', 'code' => 'VAL' ) );
		$this->assertIsInt( $first );

		$second = $branches->create_branch( array( 'name' => 'Valiasr 2', 'code' => 'VAL' ) );
		$this->assertWPError( $second );
		$this->assertSame( VPOS_Response::ERROR_CONFLICT, $second->get_error_code() );
	}

	public function test_soft_delete_branch_does_not_remove_it_physically() {
		$branches  = new VPOS_Branch_Repository();
		$branch_id = $branches->create_branch( array( 'name' => 'Archivable', 'code' => 'ARCH' ) );

		$branches->archive( $branch_id );

		global $wpdb;
		$table = VPOS_Migrator::table( 'vpos_branches' );
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $branch_id ), ARRAY_A );

		$this->assertNotNull( $row );
		$this->assertSame( 'archived', $row['status'] );
		$this->assertNotEmpty( $row['deleted_at'] );
	}

	public function test_archived_branch_does_not_appear_in_active_list_by_default() {
		$branches  = new VPOS_Branch_Repository();
		$branch_id = $branches->create_branch( array( 'name' => 'Hidden', 'code' => 'HID' ) );
		$branches->archive( $branch_id );

		$result = $branches->paginate_active();
		$ids    = wp_list_pluck( $result['items'], 'id' );

		$this->assertNotContains( (string) $branch_id, array_map( 'strval', $ids ) );
	}

	public function test_suspended_brand_blocks_operational_actions() {
		$this->assertFalse( VPOS_Brand_Repository::is_operational( array( 'status' => 'suspended' ) ) );
		$this->assertTrue( VPOS_Brand_Repository::is_operational( array( 'status' => 'active' ) ) );
	}

	public function test_can_create_same_branch_code_under_different_brands() {
		if ( ! is_multisite() ) {
			$this->markTestSkipped( 'Requires Multisite.' );
		}
		$org_id  = ( new VPOS_Organization_Repository() )->create( array( 'name' => 'Org C' ) );
		$brands  = new VPOS_Brand_Repository();
		$brand_1 = $brands->find( $brands->create_brand( $org_id, array( 'name' => 'Brand C1', 'slug' => 'brand-c1' ) ) );
		$brand_2 = $brands->find( $brands->create_brand( $org_id, array( 'name' => 'Brand C2', 'slug' => 'brand-c2' ) ) );

		switch_to_blog( $brand_1['blog_id'] );
		$first = ( new VPOS_Branch_Repository() )->create_branch( array( 'name' => 'Main', 'code' => 'SHARED' ) );
		restore_current_blog();

		switch_to_blog( $brand_2['blog_id'] );
		$second = ( new VPOS_Branch_Repository() )->create_branch( array( 'name' => 'Main', 'code' => 'SHARED' ) );
		restore_current_blog();

		$this->assertIsInt( $first );
		$this->assertIsInt( $second );
	}

	public function test_brand_admin_cannot_access_another_brand() {
		if ( ! is_multisite() ) {
			$this->markTestSkipped( 'Requires Multisite.' );
		}
		$org_id  = ( new VPOS_Organization_Repository() )->create( array( 'name' => 'Org D' ) );
		$brands  = new VPOS_Brand_Repository();
		$brand_1 = $brands->find( $brands->create_brand( $org_id, array( 'name' => 'Brand D1', 'slug' => 'brand-d1' ) ) );
		$brand_2 = $brands->find( $brands->create_brand( $org_id, array( 'name' => 'Brand D2', 'slug' => 'brand-d2' ) ) );

		$admin_id = self::factory()->user->create( array( 'role' => 'vpos_brand_admin' ) );
		add_user_to_blog( $brand_1['blog_id'], $admin_id, 'vpos_brand_admin' );
		switch_to_blog( $brand_1['blog_id'] );
		wp_set_current_user( $admin_id );
		VPOS_Context::reset();

		$rest    = new VPOS_Tenant_REST();
		$request = new WP_REST_Request( 'GET', '/visionprime/v1/admin/brands/' . $brand_2['id'] );
		$request->set_url_params( array( 'id' => $brand_2['id'] ) );
		$response = $rest->get_brand( $request );

		restore_current_blog();
		VPOS_Context::reset();

		$this->assertSame( 403, $response->get_status() );
	}
}
