<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Nonce + WordPress-user-identity helpers shared by the admin and
 * customer AJAX handlers. Holds no secrets — the plugin API key/shared
 * secret live in VP_Settings and are only ever read by VP_Api_Client.
 */
class VP_Auth {

	const ADMIN_NONCE_ACTION    = 'vp_admin_ajax';
	const CUSTOMER_NONCE_ACTION = 'vp_customer_ajax';

	public function admin_nonce(): string {
		return wp_create_nonce( self::ADMIN_NONCE_ACTION );
	}

	public function customer_nonce(): string {
		return wp_create_nonce( self::CUSTOMER_NONCE_ACTION );
	}

	/**
	 * Verifies the nonce sent with an admin AJAX request and that the
	 * current user has the capability to manage the connector. Dies with
	 * a JSON error (never a raw PHP error) on failure.
	 */
	public function require_admin_ajax(): void {
		if ( ! isset( $_REQUEST['nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_REQUEST['nonce'] ) ), self::ADMIN_NONCE_ACTION ) ) {
			wp_send_json_error( array( 'message' => __( 'Your session has expired. Please reload the page and try again.', 'visionprime-connector' ) ), 403 );
		}

		if ( ! current_user_can( VP_Settings::CAPABILITY ) ) {
			wp_send_json_error( array( 'message' => __( 'You do not have permission to do that.', 'visionprime-connector' ) ), 403 );
		}
	}

	/**
	 * Verifies the nonce sent with a customer-facing AJAX request and
	 * that a customer is logged in. Dies with a JSON error on failure.
	 */
	public function require_customer_ajax(): void {
		if ( ! isset( $_REQUEST['nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_REQUEST['nonce'] ) ), self::CUSTOMER_NONCE_ACTION ) ) {
			wp_send_json_error( array( 'message' => __( 'Your session has expired. Please refresh the page and try again.', 'visionprime-connector' ) ), 403 );
		}

		if ( ! is_user_logged_in() ) {
			wp_send_json_error( array( 'message' => __( 'Please log in to view your account.', 'visionprime-connector' ) ), 401 );
		}
	}

	/**
	 * Identity headers describing the *currently logged-in* WordPress
	 * user, sent to the backend so it can map to (or provision) a
	 * VisionPrime customer record. Never includes the plugin API key or
	 * shared secret.
	 *
	 * @return array<string, string>
	 */
	public function current_user_identity_headers(): array {
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return array();
		}

		$user = get_userdata( $user_id );
		if ( ! $user ) {
			return array();
		}

		$headers = array(
			'X-VP-Wp-User-Id' => (string) $user_id,
		);

		if ( $user->user_email ) {
			$headers['X-VP-Wp-User-Email'] = $user->user_email;
		}

		$display_name = trim( $user->display_name );
		if ( '' !== $display_name ) {
			$headers['X-VP-Wp-User-Name'] = $display_name;
		}

		return $headers;
	}
}
