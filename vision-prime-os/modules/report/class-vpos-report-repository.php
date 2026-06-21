<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reports (Master Spec §29): read-only aggregate queries over the tables
 * other modules already own. No table of its own, no caching — every
 * call reflects the current state, kept fast by being a small number of
 * indexed aggregate queries rather than a materialized rollup job.
 */
class VPOS_Report_Repository {

	public function revenue_summary( $from = null, $to = null ) {
		global $wpdb;
		$table   = VPOS_Migrator::table( 'vpos_orders' );
		$clauses = array( "status = 'completed'" );
		$values  = array();
		if ( $from ) {
			$clauses[] = 'created_at >= %s';
			$values[]  = $from;
		}
		if ( $to ) {
			$clauses[] = 'created_at <= %s';
			$values[]  = $to;
		}
		$sql = "SELECT COUNT(*) AS order_count, COALESCE(SUM(total),0) AS revenue, COALESCE(AVG(total),0) AS average_order_value
			FROM {$table} WHERE " . implode( ' AND ', $clauses );
		return $wpdb->get_row( $values ? $wpdb->prepare( $sql, $values ) : $sql, ARRAY_A );
	}

	public function customer_growth( $from = null, $to = null ) {
		global $wpdb;
		$table   = VPOS_Migrator::table( 'vpos_customers' );
		$clauses = array( 'deleted_at IS NULL' );
		$values  = array();
		if ( $from ) {
			$clauses[] = 'created_at >= %s';
			$values[]  = $from;
		}
		if ( $to ) {
			$clauses[] = 'created_at <= %s';
			$values[]  = $to;
		}
		$sql = "SELECT COUNT(*) AS new_customers FROM {$table} WHERE " . implode( ' AND ', $clauses );
		return $wpdb->get_row( $values ? $wpdb->prepare( $sql, $values ) : $sql, ARRAY_A );
	}

	/** Total wallet balance still owed to customers — an operating liability, not "income". */
	public function wallet_liability() {
		global $wpdb;
		$table = VPOS_Migrator::table( 'vpos_wallet_ledger' );
		return (float) $wpdb->get_var(
			"SELECT SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END) FROM {$table} WHERE status = 'confirmed'"
		);
	}

	public function loyalty_liability() {
		global $wpdb;
		$table = VPOS_Migrator::table( 'vpos_loyalty_ledger' );
		return (float) $wpdb->get_var(
			"SELECT SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END) FROM {$table} WHERE status = 'confirmed'"
		);
	}

	public function campaign_performance( $campaign_id ) {
		global $wpdb;
		$table = VPOS_Migrator::table( 'vpos_notifications' );
		return $wpdb->get_row(
			$wpdb->prepare(
				"SELECT COUNT(*) AS total,
					SUM(status = 'sent') AS sent,
					SUM(status = 'failed') AS failed,
					SUM(status = 'read') AS read_count
				FROM {$table} WHERE campaign_id = %d",
				$campaign_id
			),
			ARRAY_A
		);
	}

	public function top_customers( $limit = 10 ) {
		global $wpdb;
		$table = VPOS_Migrator::table( 'vpos_customers' );
		return $wpdb->get_results(
			$wpdb->prepare( "SELECT id, primary_mobile, first_name, last_name, total_spent, lifetime_value FROM {$table} WHERE deleted_at IS NULL ORDER BY lifetime_value DESC LIMIT %d", $limit ),
			ARRAY_A
		);
	}
}
