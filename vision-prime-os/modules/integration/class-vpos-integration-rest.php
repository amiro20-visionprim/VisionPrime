<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST surface for Integration delivery logs (Master Spec §27), gated by
 * the same integration:manage permission used to configure providers.
 */
class VPOS_Integration_REST extends VPOS_REST_Controller {

	public function register_routes() {
		register_rest_route( self::NAMESPACE_, '/integrations/logs', array(
			'methods' => 'GET', 'callback' => array( $this, 'list_logs' ), 'permission_callback' => $this->require_permission( 'integration:manage' ),
		) );
	}

	public function list_logs( WP_REST_Request $request ) {
		$where = array();
		if ( $request->get_param( 'channel' ) ) {
			$where['channel'] = $request->get_param( 'channel' );
		}
		$p      = $this->pagination_params( $request );
		$result = ( new VPOS_Integration_Repository() )->paginate( $where, $p['page'], $p['limit'] );
		return VPOS_Response::list( $result['items'], $result['page'], $result['limit'], $result['total'] );
	}
}
