<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reward Engine (Master Spec §17). A catalog of redeemable rewards plus
 * an append-only redemption log; redeeming always debits the points
 * ledger through VPOS_Loyalty_Repository — never decrements a balance
 * field directly.
 */
class VPOS_Reward_Repository extends VPOS_Repository {

	protected $table = 'vpos_rewards';

	const STATUSES = array( 'active', 'inactive', 'archived' );

	public static function schema() {
		VPOS_Migrator::register(
			'vpos_rewards',
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			name VARCHAR(190) NOT NULL,
			description TEXT NULL,
			points_cost DECIMAL(18,2) NOT NULL,
			stock INT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'active',
			metadata LONGTEXT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME NULL,
			PRIMARY KEY  (id),
			KEY status (status)"
		);

		VPOS_Migrator::register(
			'vpos_reward_redemptions',
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			customer_id BIGINT UNSIGNED NOT NULL,
			reward_id BIGINT UNSIGNED NOT NULL,
			points_spent DECIMAL(18,2) NOT NULL,
			ledger_entry_id BIGINT UNSIGNED NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'redeemed',
			created_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			KEY customer_id (customer_id),
			KEY reward_id (reward_id)"
		);
	}

	public function create_reward( array $data ) {
		if ( empty( $data['name'] ) || ! isset( $data['points_cost'] ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'name and points_cost are required.' );
		}
		$data = wp_parse_args( $data, array( 'status' => 'active', 'stock' => null, 'metadata' => '{}' ) );
		if ( is_array( $data['metadata'] ) ) {
			$data['metadata'] = wp_json_encode( $data['metadata'] );
		}
		return $this->insert( $data );
	}

	public function update_reward( $id, array $data ) {
		if ( isset( $data['status'] ) && ! in_array( $data['status'], self::STATUSES, true ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'Invalid status.', array( 'field' => 'status' ) );
		}
		$this->update( $id, $data );
		return $this->find( $id );
	}

	public function list_active( $page = 1, $limit = 20 ) {
		return $this->paginate( array( 'status' => 'active' ), $page, $limit );
	}

	/** Redeems a reward: debits points, decrements stock if tracked, writes an append-only redemption log. Wrapped so a points-debit failure never decrements stock. */
	public function redeem( $customer_id, $reward_id ) {
		$reward = $this->find( $reward_id );
		if ( ! $reward || 'active' !== $reward['status'] ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Reward not available.' );
		}
		if ( null !== $reward['stock'] && (int) $reward['stock'] <= 0 ) {
			return new WP_Error( VPOS_Response::ERROR_BUSINESS, 'Reward is out of stock.' );
		}
		$loyalty = new VPOS_Loyalty_Repository();
		$entry   = $loyalty->spend( $customer_id, $reward['points_cost'], 'redemption', array( 'reason' => 'Redeemed ' . $reward['name'] ) );
		if ( is_wp_error( $entry ) ) {
			return $entry;
		}
		global $wpdb;
		$wpdb->insert(
			VPOS_Migrator::table( 'vpos_reward_redemptions' ),
			array(
				'customer_id'     => $customer_id,
				'reward_id'       => $reward_id,
				'points_spent'    => $reward['points_cost'],
				'ledger_entry_id' => $entry,
				'status'          => 'redeemed',
				'created_at'      => current_time( 'mysql', true ),
			)
		);
		if ( null !== $reward['stock'] ) {
			$this->update( $reward_id, array( 'stock' => $reward['stock'] - 1 ) );
		}
		VPOS_Audit::log( 'reward:redeem', 'reward_redemption', $wpdb->insert_id, null, array( 'customer_id' => $customer_id, 'reward_id' => $reward_id ) );
		return (int) $wpdb->insert_id;
	}

	public function get_redemptions( $customer_id, $page = 1, $limit = 20 ) {
		global $wpdb;
		$page   = max( 1, (int) $page );
		$limit  = max( 1, min( 200, (int) $limit ) );
		$offset = ( $page - 1 ) * $limit;
		$table  = VPOS_Migrator::table( 'vpos_reward_redemptions' );
		$total  = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE customer_id = %d", $customer_id ) );
		$rows   = $wpdb->get_results(
			$wpdb->prepare( "SELECT r.*, w.name FROM {$table} r LEFT JOIN " . VPOS_Migrator::table( 'vpos_rewards' ) . " w ON w.id = r.reward_id WHERE r.customer_id = %d ORDER BY r.id DESC LIMIT %d OFFSET %d", $customer_id, $limit, $offset ),
			ARRAY_A
		);
		return array( 'items' => $rows, 'total' => $total, 'page' => $page, 'limit' => $limit );
	}
}

VPOS_Reward_Repository::schema();
