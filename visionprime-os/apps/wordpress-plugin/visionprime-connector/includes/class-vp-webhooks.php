<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Manages the "Register Webhooks" admin action. WooCommerce order
 * webhooks are received by the VisionPrime backend directly (see
 * apps/api/src/modules/wordpress/wordpress-webhooks.controller.ts /
 * Phase 06) — this plugin does not receive webhooks itself. This class
 * simply asks the backend to (re)register/verify its WooCommerce
 * webhook subscriptions for this site, gated by the "Enable Order
 * Webhooks" / "Enable Customer Webhooks" settings, and stores the last
 * result so the admin page can display it.
 */
class VP_Webhooks {

	const STATUS_OPTION = 'visionprime_connector_webhook_status';

	/** @var VP_Settings */
	private $settings;

	/** @var VP_Api_Client */
	private $api_client;

	/** @var VP_Logger */
	private $logger;

	public function __construct( VP_Settings $settings, VP_Api_Client $api_client, VP_Logger $logger ) {
		$this->settings   = $settings;
		$this->api_client = $api_client;
		$this->logger     = $logger;
	}

	/** @return array{ok: bool, message?: string} */
	public function register(): array {
		if ( ! $this->settings->is_order_webhooks_enabled() && ! $this->settings->is_customer_webhooks_enabled() ) {
			$result = array( 'ok' => false, 'message' => __( 'Enable Order Webhooks or Customer Webhooks first.', 'visionprime-connector' ) );
			update_option( self::STATUS_OPTION, $result, false );
			return $result;
		}

		$response = $this->api_client->post(
			'/customer/dashboard',
			array(
				'webhook_registration' => array(
					'site_url'         => home_url(),
					'order_webhooks'   => $this->settings->is_order_webhooks_enabled(),
					'customer_webhooks' => $this->settings->is_customer_webhooks_enabled(),
				),
			),
			array()
		);

		$result = $response['ok']
			? array( 'ok' => true, 'message' => __( 'Webhook registration request sent.', 'visionprime-connector' ) )
			: array( 'ok' => false, 'message' => $response['message'] ?? __( 'Webhook registration failed.', 'visionprime-connector' ) );

		update_option( self::STATUS_OPTION, $result, false );
		$this->logger->info( 'Webhook registration attempted', $result );

		return $result;
	}

	/** @return array{ok: bool, message?: string}|null */
	public function last_status() {
		$status = get_option( self::STATUS_OPTION, null );
		return is_array( $status ) ? $status : null;
	}
}
