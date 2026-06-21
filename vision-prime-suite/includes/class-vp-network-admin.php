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
		add_submenu_page(
			'vp-suite-network',
			'داشبورد KPI شبکه',
			'داشبورد KPI شبکه',
			'manage_network_options',
			'vp-suite-network-kpi',
			array( $this, 'render_kpi' )
		);
	}

	/**
	 * Aggregates per-brand KPIs across every site in the holding by walking
	 * each blog (switch_to_blog) and pulling its own real tables/stats —
	 * the same per-site data each brand already sees on its own dashboard,
	 * just rolled up in one place for a network-level view.
	 */
	public function render_kpi() {
		if ( ! current_user_can( 'manage_network_options' ) ) {
			wp_die( __( 'دسترسی غیرمجاز.', 'vp-suite' ) );
		}

		global $wpdb;
		$site_ids = get_sites( array( 'fields' => 'ids' ) );
		$rows     = array();
		$totals   = array(
			'generated' => 0,
			'errors'    => 0,
			'social_sent' => 0,
			'social_failed' => 0,
			'gsc_clicks_7d' => 0,
		);

		foreach ( $site_ids as $site_id ) {
			switch_to_blog( $site_id );

			$stats = class_exists( 'VP_Reports' ) ? VP_Reports::build( 24 * 7 ) : array(
				'generated_total' => 0,
				'errors'          => 0,
				'social_sent'     => 0,
				'social_failed'   => 0,
			);

			$gsc_clicks = 0;
			$gsc_connected = class_exists( 'VP_Search_Console' ) && VP_Search_Console::is_connected();
			if ( $gsc_connected ) {
				$since      = gmdate( 'Y-m-d', time() - 7 * DAY_IN_SECONDS );
				$gsc_clicks = (int) $wpdb->get_var(
					$wpdb->prepare( "SELECT SUM(clicks) FROM {$wpdb->prefix}vp_rank_snapshots WHERE snapshot_date >= %s", $since )
				);
			}

			$pending_queue = (int) $wpdb->get_var(
				$wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}vp_jobs WHERE status = %s", 'pending_review' )
			);

			$rows[] = array(
				'site_id'        => $site_id,
				'name'           => get_bloginfo( 'name' ),
				'url'            => get_home_url(),
				'generated_7d'   => (int) $stats['generated_total'],
				'errors_7d'      => (int) $stats['errors'],
				'social_sent_7d' => (int) $stats['social_sent'],
				'social_failed_7d' => (int) $stats['social_failed'],
				'pending_queue'  => $pending_queue,
				'gsc_connected'  => $gsc_connected,
				'gsc_clicks_7d'  => $gsc_clicks,
			);

			$totals['generated']      += (int) $stats['generated_total'];
			$totals['errors']         += (int) $stats['errors'];
			$totals['social_sent']    += (int) $stats['social_sent'];
			$totals['social_failed']  += (int) $stats['social_failed'];
			$totals['gsc_clicks_7d']  += $gsc_clicks;

			restore_current_blog();
		}

		include VP_SUITE_DIR . 'admin/views/network-kpi.php';
	}

	public function render() {
		if ( ! current_user_can( 'manage_network_options' ) ) {
			wp_die( __( 'دسترسی غیرمجاز.', 'vp-suite' ) );
		}

		$result = null;
		if ( isset( $_POST['vp_network_apikey_nonce'] ) && wp_verify_nonce( $_POST['vp_network_apikey_nonce'], 'vp_network_save_apikey' ) ) {
			$result = $this->push_shared_key();
		}

		$sites = get_sites( array( 'fields' => 'ids' ) );

		include VP_SUITE_DIR . 'admin/views/network-settings.php';
	}

	/**
	 * Writes one shared-scope API key into every site's vp_api_keys table.
	 *
	 * @return array{count:int} Number of sites updated.
	 */
	private function push_shared_key() {
		$label   = sanitize_text_field( $_POST['label'] ?? '' );
		$api_key = sanitize_text_field( $_POST['api_key'] ?? '' );

		if ( empty( $api_key ) ) {
			return array( 'count' => 0, 'error' => __( 'کلید API را وارد کنید.', 'vp-suite' ) );
		}

		if ( ! VP_Api_Manager::is_valid_key_format( $api_key ) ) {
			return array( 'count' => 0, 'error' => __( 'این مقدار فرمت یک کلید OpenRouter معتبر را ندارد (باید با sk-or- شروع شود).', 'vp-suite' ) );
		}

		$site_ids = get_sites( array( 'fields' => 'ids' ) );
		$count    = 0;

		foreach ( $site_ids as $site_id ) {
			switch_to_blog( $site_id );
			VP_Api_Manager::save_key( 'shared', $label ?: __( 'کلید مشترک شبکه', 'vp-suite' ), $api_key );
			VP_Settings::update( 'shared_api_mode', true );
			VP_Logger::log( 'network_admin', 'کلید مشترک از طریق تنظیمات شبکه روی این سایت اعمال شد.', 'info' );
			restore_current_blog();
			$count++;
		}

		return array( 'count' => $count );
	}
}
