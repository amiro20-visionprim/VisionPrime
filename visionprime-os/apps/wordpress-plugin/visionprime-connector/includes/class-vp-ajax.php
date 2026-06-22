<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers every wp_ajax_* handler. Fully AJAX-based by design — no
 * plugin action ever causes a full page reload or form POST to
 * admin-post.php. Every handler:
 *
 * 1. Verifies a nonce (admin actions: 'vp_admin_ajax'; customer actions:
 *    'vp_customer_ajax') via VP_Auth — never bypassed.
 * 2. Checks current_user_can()/is_user_logged_in() as appropriate.
 * 3. Sanitizes any input, escapes any output baked into JSON strings
 *    that may be rendered as HTML by the client.
 * 4. Replies with wp_send_json_success()/wp_send_json_error() only — no
 *    raw backend error text ever reaches wp_send_json_error().
 */
class VP_Ajax {

	/** @var VP_Settings */
	private $settings;

	/** @var VP_Auth */
	private $auth;

	/** @var VP_Api_Client */
	private $api_client;

	/** @var VP_Logger */
	private $logger;

	/** @var VP_Webhooks */
	private $webhooks;

	public function __construct( VP_Settings $settings, VP_Auth $auth, VP_Api_Client $api_client, VP_Logger $logger, VP_Webhooks $webhooks ) {
		$this->settings   = $settings;
		$this->auth       = $auth;
		$this->api_client = $api_client;
		$this->logger     = $logger;
		$this->webhooks   = $webhooks;
	}

	public function register(): void {
		// Admin actions.
		add_action( 'wp_ajax_vp_test_connection', array( $this, 'handle_test_connection' ) );
		add_action( 'wp_ajax_vp_register_webhooks', array( $this, 'handle_register_webhooks' ) );
		add_action( 'wp_ajax_vp_sync_current_user', array( $this, 'handle_sync_current_user' ) );
		add_action( 'wp_ajax_vp_clear_cache', array( $this, 'handle_clear_cache' ) );
		add_action( 'wp_ajax_vp_send_test_event', array( $this, 'handle_send_test_event' ) );
		add_action( 'wp_ajax_vp_get_sync_status', array( $this, 'handle_get_sync_status' ) );

		// Customer actions — registered for logged-in users only; the
		// is_user_logged_in() check inside require_customer_ajax() is the
		// authoritative guard, this just avoids wiring a wp_ajax_nopriv_
		// handler for actions that should never run for guests.
		add_action( 'wp_ajax_vp_get_customer_dashboard', array( $this, 'handle_get_customer_dashboard' ) );
		add_action( 'wp_ajax_vp_get_wallet', array( $this, 'handle_get_wallet' ) );
		add_action( 'wp_ajax_vp_get_points', array( $this, 'handle_get_points' ) );
		add_action( 'wp_ajax_vp_get_rewards', array( $this, 'handle_get_rewards' ) );
		add_action( 'wp_ajax_vp_get_tier', array( $this, 'handle_get_tier' ) );
		add_action( 'wp_ajax_vp_refresh_account_data', array( $this, 'handle_refresh_account_data' ) );
	}

	/* ---------------------------------------------------------------- */
	/* Admin actions                                                     */
	/* ---------------------------------------------------------------- */

	public function handle_test_connection(): void {
		$this->auth->require_admin_ajax();

		$result = $this->api_client->get( '/customer/me', array(), false );
		if ( ! $result['ok'] ) {
			wp_send_json_error( array( 'message' => $result['message'] ?? __( 'Connection test failed.', 'visionprime-connector' ) ) );
		}

		wp_send_json_success( array( 'message' => __( 'Connection successful.', 'visionprime-connector' ) ) );
	}

	public function handle_register_webhooks(): void {
		$this->auth->require_admin_ajax();

		$result = $this->webhooks->register();
		if ( ! $result['ok'] ) {
			wp_send_json_error( array( 'message' => $result['message'] ?? __( 'Could not register webhooks.', 'visionprime-connector' ) ) );
		}

		wp_send_json_success( array( 'message' => __( 'Webhooks registered.', 'visionprime-connector' ) ) );
	}

	public function handle_sync_current_user(): void {
		$this->auth->require_admin_ajax();

		$result = $this->api_client->get( '/customer/me', array(), false );
		if ( ! $result['ok'] ) {
			wp_send_json_error( array( 'message' => $result['message'] ?? __( 'Sync failed.', 'visionprime-connector' ) ) );
		}

		wp_send_json_success(
			array(
				'message'  => __( 'Current user synced.', 'visionprime-connector' ),
				'customer' => $result['body'],
			)
		);
	}

	public function handle_clear_cache(): void {
		$this->auth->require_admin_ajax();

		$this->api_client->clear_cache();
		wp_send_json_success( array( 'message' => __( 'Cache cleared.', 'visionprime-connector' ) ) );
	}

	public function handle_send_test_event(): void {
		$this->auth->require_admin_ajax();

		$result = $this->api_client->post( '/customer/dashboard', array( 'test' => true ), array() );
		if ( ! $result['ok'] ) {
			// A test event hitting an unreachable backend is itself the
			// useful signal — report it as a (handled) failure, not a 500.
			wp_send_json_error( array( 'message' => $result['message'] ?? __( 'Test event failed.', 'visionprime-connector' ) ) );
		}

		wp_send_json_success( array( 'message' => __( 'Test event sent.', 'visionprime-connector' ) ) );
	}

	public function handle_get_sync_status(): void {
		$this->auth->require_admin_ajax();

		wp_send_json_success(
			array(
				'configured' => $this->settings->is_configured(),
				'logs'       => $this->logger->get_recent_entries(),
			)
		);
	}

	/* ---------------------------------------------------------------- */
	/* Customer actions                                                  */
	/* ---------------------------------------------------------------- */

	public function handle_get_customer_dashboard(): void {
		$this->auth->require_customer_ajax();
		$this->reply_from_backend( '/customer/dashboard' );
	}

	public function handle_get_wallet(): void {
		$this->auth->require_customer_ajax();
		if ( ! $this->settings->is_wallet_enabled() ) {
			wp_send_json_error( array( 'message' => __( 'Wallet is not enabled.', 'visionprime-connector' ) ) );
		}
		$this->reply_from_backend( '/customer/wallet' );
	}

	public function handle_get_points(): void {
		$this->auth->require_customer_ajax();
		if ( ! $this->settings->is_points_enabled() ) {
			wp_send_json_success( array( 'enabled' => false, 'balanceCents' => 0 ) );
		}
		$this->reply_from_backend( '/customer/points' );
	}

	public function handle_get_rewards(): void {
		$this->auth->require_customer_ajax();
		if ( ! $this->settings->is_rewards_enabled() ) {
			wp_send_json_success( array( 'enabled' => false, 'rewards' => array() ) );
		}
		$this->reply_from_backend( '/customer/rewards' );
	}

	public function handle_get_tier(): void {
		$this->auth->require_customer_ajax();
		if ( ! $this->settings->is_tier_enabled() ) {
			wp_send_json_success( array( 'enabled' => false, 'tier' => null ) );
		}
		$this->reply_from_backend( '/customer/tier' );
	}

	public function handle_refresh_account_data(): void {
		$this->auth->require_customer_ajax();

		$component = isset( $_REQUEST['component'] ) ? sanitize_key( wp_unslash( $_REQUEST['component'] ) ) : '';
		$map       = array(
			'wallet'  => '/customer/wallet',
			'points'  => '/customer/points',
			'rewards' => '/customer/rewards',
			'tier'    => '/customer/tier',
			'club'    => '/customer/dashboard',
		);

		if ( ! isset( $map[ $component ] ) ) {
			wp_send_json_error( array( 'message' => __( 'Unknown component.', 'visionprime-connector' ) ) );
		}

		// A refresh always bypasses the short-lived cache for that one
		// component — every other AJAX read may still hit it.
		$result = $this->api_client->get( $map[ $component ], array(), false );
		$this->send_backend_result( $result );
	}

	/* ---------------------------------------------------------------- */
	/* Shared helpers                                                    */
	/* ---------------------------------------------------------------- */

	private function reply_from_backend( string $path ): void {
		$result = $this->api_client->get( $path );
		$this->send_backend_result( $result );
	}

	/** @param array{ok: bool, status: int, body: mixed, message?: string} $result */
	private function send_backend_result( array $result ): void {
		if ( ! $result['ok'] ) {
			wp_send_json_error( array( 'message' => $result['message'] ?? __( 'Something went wrong. Please try again.', 'visionprime-connector' ) ) );
		}

		wp_send_json_success( $result['body'] );
	}
}
