<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Customer segments (Master Spec §16): a saved rule set, evaluated live
 * against the customer table on demand rather than materialized into a
 * membership table — segment membership is always current, never stale.
 */
class VPOS_Segment_Repository extends VPOS_Repository {

	protected $table = 'vpos_segments';

	public static function schema() {
		VPOS_Migrator::register(
			'vpos_segments',
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			name VARCHAR(190) NOT NULL,
			description TEXT NULL,
			rules LONGTEXT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME NULL,
			PRIMARY KEY  (id)"
		);
	}

	public function create_segment( array $data ) {
		if ( empty( $data['name'] ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'name is required.', array( 'field' => 'name' ) );
		}
		$data['rules'] = wp_json_encode( $data['rules'] ?? array() );
		$id            = $this->insert( $data );
		VPOS_Audit::log( 'segment:create', 'segment', $id, null, $data );
		return $id;
	}

	public function update_segment( $id, array $data ) {
		$before = $this->find( $id );
		if ( ! $before ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Segment not found.' );
		}
		if ( isset( $data['rules'] ) ) {
			$data['rules'] = wp_json_encode( $data['rules'] );
		}
		$this->update( $id, $data );
		VPOS_Audit::log( 'segment:update', 'segment', $id, $before, $data );
		return $this->find( $id );
	}

	/** Customer ids currently matching a saved segment's rules. */
	public function resolve_customer_ids( $segment_id ) {
		$segment = $this->find( $segment_id );
		return $segment ? $this->resolve_rule_customer_ids( json_decode( $segment['rules'], true ) ?: array() ) : array();
	}

	/**
	 * Evaluates an ad-hoc rule set against vpos_customers, without requiring
	 * a saved segment — lets the admin UI preview matches before saving.
	 * Supported keys: status, tags[], min_purchase_count, min_total_spent,
	 * min_lifetime_value, created_after, created_before.
	 */
	public function resolve_rule_customer_ids( array $rules ) {
		global $wpdb;
		$customers_table = VPOS_Migrator::table( 'vpos_customers' );
		$clauses         = array( 'deleted_at IS NULL' );
		$values          = array();

		if ( ! empty( $rules['status'] ) ) {
			$clauses[] = 'status = %s';
			$values[]  = $rules['status'];
		}
		if ( ! empty( $rules['min_purchase_count'] ) ) {
			$clauses[] = 'purchase_count >= %d';
			$values[]  = (int) $rules['min_purchase_count'];
		}
		if ( ! empty( $rules['min_total_spent'] ) ) {
			$clauses[] = 'total_spent >= %f';
			$values[]  = (float) $rules['min_total_spent'];
		}
		if ( ! empty( $rules['min_lifetime_value'] ) ) {
			$clauses[] = 'lifetime_value >= %f';
			$values[]  = (float) $rules['min_lifetime_value'];
		}
		if ( ! empty( $rules['created_after'] ) ) {
			$clauses[] = 'created_at >= %s';
			$values[]  = $rules['created_after'];
		}
		if ( ! empty( $rules['created_before'] ) ) {
			$clauses[] = 'created_at <= %s';
			$values[]  = $rules['created_before'];
		}

		$sql = "SELECT id FROM {$customers_table} WHERE " . implode( ' AND ', $clauses );
		$ids = $values ? $wpdb->get_col( $wpdb->prepare( $sql, $values ) ) : $wpdb->get_col( $sql );

		if ( ! empty( $rules['tags'] ) ) {
			$tags_table   = VPOS_Migrator::table( 'vpos_customer_tags' );
			$tags         = (array) $rules['tags'];
			$placeholders = implode( ',', array_fill( 0, count( $tags ), '%s' ) );
			$tagged_ids   = $wpdb->get_col( $wpdb->prepare( "SELECT DISTINCT customer_id FROM {$tags_table} WHERE tag IN ({$placeholders})", $tags ) );
			$ids          = array_values( array_intersect( $ids, $tagged_ids ) );
		}

		return array_map( 'intval', $ids );
	}

	public function count_customers( $segment_id ) {
		return count( $this->resolve_customer_ids( $segment_id ) );
	}
}

VPOS_Segment_Repository::schema();
