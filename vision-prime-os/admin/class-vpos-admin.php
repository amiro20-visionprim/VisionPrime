<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Per-site admin shell. Feature modules append their own submenu pages via
 * the vpos_admin_menu action instead of editing this file (Phase 1+).
 */
class VPOS_Admin {

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
	}

	public function register_menu() {
		$capability = current_user_can( 'manage_options' ) ? 'manage_options' : 'read';

		add_menu_page(
			__( 'VisionPrime OS', 'vpos' ),
			__( 'VisionPrime OS', 'vpos' ),
			$capability,
			'vpos-dashboard',
			array( $this, 'render_dashboard' ),
			'dashicons-store',
			3
		);

		/**
		 * Other modules hook here, e.g.:
		 * add_submenu_page( 'vpos-dashboard', __('Customers'), __('Customers'), $cap, 'vpos-customers', $callback );
		 */
		do_action( 'vpos_admin_menu', 'vpos-dashboard' );
	}

	public function enqueue_assets( $hook ) {
		if ( false === strpos( $hook, 'vpos' ) ) {
			return;
		}
		wp_enqueue_style( 'vpos-admin', VPOS_URL . 'admin/assets/admin.css', array(), VPOS_VERSION );
	}

	public function render_dashboard() {
		$ctx = VPOS_Context::resolve();
		include VPOS_DIR . 'admin/views/dashboard.php';
	}
}
