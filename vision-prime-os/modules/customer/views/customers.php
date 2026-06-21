<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array $result */
?>
<div class="wrap">
	<h1><?php esc_html_e( 'Customers', 'vpos' ); ?></h1>

	<?php if ( ! empty( $_GET['vpos_error'] ) ) : ?>
		<div class="notice notice-error"><p><?php echo esc_html( wp_unslash( $_GET['vpos_error'] ) ); ?></p></div>
	<?php endif; ?>

	<h2><?php esc_html_e( 'Add Customer', 'vpos' ); ?></h2>
	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="vpos_create_customer" />
		<?php wp_nonce_field( 'vpos_create_customer' ); ?>
		<table class="form-table">
			<tr><th><label for="primary_mobile"><?php esc_html_e( 'Mobile', 'vpos' ); ?></label></th>
				<td><input type="text" id="primary_mobile" name="primary_mobile" class="regular-text" required /></td></tr>
			<tr><th><label for="first_name"><?php esc_html_e( 'First Name', 'vpos' ); ?></label></th>
				<td><input type="text" id="first_name" name="first_name" class="regular-text" /></td></tr>
			<tr><th><label for="last_name"><?php esc_html_e( 'Last Name', 'vpos' ); ?></label></th>
				<td><input type="text" id="last_name" name="last_name" class="regular-text" /></td></tr>
			<tr><th><label for="primary_email"><?php esc_html_e( 'Email', 'vpos' ); ?></label></th>
				<td><input type="email" id="primary_email" name="primary_email" class="regular-text" /></td></tr>
		</table>
		<?php submit_button( __( 'Add Customer', 'vpos' ) ); ?>
	</form>

	<h2><?php esc_html_e( 'All Customers', 'vpos' ); ?></h2>
	<table class="widefat striped">
		<thead><tr>
			<th><?php esc_html_e( 'Name', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Mobile', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Status', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Purchases', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Total Spent', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Last Seen', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Actions', 'vpos' ); ?></th>
		</tr></thead>
		<tbody>
		<?php foreach ( $result['items'] as $customer ) : ?>
			<tr>
				<td><?php echo esc_html( trim( $customer['first_name'] . ' ' . $customer['last_name'] ) ) ?: '—'; ?></td>
				<td><?php echo esc_html( $customer['primary_mobile'] ); ?></td>
				<td><?php echo esc_html( $customer['status'] ); ?></td>
				<td><?php echo esc_html( $customer['purchase_count'] ); ?></td>
				<td><?php echo esc_html( $customer['total_spent'] ); ?></td>
				<td><?php echo esc_html( $customer['last_seen_at'] ); ?></td>
				<td><a href="<?php echo esc_url( admin_url( 'admin.php?page=vpos-customer-edit&id=' . $customer['id'] ) ); ?>"><?php esc_html_e( 'View 360', 'vpos' ); ?></a></td>
			</tr>
		<?php endforeach; ?>
		<?php if ( ! $result['items'] ) : ?>
			<tr><td colspan="7"><?php esc_html_e( 'No customers yet.', 'vpos' ); ?></td></tr>
		<?php endif; ?>
		</tbody>
	</table>
</div>
