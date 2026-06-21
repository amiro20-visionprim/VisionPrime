<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array $result */
?>
<div class="wrap">
	<h1><?php esc_html_e( 'Orders', 'vpos' ); ?></h1>

	<?php if ( ! empty( $_GET['vpos_error'] ) ) : ?>
		<div class="notice notice-error"><p><?php echo esc_html( wp_unslash( $_GET['vpos_error'] ) ); ?></p></div>
	<?php endif; ?>

	<h2><?php esc_html_e( 'New Order', 'vpos' ); ?></h2>
	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="vpos_create_order" />
		<?php wp_nonce_field( 'vpos_create_order' ); ?>
		<table class="form-table">
			<tr><th><label for="customer_id"><?php esc_html_e( 'Customer ID', 'vpos' ); ?></label></th>
				<td><input type="number" id="customer_id" name="customer_id" required /></td></tr>
			<tr><th><label for="product_name"><?php esc_html_e( 'Product', 'vpos' ); ?></label></th>
				<td><input type="text" id="product_name" name="product_name" class="regular-text" /></td></tr>
			<tr><th><label for="quantity"><?php esc_html_e( 'Quantity', 'vpos' ); ?></label></th>
				<td><input type="number" id="quantity" name="quantity" value="1" min="1" /></td></tr>
			<tr><th><label for="unit_price"><?php esc_html_e( 'Unit Price', 'vpos' ); ?></label></th>
				<td><input type="number" id="unit_price" name="unit_price" step="0.01" /></td></tr>
		</table>
		<?php submit_button( __( 'Create Order', 'vpos' ) ); ?>
	</form>

	<h2><?php esc_html_e( 'All Orders', 'vpos' ); ?></h2>
	<table class="widefat striped">
		<thead><tr>
			<th><?php esc_html_e( 'Order #', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Customer ID', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Status', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Total', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Date', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Actions', 'vpos' ); ?></th>
		</tr></thead>
		<tbody>
		<?php foreach ( $result['items'] as $order ) : ?>
			<tr>
				<td><?php echo esc_html( $order['order_number'] ); ?></td>
				<td><?php echo esc_html( $order['customer_id'] ); ?></td>
				<td><?php echo esc_html( $order['status'] ); ?></td>
				<td><?php echo esc_html( $order['total'] ); ?></td>
				<td><?php echo esc_html( $order['created_at'] ); ?></td>
				<td><a href="<?php echo esc_url( admin_url( 'admin.php?page=vpos-order-edit&id=' . $order['id'] ) ); ?>"><?php esc_html_e( 'View', 'vpos' ); ?></a></td>
			</tr>
		<?php endforeach; ?>
		<?php if ( ! $result['items'] ) : ?>
			<tr><td colspan="6"><?php esc_html_e( 'No orders yet.', 'vpos' ); ?></td></tr>
		<?php endif; ?>
		</tbody>
	</table>
</div>
