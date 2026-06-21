<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array|null $order */
/** @var array $items */
if ( ! $order ) {
	echo '<div class="wrap"><p>' . esc_html__( 'Order not found.', 'vpos' ) . '</p></div>';
	return;
}
?>
<div class="wrap">
	<h1><?php echo esc_html( $order['order_number'] ); ?></h1>

	<?php if ( ! empty( $_GET['vpos_error'] ) ) : ?>
		<div class="notice notice-error"><p><?php echo esc_html( wp_unslash( $_GET['vpos_error'] ) ); ?></p></div>
	<?php endif; ?>

	<table class="form-table">
		<tr><th><?php esc_html_e( 'Customer ID', 'vpos' ); ?></th><td><a href="<?php echo esc_url( admin_url( 'admin.php?page=vpos-customer-edit&id=' . $order['customer_id'] ) ); ?>"><?php echo esc_html( $order['customer_id'] ); ?></a></td></tr>
		<tr><th><?php esc_html_e( 'Status', 'vpos' ); ?></th><td><?php echo esc_html( $order['status'] ); ?></td></tr>
		<tr><th><?php esc_html_e( 'Subtotal', 'vpos' ); ?></th><td><?php echo esc_html( $order['subtotal'] ); ?></td></tr>
		<tr><th><?php esc_html_e( 'Total', 'vpos' ); ?></th><td><?php echo esc_html( $order['total'] ); ?></td></tr>
		<tr><th><?php esc_html_e( 'Currency', 'vpos' ); ?></th><td><?php echo esc_html( $order['currency'] ); ?></td></tr>
	</table>

	<h2><?php esc_html_e( 'Items', 'vpos' ); ?></h2>
	<table class="widefat striped">
		<thead><tr><th><?php esc_html_e( 'Product', 'vpos' ); ?></th><th><?php esc_html_e( 'Qty', 'vpos' ); ?></th><th><?php esc_html_e( 'Unit Price', 'vpos' ); ?></th><th><?php esc_html_e( 'Total', 'vpos' ); ?></th></tr></thead>
		<tbody>
		<?php foreach ( $items as $item ) : ?>
			<tr>
				<td><?php echo esc_html( $item['product_name'] ); ?></td>
				<td><?php echo esc_html( $item['quantity'] ); ?></td>
				<td><?php echo esc_html( $item['unit_price'] ); ?></td>
				<td><?php echo esc_html( $item['total'] ); ?></td>
			</tr>
		<?php endforeach; ?>
		<?php if ( ! $items ) : ?>
			<tr><td colspan="4"><?php esc_html_e( 'No items.', 'vpos' ); ?></td></tr>
		<?php endif; ?>
		</tbody>
	</table>

	<?php if ( 'pending' === $order['status'] ) : ?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
			<input type="hidden" name="action" value="vpos_complete_order" />
			<input type="hidden" name="id" value="<?php echo esc_attr( $order['id'] ); ?>" />
			<?php wp_nonce_field( 'vpos_complete_order' ); ?>
			<?php submit_button( __( 'Mark Completed', 'vpos' ), 'primary', '', false ); ?>
		</form>
	<?php endif; ?>
	<?php if ( in_array( $order['status'], array( 'pending', 'completed' ), true ) ) : ?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
			<input type="hidden" name="action" value="vpos_cancel_order" />
			<input type="hidden" name="id" value="<?php echo esc_attr( $order['id'] ); ?>" />
			<?php wp_nonce_field( 'vpos_cancel_order' ); ?>
			<?php submit_button( __( 'Cancel Order', 'vpos' ), 'delete', '', false ); ?>
		</form>
	<?php endif; ?>
</div>
