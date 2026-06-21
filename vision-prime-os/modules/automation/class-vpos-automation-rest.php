<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST surface for the Automation Engine (Master Spec §18).
 */
class VPOS_Automation_REST extends VPOS_REST_Controller {

	public function register_routes() {
		register_rest_route( self::NAMESPACE_, '/automations', array(
			array( 'methods' => 'GET', 'callback' => array( $this, 'list_rules' ), 'permission_callback' => $this->require_permission( 'automation:view' ) ),
			array( 'methods' => 'POST', 'callback' => array( $this, 'create_rule' ), 'permission_callback' => $this->require_permission( 'automation:manage' ) ),
		) );
		register_rest_route( self::NAMESPACE_, '/automations/(?P<id>\d+)', array(
			array( 'methods' => 'GET', 'callback' => array( $this, 'get_rule' ), 'permission_callback' => $this->require_permission( 'automation:view' ) ),
			array( 'methods' => 'PATCH', 'callback' => array( $this, 'update_rule' ), 'permission_callback' => $this->require_permission( 'automation:manage' ) ),
		) );
		register_rest_route( self::NAMESPACE_, '/automations/(?P<id>\d+)/runs', array(
			'methods' => 'GET', 'callback' => array( $this, 'get_runs' ), 'permission_callback' => $this->require_permission( 'automation:view' ),
		) );
	}

	public function list_rules( WP_REST_Request $request ) {
		$where = array();
		if ( $request->get_param( 'trigger_event' ) ) {
			$where['trigger_event'] = $request->get_param( 'trigger_event' );
		}
		$p      = $this->pagination_params( $request );
		$result = ( new VPOS_Automation_Repository() )->paginate( $where, $p['page'], $p['limit'] );
		return VPOS_Response::list( $result['items'], $result['page'], $result['limit'], $result['total'] );
	}

	public function create_rule( WP_REST_Request $request ) {
		$result = ( new VPOS_Automation_Repository() )->create_rule( $request->get_json_params() );
		if ( is_wp_error( $result ) ) {
			return VPOS_Response::wp_error_to_response( $result );
		}
		return VPOS_Response::created( ( new VPOS_Automation_Repository() )->find( $result ) );
	}

	public function get_rule( WP_REST_Request $request ) {
		$rule = ( new VPOS_Automation_Repository() )->find( (int) $request['id'] );
		if ( ! $rule ) {
			return VPOS_Response::error( VPOS_Response::ERROR_NOT_FOUND, 'Automation rule not found.' );
		}
		return VPOS_Response::ok( $rule );
	}

	public function update_rule( WP_REST_Request $request ) {
		$result = ( new VPOS_Automation_Repository() )->update_rule( (int) $request['id'], $request->get_json_params() );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::ok( $result );
	}

	public function get_runs( WP_REST_Request $request ) {
		$p      = $this->pagination_params( $request );
		$result = ( new VPOS_Automation_Repository() )->get_runs( (int) $request['id'], $p['page'], $p['limit'] );
		return VPOS_Response::list( $result['items'], $result['page'], $result['limit'], $result['total'] );
	}
}
