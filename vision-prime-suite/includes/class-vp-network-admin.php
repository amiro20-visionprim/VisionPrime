<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Network-level settings page (multisite only). Lets a network admin push
 * one shared API key set to every site's own vp_api_keys table in one go,
 * instead of re-entering keys on each holding site individually. Each site
 * keeps full per-site tables/settings — this only writes the "shared"
 * scope rows, so a site can still override with its own dedicated key.
 */
class VP_Network_Admin {

	public function __construct() {
		if ( ! is_multisite() ) {
			return;
		}
		add_action( 'network_admin_menu', array( $this, 'register_menu' ) );
	}

	public function register_menu() {
		add_menu_page(
			'VisionPrime Suite — شبکه',
			'VisionPrime (شبکه)',
			'manage_network_options',
			'vp-suite-network',
			array( $this, 'render' ),
			'dashicons-admin-customizer',
			58
		);
	}

	public function render() {
		if ( ! current_user_can( 'manage_network_options' ) ) {
			wp_die( __( 'دسترسی غیرمجاز.', 'vp-suite' ) );
		}

		$result = null;
		if ( isset( $_POST['vp_network_apikey_nonce'] ) && wp_verify_nonce( $_POST['vp_network_apikey_nonce'], 'vp_network_save_apikey' ) ) {
			$result = $this->push_shared_key();
		}

		$providers = VP_AI_Providers::get_providers();
		$sites     = get_sites( array( 'fields' => 'ids' ) );

		include VP_SUITE_DIR . 'admin/views/network-settings.php';
	}

	/**
	 * Writes one shared-scope API key into every site's vp_api_keys table.
	 *
	 * @return array{count:int} Number of sites updated.
	 */
	private function push_shared_key() {
		$provider = sanitize_key( $_POST['provider'] ?? '' );
		$label    = sanitize_text_field( $_POST['label'] ?? '' );
		$api_key  = sanitize_text_field( $_POST['api_key'] ?? '' );

		if ( empty( $provider ) || empty( $api_key ) ) {
			return array( 'count' => 0, 'error' => __( 'سرویس و کلید API را وارد کنید.', 'vp-suite' ) );
		}

		$site_ids = get_sites( array( 'fields' => 'ids' ) );
		$count    = 0;

		foreach ( $site_ids as $site_id ) {
			switch_to_blog( $site_id );
			VP_Api_Manager::save_key( $provider, 'shared', $label ?: __( 'کلید مشترک شبکه', 'vp-suite' ), $api_key );
			VP_Settings::update( 'shared_api_mode', true );
			VP_Logger::log( 'network_admin', "کلید مشترک $provider از طریق تنظیمات شبکه روی این سایت اعمال شد.", 'info' );
			restore_current_blog();
			$count++;
		}

		return array( 'count' => $count );
	}
}
