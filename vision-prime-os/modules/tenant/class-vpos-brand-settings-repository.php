<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Single-row, per-site settings table (Master Spec §11). Lives in the
 * brand's own site so brand_id is informational (points back to the
 * network vpos_brands.id) rather than a scoping column.
 */
class VPOS_Brand_Settings_Repository extends VPOS_Repository {

	protected $table          = 'vpos_brand_settings';
	protected $soft_deletable = false;

	public static function schema() {
		VPOS_Migrator::register(
			'vpos_brand_settings',
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			brand_id BIGINT UNSIGNED NOT NULL,
			club_domain VARCHAR(190) NULL,
			club_path VARCHAR(190) NULL,
			sms_sender_name VARCHAR(64) NULL,
			support_phone VARCHAR(32) NULL,
			support_email VARCHAR(190) NULL,
			terms_url VARCHAR(255) NULL,
			privacy_url VARCHAR(255) NULL,
			wallet_enabled TINYINT(1) NOT NULL DEFAULT 1,
			loyalty_enabled TINYINT(1) NOT NULL DEFAULT 1,
			rewards_enabled TINYINT(1) NOT NULL DEFAULT 1,
			campaigns_enabled TINYINT(1) NOT NULL DEFAULT 1,
			customer_club_enabled TINYINT(1) NOT NULL DEFAULT 1,
			settings LONGTEXT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY brand_id (brand_id)"
		);
	}

	public function create_default( $brand_id ) {
		return $this->insert(
			array(
				'brand_id'              => $brand_id,
				'wallet_enabled'        => 1,
				'loyalty_enabled'       => 1,
				'rewards_enabled'       => 1,
				'campaigns_enabled'     => 1,
				'customer_club_enabled' => 1,
				'settings'              => '{}',
			)
		);
	}

	public function get_for_current_site() {
		global $wpdb;
		return $wpdb->get_row( "SELECT * FROM {$this->table_name()} LIMIT 1", ARRAY_A );
	}

	public function update_settings( array $data ) {
		$row = $this->get_for_current_site();
		if ( ! $row ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Brand settings not found.' );
		}
		foreach ( array( 'wallet_enabled', 'loyalty_enabled', 'rewards_enabled', 'campaigns_enabled', 'customer_club_enabled' ) as $flag ) {
			if ( isset( $data[ $flag ] ) ) {
				$data[ $flag ] = $data[ $flag ] ? 1 : 0;
			}
		}
		if ( isset( $data['settings'] ) && is_array( $data['settings'] ) ) {
			$data['settings'] = wp_json_encode( $data['settings'] );
		}
		unset( $data['brand_id'] );
		$this->update( $row['id'], $data );
		VPOS_Audit::log( 'brand:settings:update', 'brand_settings', $row['id'], $row, $data );
		return $this->get_for_current_site();
	}
}

VPOS_Brand_Settings_Repository::schema();
