<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array|null $customer */
/** @var array $notes */
/** @var array $tags */
/** @var array $events */
/** @var array $orders */
if ( ! $customer ) {
	echo '<div class="wrap"><p>' . esc_html__( 'Customer not found.', 'vpos' ) . '</p></div>';
	return;
}
?>
<div class="wrap">
	<h1><?php echo esc_html( trim( $customer['first_name'] . ' ' . $customer['last_name'] ) ) ?: esc_html( $customer['primary_mobile'] ); ?> — <?php esc_html_e( 'Customer 360', 'vpos' ); ?></h1>

	<?php if ( ! empty( $_GET['vpos_error'] ) ) : ?>
		<div class="notice notice-error"><p><?php echo esc_html( wp_unslash( $_GET['vpos_error'] ) ); ?></p></div>
	<?php endif; ?>

	<h2><?php esc_html_e( 'Profile', 'vpos' ); ?></h2>
	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="vpos_update_customer" />
		<input type="hidden" name="id" value="<?php echo esc_attr( $customer['id'] ); ?>" />
		<?php wp_nonce_field( 'vpos_update_customer' ); ?>
		<table class="form-table">
			<tr><th><?php esc_html_e( 'Mobile', 'vpos' ); ?></th><td><?php echo esc_html( $customer['primary_mobile'] ); ?></td></tr>
			<tr><th><label for="first_name"><?php esc_html_e( 'First Name', 'vpos' ); ?></label></th>
				<td><input type="text" id="first_name" name="first_name" value="<?php echo esc_attr( $customer['first_name'] ); ?>" /></td></tr>
			<tr><th><label for="last_name"><?php esc_html_e( 'Last Name', 'vpos' ); ?></label></th>
				<td><input type="text" id="last_name" name="last_name" value="<?php echo esc_attr( $customer['last_name'] ); ?>" /></td></tr>
			<tr><th><label for="status"><?php esc_html_e( 'Status', 'vpos' ); ?></label></th>
				<td><select id="status" name="status">
					<?php foreach ( VPOS_Customer_Repository::STATUSES as $status ) : ?>
						<option value="<?php echo esc_attr( $status ); ?>" <?php selected( $customer['status'], $status ); ?>><?php echo esc_html( $status ); ?></option>
					<?php endforeach; ?>
				</select></td></tr>
			<tr><th><?php esc_html_e( 'Purchases', 'vpos' ); ?></th><td><?php echo esc_html( $customer['purchase_count'] ); ?></td></tr>
			<tr><th><?php esc_html_e( 'Total Spent', 'vpos' ); ?></th><td><?php echo esc_html( $customer['total_spent'] ); ?></td></tr>
			<tr><th><?php esc_html_e( 'Lifetime Value', 'vpos' ); ?></th><td><?php echo esc_html( $customer['lifetime_value'] ); ?></td></tr>
		</table>
		<?php submit_button( __( 'Save Changes', 'vpos' ) ); ?>
	</form>

	<p><a href="<?php echo esc_url( admin_url( 'admin.php?page=vpos-wallet&customer_id=' . $customer['id'] ) ); ?>"><?php esc_html_e( 'View Wallet →', 'vpos' ); ?></a>
	&nbsp;|&nbsp;
	<a href="<?php echo esc_url( admin_url( 'admin.php?page=vpos-redeem&customer_id=' . $customer['id'] ) ); ?>"><?php esc_html_e( 'Redeem Reward →', 'vpos' ); ?></a></p>

	<h2><?php esc_html_e( 'Tags', 'vpos' ); ?></h2>
	<p><?php echo $tags ? esc_html( implode( ', ', $tags ) ) : esc_html__( 'No tags.', 'vpos' ); ?></p>
	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="vpos_add_customer_tag" />
		<input type="hidden" name="customer_id" value="<?php echo esc_attr( $customer['id'] ); ?>" />
		<?php wp_nonce_field( 'vpos_add_customer_tag' ); ?>
		<input type="text" name="tag" placeholder="<?php esc_attr_e( 'tag', 'vpos' ); ?>" required />
		<?php submit_button( __( 'Add Tag', 'vpos' ), 'secondary', '', false ); ?>
	</form>

	<h2><?php esc_html_e( 'Notes', 'vpos' ); ?></h2>
	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="vpos_add_customer_note" />
		<input type="hidden" name="customer_id" value="<?php echo esc_attr( $customer['id'] ); ?>" />
		<?php wp_nonce_field( 'vpos_add_customer_note' ); ?>
		<textarea name="note" class="large-text" rows="2" required></textarea>
		<?php submit_button( __( 'Add Note', 'vpos' ), 'secondary', '', false ); ?>
	</form>
	<ul>
		<?php foreach ( $notes as $note ) : ?>
			<li><?php echo esc_html( $note['created_at'] ); ?> — <?php echo esc_html( $note['note'] ); ?></li>
		<?php endforeach; ?>
	</ul>

	<h2><?php esc_html_e( 'Orders', 'vpos' ); ?></h2>
	<table class="widefat striped">
		<thead><tr><th><?php esc_html_e( 'Order #', 'vpos' ); ?></th><th><?php esc_html_e( 'Status', 'vpos' ); ?></th><th><?php esc_html_e( 'Total', 'vpos' ); ?></th><th><?php esc_html_e( 'Date', 'vpos' ); ?></th></tr></thead>
		<tbody>
		<?php foreach ( $orders as $order ) : ?>
			<tr>
				<td><a href="<?php echo esc_url( admin_url( 'admin.php?page=vpos-order-edit&id=' . $order['id'] ) ); ?>"><?php echo esc_html( $order['order_number'] ); ?></a></td>
				<td><?php echo esc_html( $order['status'] ); ?></td>
				<td><?php echo esc_html( $order['total'] ); ?></td>
				<td><?php echo esc_html( $order['created_at'] ); ?></td>
			</tr>
		<?php endforeach; ?>
		<?php if ( ! $orders ) : ?>
			<tr><td colspan="4"><?php esc_html_e( 'No orders yet.', 'vpos' ); ?></td></tr>
		<?php endif; ?>
		</tbody>
	</table>

	<h2><?php esc_html_e( 'Activity', 'vpos' ); ?></h2>
	<ul>
		<?php foreach ( $events as $event ) : ?>
			<li><?php echo esc_html( $event['created_at'] ); ?> — <?php echo esc_html( $event['event_type'] ); ?></li>
		<?php endforeach; ?>
	</ul>
</div>
