<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Contract every channel module must implement. Keeping this tiny means
 * adding a new platform is a drop-in class, never a change to core flow.
 */
abstract class VP_Channel_Base {

	abstract public function get_key();

	abstract public function get_label();

	/**
	 * @return array|WP_Error Normalized result, e.g. ['message_id'=>..,'reach'=>..]
	 */
	abstract public function send( $account, $message );

	/**
	 * @return array|WP_Error Engagement stats for the account (views, reactions, etc.)
	 */
	public function get_stats( $account ) {
		return array();
	}
}
