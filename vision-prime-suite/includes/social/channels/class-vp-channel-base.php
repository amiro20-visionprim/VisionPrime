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

	/**
	 * Describes the exact config fields this channel needs, so the admin UI
	 * can render one dedicated field per channel instead of a generic JSON
	 * config textarea. Each entry: ['key'=>.., 'label'=>.., 'type'=>'text'|'password', 'placeholder'=>..].
	 */
	public function get_required_fields() {
		return array();
	}

	/**
	 * Concise must/must-not guidance strings shown under this channel's
	 * connection form in the admin UI.
	 */
	public function get_notes() {
		return array();
	}

	/**
	 * Lightweight connectivity check, distinct from send() which dispatches a
	 * real message. Default implementation only verifies the required config
	 * fields are present; channels with a cheap "whoami"-style API call
	 * should override this with a real round-trip check.
	 *
	 * @return true|WP_Error
	 */
	public function test_connection( $account ) {
		$config = is_array( $account->config ) ? $account->config : json_decode( $account->config, true );
		$config = is_array( $config ) ? $config : array();

		foreach ( $this->get_required_fields() as $field ) {
			if ( empty( $config[ $field['key'] ] ) ) {
				return new WP_Error( 'vp_missing_field', sprintf( 'فیلد «%s» تنظیم نشده است.', $field['label'] ) );
			}
		}

		return true;
	}
}
