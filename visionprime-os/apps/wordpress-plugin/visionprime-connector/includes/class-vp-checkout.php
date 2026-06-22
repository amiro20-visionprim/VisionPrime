<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Placeholder only. Checkout wallet/reward integration is explicitly out
 * of scope for this phase — the "Enable Checkout Wallet" / "Enable
 * Checkout Rewards" settings exist in the admin UI but are rendered
 * disabled and have no effect. This class intentionally registers no
 * hooks yet; it exists so the wiring point is already in place when
 * checkout integration is implemented in a future phase.
 */
class VP_Checkout {

	/** @var VP_Settings */
	private $settings;

	public function __construct( VP_Settings $settings ) {
		$this->settings = $settings;
	}

	public function register(): void {
		// Intentionally empty — no checkout integration yet.
	}
}
