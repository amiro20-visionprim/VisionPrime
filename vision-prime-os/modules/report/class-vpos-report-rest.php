<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST surface for Reports (Master Spec §29) — every route is read-only,
 * gated by report:view.
 */
class VPOS_Report_REST extends VPOS_REST_Controller {

	public function register_routes() {
		register_rest_route( self::NAMESPACE_, '/reports/revenue', array(
			'methods' => 'GET', 'callback' => array( $this, 'revenue' ), 'permission_callback' => $this->require_permission( 'report:view' ),
		) );
		register_rest_route( self::NAMESPACE_, '/reports/customer-growth', array(
			'methods' => 'GET', 'callback' => array( $this, 'customer_growth' ), 'permission_callback' => $this->require_permission( 'report:view' ),
		) );
		register_rest_route( self::NAMESPACE_, '/reports/liabilities', array(
			'methods' => 'GET', 'callback' => array( $this, 'liabilities' ), 'permission_callback' => $this->require_permission( 'report:view' ),
		) );
		register_rest_route( self::NAMESPACE_, '/reports/campaigns/(?P<id>\d+)', array(
			'methods' => 'GET', 'callback' => array( $this, 'campaign_performance' ), 'permission_callback' => $this->require_permission( 'report:view' ),
		) );
		register_rest_route( self::NAMESPACE_, '/reports/top-customers', array(
			'methods' => 'GET', 'callback' => array( $this, 'top_customers' ), 'permission_callback' => $this->require_permission( 'report:view' ),
		) );
	}

	private function range( WP_REST_Request $request ) {
		return array( $request->get_param( 'from' ), $request->get_param( 'to' ) );
	}

	public function revenue( WP_REST_Request $request ) {
		list( $from, $to ) = $this->range( $request );
		return VPOS_Response::ok( ( new VPOS_Report_Repository() )->revenue_summary( $from, $to ) );
	}

	public function customer_growth( WP_REST_Request $request ) {
		list( $from, $to ) = $this->range( $request );
		return VPOS_Response::ok( ( new VPOS_Report_Repository() )->customer_growth( $from, $to ) );
	}

	public function liabilities() {
		$reports = new VPOS_Report_Repository();
		return VPOS_Response::ok( array( 'wallet' => $reports->wallet_liability(), 'loyalty' => $reports->loyalty_liability() ) );
	}

	public function campaign_performance( WP_REST_Request $request ) {
		return VPOS_Response::ok( ( new VPOS_Report_Repository() )->campaign_performance( (int) $request['id'] ) );
	}

	public function top_customers( WP_REST_Request $request ) {
		$limit = (int) $request->get_param( 'limit' ) ?: 10;
		return VPOS_Response::ok( ( new VPOS_Report_Repository() )->top_customers( $limit ) );
	}
}
