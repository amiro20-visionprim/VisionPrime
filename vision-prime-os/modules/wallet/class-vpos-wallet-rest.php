<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST surface for the Wallet Ledger Engine (Master Spec §15). Every
 * mutation goes through VPOS_Wallet_Repository so balances are always
 * derived from confirmed ledger entries, never written directly here.
 */
class VPOS_Wallet_REST extends VPOS_REST_Controller {

	public function register_routes() {
		register_rest_route( self::NAMESPACE_, '/customers/(?P<id>\d+)/wallet', array(
			'methods' => 'GET', 'callback' => array( $this, 'get_wallet' ), 'permission_callback' => $this->require_permission( 'wallet:view' ),
		) );
		register_rest_route( self::NAMESPACE_, '/customers/(?P<id>\d+)/wallet/credit', array(
			'methods' => 'POST', 'callback' => array( $this, 'credit' ), 'permission_callback' => $this->require_permission( 'wallet:credit' ),
		) );
		register_rest_route( self::NAMESPACE_, '/customers/(?P<id>\d+)/wallet/debit', array(
			'methods' => 'POST', 'callback' => array( $this, 'debit' ), 'permission_callback' => $this->require_permission( 'wallet:debit' ),
		) );
		register_rest_route( self::NAMESPACE_, '/wallet/entries/(?P<id>\d+)/reverse', array(
			'methods' => 'POST', 'callback' => array( $this, 'reverse' ), 'permission_callback' => $this->require_permission( 'wallet:reverse' ),
		) );
	}

	public function get_wallet( WP_REST_Request $request ) {
		$id      = (int) $request['id'];
		$repo    = new VPOS_Wallet_Repository();
		$p       = $this->pagination_params( $request );
		$ledger  = $repo->get_ledger( $id, $p['page'], $p['limit'] );
		return VPOS_Response::ok( array( 'balance' => $repo->balance( $id ), 'entries' => $ledger['items'], 'page' => $ledger['page'], 'limit' => $ledger['limit'], 'total' => $ledger['total'] ) );
	}

	public function credit( WP_REST_Request $request ) {
		$body   = $request->get_json_params();
		$result = ( new VPOS_Wallet_Repository() )->credit( (int) $request['id'], (float) ( $body['amount'] ?? 0 ), $body['transaction_type'] ?? 'manual', array( 'reason' => $body['reason'] ?? null ) );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::created( array( 'entry_id' => $result ) );
	}

	public function debit( WP_REST_Request $request ) {
		$body   = $request->get_json_params();
		$result = ( new VPOS_Wallet_Repository() )->debit( (int) $request['id'], (float) ( $body['amount'] ?? 0 ), $body['transaction_type'] ?? 'manual', array( 'reason' => $body['reason'] ?? null ) );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::created( array( 'entry_id' => $result ) );
	}

	public function reverse( WP_REST_Request $request ) {
		$body   = $request->get_json_params();
		$result = ( new VPOS_Wallet_Repository() )->reverse( (int) $request['id'], $body['reason'] ?? '' );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::created( array( 'entry_id' => $result ) );
	}
}
