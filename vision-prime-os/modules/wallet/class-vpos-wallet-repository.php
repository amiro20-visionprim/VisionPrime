<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Wallet Ledger Engine (Master Spec §15). Append-only by construction:
 * uses VPOS_Ledger so the balance is always SUM(credits-debits) over
 * confirmed entries, never a stored field anyone could edit directly.
 * Corrections are reversal entries, never edits or deletes.
 */
class VPOS_Wallet_Repository {

	use VPOS_Ledger;

	protected function table_name() {
		return VPOS_Migrator::table( 'vpos_wallet_ledger' );
	}

	public static function schema() {
		VPOS_Migrator::register(
			'vpos_wallet_ledger',
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
	}

	private function ensure_wallet_enabled() {
		$settings = ( new VPOS_Brand_Settings_Repository() )->get_for_current_site();
		if ( $settings && ! $settings['wallet_enabled'] ) {
			return new WP_Error( VPOS_Response::ERROR_BUSINESS, 'Wallet is disabled for this brand.' );
		}
		return true;
	}

	private function ensure_customer( $customer_id ) {
		return ( new VPOS_Customer_Repository() )->find( $customer_id ) ? true :
			new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Customer not found.' );
	}

	public function credit( $customer_id, $amount, $transaction_type = 'manual', array $extra = array() ) {
		$gate = $this->gate( $customer_id );
		if ( is_wp_error( $gate ) ) {
			return $gate;
		}
		return $this->append_entry( array_merge( $extra, array(
			'account_id'       => $customer_id,
			'amount'           => $amount,
			'direction'        => 'credit',
			'transaction_type' => $transaction_type,
			'status'           => 'confirmed',
			'performed_by'     => get_current_user_id(),
		) ) );
	}

	/** Never lets a debit push the balance negative — no overdraft wallets. */
	public function debit( $customer_id, $amount, $transaction_type = 'manual', array $extra = array() ) {
		$gate = $this->gate( $customer_id );
		if ( is_wp_error( $gate ) ) {
			return $gate;
		}
		if ( $this->confirmed_balance( 'account_id', $customer_id ) < $amount ) {
			return new WP_Error( VPOS_Response::ERROR_BUSINESS, 'Insufficient wallet balance.' );
		}
		return $this->append_entry( array_merge( $extra, array(
			'account_id'       => $customer_id,
			'amount'           => $amount,
			'direction'        => 'debit',
			'transaction_type' => $transaction_type,
			'status'           => 'confirmed',
			'performed_by'     => get_current_user_id(),
		) ) );
	}

	/** Reversal entries cannot themselves be reversed — that would let a correction be "corrected" indefinitely instead of just re-crediting/re-debiting fresh. */
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

	private function gate( $customer_id ) {
		$enabled = $this->ensure_wallet_enabled();
		if ( is_wp_error( $enabled ) ) {
			return $enabled;
		}
		return $this->ensure_customer( $customer_id );
	}

	/** Cashback on completed orders, driven by brand_settings.settings.cashback_rate (0 = disabled). Reversed automatically when the order is cancelled. */
	public function apply_order_cashback( $order_id, array $order ) {
		$settings = ( new VPOS_Brand_Settings_Repository() )->get_for_current_site();
		if ( ! $settings || ! $settings['wallet_enabled'] ) {
			return;
		}
		$config = json_decode( $settings['settings'] ?: '{}', true );
		$rate   = (float) ( $config['cashback_rate'] ?? 0 );
		if ( $rate <= 0 ) {
			return;
		}
		$amount = round( (float) $order['total'] * $rate, 2 );
		if ( $amount <= 0 ) {
			return;
		}
		$this->credit( $order['customer_id'], $amount, 'order_cashback', array( 'order_id' => $order_id, 'reason' => 'Cashback for order ' . $order['order_number'] ) );
	}

	/** Reverses every confirmed cashback entry tied to this order — never deletes, only writes opposite entries. */
	public function reverse_order_cashback( $order_id ) {
		global $wpdb;
		$table = $this->table_name();
		$ids   = $wpdb->get_col( $wpdb->prepare( "SELECT id FROM {$table} WHERE order_id = %d AND transaction_type = 'order_cashback' AND status = 'confirmed'", $order_id ) );
		foreach ( $ids as $id ) {
			$this->reverse( $id, 'Order cancelled' );
		}
	}
}

VPOS_Wallet_Repository::schema();
