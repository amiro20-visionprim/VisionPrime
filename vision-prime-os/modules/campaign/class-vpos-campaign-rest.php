<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST surface for Segments, Campaigns, and per-customer Notifications
 * (Master Spec §16-17).
 */
class VPOS_Campaign_REST extends VPOS_REST_Controller {

	public function register_routes() {
		register_rest_route( self::NAMESPACE_, '/segments', array(
			array( 'methods' => 'GET', 'callback' => array( $this, 'list_segments' ), 'permission_callback' => $this->require_permission( 'segment:view' ) ),
			array( 'methods' => 'POST', 'callback' => array( $this, 'create_segment' ), 'permission_callback' => $this->require_permission( 'segment:manage' ) ),
		) );
		register_rest_route( self::NAMESPACE_, '/segments/(?P<id>\d+)', array(
			array( 'methods' => 'GET', 'callback' => array( $this, 'get_segment' ), 'permission_callback' => $this->require_permission( 'segment:view' ) ),
			array( 'methods' => 'PATCH', 'callback' => array( $this, 'update_segment' ), 'permission_callback' => $this->require_permission( 'segment:manage' ) ),
		) );
		register_rest_route( self::NAMESPACE_, '/segments/(?P<id>\d+)/customers', array(
			'methods' => 'GET', 'callback' => array( $this, 'get_segment_customers' ), 'permission_callback' => $this->require_permission( 'segment:view' ),
		) );

		register_rest_route( self::NAMESPACE_, '/campaigns', array(
			array( 'methods' => 'GET', 'callback' => array( $this, 'list_campaigns' ), 'permission_callback' => $this->require_permission( 'campaign:view' ) ),
			array( 'methods' => 'POST', 'callback' => array( $this, 'create_campaign' ), 'permission_callback' => $this->require_permission( 'campaign:manage' ) ),
		) );
		register_rest_route( self::NAMESPACE_, '/campaigns/(?P<id>\d+)', array(
			array( 'methods' => 'GET', 'callback' => array( $this, 'get_campaign' ), 'permission_callback' => $this->require_permission( 'campaign:view' ) ),
			array( 'methods' => 'PATCH', 'callback' => array( $this, 'update_campaign' ), 'permission_callback' => $this->require_permission( 'campaign:manage' ) ),
		) );
		register_rest_route( self::NAMESPACE_, '/campaigns/(?P<id>\d+)/schedule', array(
			'methods' => 'POST', 'callback' => array( $this, 'schedule_campaign' ), 'permission_callback' => $this->require_permission( 'campaign:manage' ),
		) );
		register_rest_route( self::NAMESPACE_, '/campaigns/(?P<id>\d+)/send', array(
			'methods' => 'POST', 'callback' => array( $this, 'send_campaign' ), 'permission_callback' => $this->require_permission( 'campaign:manage' ),
		) );
		register_rest_route( self::NAMESPACE_, '/campaigns/(?P<id>\d+)/cancel', array(
			'methods' => 'POST', 'callback' => array( $this, 'cancel_campaign' ), 'permission_callback' => $this->require_permission( 'campaign:manage' ),
		) );
		register_rest_route( self::NAMESPACE_, '/campaigns/(?P<id>\d+)/sends', array(
			'methods' => 'GET', 'callback' => array( $this, 'get_campaign_sends' ), 'permission_callback' => $this->require_permission( 'campaign:view' ),
		) );

		register_rest_route( self::NAMESPACE_, '/customers/(?P<id>\d+)/notifications', array(
			'methods' => 'GET', 'callback' => array( $this, 'get_customer_notifications' ), 'permission_callback' => $this->require_permission( 'customer:view' ),
		) );
		register_rest_route( self::NAMESPACE_, '/notifications/(?P<id>\d+)/read', array(
			'methods' => 'POST', 'callback' => array( $this, 'mark_notification_read' ), 'permission_callback' => $this->require_permission( 'customer:view' ),
		) );
	}

	/* ---------------- Segments ---------------- */

	public function list_segments( WP_REST_Request $request ) {
		$p      = $this->pagination_params( $request );
		$result = ( new VPOS_Segment_Repository() )->paginate( array(), $p['page'], $p['limit'] );
		return VPOS_Response::list( $result['items'], $result['page'], $result['limit'], $result['total'] );
	}

	public function create_segment( WP_REST_Request $request ) {
		$result = ( new VPOS_Segment_Repository() )->create_segment( $request->get_json_params() );
		if ( is_wp_error( $result ) ) {
			return VPOS_Response::wp_error_to_response( $result );
		}
		return VPOS_Response::created( ( new VPOS_Segment_Repository() )->find( $result ) );
	}

	public function get_segment( WP_REST_Request $request ) {
		$segment = ( new VPOS_Segment_Repository() )->find( (int) $request['id'] );
		if ( ! $segment ) {
			return VPOS_Response::error( VPOS_Response::ERROR_NOT_FOUND, 'Segment not found.' );
		}
		return VPOS_Response::ok( $segment );
	}

	public function update_segment( WP_REST_Request $request ) {
		$result = ( new VPOS_Segment_Repository() )->update_segment( (int) $request['id'], $request->get_json_params() );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::ok( $result );
	}

	public function get_segment_customers( WP_REST_Request $request ) {
		$ids = ( new VPOS_Segment_Repository() )->resolve_customer_ids( (int) $request['id'] );
		return VPOS_Response::ok( array( 'customer_ids' => $ids, 'count' => count( $ids ) ) );
	}

	/* ---------------- Campaigns ---------------- */

	public function list_campaigns( WP_REST_Request $request ) {
		$where = array();
		if ( $request->get_param( 'status' ) ) {
			$where['status'] = $request->get_param( 'status' );
		}
		$p      = $this->pagination_params( $request );
		$result = ( new VPOS_Campaign_Repository() )->paginate( $where, $p['page'], $p['limit'] );
		return VPOS_Response::list( $result['items'], $result['page'], $result['limit'], $result['total'] );
	}

	public function create_campaign( WP_REST_Request $request ) {
		$result = ( new VPOS_Campaign_Repository() )->create_campaign( $request->get_json_params() );
		if ( is_wp_error( $result ) ) {
			return VPOS_Response::wp_error_to_response( $result );
		}
		return VPOS_Response::created( ( new VPOS_Campaign_Repository() )->find( $result ) );
	}

	public function get_campaign( WP_REST_Request $request ) {
		$campaign = ( new VPOS_Campaign_Repository() )->find( (int) $request['id'] );
		if ( ! $campaign ) {
			return VPOS_Response::error( VPOS_Response::ERROR_NOT_FOUND, 'Campaign not found.' );
		}
		return VPOS_Response::ok( $campaign );
	}

	public function update_campaign( WP_REST_Request $request ) {
		$result = ( new VPOS_Campaign_Repository() )->update_campaign( (int) $request['id'], $request->get_json_params() );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::ok( $result );
	}

	public function schedule_campaign( WP_REST_Request $request ) {
		$body      = $request->get_json_params();
		$timestamp = isset( $body['scheduled_at'] ) ? strtotime( $body['scheduled_at'] ) : 0;
		if ( ! $timestamp ) {
			return VPOS_Response::error( VPOS_Response::ERROR_VALIDATION, 'scheduled_at is required.' );
		}
		$result = ( new VPOS_Campaign_Repository() )->schedule( (int) $request['id'], $timestamp );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::ok( $result );
	}

	public function send_campaign( WP_REST_Request $request ) {
		$result = ( new VPOS_Campaign_Repository() )->send_now( (int) $request['id'] );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::ok( $result );
	}

	public function cancel_campaign( WP_REST_Request $request ) {
		$result = ( new VPOS_Campaign_Repository() )->cancel( (int) $request['id'] );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::ok( $result );
	}

	public function get_campaign_sends( WP_REST_Request $request ) {
		$p      = $this->pagination_params( $request );
		$result = ( new VPOS_Campaign_Repository() )->get_sends( (int) $request['id'], $p['page'], $p['limit'] );
		return VPOS_Response::list( $result['items'], $result['page'], $result['limit'], $result['total'] );
	}

	/* ---------------- Notifications ---------------- */

	public function get_customer_notifications( WP_REST_Request $request ) {
		$p      = $this->pagination_params( $request );
		$result = ( new VPOS_Notification_Repository() )->get_for_customer( (int) $request['id'], $p['page'], $p['limit'] );
		return VPOS_Response::list( $result['items'], $result['page'], $result['limit'], $result['total'] );
	}

	public function mark_notification_read( WP_REST_Request $request ) {
		$body = $request->get_json_params();
		( new VPOS_Notification_Repository() )->mark_read( (int) $request['id'], (int) ( $body['customer_id'] ?? 0 ) );
		return VPOS_Response::ok( array( 'id' => (int) $request['id'] ) );
	}
}
