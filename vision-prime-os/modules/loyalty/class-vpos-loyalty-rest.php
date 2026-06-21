<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST surface for Loyalty (points ledger + tiers) and Rewards (catalog +
 * redemption) — Master Spec §16-17. Combined into one controller since
 * Rewards always spends Loyalty points; kept thin, all rules live in the
 * repositories.
 */
class VPOS_Loyalty_REST extends VPOS_REST_Controller {

	public function register_routes() {
		register_rest_route( self::NAMESPACE_, '/customers/(?P<id>\d+)/loyalty', array(
			'methods' => 'GET', 'callback' => array( $this, 'get_loyalty' ), 'permission_callback' => $this->require_permission( 'loyalty:view' ),
		) );
		register_rest_route( self::NAMESPACE_, '/customers/(?P<id>\d+)/loyalty/earn', array(
			'methods' => 'POST', 'callback' => array( $this, 'earn' ), 'permission_callback' => $this->require_permission( 'loyalty:adjust' ),
		) );
		register_rest_route( self::NAMESPACE_, '/loyalty/tiers', array(
			array( 'methods' => 'GET', 'callback' => array( $this, 'list_tiers' ), 'permission_callback' => $this->require_permission( 'loyalty:view' ) ),
			array( 'methods' => 'POST', 'callback' => array( $this, 'create_tier' ), 'permission_callback' => $this->require_permission( 'loyalty:manage' ) ),
		) );

		register_rest_route( self::NAMESPACE_, '/rewards', array(
			array( 'methods' => 'GET', 'callback' => array( $this, 'list_rewards' ), 'permission_callback' => $this->require_permission( 'reward:view' ) ),
			array( 'methods' => 'POST', 'callback' => array( $this, 'create_reward' ), 'permission_callback' => $this->require_permission( 'reward:manage' ) ),
		) );
		register_rest_route( self::NAMESPACE_, '/rewards/(?P<id>\d+)', array(
			'methods' => 'PATCH', 'callback' => array( $this, 'update_reward' ), 'permission_callback' => $this->require_permission( 'reward:manage' ),
		) );
		register_rest_route( self::NAMESPACE_, '/customers/(?P<id>\d+)/rewards/redeem', array(
			'methods' => 'POST', 'callback' => array( $this, 'redeem' ), 'permission_callback' => $this->require_permission( 'reward:redeem' ),
		) );

		register_rest_route( self::NAMESPACE_, '/loyalty/entries/(?P<id>\d+)/reverse', array(
			'methods' => 'POST', 'callback' => array( $this, 'reverse' ), 'permission_callback' => $this->require_permission( 'loyalty:adjust' ),
		) );
	}

	/* ---------------- Loyalty ---------------- */

	public function get_loyalty( WP_REST_Request $request ) {
		$id      = (int) $request['id'];
		$repo    = new VPOS_Loyalty_Repository();
		$p       = $this->pagination_params( $request );
		$ledger  = $repo->get_ledger( $id, $p['page'], $p['limit'] );
		return VPOS_Response::ok( array(
			'balance'  => $repo->balance( $id ),
			'tier'     => $repo->current_tier( $id ),
			'entries'  => $ledger['items'],
			'page'     => $ledger['page'],
			'limit'    => $ledger['limit'],
			'total'    => $ledger['total'],
		) );
	}

	public function earn( WP_REST_Request $request ) {
		$body   = $request->get_json_params();
		$result = ( new VPOS_Loyalty_Repository() )->earn( (int) $request['id'], (float) ( $body['points'] ?? 0 ), 'manual', array( 'reason' => $body['reason'] ?? null ) );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::created( array( 'entry_id' => $result ) );
	}

	public function list_tiers( WP_REST_Request $request ) {
		return VPOS_Response::ok( ( new VPOS_Loyalty_Repository() )->list_tiers() );
	}

	public function create_tier( WP_REST_Request $request ) {
		$result = ( new VPOS_Loyalty_Repository() )->create_tier( $request->get_json_params() );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::created( array( 'id' => $result ) );
	}

	public function reverse( WP_REST_Request $request ) {
		$body   = $request->get_json_params();
		$result = ( new VPOS_Loyalty_Repository() )->reverse( (int) $request['id'], $body['reason'] ?? '' );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::created( array( 'entry_id' => $result ) );
	}

	/* ---------------- Rewards ---------------- */

	public function list_rewards( WP_REST_Request $request ) {
		$p      = $this->pagination_params( $request );
		$result = ( new VPOS_Reward_Repository() )->list_active( $p['page'], $p['limit'] );
		return VPOS_Response::list( $result['items'], $result['page'], $result['limit'], $result['total'] );
	}

	public function create_reward( WP_REST_Request $request ) {
		$result = ( new VPOS_Reward_Repository() )->create_reward( $request->get_json_params() );
		if ( is_wp_error( $result ) ) {
			return VPOS_Response::wp_error_to_response( $result );
		}
		return VPOS_Response::created( ( new VPOS_Reward_Repository() )->find( $result ) );
	}

	public function update_reward( WP_REST_Request $request ) {
		$result = ( new VPOS_Reward_Repository() )->update_reward( (int) $request['id'], $request->get_json_params() );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::ok( $result );
	}

	public function redeem( WP_REST_Request $request ) {
		$body   = $request->get_json_params();
		$result = ( new VPOS_Reward_Repository() )->redeem( (int) $request['id'], (int) ( $body['reward_id'] ?? 0 ) );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::created( array( 'redemption_id' => $result ) );
	}
}
