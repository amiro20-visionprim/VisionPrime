<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Adds the VisionPrime tabs (Club, Wallet, Points, Rewards, Tier) to
 * WooCommerce's My Account page. Like the shortcodes, every tab renders
 * only container markup — the actual data is loaded by the public JS via
 * AJAX once the page (and the customer nonce baked into the container)
 * is in the DOM. No customer data is ever echoed here.
 */
class VP_My_Account {

	/** @var VP_Settings */
	private $settings;

	/** @var VP_Auth */
	private $auth;

	const ENDPOINTS = array(
		'visionprime-club'    => array( 'label' => 'VisionPrime Club', 'component' => 'club' ),
		'visionprime-wallet'  => array( 'label' => 'Wallet', 'component' => 'wallet' ),
		'visionprime-points'  => array( 'label' => 'Points', 'component' => 'points' ),
		'visionprime-rewards' => array( 'label' => 'Rewards', 'component' => 'rewards' ),
		'visionprime-tier'    => array( 'label' => 'Tier', 'component' => 'tier' ),
	);

	public function __construct( VP_Settings $settings, VP_Auth $auth ) {
		$this->settings = $settings;
		$this->auth     = $auth;
	}

	public function register(): void {
		if ( ! $this->settings->is_my_account_tabs_enabled() ) {
			return;
		}

		add_filter( 'woocommerce_account_menu_items', array( $this, 'add_menu_items' ) );

		foreach ( $this->enabled_endpoints() as $endpoint => $config ) {
			add_action( "woocommerce_account_{$endpoint}_endpoint", array( $this, 'render_endpoint' ) );
		}

		add_action( 'init', array( $this, 'add_rewrite_endpoints' ) );
	}

	public function add_rewrite_endpoints(): void {
		foreach ( array_keys( $this->enabled_endpoints() ) as $endpoint ) {
			add_rewrite_endpoint( $endpoint, EP_ROOT | EP_PAGES );
		}
	}

	/** @param array<string, string> $items */
	public function add_menu_items( array $items ): array {
		$new_items = array();

		foreach ( $items as $key => $label ) {
			$new_items[ $key ] = $label;

			// Insert our tabs right after the Orders tab so they sit near
			// the top of the account menu without disturbing logout/edit-account ordering.
			if ( 'orders' === $key ) {
				foreach ( $this->enabled_endpoints() as $endpoint => $config ) {
					$new_items[ $endpoint ] = __( $config['label'], 'visionprime-connector' );
				}
			}
		}

		return $new_items;
	}

	public function render_endpoint(): void {
		$endpoint = WC()->query->get_current_endpoint();
		$config   = self::ENDPOINTS[ $endpoint ] ?? null;

		if ( ! $config ) {
			return;
		}

		printf(
			'<div class="vp-component vp-component-%1$s" data-vp-component="%1$s" data-vp-nonce="%2$s"><p class="vp-loading">%3$s</p></div>',
			esc_attr( $config['component'] ),
			esc_attr( $this->auth->customer_nonce() ),
			esc_html__( 'Loading…', 'visionprime-connector' )
		);
	}

	/** @return array<string, array{label: string, component: string}> */
	private function enabled_endpoints(): array {
		$flags = array(
			'visionprime-club'    => true,
			'visionprime-wallet'  => $this->settings->is_wallet_enabled(),
			'visionprime-points'  => $this->settings->is_points_enabled(),
			'visionprime-rewards' => $this->settings->is_rewards_enabled(),
			'visionprime-tier'    => $this->settings->is_tier_enabled(),
		);

		return array_intersect_key( self::ENDPOINTS, array_filter( $flags ) );
	}
}
