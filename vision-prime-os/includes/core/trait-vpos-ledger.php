<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Shared append-only ledger mechanics (Master Spec §15: wallet cashback,
 * and later points/coins ledgers). Balance is always SUM(credits-debits)
 * over confirmed entries — never a stored, directly-editable number.
 * Repositories using this trait must define a table with at least:
 * id, account_id, amount, direction(credit|debit), status, reversal_of_id.
 */
trait VPOS_Ledger {

	abstract protected function table_name();

	public function append_entry( array $entry ) {
		global $wpdb;
		if ( empty( $entry['direction'] ) || ! in_array( $entry['direction'], array( 'credit', 'debit' ), true ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'direction must be credit or debit.' );
		}
		if ( ! isset( $entry['amount'] ) || $entry['amount'] <= 0 ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'amount must be a positive number.' );
		}
		$entry['created_at'] = current_time( 'mysql', true );
		$wpdb->insert( $this->table_name(), $entry );
		$id = (int) $wpdb->insert_id;

		VPOS_Audit::log(
			'ledger:' . ( $entry['transaction_type'] ?? 'entry' ),
			$this->table_name(),
			$id,
			null,
			$entry
		);

		return $id;
	}

	/** Reverses a confirmed entry by writing the opposite-direction entry — never mutates the original. */
	public function reverse_entry( $entry_id, $reason ) {
		global $wpdb;
		$original = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$this->table_name()} WHERE id = %d", $entry_id ), ARRAY_A );
		if ( ! $original ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Ledger entry not found.' );
		}
		if ( 'confirmed' !== $original['status'] ) {
			return new WP_Error( VPOS_Response::ERROR_BUSINESS, 'Only confirmed entries can be reversed.' );
		}

		$reversal                     = $original;
		unset( $reversal['id'] );
		$reversal['direction']        = 'credit' === $original['direction'] ? 'debit' : 'credit';
		$reversal['transaction_type'] = 'reversal';
		$reversal['status']           = 'confirmed';
		$reversal['reversal_of_id']   = $entry_id;
		$reversal['reason']           = $reason;

		return $this->append_entry( $reversal );
	}

	public function confirmed_balance( $account_column, $account_id ) {
		global $wpdb;
		$sql = "SELECT
				SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) -
				SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END) AS balance
			FROM {$this->table_name()}
			WHERE {$account_column} = %d AND status = 'confirmed'";
		return (float) $wpdb->get_var( $wpdb->prepare( $sql, $account_id ) );
	}
}
