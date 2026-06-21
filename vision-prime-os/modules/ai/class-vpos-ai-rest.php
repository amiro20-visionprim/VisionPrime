<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST surface for AI Insights (Master Spec §33). Listing is ai:view;
 * approve/reject (the only state-changing actions, and only over the
 * non-financial vocabulary in VPOS_Ai_Repository::ACTIONS) require ai:manage.
 */
class VPOS_Ai_REST extends VPOS_REST_Controller {

	public function register_routes() {
		register_rest_route( self::NAMESPACE_, '/ai/insights', array(
			'methods' => 'GET', 'callback' => array( $this, 'list_insights' ), 'permission_callback' => $this->require_permission( 'ai:view' ),
		) );
		register_rest_route( self::NAMESPACE_, '/ai/insights/(?P<id>\d+)/approve', array(
			'methods' => 'POST', 'callback' => array( $this, 'approve' ), 'permission_callback' => $this->require_permission( 'ai:manage' ),
		) );
		register_rest_route( self::NAMESPACE_, '/ai/insights/(?P<id>\d+)/reject', array(
			'methods' => 'POST', 'callback' => array( $this, 'reject' ), 'permission_callback' => $this->require_permission( 'ai:manage' ),
		) );
	}

	public function list_insights( WP_REST_Request $request ) {
		$where = array();
		if ( $request->get_param( 'status' ) ) {
			$where['status'] = $request->get_param( 'status' );
		}
		$p      = $this->pagination_params( $request );
		$result = ( new VPOS_Ai_Repository() )->paginate( $where, $p['page'], $p['limit'] );
		return VPOS_Response::list( $result['items'], $result['page'], $result['limit'], $result['total'] );
	}

	public function approve( WP_REST_Request $request ) {
		$ctx    = VPOS_Context::resolve();
		$result = ( new VPOS_Ai_Repository() )->approve( (int) $request['id'], $ctx['user_id'] );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::ok( array( 'approved' => true ) );
	}

	public function reject( WP_REST_Request $request ) {
		$ctx    = VPOS_Context::resolve();
		$result = ( new VPOS_Ai_Repository() )->reject( (int) $request['id'], $ctx['user_id'] );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::ok( array( 'rejected' => true ) );
	}
}
