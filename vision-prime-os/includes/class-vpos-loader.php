<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Central include/bootstrap point. Each module wires its own hooks in its
 * constructor; the loader only requires files and instantiates modules.
 */
class VPOS_Loader {

	/** @var object[] */
	private $modules = array();

	public function load_dependencies() {
		// Core base layer — every module is built on top of these.
		require_once VPOS_DIR . 'includes/core/class-vpos-response.php';
		require_once VPOS_DIR . 'includes/core/class-vpos-migrator.php';
		require_once VPOS_DIR . 'includes/core/class-vpos-context.php';
		require_once VPOS_DIR . 'includes/core/class-vpos-rbac.php';
		require_once VPOS_DIR . 'includes/core/class-vpos-audit.php';
		require_once VPOS_DIR . 'includes/core/class-vpos-repository.php';
		require_once VPOS_DIR . 'includes/core/class-vpos-rest-controller.php';
		require_once VPOS_DIR . 'includes/core/class-vpos-jobs.php';
		require_once VPOS_DIR . 'includes/core/trait-vpos-ledger.php';

		require_once VPOS_DIR . 'includes/class-vpos-activator.php';

		// Admin shell (Phase 0). Feature modules register themselves from
		// Phase 1 onward via vpos_register_modules.
		require_once VPOS_DIR . 'admin/class-vpos-admin.php';
	}

	public function init_modules() {
		VPOS_RBAC::instance()->register_capabilities();
		VPOS_Jobs::instance()->register_hooks();

		if ( is_admin() ) {
			$this->modules['admin'] = new VPOS_Admin();
		}

		/**
		 * Feature modules (Tenant, Customer, Wallet, ...) hook in here as
		 * each phase is built, keeping this file stable across phases.
		 */
		do_action( 'vpos_register_modules', $this );
	}

	public function register_module( $key, $instance ) {
		$this->modules[ $key ] = $instance;
	}

	public function get_module( $key ) {
		return isset( $this->modules[ $key ] ) ? $this->modules[ $key ] : null;
	}
}
