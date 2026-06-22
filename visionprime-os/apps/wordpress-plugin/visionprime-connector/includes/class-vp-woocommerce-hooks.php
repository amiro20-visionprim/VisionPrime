<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * General WooCommerce-environment hooks that aren't AJAX, settings, or
 * webhook concerns — currently just an admin notice when WooCommerce
 * isn't active, since every other class in this plugin assumes
 * WC()/WooCommerce hooks are available.
 */
class VP_WooCommerce_Hooks {

	/** @var VP_Settings */
	private $settings;

	/** @var VP_Logger */
	private $logger;

	public function __construct( VP_Settings $settings, VP_Logger $logger ) {
		$this->settings = $settings;
		$this->logger   = $logger;
	}

	public function register(): void {
		add_action( 'admin_notices', array( $this, 'maybe_render_missing_woocommerce_notice' ) );
	}

	public function maybe_render_missing_woocommerce_notice(): void {
		if ( class_exists( 'WooCommerce' ) ) {
			return;
		}

		if ( ! current_user_can( VP_Settings::CAPABILITY ) ) {
			return;
		}

		printf(
			'<div class="notice notice-warning"><p>%s</p></div>',
			esc_html__( 'VisionPrime Connector requires WooCommerce to be installed and active for My Account tabs and order/customer webhooks to work.', 'visionprime-connector' )
		);
	}
}
