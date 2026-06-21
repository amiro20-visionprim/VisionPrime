<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Order Engine (Master Spec §14). Orders belong to the brand's own site
 * (no brand_id needed) and are branch-scoped. Completing/cancelling an
 * order updates the customer's rollup metrics here, and fires hooks so
 * later phases (Wallet, Loyalty) can react without this class knowing
 * about them.
 */
class VPOS_Order_Repository extends VPOS_Repository {

	protected $table         = 'vpos_orders';
	protected $branch_scoped = true;

	const STATUSES = array( 'pending', 'completed', 'cancelled', 'refunded' );

	public static function schema() {
		VPOS_Migrator::register(
			'vpos_orders',
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			order_number VARCHAR(40) NOT NULL,
			customer_id BIGINT UNSIGNED NOT NULL,
			branch_id BIGINT UNSIGNED NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'pending',
			subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
			discount_total DECIMAL(18,2) NOT NULL DEFAULT 0,
			tax_total DECIMAL(18,2) NOT NULL DEFAULT 0,
			total DECIMAL(18,2) NOT NULL DEFAULT 0,
			currency VARCHAR(8) NOT NULL DEFAULT 'IRR',
			payment_method VARCHAR(32) NULL,
			source VARCHAR(32) NULL,
			metadata LONGTEXT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY order_number (order_number),
			KEY customer_id (customer_id),
			KEY branch_id (branch_id),
			KEY status (status)"
		);

		VPOS_Migrator::register(
			'vpos_order_items',
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			order_id BIGINT UNSIGNED NOT NULL,
			product_name VARCHAR(190) NOT NULL,
			sku VARCHAR(64) NULL,
			quantity INT UNSIGNED NOT NULL DEFAULT 1,
			unit_price DECIMAL(18,2) NOT NULL DEFAULT 0,
			total DECIMAL(18,2) NOT NULL DEFAULT 0,
			metadata LONGTEXT NULL,
			PRIMARY KEY  (id),
			KEY order_id (order_id)"
		);
	}

	/** Creates an order + its line items in one call; customer must belong to this brand's site (already guaranteed: same DB). */
	public function create_order( array $data, array $items = array() ) {
		if ( empty( $data['customer_id'] ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'customer_id is required.', array( 'field' => 'customer_id' ) );
		}
		$customer = ( new VPOS_Customer_Repository() )->find( $data['customer_id'] );
		if ( ! $customer ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Customer not found.' );
		}
		$totals = $this->compute_totals( $items );
		$data   = wp_parse_args(
			array_merge( $data, $totals ),
			array(
				'order_number' => $this->generate_order_number(),
				'status'       => 'pending',
				'currency'     => 'IRR',
				'metadata'     => '{}',
			)
		);
		if ( is_array( $data['metadata'] ) ) {
			$data['metadata'] = wp_json_encode( $data['metadata'] );
		}
		$id = $this->insert( $data );
		foreach ( $items as $item ) {
			$this->add_item( $id, $item );
		}
		VPOS_Audit::log( 'order:create', 'order', $id, null, $data );
		return $id;
	}

	private function compute_totals( array $items ) {
		$subtotal = 0;
		foreach ( $items as $item ) {
			$subtotal += (float) $item['quantity'] * (float) $item['unit_price'];
		}
		return array( 'subtotal' => $subtotal, 'total' => $subtotal );
	}

	private function add_item( $order_id, array $item ) {
		global $wpdb;
		$total = (float) $item['quantity'] * (float) $item['unit_price'];
		$wpdb->insert(
			VPOS_Migrator::table( 'vpos_order_items' ),
			array(
				'order_id'     => $order_id,
				'product_name' => $item['product_name'],
				'sku'          => $item['sku'] ?? null,
				'quantity'     => $item['quantity'],
				'unit_price'   => $item['unit_price'],
				'total'        => $total,
				'metadata'     => wp_json_encode( $item['metadata'] ?? array() ),
			)
		);
	}

	public function get_items( $order_id ) {
		global $wpdb;
		$table = VPOS_Migrator::table( 'vpos_order_items' );
		return $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table} WHERE order_id = %d", $order_id ), ARRAY_A );
	}

	private function generate_order_number() {
		return 'ORD-' . gmdate( 'Ymd' ) . '-' . wp_generate_password( 6, false, false );
	}

	/** Completing an order applies its effect on the customer's rollup metrics and fires a hook for Wallet/Loyalty. */
	public function complete( $order_id ) {
		$order = $this->find( $order_id );
		if ( ! $order ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Order not found.' );
		}
		if ( 'completed' === $order['status'] ) {
			return $order;
		}
		$this->update( $order_id, array( 'status' => 'completed' ) );
		$this->apply_customer_effect( $order, 1 );
		VPOS_Audit::log( 'order:complete', 'order', $order_id, $order, array( 'status' => 'completed' ) );
		do_action( 'vpos_order_completed', $order_id, $order );
		return $this->find( $order_id );
	}

	/** Cancelling/refunding a completed order must reverse its earlier effect on the customer (never just delete history). */
	public function cancel( $order_id ) {
		$order = $this->find( $order_id );
		if ( ! $order ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Order not found.' );
		}
		$was_completed = 'completed' === $order['status'];
		$this->update( $order_id, array( 'status' => 'cancelled' ) );
		if ( $was_completed ) {
			$this->apply_customer_effect( $order, -1 );
		}
		VPOS_Audit::log( 'order:cancel', 'order', $order_id, $order, array( 'status' => 'cancelled' ) );
		do_action( 'vpos_order_cancelled', $order_id, $order, $was_completed );
		return $this->find( $order_id );
	}

	private function apply_customer_effect( array $order, $sign ) {
		$customers = new VPOS_Customer_Repository();
		$customer  = $customers->find( $order['customer_id'] );
		if ( ! $customer ) {
			return;
		}
		$count = max( 0, $customer['purchase_count'] + $sign );
		$spent = max( 0, $customer['total_spent'] + $sign * $order['total'] );
		$avg   = $count > 0 ? $spent / $count : 0;
		$update = array(
			'purchase_count'      => $count,
			'total_spent'         => $spent,
			'average_order_value' => $avg,
			'lifetime_value'      => $spent,
		);
		if ( $sign > 0 ) {
			$update['last_purchase_at'] = current_time( 'mysql', true );
			$update['status']           = 'new' === $customer['status'] ? 'active' : $customer['status'];
		}
		$customers->update_customer( $order['customer_id'], $update );
		$customers->log_event( $order['customer_id'], $sign > 0 ? 'order_completed' : 'order_cancelled', array( 'order_id' => $order['id'] ) );
	}
}

VPOS_Order_Repository::schema();
