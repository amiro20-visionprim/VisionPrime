<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the public-facing shortcodes. Every shortcode renders ONLY
 * container markup (a div with data attributes the public JS reads) —
 * no customer data is ever fetched or rendered server-side here. The
 * actual data is loaded client-side via AJAX (see assets/js/visionprime-public.js),
 * which keeps this class free of any backend calls or sensitive output.
 */
class VP_Shortcodes {

	/** @var VP_Settings */
	private $settings;

	/** @var VP_Auth */
	private $auth;

	public function __construct( VP_Settings $settings, VP_Auth $auth ) {
		$this->settings = $settings;
		$this->auth     = $auth;
	}

	public function register(): void {
		add_shortcode( 'visionprime_club', array( $this, 'render_club' ) );
		add_shortcode( 'visionprime_wallet', array( $this, 'render_wallet' ) );
		add_shortcode( 'visionprime_points', array( $this, 'render_points' ) );
		add_shortcode( 'visionprime_rewards', array( $this, 'render_rewards' ) );
		add_shortcode( 'visionprime_tier', array( $this, 'render_tier' ) );
	}

	public function render_club(): string {
		return $this->render_container( 'club', __( 'Loading your VisionPrime Club info…', 'visionprime-connector' ) );
	}

	public function render_wallet(): string {
		if ( ! $this->settings->is_wallet_enabled() ) {
			return '';
		}
		return $this->render_container( 'wallet', __( 'Loading your wallet…', 'visionprime-connector' ) );
	}

	public function render_points(): string {
		if ( ! $this->settings->is_points_enabled() ) {
			return '';
		}
		return $this->render_container( 'points', __( 'Loading your points…', 'visionprime-connector' ) );
	}

	public function render_rewards(): string {
		if ( ! $this->settings->is_rewards_enabled() ) {
			return '';
		}
		return $this->render_container( 'rewards', __( 'Loading your rewards…', 'visionprime-connector' ) );
	}

	public function render_tier(): string {
		if ( ! $this->settings->is_tier_enabled() ) {
			return '';
		}
		return $this->render_container( 'tier', __( 'Loading your tier…', 'visionprime-connector' ) );
	}

	/**
	 * Container-only markup. The component is loaded by the public JS,
	 * which reads data-vp-component and calls vp_get_customer_dashboard /
	 * vp_get_wallet / vp_get_points / vp_get_rewards / vp_get_tier
	 * accordingly. Logged-out visitors get a login prompt instead of a
	 * loading container — never a silent empty box.
	 */
	private function render_container( string $component, string $loading_text ): string {
		if ( ! is_user_logged_in() ) {
			return '<p class="vp-login-required">' . esc_html__( 'Please log in to view your VisionPrime account.', 'visionprime-connector' ) . '</p>';
		}

		return sprintf(
			'<div class="vp-component vp-component-%1$s" data-vp-component="%1$s" data-vp-nonce="%2$s"><p class="vp-loading">%3$s</p></div>',
			esc_attr( $component ),
			esc_attr( $this->auth->customer_nonce() ),
			esc_html( $loading_text )
		);
	}
}
