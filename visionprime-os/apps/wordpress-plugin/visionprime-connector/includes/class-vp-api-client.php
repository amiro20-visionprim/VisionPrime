<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Server-to-server HTTP client for the VisionPrime backend's plugin API
 * (`/api/wp-plugin/*`). This is the ONLY place the plugin API key and
 * shared secret are read and used — every request is signed with an
 * HMAC over `${method}:${path}:${timestamp}` (matching the backend's
 * verification in apps/api/src/modules/wp-plugin/wp-plugin.middleware.ts)
 * and carries the WordPress user's identity headers so the backend can
 * map to a VisionPrime customer. Runs entirely in PHP — never reachable
 * from, or exposed to, browser JavaScript.
 */
class VP_Api_Client {

	/** @var VP_Settings */
	private $settings;

	/** @var VP_Auth */
	private $auth;

	/** @var VP_Logger */
	private $logger;

	const CACHE_TTL_SECONDS = 30;
	const CACHE_KEY_REGISTRY_OPTION = 'visionprime_connector_cache_keys';

	public function __construct( VP_Settings $settings, VP_Auth $auth, VP_Logger $logger ) {
		$this->settings = $settings;
		$this->auth     = $auth;
		$this->logger   = $logger;
	}

	/**
	 * @param string               $path   e.g. '/customer/wallet' — relative to /api/wp-plugin.
	 * @param array<string, mixed> $identity_headers Optional override of the identity headers
	 *                                                (defaults to the currently logged-in WP user).
	 * @param bool                 $use_cache Short-lived (30s) per-user transient cache for repeat
	 *                                        tab loads within the same page session.
	 * @return array{ok: bool, status: int, body: mixed, message?: string}
	 */
	public function get( string $path, array $identity_headers = array(), bool $use_cache = true ) {
		$cache_key = $this->cache_key( $path );

		if ( $use_cache ) {
			$cached = get_transient( $cache_key );
			if ( false !== $cached ) {
				return $cached;
			}
		}

		$result = $this->request( 'GET', $path, null, $identity_headers );

		if ( $use_cache && $result['ok'] ) {
			set_transient( $cache_key, $result, self::CACHE_TTL_SECONDS );
			$this->remember_cache_key( $cache_key );
		}

		return $result;
	}

	private function cache_key( string $path ): string {
		return 'vp_cache_' . md5( get_current_user_id() . ':' . $path );
	}

	private function remember_cache_key( string $cache_key ): void {
		$keys = get_option( self::CACHE_KEY_REGISTRY_OPTION, array() );
		if ( ! in_array( $cache_key, $keys, true ) ) {
			$keys[] = $cache_key;
			update_option( self::CACHE_KEY_REGISTRY_OPTION, $keys, false );
		}
	}

	/**
	 * Clears every cached plugin-API response (used by the "Clear Cache"
	 * admin action). Affects only this plugin's transients.
	 */
	public function clear_cache(): void {
		$keys = get_option( self::CACHE_KEY_REGISTRY_OPTION, array() );
		foreach ( $keys as $key ) {
			delete_transient( $key );
		}
		delete_option( self::CACHE_KEY_REGISTRY_OPTION );
	}

	/**
	 * @param string               $path
	 * @param array<string, mixed> $body
	 * @param array<string, mixed> $identity_headers
	 * @return array{ok: bool, status: int, body: mixed, message?: string}
	 */
	public function post( string $path, array $body = array(), array $identity_headers = array() ) {
		return $this->request( 'POST', $path, $body, $identity_headers );
	}

	/**
	 * @return array{ok: bool, status: int, body: mixed, message?: string}
	 */
	private function request( string $method, string $path, ?array $body, array $identity_headers ) {
		if ( ! $this->settings->is_configured() ) {
			return array(
				'ok'      => false,
				'status'  => 0,
				'body'    => null,
				'message' => __( 'VisionPrime connection is not configured yet.', 'visionprime-connector' ),
			);
		}

		$base_url = untrailingslashit( $this->settings->get_api_url() );
		$url      = $base_url . '/api/wp-plugin' . $path;

		$timestamp = (string) round( microtime( true ) * 1000 );
		$signature = hash_hmac( 'sha256', $method . ':' . $path . ':' . $timestamp, $this->settings->get_shared_secret() );

		$headers = array_merge(
			array(
				'X-VP-Plugin-Api-Key' => $this->settings->get_plugin_api_key(),
				'X-VP-Timestamp'      => $timestamp,
				'X-VP-Signature'      => $signature,
				'Content-Type'        => 'application/json',
			),
			empty( $identity_headers ) ? $this->auth->current_user_identity_headers() : $identity_headers
		);

		$args = array(
			'method'  => $method,
			'headers' => $headers,
			'timeout' => 15,
		);
		if ( null !== $body ) {
			$args['body'] = wp_json_encode( $body );
		}

		$this->logger->debug( 'Plugin API request', array( 'method' => $method, 'path' => $path ) );

		$response = wp_remote_request( $url, $args );

		if ( is_wp_error( $response ) ) {
			$this->logger->error( 'Plugin API request failed', array( 'path' => $path, 'error' => $response->get_error_message() ) );
			return array(
				'ok'      => false,
				'status'  => 0,
				'body'    => null,
				'message' => __( 'Unable to reach VisionPrime right now. Please try again shortly.', 'visionprime-connector' ),
			);
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		$raw    = wp_remote_retrieve_body( $response );
		$parsed = json_decode( $raw, true );

		if ( $status < 200 || $status >= 300 ) {
			$this->logger->error( 'Plugin API request returned an error', array( 'path' => $path, 'status' => $status ) );
			return array(
				'ok'      => false,
				'status'  => $status,
				'body'    => $parsed,
				'code'    => $parsed['error']['code'] ?? null,
				// Validation/business-rule errors (400/404/409/422) already carry a
				// customer-safe message generated server-side (e.g. "That amount
				// exceeds your available wallet balance."); only unexpected/5xx
				// failures fall back to a generic masked message.
				'message' => $this->friendly_message_for_status( $status, $parsed['error']['message'] ?? null ),
			);
		}

		return array(
			'ok'     => true,
			'status' => $status,
			'body'   => $parsed['data'] ?? $parsed,
		);
	}

	private function friendly_message_for_status( int $status, ?string $business_message = null ): string {
		if ( 401 === $status || 403 === $status ) {
			return __( 'VisionPrime could not verify this request. Please contact support if this continues.', 'visionprime-connector' );
		}
		// 400/404/409/422 are business-rule outcomes (validation, insufficient
		// balance, expired/duplicate reservation, etc.) whose server-generated
		// message is already written for a customer audience.
		if ( in_array( $status, array( 400, 404, 409, 422 ), true ) && $business_message ) {
			return $business_message;
		}
		if ( 404 === $status ) {
			return __( 'That information is not available right now.', 'visionprime-connector' );
		}
		return __( 'Something went wrong loading your VisionPrime account data. Please try again.', 'visionprime-connector' );
	}
}
