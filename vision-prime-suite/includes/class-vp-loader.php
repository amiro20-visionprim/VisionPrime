<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Central include/bootstrap point. Kept dependency-free of WP hooks so it
 * can be unit-loaded; actual hook wiring happens in each module's own
 * constructor (each module is self-contained and independently testable).
 */
class VP_Loader {

	public function run() {
		$this->load_dependencies();
		$this->init_modules();
	}

	private function load_dependencies() {
		require_once VP_SUITE_DIR . 'includes/class-vp-activator.php';
		require_once VP_SUITE_DIR . 'includes/class-vp-logger.php';
		require_once VP_SUITE_DIR . 'includes/class-vp-settings.php';
		require_once VP_SUITE_DIR . 'includes/class-vp-ai-providers.php';
		require_once VP_SUITE_DIR . 'includes/class-vp-api-manager.php';
		require_once VP_SUITE_DIR . 'includes/class-vp-content-generator.php';
		require_once VP_SUITE_DIR . 'includes/class-vp-image-generator.php';
		require_once VP_SUITE_DIR . 'includes/class-vp-seo-engine.php';
		require_once VP_SUITE_DIR . 'includes/class-vp-seo-metabox.php';
		require_once VP_SUITE_DIR . 'includes/class-vp-rankmath-sync.php';
		require_once VP_SUITE_DIR . 'includes/class-vp-queue.php';
		require_once VP_SUITE_DIR . 'includes/class-vp-competitor-analysis.php';
		require_once VP_SUITE_DIR . 'includes/class-vp-search-console.php';
		require_once VP_SUITE_DIR . 'includes/class-vp-review-assistant.php';
		require_once VP_SUITE_DIR . 'includes/class-vp-linking.php';
		require_once VP_SUITE_DIR . 'includes/class-vp-content-calendar.php';
		require_once VP_SUITE_DIR . 'includes/class-vp-cannibalization.php';
		require_once VP_SUITE_DIR . 'includes/class-vp-catalog.php';
		require_once VP_SUITE_DIR . 'includes/class-vp-reports.php';
		require_once VP_SUITE_DIR . 'includes/class-vp-cron.php';
		require_once VP_SUITE_DIR . 'includes/social/class-vp-social-manager.php';
		require_once VP_SUITE_DIR . 'includes/class-vp-network-admin.php';
		require_once VP_SUITE_DIR . 'admin/class-vp-admin.php';

		add_action( 'wp_initialize_site', array( 'VP_Activator', 'activate_new_site' ) );
	}

	private function init_modules() {
		new VP_Logger();
		new VP_Settings();
		new VP_Api_Manager();
		new VP_Content_Generator();
		new VP_Image_Generator();
		new VP_SEO_Engine();
		new VP_SEO_Metabox();
		new VP_Rankmath_Sync();
		new VP_Queue();
		new VP_Competitor_Analysis();
		new VP_Search_Console();
		new VP_Review_Assistant();
		new VP_Linking();
		new VP_Content_Calendar();
		new VP_Cannibalization();
		new VP_Catalog();
		new VP_Reports();
		new VP_Social_Manager();
		new VP_Cron();
		new VP_Network_Admin();
		new VP_Admin();
	}
}
