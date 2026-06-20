<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the admin menu tree and shared assets. Every page is a thin
 * view file under admin/views/ that pulls data from the relevant module —
 * keeps this class a pure router.
 */
class VP_Admin {

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	public function register_menu() {
		$cap = 'manage_options';

		add_menu_page( 'VisionPrime Suite', 'VisionPrime', $cap, 'vp-suite', array( $this, 'render_dashboard' ), 'dashicons-admin-customizer', 58 );
		add_submenu_page( 'vp-suite', 'داشبورد', 'داشبورد', $cap, 'vp-suite', array( $this, 'render_dashboard' ) );
		add_submenu_page( 'vp-suite', 'تولید محتوا', 'تولید محتوا', 'edit_posts', 'vp-suite-generate', array( $this, 'render_generate' ) );
		add_submenu_page( 'vp-suite', 'صف انتشار', 'صف انتشار', 'edit_posts', 'vp-suite-queue', array( $this, 'render_queue' ) );
		add_submenu_page( 'vp-suite', 'تحلیل رقبا', 'تحلیل رقبا', 'edit_posts', 'vp-suite-competitor', array( $this, 'render_competitor' ) );
		add_submenu_page( 'vp-suite', 'ریویو محتوای موجود', 'ریویو محتوا', 'edit_posts', 'vp-suite-review', array( $this, 'render_review' ) );
		add_submenu_page( 'vp-suite', 'شبکه‌های اجتماعی', 'شبکه‌های اجتماعی', $cap, 'vp-suite-social', array( $this, 'render_social' ) );
		add_submenu_page( 'vp-suite', 'گزارش‌ها و لاگ', 'گزارش‌ها و لاگ', $cap, 'vp-suite-logs', array( $this, 'render_logs' ) );
		add_submenu_page( 'vp-suite', 'کاتالوگ و راهنما', 'کاتالوگ و راهنما', 'read', 'vp-suite-catalog', array( $this, 'render_catalog' ) );
		add_submenu_page( 'vp-suite', 'تنظیمات', 'تنظیمات', $cap, 'vp-suite-settings', array( $this, 'render_settings' ) );
	}

	public function enqueue( $hook ) {
		if ( false === strpos( $hook, 'vp-suite' ) ) {
			return;
		}

		wp_enqueue_style( 'vp-suite-admin', VP_SUITE_URL . 'admin/assets/css/admin.css', array(), VP_SUITE_VERSION );
		wp_enqueue_script( 'vp-suite-admin', VP_SUITE_URL . 'admin/assets/js/admin.js', array( 'jquery' ), VP_SUITE_VERSION, true );
		wp_localize_script(
			'vp-suite-admin',
			'VPSuite',
			array(
				'ajaxUrl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'vp_suite_nonce' ),
			)
		);
	}

	private function view( $name, $data = array() ) {
		extract( $data );
		include VP_SUITE_DIR . "admin/views/{$name}.php";
	}

	public function render_dashboard() {
		$this->view(
			'dashboard',
			array(
				'jobs'      => VP_Queue::get_jobs( '', 5 ),
				'logs'      => VP_Logger::query( array( 'limit' => 8 ) ),
				'providers' => VP_AI_Providers::get_providers(),
			)
		);
	}

	public function render_generate() {
		$this->view( 'generate', array( 'providers' => VP_AI_Providers::get_providers(), 'settings' => VP_Settings::all() ) );
	}

	public function render_queue() {
		$this->view( 'queue', array( 'jobs' => VP_Queue::get_jobs() ) );
	}

	public function render_competitor() {
		$this->view( 'competitor', array( 'reports' => VP_Competitor_Analysis::get_reports(), 'settings' => VP_Settings::all() ) );
	}

	public function render_review() {
		$this->view( 'review' );
	}

	public function render_social() {
		global $wpdb;
		$accounts = $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}vp_social_accounts ORDER BY id DESC" );
		$this->view( 'social', array( 'channels' => VP_Social_Manager::get_channels(), 'accounts' => $accounts ) );
	}

	public function render_logs() {
		$this->view( 'logs', array( 'logs' => VP_Logger::query( array( 'limit' => 100 ) ) ) );
	}

	public function render_catalog() {
		$this->view( 'catalog', array( 'sections' => VP_Catalog::get_sections() ) );
	}

	public function render_settings() {
		if ( isset( $_POST['vp_suite_settings_nonce'] ) && wp_verify_nonce( $_POST['vp_suite_settings_nonce'], 'vp_suite_save_settings' ) ) {
			$this->save_settings();
		}
		if ( isset( $_POST['vp_suite_apikey_nonce'] ) && wp_verify_nonce( $_POST['vp_suite_apikey_nonce'], 'vp_suite_save_apikey' ) ) {
			$this->save_api_key();
		}

		$this->view(
			'settings',
			array(
				'settings' => VP_Settings::all(),
				'providers' => VP_AI_Providers::get_providers(),
				'keys'     => VP_Api_Manager::list_keys(),
			)
		);
	}

	private function save_settings() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$fields = array( 'default_provider', 'article_prompt', 'product_prompt', 'seo_prompt', 'competitor_prompt' );
		foreach ( $fields as $field ) {
			if ( isset( $_POST[ $field ] ) ) {
				VP_Settings::update( $field, wp_kses_post( wp_unslash( $_POST[ $field ] ) ) );
			}
		}
		VP_Settings::update( 'shared_api_mode', ! empty( $_POST['shared_api_mode'] ) );
		VP_Settings::update( 'rankmath_sync', ! empty( $_POST['rankmath_sync'] ) );
		VP_Settings::update( 'image_generation', ! empty( $_POST['image_generation'] ) );

		add_action( 'admin_notices', function () {
			echo '<div class="notice notice-success"><p>تنظیمات ذخیره شد.</p></div>';
		} );
	}

	private function save_api_key() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		VP_Api_Manager::save_key(
			sanitize_key( $_POST['provider'] ?? '' ),
			sanitize_key( $_POST['scope'] ?? 'shared' ),
			sanitize_text_field( $_POST['label'] ?? '' ),
			sanitize_text_field( $_POST['api_key'] ?? '' )
		);

		add_action( 'admin_notices', function () {
			echo '<div class="notice notice-success"><p>کلید API ذخیره شد.</p></div>';
		} );
	}
}
