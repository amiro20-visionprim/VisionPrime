<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Organizations are network-level (Master Spec §11): one registry shared
 * across every brand site, stored on $wpdb->base_prefix.
 */
class VPOS_Organization_Repository extends VPOS_Repository {

	protected $table   = 'vpos_organizations';
	protected $network = true;

	const STATUSES = array( 'active', 'inactive', 'suspended', 'archived' );

	public static function schema() {
		VPOS_Migrator::register(
			'vpos_organizations',
			'network',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			name VARCHAR(190) NOT NULL,
			legal_name VARCHAR(190) NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'active',
			country VARCHAR(8) NULL,
			timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Tehran',
			default_currency VARCHAR(8) NOT NULL DEFAULT 'IRR',
			metadata LONGTEXT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME NULL,
			PRIMARY KEY  (id),
			KEY status (status)"
		);
	}

	public function create( array $data ) {
		if ( empty( $data['name'] ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'name is required.', array( 'field' => 'name' ) );
		}
		$data = wp_parse_args(
			$data,
			array(
				'status'           => 'active',
				'timezone'         => 'Asia/Tehran',
				'default_currency' => 'IRR',
				'metadata'         => '{}',
			)
		);
		if ( isset( $data['metadata'] ) && is_array( $data['metadata'] ) ) {
			$data['metadata'] = wp_json_encode( $data['metadata'] );
		}
		$id = $this->insert( $data );
		VPOS_Audit::log( 'organization:create', 'organization', $id, null, $data );
		return $id;
	}

	public function update_org( $id, array $data ) {
		if ( isset( $data['status'] ) && ! in_array( $data['status'], self::STATUSES, true ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'Invalid status.', array( 'field' => 'status' ) );
		}
		if ( isset( $data['metadata'] ) && is_array( $data['metadata'] ) ) {
			$data['metadata'] = wp_json_encode( $data['metadata'] );
		}
		$before = $this->find( $id );
		if ( ! $before ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Organization not found.' );
		}
		$this->update( $id, $data );
		VPOS_Audit::log( 'organization:update', 'organization', $id, $before, $data );
		return $this->find( $id );
	}
}

VPOS_Organization_Repository::schema();
