<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The only place add_action/add_filter calls happen for plugin wiring
 * (each collaborator already has a register() method covering its own
 * hooks/shortcodes — this just calls them and owns the asset enqueues,
 * since enqueuing is cross-cutting and doesn't belong to any one
 * collaborator).
 */
class VP_Loader {

	/** @var VP_Settings */
	private $settings;

	/** @var VP_Auth */
	private $auth;

	/** @var VP_Ajax */
	private $ajax;

	/** @var VP_Shortcodes */
	private $shortcodes;

	/** @var VP_My_Account */
	private $my_account;

	/** @var VP_Checkout */
	private $checkout;

	/** @var VP_Webhooks */
	private $webhooks;

	/** @var VP_WooCommerce_Hooks */
	private $wc_hooks;

	public function __construct(
		VP_Settings $settings,
		VP_Auth $auth,
		VP_Ajax $ajax,
		VP_Shortcodes $shortcodes,
		VP_My_Account $my_account,
		VP_Checkout $checkout,
		VP_Webhooks $webhooks,
		VP_WooCommerce_Hooks $wc_hooks
	) {
		$this->settings   = $settings;
		$this->auth       = $auth;
		$this->ajax       = $ajax;
		$this->shortcodes = $shortcodes;
		$this->my_account = $my_account;
		$this->checkout   = $checkout;
		$this->webhooks   = $webhooks;
		$this->wc_hooks   = $wc_hooks;
	}

	public function run(): void {
		add_action( 'admin_menu', array( $this->settings, 'register_menu' ) );
		add_action( 'admin_init', array( $this->settings, 'register_settings' ) );

		$this->ajax->register();
		$this->shortcodes->register();
		$this->my_account->register();
		$this->checkout->register();
		$this->wc_hooks->register();

		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_public_assets' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );
	}

	public function enqueue_public_assets(): void {
		if ( ! is_user_logged_in() ) {
			return;
		}

		wp_enqueue_style(
			'visionprime-public',
			VISIONPRIME_CONNECTOR_URL . 'assets/css/visionprime-public.css',
			array(),
			VISIONPRIME_CONNECTOR_VERSION
		);

		wp_enqueue_script(
			'visionprime-public',
			VISIONPRIME_CONNECTOR_URL . 'assets/js/visionprime-public.js',
			array( 'jquery' ),
			VISIONPRIME_CONNECTOR_VERSION,
			true
		);

		// Only the AJAX URL and a friendly error string are exposed — no
		// API key, no shared secret. Per-component nonces are baked into
		// each container's data-vp-nonce attribute instead of a single
		// global nonce, since shortcodes/My Account tabs can render
		// independently of this enqueue.
		wp_localize_script(
			'visionprime-public',
			'visionprimePublic',
			array(
				'ajaxUrl'      => admin_url( 'admin-ajax.php' ),
				'genericError' => __( 'Something went wrong. Please try again.', 'visionprime-connector' ),
			)
		);
	}

	public function enqueue_admin_assets( string $hook ): void {
		if ( 'settings_page_' . VP_Settings::PAGE_SLUG !== $hook ) {
			return;
		}

		wp_enqueue_style(
			'visionprime-admin',
			VISIONPRIME_CONNECTOR_URL . 'assets/css/visionprime-admin.css',
			array(),
			VISIONPRIME_CONNECTOR_VERSION
		);

		wp_enqueue_script(
			'visionprime-admin',
			VISIONPRIME_CONNECTOR_URL . 'assets/js/visionprime-admin.js',
			array( 'jquery' ),
			VISIONPRIME_CONNECTOR_VERSION,
			true
		);

		wp_localize_script(
			'visionprime-admin',
			'visionprimeAdmin',
			array(
				'ajaxUrl'      => admin_url( 'admin-ajax.php' ),
				'nonce'        => $this->auth->admin_nonce(),
				'genericError' => __( 'Something went wrong. Please try again.', 'visionprime-connector' ),
			)
		);
	}
}
