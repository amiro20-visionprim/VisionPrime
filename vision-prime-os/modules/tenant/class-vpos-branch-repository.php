<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Branches live in the brand's own site (physical isolation already
 * guarantees brand scope), so "unique per brand" is simply "unique in
 * this table" (Master Spec §11).
 */
class VPOS_Branch_Repository extends VPOS_Repository {

	protected $table = 'vpos_branches';

	const STATUSES = array( 'active', 'inactive', 'temporary_closed', 'archived' );
	const TYPES    = array( 'physical', 'online', 'instagram', 'marketplace', 'phone', 'warehouse', 'other' );

	public static function schema() {
		VPOS_Migrator::register(
			'vpos_branches',
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			name VARCHAR(190) NOT NULL,
			code VARCHAR(64) NOT NULL,
			status VARCHAR(24) NOT NULL DEFAULT 'active',
			type VARCHAR(24) NOT NULL DEFAULT 'physical',
			city VARCHAR(120) NULL,
			province VARCHAR(120) NULL,
			address TEXT NULL,
			phone VARCHAR(32) NULL,
			latitude DECIMAL(10,6) NULL,
			longitude DECIMAL(10,6) NULL,
			metadata LONGTEXT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY code (code),
			KEY status (status)"
		);
	}

	public function create_branch( array $data ) {
		if ( empty( $data['name'] ) || empty( $data['code'] ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'name and code are required.' );
		}
		if ( isset( $data['type'] ) && ! in_array( $data['type'], self::TYPES, true ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'Invalid type.', array( 'field' => 'type' ) );
		}
		if ( $this->find_by_code( $data['code'] ) ) {
			return new WP_Error( VPOS_Response::ERROR_CONFLICT, 'Branch code already exists for this brand.', array( 'field' => 'code' ) );
		}
		$data = wp_parse_args( $data, array( 'status' => 'active', 'type' => 'physical', 'metadata' => '{}' ) );
		if ( is_array( $data['metadata'] ) ) {
			$data['metadata'] = wp_json_encode( $data['metadata'] );
		}
		$id = $this->insert( $data );
		VPOS_Audit::log( 'branch:create', 'branch', $id, null, $data );
		return $id;
	}

	public function find_by_code( $code ) {
		global $wpdb;
		return $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$this->table_name()} WHERE code = %s AND deleted_at IS NULL", $code ),
			ARRAY_A
		);
	}

	public function update_branch( $id, array $data ) {
		$before = $this->find( $id );
		if ( ! $before ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Branch not found.' );
		}
		if ( isset( $data['status'] ) && ! in_array( $data['status'], self::STATUSES, true ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'Invalid status.', array( 'field' => 'status' ) );
		}
		if ( isset( $data['metadata'] ) && is_array( $data['metadata'] ) ) {
			$data['metadata'] = wp_json_encode( $data['metadata'] );
		}
		unset( $data['code'] );
		$this->update( $id, $data );
		VPOS_Audit::log( 'branch:update', 'branch', $id, $before, $data );
		return $this->find( $id );
	}

	/** Soft delete only — archived branches drop out of the default active list. */
	public function archive( $id ) {
		$before = $this->find( $id );
		if ( ! $before ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Branch not found.' );
		}
		global $wpdb;
		$wpdb->update(
			$this->table_name(),
			array( 'status' => 'archived', 'deleted_at' => current_time( 'mysql', true ) ),
			array( 'id' => $id )
		);
		VPOS_Audit::log( 'branch:archive', 'branch', $id, $before, array( 'status' => 'archived' ) );
		return true;
	}

	/** Active list excludes archived branches unless explicitly requested. */
	public function paginate_active( $page = 1, $limit = 20, array $filters = array() ) {
		if ( empty( $filters['include_archived'] ) ) {
			$filters['status'] = isset( $filters['status'] ) ? $filters['status'] : array_diff( self::STATUSES, array( 'archived' ) );
		}
		unset( $filters['include_archived'] );
		return $this->paginate( $filters, $page, $limit );
	}
}

VPOS_Branch_Repository::schema();
