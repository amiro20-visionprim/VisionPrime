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
		require_once VPOS_DIR . 'admin/class-vpos-admin.php';

		// Phase 1 — Tenant (Organization/Brand/Branch/Brand Settings).
		require_once VPOS_DIR . 'modules/tenant/class-vpos-organization-repository.php';
		require_once VPOS_DIR . 'modules/tenant/class-vpos-brand-settings-repository.php';
		require_once VPOS_DIR . 'modules/tenant/class-vpos-brand-repository.php';
		require_once VPOS_DIR . 'modules/tenant/class-vpos-branch-repository.php';
		require_once VPOS_DIR . 'modules/tenant/class-vpos-tenant-rest.php';
		require_once VPOS_DIR . 'modules/tenant/class-vpos-tenant-module.php';

		// Phase 2 — Customer Data Platform, Customer 360, Order Engine.
		require_once VPOS_DIR . 'modules/customer/class-vpos-customer-repository.php';
		require_once VPOS_DIR . 'modules/customer/class-vpos-order-repository.php';
		require_once VPOS_DIR . 'modules/customer/class-vpos-customer-rest.php';
		require_once VPOS_DIR . 'modules/customer/class-vpos-customer-module.php';

		// Phase 3 — Wallet Ledger Engine.
		require_once VPOS_DIR . 'modules/wallet/class-vpos-wallet-repository.php';
		require_once VPOS_DIR . 'modules/wallet/class-vpos-wallet-rest.php';
		require_once VPOS_DIR . 'modules/wallet/class-vpos-wallet-module.php';

		// Phase 4 — Loyalty, Rewards, Customer Club.
		require_once VPOS_DIR . 'modules/loyalty/class-vpos-loyalty-repository.php';
		require_once VPOS_DIR . 'modules/reward/class-vpos-reward-repository.php';
		require_once VPOS_DIR . 'modules/loyalty/class-vpos-loyalty-rest.php';
		require_once VPOS_DIR . 'modules/loyalty/class-vpos-loyalty-module.php';
		require_once VPOS_DIR . 'modules/club/class-vpos-club-session.php';
		require_once VPOS_DIR . 'modules/club/class-vpos-club-module.php';

		// Phase 5 — Segments, Campaigns, Notifications.
		require_once VPOS_DIR . 'modules/campaign/class-vpos-segment-repository.php';
		require_once VPOS_DIR . 'modules/campaign/class-vpos-notification-repository.php';
		require_once VPOS_DIR . 'modules/campaign/class-vpos-campaign-repository.php';
		require_once VPOS_DIR . 'modules/campaign/class-vpos-campaign-rest.php';
		require_once VPOS_DIR . 'modules/campaign/class-vpos-campaign-module.php';

		// Phase 6 — Automation Engine.
		require_once VPOS_DIR . 'modules/automation/class-vpos-automation-repository.php';
		require_once VPOS_DIR . 'modules/automation/class-vpos-automation-rest.php';
		require_once VPOS_DIR . 'modules/automation/class-vpos-automation-module.php';

		// Phase 7 — Integrations, Reports, AI Intelligence Layer.
		require_once VPOS_DIR . 'modules/integration/class-vpos-integration-repository.php';
		require_once VPOS_DIR . 'modules/integration/class-vpos-integration-rest.php';
		require_once VPOS_DIR . 'modules/integration/class-vpos-integration-module.php';
		require_once VPOS_DIR . 'modules/report/class-vpos-report-repository.php';
		require_once VPOS_DIR . 'modules/report/class-vpos-report-rest.php';
		require_once VPOS_DIR . 'modules/report/class-vpos-report-module.php';
		require_once VPOS_DIR . 'modules/ai/class-vpos-ai-repository.php';
		require_once VPOS_DIR . 'modules/ai/class-vpos-ai-rest.php';
		require_once VPOS_DIR . 'modules/ai/class-vpos-ai-module.php';
	}

	public function init_modules() {
		VPOS_RBAC::instance()->register_capabilities();
		VPOS_Jobs::instance()->register_hooks();

		$this->register_module( 'tenant', new VPOS_Tenant_Module() );
		$this->register_module( 'customer', new VPOS_Customer_Module() );
		$this->register_module( 'wallet', new VPOS_Wallet_Module() );
		$this->register_module( 'loyalty', new VPOS_Loyalty_Module() );
		$this->register_module( 'club', new VPOS_Club_Module() );
		$this->register_module( 'campaign', new VPOS_Campaign_Module() );
		$this->register_module( 'automation', new VPOS_Automation_Module() );
		$this->register_module( 'integration', new VPOS_Integration_Module() );
		$this->register_module( 'report', new VPOS_Report_Module() );
		$this->register_module( 'ai', new VPOS_Ai_Module() );

		if ( is_admin() ) {
			$this->modules['admin'] = new VPOS_Admin();
		}

		/**
		 * Later-phase modules (Customer, Wallet, Loyalty, ...) hook in here,
		 * keeping this file stable across phases.
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
