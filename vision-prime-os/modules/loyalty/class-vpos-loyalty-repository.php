<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Loyalty Engine (Master Spec §16): a points ledger built on the same
 * append-only VPOS_Ledger trait as Wallet, plus a small tier table.
 * Tier is always derived from lifetime earned points — never a field
 * the customer or staff can set directly.
 */
class VPOS_Loyalty_Repository {

	use VPOS_Ledger;

	protected function table_name() {
		return VPOS_Migrator::table( 'vpos_loyalty_ledger' );
	}

	public static function schema() {
		VPOS_Migrator::register(
			'vpos_loyalty_ledger',
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			account_id BIGINT UNSIGNED NOT NULL,
			amount DECIMAL(18,2) NOT NULL,
			direction VARCHAR(8) NOT NULL,
			transaction_type VARCHAR(32) NOT NULL DEFAULT 'manual',
			status VARCHAR(16) NOT NULL DEFAULT 'confirmed',
			reversal_of_id BIGINT UNSIGNED NULL,
			reason VARCHAR(255) NULL,
			performed_by BIGINT UNSIGNED NULL,
			order_id BIGINT UNSIGNED NULL,
			metadata LONGTEXT NULL,
			created_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			KEY account_id (account_id),
			KEY order_id (order_id)"
		);

		VPOS_Migrator::register(
			'vpos_loyalty_tiers',
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			name VARCHAR(64) NOT NULL,
			min_points DECIMAL(18,2) NOT NULL DEFAULT 0,
			multiplier DECIMAL(5,2) NOT NULL DEFAULT 1,
			sort_order INT UNSIGNED NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL,
			PRIMARY KEY  (id)"
		);
	}

	private function enabled() {
		$settings = ( new VPOS_Brand_Settings_Repository() )->get_for_current_site();
		if ( $settings && ! $settings['loyalty_enabled'] ) {
			return new WP_Error( VPOS_Response::ERROR_BUSINESS, 'Loyalty is disabled for this brand.' );
		}
		return true;
	}

	public function earn( $customer_id, $points, $transaction_type = 'manual', array $extra = array() ) {
		$gate = $this->enabled();
		if ( is_wp_error( $gate ) ) {
			return $gate;
		}
		return $this->append_entry( array_merge( $extra, array(
			'account_id'       => $customer_id,
			'amount'           => $points,
			'direction'        => 'credit',
			'transaction_type' => $transaction_type,
			'status'           => 'confirmed',
			'performed_by'     => get_current_user_id(),
		) ) );
	}

	/** Redemptions are the only debit path; see VPOS_Reward_Repository::redeem(). Never lets points go negative. */
	public function spend( $customer_id, $points, $transaction_type = 'redemption', array $extra = array() ) {
		$gate = $this->enabled();
		if ( is_wp_error( $gate ) ) {
			return $gate;
		}
		if ( $this->balance( $customer_id ) < $points ) {
			return new WP_Error( VPOS_Response::ERROR_BUSINESS, 'Insufficient points balance.' );
		}
		return $this->append_entry( array_merge( $extra, array(
			'account_id'       => $customer_id,
			'amount'           => $points,
			'direction'        => 'debit',
			'transaction_type' => $transaction_type,
			'status'           => 'confirmed',
			'performed_by'     => get_current_user_id(),
		) ) );
	}

	public function reverse( $entry_id, $reason ) {
		global $wpdb;
		$entry = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$this->table_name()} WHERE id = %d", $entry_id ), ARRAY_A );
		if ( $entry && 'reversal' === $entry['transaction_type'] ) {
			return new WP_Error( VPOS_Response::ERROR_BUSINESS, 'A reversal entry cannot itself be reversed.' );
		}
		return $this->reverse_entry( $entry_id, $reason );
	}

	public function balance( $customer_id ) {
		return $this->confirmed_balance( 'account_id', $customer_id );
	}

	/** Lifetime points earned (credits only) drives tier — spending points must never demote a customer. */
	public function lifetime_points( $customer_id ) {
		global $wpdb;
		$sql = "SELECT SUM(amount) FROM {$this->table_name()} WHERE account_id = %d AND direction = 'credit' AND status = 'confirmed'";
		return (float) $wpdb->get_var( $wpdb->prepare( $sql, $customer_id ) );
	}

	public function get_ledger( $customer_id, $page = 1, $limit = 20 ) {
		global $wpdb;
		$page   = max( 1, (int) $page );
		$limit  = max( 1, min( 200, (int) $limit ) );
		$offset = ( $page - 1 ) * $limit;
		$table  = $this->table_name();
		$total  = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE account_id = %d", $customer_id ) );
		$rows   = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE account_id = %d ORDER BY id DESC LIMIT %d OFFSET %d", $customer_id, $limit, $offset ),
			ARRAY_A
		);
		return array( 'items' => $rows, 'total' => $total, 'page' => $page, 'limit' => $limit );
	}

	/* ---------------- tiers ---------------- */

	public function list_tiers() {
		global $wpdb;
		$table = VPOS_Migrator::table( 'vpos_loyalty_tiers' );
		return $wpdb->get_results( "SELECT * FROM {$table} ORDER BY min_points ASC", ARRAY_A );
	}

	public function create_tier( array $data ) {
		if ( empty( $data['name'] ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'name is required.', array( 'field' => 'name' ) );
		}
		global $wpdb;
		$data = wp_parse_args( $data, array( 'min_points' => 0, 'multiplier' => 1, 'sort_order' => 0 ) );
		$data['created_at'] = current_time( 'mysql', true );
		$wpdb->insert( VPOS_Migrator::table( 'vpos_loyalty_tiers' ), $data );
		return (int) $wpdb->insert_id;
	}

	/** The highest tier whose min_points threshold the customer's lifetime points have crossed. */
	public function current_tier( $customer_id ) {
		$lifetime = $this->lifetime_points( $customer_id );
		$matched  = null;
		foreach ( $this->list_tiers() as $tier ) {
			if ( $lifetime >= (float) $tier['min_points'] ) {
				$matched = $tier;
			}
		}
		return $matched;
	}

	/** Earns points for a completed order, rate driven by brand_settings.settings.points_rate (points per currency unit), multiplied by the customer's current tier. */
	public function apply_order_points( $order_id, array $order ) {
		$settings = ( new VPOS_Brand_Settings_Repository() )->get_for_current_site();
		if ( ! $settings || ! $settings['loyalty_enabled'] ) {
			return;
		}
		$config = json_decode( $settings['settings'] ?: '{}', true );
		$rate   = (float) ( $config['points_rate'] ?? 0 );
		if ( $rate <= 0 ) {
			return;
		}
		$tier       = $this->current_tier( $order['customer_id'] );
		$multiplier = $tier ? (float) $tier['multiplier'] : 1;
		$points     = round( (float) $order['total'] * $rate * $multiplier, 2 );
		if ( $points <= 0 ) {
			return;
		}
		$this->earn( $order['customer_id'], $points, 'order_points', array( 'order_id' => $order_id, 'reason' => 'Points for order ' . $order['order_number'] ) );
	}

	public function reverse_order_points( $order_id ) {
		global $wpdb;
		$table = $this->table_name();
		$ids   = $wpdb->get_col( $wpdb->prepare( "SELECT id FROM {$table} WHERE order_id = %d AND transaction_type = 'order_points' AND status = 'confirmed'", $order_id ) );
		foreach ( $ids as $id ) {
			$this->reverse( $id, 'Order cancelled' );
		}
	}
}

VPOS_Loyalty_Repository::schema();
