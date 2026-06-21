<?php
/**
 * Required tests for the Automation Engine (Master Spec §32 "Automation").
 */
class VPOS_Automation_Test extends WP_UnitTestCase {

	private function customer( $mobile, array $extra = array() ) {
		return ( new VPOS_Customer_Repository() )->create_customer( array_merge( array( 'primary_mobile' => $mobile ), $extra ) );
	}

	public function test_customer_created_trigger_runs_add_tag_action() {
		$automations = new VPOS_Automation_Repository();
		$automations->create_rule(
			array(
				'name'          => 'Welcome Tag',
				'trigger_event' => 'customer_created',
				'actions'       => array( array( 'type' => 'add_tag', 'params' => array( 'tag' => 'new-customer' ) ) ),
			)
		);

		$id = $this->customer( '09160000001' );

		$this->assertContains( 'new-customer', ( new VPOS_Customer_Repository() )->get_tags( $id ) );
	}

	public function test_order_completed_trigger_runs_loyalty_earn_action() {
		$automations = new VPOS_Automation_Repository();
		$automations->create_rule(
			array(
				'name'          => 'Bonus Points',
				'trigger_event' => 'order_completed',
				'actions'       => array( array( 'type' => 'loyalty_earn', 'params' => array( 'points' => 25 ) ) ),
			)
		);

		$customer_id = $this->customer( '09160000002' );
		$order_id    = ( new VPOS_Order_Repository() )->create_order(
			array( 'customer_id' => $customer_id ),
			array( array( 'product_name' => 'Frame', 'quantity' => 1, 'unit_price' => 10 ) )
		);
		( new VPOS_Order_Repository() )->complete( $order_id );

		$this->assertEquals( 25, ( new VPOS_Loyalty_Repository() )->balance( $customer_id ) );
	}

	public function test_rule_with_unmet_conditions_does_not_run() {
		$automations = new VPOS_Automation_Repository();
		$automations->create_rule(
			array(
				'name'          => 'VIP Only',
				'trigger_event' => 'customer_created',
				'conditions'    => array( 'min_total_spent' => 1000 ),
				'actions'       => array( array( 'type' => 'add_tag', 'params' => array( 'tag' => 'vip-welcome' ) ) ),
			)
		);

		$id = $this->customer( '09160000003' );

		$this->assertNotContains( 'vip-welcome', ( new VPOS_Customer_Repository() )->get_tags( $id ) );
	}

	public function test_inactive_rule_does_not_run() {
		$automations = new VPOS_Automation_Repository();
		$rule_id     = $automations->create_rule(
			array(
				'name'          => 'Disabled',
				'trigger_event' => 'customer_created',
				'actions'       => array( array( 'type' => 'add_tag', 'params' => array( 'tag' => 'should-not-appear' ) ) ),
			)
		);
		$automations->update_rule( $rule_id, array( 'status' => 'inactive' ) );

		$id = $this->customer( '09160000004' );

		$this->assertNotContains( 'should-not-appear', ( new VPOS_Customer_Repository() )->get_tags( $id ) );
	}

	public function test_each_run_is_logged() {
		$automations = new VPOS_Automation_Repository();
		$rule_id     = $automations->create_rule(
			array(
				'name'          => 'Logged',
				'trigger_event' => 'customer_created',
				'actions'       => array( array( 'type' => 'add_tag', 'params' => array( 'tag' => 'logged' ) ) ),
			)
		);

		$id = $this->customer( '09160000005' );

		$runs = $automations->get_runs( $rule_id, 1, 10 );
		$this->assertCount( 1, $runs['items'] );
		$this->assertSame( 'success', $runs['items'][0]['status'] );
		$this->assertEquals( $id, $runs['items'][0]['customer_id'] );
	}

	public function test_unknown_action_type_is_logged_as_failed_without_blocking_other_rules() {
		$automations = new VPOS_Automation_Repository();
		$failing_id  = $automations->create_rule(
			array(
				'name'          => 'Broken',
				'trigger_event' => 'customer_created',
				'actions'       => array( array( 'type' => 'does_not_exist' ) ),
			)
		);
		$automations->create_rule(
			array(
				'name'          => 'Still Works',
				'trigger_event' => 'customer_created',
				'actions'       => array( array( 'type' => 'add_tag', 'params' => array( 'tag' => 'still-works' ) ) ),
			)
		);

		$id = $this->customer( '09160000006' );

		$this->assertContains( 'still-works', ( new VPOS_Customer_Repository() )->get_tags( $id ) );
		$runs = $automations->get_runs( $failing_id, 1, 10 );
		$this->assertSame( 'failed', $runs['items'][0]['status'] );
	}
}
