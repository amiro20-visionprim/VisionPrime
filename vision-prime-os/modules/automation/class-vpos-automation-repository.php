<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Automation Engine (Master Spec §18): "when X happens and conditions
 * match, do Y" rules. Triggers are existing domain events the plugin
 * already fires (vpos_customer_created, vpos_order_completed/cancelled);
 * conditions reuse the same rule language as Segments; actions are a
 * small fixed vocabulary (no arbitrary code execution) — Master Spec §30
 * "AI never auto-executes financial actions" extends here too: financial
 * actions (wallet credit, loyalty earn) are explicit, bounded, and every
 * run is logged append-only in vpos_automation_runs for audit.
 */
class VPOS_Automation_Repository extends VPOS_Repository {

	protected $table = 'vpos_automation_rules';

	const TRIGGERS = array( 'customer_created', 'order_completed', 'order_cancelled' );
	const ACTIONS   = array( 'add_tag', 'notify', 'loyalty_earn', 'wallet_credit' );

	public static function schema() {
		VPOS_Migrator::register(
			'vpos_automation_rules',
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			name VARCHAR(190) NOT NULL,
			trigger_event VARCHAR(32) NOT NULL,
			conditions LONGTEXT NULL,
			actions LONGTEXT NOT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'active',
			run_count INT UNSIGNED NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME NULL,
			PRIMARY KEY  (id),
			KEY trigger_event (trigger_event)"
		);

		VPOS_Migrator::register(
			'vpos_automation_runs',
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			rule_id BIGINT UNSIGNED NOT NULL,
			customer_id BIGINT UNSIGNED NOT NULL,
			trigger_event VARCHAR(32) NOT NULL,
			status VARCHAR(16) NOT NULL DEFAULT 'success',
			error TEXT NULL,
			created_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			KEY rule_id (rule_id),
			KEY customer_id (customer_id)"
		);
	}

	public function create_rule( array $data ) {
		if ( empty( $data['name'] ) || empty( $data['trigger_event'] ) || empty( $data['actions'] ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'name, trigger_event and actions are required.' );
		}
		if ( ! in_array( $data['trigger_event'], self::TRIGGERS, true ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'Invalid trigger_event.', array( 'field' => 'trigger_event' ) );
		}
		$data['conditions'] = wp_json_encode( $data['conditions'] ?? array() );
		$data['actions']    = wp_json_encode( $data['actions'] );
		$data               = wp_parse_args( $data, array( 'status' => 'active' ) );
		$id                 = $this->insert( $data );
		VPOS_Audit::log( 'automation:create', 'automation_rule', $id, null, $data );
		return $id;
	}

	public function update_rule( $id, array $data ) {
		$before = $this->find( $id );
		if ( ! $before ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Automation rule not found.' );
		}
		if ( isset( $data['conditions'] ) ) {
			$data['conditions'] = wp_json_encode( $data['conditions'] );
		}
		if ( isset( $data['actions'] ) ) {
			$data['actions'] = wp_json_encode( $data['actions'] );
		}
		$this->update( $id, $data );
		VPOS_Audit::log( 'automation:update', 'automation_rule', $id, $before, $data );
		return $this->find( $id );
	}

	public function list_active_for_trigger( $trigger_event ) {
		global $wpdb;
		return $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$this->table_name()} WHERE trigger_event = %s AND status = 'active' AND deleted_at IS NULL", $trigger_event ),
			ARRAY_A
		);
	}

	/** Runs every active rule for a trigger against one customer; never throws — failures are logged per-rule and don't block the other rules. */
	public function handle_event( $trigger_event, $customer_id, array $context = array() ) {
		foreach ( $this->list_active_for_trigger( $trigger_event ) as $rule ) {
			$conditions = json_decode( $rule['conditions'], true ) ?: array();
			if ( $conditions && ! $this->matches( $customer_id, $conditions ) ) {
				continue;
			}
			$this->run_rule( $rule, $customer_id, $context );
		}
	}

	private function matches( $customer_id, array $conditions ) {
		$ids = ( new VPOS_Segment_Repository() )->resolve_rule_customer_ids( $conditions );
		return in_array( (int) $customer_id, $ids, true );
	}

	private function run_rule( array $rule, $customer_id, array $context ) {
		$error = null;
		foreach ( json_decode( $rule['actions'], true ) ?: array() as $action ) {
			$result = $this->execute_action( $customer_id, $action, $context );
			if ( is_wp_error( $result ) ) {
				$error = $result->get_error_message();
				break;
			}
		}
		global $wpdb;
		$wpdb->insert(
			VPOS_Migrator::table( 'vpos_automation_runs' ),
			array(
				'rule_id'       => $rule['id'],
				'customer_id'   => $customer_id,
				'trigger_event' => $rule['trigger_event'],
				'status'        => $error ? 'failed' : 'success',
				'error'         => $error,
				'created_at'    => current_time( 'mysql', true ),
			)
		);
		$this->update( $rule['id'], array( 'run_count' => $rule['run_count'] + 1 ) );
	}

	/** Fixed, auditable action vocabulary — no arbitrary code execution, and financial actions go through the same gated repositories a human would use. */
	private function execute_action( $customer_id, array $action, array $context ) {
		$type   = $action['type'] ?? '';
		$params = $action['params'] ?? array();

		switch ( $type ) {
			case 'add_tag':
				( new VPOS_Customer_Repository() )->add_tag( $customer_id, $params['tag'] ?? '' );
				return true;
			case 'notify':
				( new VPOS_Notification_Repository() )->queue( $customer_id, $params['channel'] ?? 'in_app', $params['title'] ?? '', $params['body'] ?? '' );
				return true;
			case 'loyalty_earn':
				return ( new VPOS_Loyalty_Repository() )->earn( $customer_id, (float) ( $params['points'] ?? 0 ), 'automation' );
			case 'wallet_credit':
				return ( new VPOS_Wallet_Repository() )->credit( $customer_id, (float) ( $params['amount'] ?? 0 ), 'automation' );
			default:
				return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'Unknown action type: ' . $type );
		}
	}

	public function get_runs( $rule_id, $page = 1, $limit = 20 ) {
		global $wpdb;
		$page  = max( 1, (int) $page );
		$limit = max( 1, min( 200, (int) $limit ) );
		$table = VPOS_Migrator::table( 'vpos_automation_runs' );

		$total = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE rule_id = %d", $rule_id ) );
		$rows  = $wpdb->get_results(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE rule_id = %d ORDER BY id DESC LIMIT %d OFFSET %d", $rule_id, $limit, ( $page - 1 ) * $limit ),
			ARRAY_A
		);
		return array( 'items' => $rows, 'total' => $total, 'page' => $page, 'limit' => $limit );
	}
}

VPOS_Automation_Repository::schema();
