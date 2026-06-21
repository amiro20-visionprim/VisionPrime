<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST surface for Customer Data Platform + Customer 360 + Order Engine
 * (Master Spec §12-14). Everything here runs on the brand's own site —
 * no cross-site switching needed, unlike the Tenant module.
 */
class VPOS_Customer_REST extends VPOS_REST_Controller {

	public function register_routes() {
		register_rest_route( self::NAMESPACE_, '/customers', array(
			array( 'methods' => 'GET', 'callback' => array( $this, 'list_customers' ), 'permission_callback' => $this->require_permission( 'customer:view' ) ),
			array( 'methods' => 'POST', 'callback' => array( $this, 'create_customer' ), 'permission_callback' => $this->require_permission( 'customer:create' ) ),
		) );
		register_rest_route( self::NAMESPACE_, '/customers/(?P<id>\d+)', array(
			array( 'methods' => 'GET', 'callback' => array( $this, 'get_customer' ), 'permission_callback' => $this->require_permission( 'customer:view' ) ),
			array( 'methods' => 'PATCH', 'callback' => array( $this, 'update_customer' ), 'permission_callback' => $this->require_permission( 'customer:update' ) ),
		) );
		register_rest_route( self::NAMESPACE_, '/customers/(?P<id>\d+)/360', array(
			'methods' => 'GET', 'callback' => array( $this, 'get_customer_360' ), 'permission_callback' => $this->require_permission( 'customer:view' ),
		) );
		register_rest_route( self::NAMESPACE_, '/customers/(?P<id>\d+)/notes', array(
			array( 'methods' => 'GET', 'callback' => array( $this, 'get_notes' ), 'permission_callback' => $this->require_permission( 'customer:view' ) ),
			array( 'methods' => 'POST', 'callback' => array( $this, 'add_note' ), 'permission_callback' => $this->require_permission( 'customer:update' ) ),
		) );
		register_rest_route( self::NAMESPACE_, '/customers/(?P<id>\d+)/tags', array(
			array( 'methods' => 'GET', 'callback' => array( $this, 'get_tags' ), 'permission_callback' => $this->require_permission( 'customer:view' ) ),
			array( 'methods' => 'POST', 'callback' => array( $this, 'add_tag' ), 'permission_callback' => $this->require_permission( 'customer:update' ) ),
		) );
		register_rest_route( self::NAMESPACE_, '/customers/merge', array(
			'methods' => 'POST', 'callback' => array( $this, 'merge_customers' ), 'permission_callback' => $this->require_permission( 'customer:update' ),
		) );

		register_rest_route( self::NAMESPACE_, '/orders', array(
			array( 'methods' => 'GET', 'callback' => array( $this, 'list_orders' ), 'permission_callback' => $this->require_permission( 'order:view' ) ),
			array( 'methods' => 'POST', 'callback' => array( $this, 'create_order' ), 'permission_callback' => $this->require_permission( 'order:create' ) ),
		) );
		register_rest_route( self::NAMESPACE_, '/orders/(?P<id>\d+)', array(
			'methods' => 'GET', 'callback' => array( $this, 'get_order' ), 'permission_callback' => $this->require_permission( 'order:view' ),
		) );
		register_rest_route( self::NAMESPACE_, '/orders/(?P<id>\d+)/complete', array(
			'methods' => 'POST', 'callback' => array( $this, 'complete_order' ), 'permission_callback' => $this->require_permission( 'order:update' ),
		) );
		register_rest_route( self::NAMESPACE_, '/orders/(?P<id>\d+)/cancel', array(
			'methods' => 'POST', 'callback' => array( $this, 'cancel_order' ), 'permission_callback' => $this->require_permission( 'order:update' ),
		) );
	}

	/* ---------------- Customers ---------------- */

	public function list_customers( WP_REST_Request $request ) {
		$repo  = new VPOS_Customer_Repository();
		$where = array();
		if ( $request->get_param( 'status' ) ) {
			$where['status'] = $request->get_param( 'status' );
		}
		$p      = $this->pagination_params( $request );
		$result = $repo->paginate( $where, $p['page'], $p['limit'] );
		return VPOS_Response::list( $result['items'], $result['page'], $result['limit'], $result['total'] );
	}

	public function create_customer( WP_REST_Request $request ) {
		$result = ( new VPOS_Customer_Repository() )->create_customer( $request->get_json_params() );
		if ( is_wp_error( $result ) ) {
			return VPOS_Response::wp_error_to_response( $result );
		}
		return VPOS_Response::created( ( new VPOS_Customer_Repository() )->find( $result ) );
	}

	public function get_customer( WP_REST_Request $request ) {
		$customer = ( new VPOS_Customer_Repository() )->find( (int) $request['id'] );
		if ( ! $customer ) {
			return VPOS_Response::error( VPOS_Response::ERROR_NOT_FOUND, 'Customer not found.' );
		}
		return VPOS_Response::ok( $customer );
	}

	public function update_customer( WP_REST_Request $request ) {
		$result = ( new VPOS_Customer_Repository() )->update_customer( (int) $request['id'], $request->get_json_params() );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::ok( $result );
	}

	/** Customer 360 (Master Spec §13): a single read-only aggregate view, extensible via filter so later phases (Wallet/Loyalty) can add their own sections without touching this class. */
	public function get_customer_360( WP_REST_Request $request ) {
		$id       = (int) $request['id'];
		$customer = ( new VPOS_Customer_Repository() )->find( $id );
		if ( ! $customer ) {
			return VPOS_Response::error( VPOS_Response::ERROR_NOT_FOUND, 'Customer not found.' );
		}
		$customers = new VPOS_Customer_Repository();
		$orders    = ( new VPOS_Order_Repository() )->paginate( array( 'customer_id' => $id ), 1, 20 );
		$profile   = array(
			'customer' => $customer,
			'tags'     => $customers->get_tags( $id ),
			'notes'    => $customers->get_notes( $id ),
			'events'   => $customers->get_events( $id, 20 ),
			'orders'   => $orders['items'],
		);
		/** Lets Wallet/Loyalty/Reward phases add 'wallet', 'loyalty', 'rewards' sections later. */
		$profile = apply_filters( 'vpos_customer_360', $profile, $id );
		return VPOS_Response::ok( $profile );
	}

	public function get_notes( WP_REST_Request $request ) {
		return VPOS_Response::ok( ( new VPOS_Customer_Repository() )->get_notes( (int) $request['id'] ) );
	}

	public function add_note( WP_REST_Request $request ) {
		$body = $request->get_json_params();
		$id   = ( new VPOS_Customer_Repository() )->add_note( (int) $request['id'], $body['note'] ?? '' );
		return VPOS_Response::created( array( 'id' => $id ) );
	}

	public function get_tags( WP_REST_Request $request ) {
		return VPOS_Response::ok( ( new VPOS_Customer_Repository() )->get_tags( (int) $request['id'] ) );
	}

	public function add_tag( WP_REST_Request $request ) {
		$body = $request->get_json_params();
		$id   = ( new VPOS_Customer_Repository() )->add_tag( (int) $request['id'], $body['tag'] ?? '' );
		return VPOS_Response::created( array( 'id' => $id ) );
	}

	public function merge_customers( WP_REST_Request $request ) {
		$body   = $request->get_json_params();
		$result = ( new VPOS_Customer_Repository() )->merge( (int) ( $body['primary_id'] ?? 0 ), (int) ( $body['merged_id'] ?? 0 ) );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::ok( $result );
	}

	/* ---------------- Orders ---------------- */

	public function list_orders( WP_REST_Request $request ) {
		$where = array();
		if ( $request->get_param( 'customer_id' ) ) {
			$where['customer_id'] = $request->get_param( 'customer_id' );
		}
		if ( $request->get_param( 'status' ) ) {
			$where['status'] = $request->get_param( 'status' );
		}
		$p      = $this->pagination_params( $request );
		$result = ( new VPOS_Order_Repository() )->paginate( $where, $p['page'], $p['limit'] );
		return VPOS_Response::list( $result['items'], $result['page'], $result['limit'], $result['total'] );
	}

	public function create_order( WP_REST_Request $request ) {
		$body   = $request->get_json_params();
		$items  = $body['items'] ?? array();
		unset( $body['items'] );
		$result = ( new VPOS_Order_Repository() )->create_order( $body, $items );
		if ( is_wp_error( $result ) ) {
			return VPOS_Response::wp_error_to_response( $result );
		}
		$order          = ( new VPOS_Order_Repository() )->find( $result );
		$order['items'] = ( new VPOS_Order_Repository() )->get_items( $result );
		return VPOS_Response::created( $order );
	}

	public function get_order( WP_REST_Request $request ) {
		$repo  = new VPOS_Order_Repository();
		$order = $repo->find( (int) $request['id'] );
		if ( ! $order ) {
			return VPOS_Response::error( VPOS_Response::ERROR_NOT_FOUND, 'Order not found.' );
		}
		$order['items'] = $repo->get_items( $order['id'] );
		return VPOS_Response::ok( $order );
	}

	public function complete_order( WP_REST_Request $request ) {
		$result = ( new VPOS_Order_Repository() )->complete( (int) $request['id'] );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::ok( $result );
	}

	public function cancel_order( WP_REST_Request $request ) {
		$result = ( new VPOS_Order_Repository() )->cancel( (int) $request['id'] );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::ok( $result );
	}
}
