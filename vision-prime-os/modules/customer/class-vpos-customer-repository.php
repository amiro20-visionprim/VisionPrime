<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Customer Data Platform (Master Spec §12). Lives in the brand's own
 * site, so "duplicate detection is brand-scoped" is just a unique key on
 * this table — no brand_id filtering needed.
 */
class VPOS_Customer_Repository extends VPOS_Repository {

	protected $table = 'vpos_customers';

	const STATUSES = array( 'new', 'active', 'vip', 'at_risk', 'churned', 'dormant', 'blocked' );

	public static function schema() {
		VPOS_Migrator::register(
			'vpos_customers',
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			primary_mobile VARCHAR(32) NULL,
			primary_email VARCHAR(190) NULL,
			first_name VARCHAR(120) NULL,
			last_name VARCHAR(120) NULL,
			gender VARCHAR(16) NULL,
			birth_date DATE NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'new',
			source VARCHAR(32) NULL,
			main_branch_id BIGINT UNSIGNED NULL,
			first_seen_at DATETIME NULL,
			last_seen_at DATETIME NULL,
			last_purchase_at DATETIME NULL,
			purchase_count INT UNSIGNED NOT NULL DEFAULT 0,
			total_spent DECIMAL(18,2) NOT NULL DEFAULT 0,
			average_order_value DECIMAL(18,2) NOT NULL DEFAULT 0,
			lifetime_value DECIMAL(18,2) NOT NULL DEFAULT 0,
			churn_risk_score DECIMAL(5,2) NULL,
			metadata LONGTEXT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY primary_mobile (primary_mobile),
			KEY status (status)"
		);

		VPOS_Migrator::register(
			'vpos_customer_notes',
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			customer_id BIGINT UNSIGNED NOT NULL,
			author_id BIGINT UNSIGNED NULL,
			note TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			KEY customer_id (customer_id)"
		);

		VPOS_Migrator::register(
			'vpos_customer_tags',
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			customer_id BIGINT UNSIGNED NOT NULL,
			tag VARCHAR(64) NOT NULL,
			created_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY customer_tag (customer_id, tag)"
		);

		VPOS_Migrator::register(
			'vpos_customer_events',
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			customer_id BIGINT UNSIGNED NOT NULL,
			event_type VARCHAR(64) NOT NULL,
			payload LONGTEXT NULL,
			created_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			KEY customer_id (customer_id),
			KEY event_type (event_type)"
		);

		VPOS_Migrator::register(
			'vpos_customer_merge_logs',
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			primary_customer_id BIGINT UNSIGNED NOT NULL,
			merged_customer_id BIGINT UNSIGNED NOT NULL,
			performed_by BIGINT UNSIGNED NULL,
			metadata LONGTEXT NULL,
			created_at DATETIME NOT NULL,
			PRIMARY KEY  (id)"
		);
	}

	public function create_customer( array $data ) {
		if ( empty( $data['primary_mobile'] ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'primary_mobile is required.', array( 'field' => 'primary_mobile' ) );
		}
		if ( $this->find_by_mobile( $data['primary_mobile'] ) ) {
			return new WP_Error( VPOS_Response::ERROR_CONFLICT, 'A customer with this mobile already exists.', array( 'field' => 'primary_mobile' ) );
		}
		$now  = current_time( 'mysql', true );
		$data = wp_parse_args( $data, array( 'status' => 'new', 'source' => 'manual', 'first_seen_at' => $now, 'last_seen_at' => $now, 'metadata' => '{}' ) );
		if ( is_array( $data['metadata'] ) ) {
			$data['metadata'] = wp_json_encode( $data['metadata'] );
		}
		$id = $this->insert( $data );
		$this->log_event( $id, 'customer_created', array() );
		VPOS_Audit::log( 'customer:create', 'customer', $id, null, $data );
		return $id;
	}

	public function find_by_mobile( $mobile ) {
		global $wpdb;
		return $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$this->table_name()} WHERE primary_mobile = %s AND deleted_at IS NULL", $mobile ),
			ARRAY_A
		);
	}

	public function update_customer( $id, array $data ) {
		$before = $this->find( $id );
		if ( ! $before ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Customer not found.' );
		}
		if ( isset( $data['status'] ) && ! in_array( $data['status'], self::STATUSES, true ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'Invalid status.', array( 'field' => 'status' ) );
		}
		if ( isset( $data['metadata'] ) && is_array( $data['metadata'] ) ) {
			$data['metadata'] = wp_json_encode( $data['metadata'] );
		}
		$this->update( $id, $data );
		VPOS_Audit::log( 'customer:update', 'customer', $id, $before, $data );
		return $this->find( $id );
	}

	public function block( $id, $reason = '' ) {
		return $this->update_customer( $id, array( 'status' => 'blocked' ) );
	}

	/* ---------------- notes / tags / events / merge ---------------- */

	public function add_note( $customer_id, $note, $author_id = null ) {
		global $wpdb;
		$wpdb->insert(
			VPOS_Migrator::table( 'vpos_customer_notes' ),
			array(
				'customer_id' => $customer_id,
				'author_id'   => $author_id ?: get_current_user_id(),
				'note'        => $note,
				'created_at'  => current_time( 'mysql', true ),
			)
		);
		VPOS_Audit::log( 'customer:note:add', 'customer', $customer_id, null, array( 'note' => $note ) );
		return (int) $wpdb->insert_id;
	}

	public function add_tag( $customer_id, $tag ) {
		global $wpdb;
		$wpdb->insert(
			VPOS_Migrator::table( 'vpos_customer_tags' ),
			array( 'customer_id' => $customer_id, 'tag' => sanitize_key( $tag ), 'created_at' => current_time( 'mysql', true ) )
		);
		return (int) $wpdb->insert_id;
	}

	public function get_tags( $customer_id ) {
		global $wpdb;
		$table = VPOS_Migrator::table( 'vpos_customer_tags' );
		return $wpdb->get_col( $wpdb->prepare( "SELECT tag FROM {$table} WHERE customer_id = %d", $customer_id ) );
	}

	public function get_notes( $customer_id ) {
		global $wpdb;
		$table = VPOS_Migrator::table( 'vpos_customer_notes' );
		return $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table} WHERE customer_id = %d ORDER BY id DESC", $customer_id ), ARRAY_A );
	}

	public function log_event( $customer_id, $event_type, array $payload = array() ) {
		global $wpdb;
		$wpdb->insert(
			VPOS_Migrator::table( 'vpos_customer_events' ),
			array(
				'customer_id' => $customer_id,
				'event_type'  => $event_type,
				'payload'     => wp_json_encode( $payload ),
				'created_at'  => current_time( 'mysql', true ),
			)
		);
		return (int) $wpdb->insert_id;
	}

	public function get_events( $customer_id, $limit = 50 ) {
		global $wpdb;
		$table = VPOS_Migrator::table( 'vpos_customer_events' );
		return $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table} WHERE customer_id = %d ORDER BY id DESC LIMIT %d", $customer_id, $limit ), ARRAY_A );
	}

	/** Merges two customers: keeps $primary_id, soft-deletes $merged_id, writes an append-only merge log. */
	public function merge( $primary_id, $merged_id ) {
		$primary = $this->find( $primary_id );
		$merged  = $this->find( $merged_id );
		if ( ! $primary || ! $merged ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Both customers must exist.' );
		}
		global $wpdb;
		$wpdb->insert(
			VPOS_Migrator::table( 'vpos_customer_merge_logs' ),
			array(
				'primary_customer_id' => $primary_id,
				'merged_customer_id'  => $merged_id,
				'performed_by'        => get_current_user_id(),
				'metadata'            => wp_json_encode( array( 'merged_customer_snapshot' => $merged ) ),
				'created_at'          => current_time( 'mysql', true ),
			)
		);
		$this->update(
			$primary_id,
			array(
				'purchase_count' => $primary['purchase_count'] + $merged['purchase_count'],
				'total_spent'    => $primary['total_spent'] + $merged['total_spent'],
			)
		);
		$this->soft_delete( $merged_id );
		VPOS_Audit::log( 'customer:merge', 'customer', $primary_id, $merged, array( 'merged_into' => $primary_id ) );
		return $this->find( $primary_id );
	}
}

VPOS_Customer_Repository::schema();
