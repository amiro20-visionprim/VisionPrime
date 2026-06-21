<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * AI Intelligence Layer (Master Spec §33): every insight is suggest-then-
 * approve, never auto-applied. The approval action vocabulary is
 * deliberately a strict subset of Automation's (add_tag, notify, tag a
 * segment-worthy customer) — loyalty_earn/wallet_credit are not present
 * here at all, so "AI never executes financial actions" is impossible to
 * violate by construction, not just by review-gate policy.
 */
class VPOS_Ai_Repository extends VPOS_Repository {

	protected $table = 'vpos_ai_insights';

	const TYPES    = array( 'churn_risk' );
	const STATUSES = array( 'suggested', 'approved', 'rejected' );
	/** Deliberately excludes loyalty_earn/wallet_credit — see class docblock. */
	const ACTIONS  = array( 'add_tag', 'notify' );

	public static function schema() {
		VPOS_Migrator::register(
			'vpos_ai_insights',
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			type VARCHAR(32) NOT NULL,
			customer_id BIGINT UNSIGNED NULL,
			payload LONGTEXT NULL,
			suggested_action LONGTEXT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'suggested',
			reviewed_by BIGINT UNSIGNED NULL,
			reviewed_at DATETIME NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME NULL,
			PRIMARY KEY  (id),
			KEY type (type),
			KEY customer_id (customer_id),
			KEY status (status)"
		);
	}

	/** Scans customers for churn risk (no purchase in 90+ days, not already churned/blocked) and suggests a re-engagement insight per match, skipping customers with an open suggestion already. */
	public function generate_churn_risk_insights( $days_inactive = 90 ) {
		global $wpdb;
		$customers = VPOS_Migrator::table( 'vpos_customers' );
		$cutoff    = gmdate( 'Y-m-d H:i:s', time() - $days_inactive * DAY_IN_SECONDS );
		$rows      = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, first_name, last_name, last_purchase_at FROM {$customers}
				WHERE deleted_at IS NULL AND status NOT IN ('churned','blocked')
				AND last_purchase_at IS NOT NULL AND last_purchase_at < %s",
				$cutoff
			),
			ARRAY_A
		);

		$created = array();
		foreach ( $rows as $row ) {
			if ( $this->has_open_insight( 'churn_risk', $row['id'] ) ) {
				continue;
			}
			$created[] = $this->insert(
				array(
					'type'             => 'churn_risk',
					'customer_id'      => $row['id'],
					'payload'          => wp_json_encode( array( 'last_purchase_at' => $row['last_purchase_at'] ) ),
					'suggested_action' => wp_json_encode( array( 'type' => 'notify', 'params' => array( 'channel' => 'sms', 'title' => 'We miss you', 'body' => 'Come back for a special offer!' ) ) ),
					'status'           => 'suggested',
				)
			);
		}
		return $created;
	}

	private function has_open_insight( $type, $customer_id ) {
		global $wpdb;
		return (bool) $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$this->table_name()} WHERE type = %s AND customer_id = %d AND status = 'suggested' AND deleted_at IS NULL",
				$type,
				$customer_id
			)
		);
	}

	public function approve( $id, $reviewer_id ) {
		$insight = $this->find( $id );
		if ( ! $insight ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Insight not found.' );
		}
		if ( 'suggested' !== $insight['status'] ) {
			return new WP_Error( VPOS_Response::ERROR_CONFLICT, 'Insight already reviewed.' );
		}
		$action = json_decode( $insight['suggested_action'], true ) ?: array();
		$result = $this->execute_action( $insight['customer_id'], $action );
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		$this->update( $id, array( 'status' => 'approved', 'reviewed_by' => $reviewer_id, 'reviewed_at' => current_time( 'mysql', true ) ) );
		VPOS_Audit::log( 'ai:approve', 'vpos_ai_insights', $id, null, $action );
		return true;
	}

	public function reject( $id, $reviewer_id ) {
		$insight = $this->find( $id );
		if ( ! $insight ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Insight not found.' );
		}
		if ( 'suggested' !== $insight['status'] ) {
			return new WP_Error( VPOS_Response::ERROR_CONFLICT, 'Insight already reviewed.' );
		}
		$this->update( $id, array( 'status' => 'rejected', 'reviewed_by' => $reviewer_id, 'reviewed_at' => current_time( 'mysql', true ) ) );
		VPOS_Audit::log( 'ai:reject', 'vpos_ai_insights', $id );
		return true;
	}

	/** Only ever dispatches the non-financial vocabulary in self::ACTIONS — never loyalty/wallet. */
	private function execute_action( $customer_id, array $action ) {
		$type   = $action['type'] ?? '';
		$params = $action['params'] ?? array();
		if ( ! in_array( $type, self::ACTIONS, true ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'Unsupported AI action type.' );
		}
		switch ( $type ) {
			case 'add_tag':
				( new VPOS_Customer_Repository() )->add_tag( $customer_id, $params['tag'] ?? '' );
				return true;
			case 'notify':
				( new VPOS_Notification_Repository() )->queue( $customer_id, $params['channel'] ?? 'in_app', $params['title'] ?? '', $params['body'] ?? '' );
				return true;
		}
		return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'Unsupported AI action type.' );
	}
}

VPOS_Ai_Repository::schema();
