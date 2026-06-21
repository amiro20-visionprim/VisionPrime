<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array $revenue */
/** @var array $customer_growth */
/** @var float $wallet_liability */
/** @var float $loyalty_liability */
/** @var array $top_customers */
?>
<div class="wrap">
	<h1><?php esc_html_e( 'Reports', 'vpos' ); ?></h1>

	<form method="get">
		<input type="hidden" name="page" value="vpos-reports" />
		<label><?php esc_html_e( 'From', 'vpos' ); ?> <input type="date" name="from" value="<?php echo esc_attr( $_GET['from'] ?? '' ); ?>" /></label>
		<label><?php esc_html_e( 'To', 'vpos' ); ?> <input type="date" name="to" value="<?php echo esc_attr( $_GET['to'] ?? '' ); ?>" /></label>
		<?php submit_button( __( 'Filter', 'vpos' ), '', '', false ); ?>
	</form>

	<h2><?php esc_html_e( 'Revenue', 'vpos' ); ?></h2>
	<table class="widefat striped">
		<tbody>
			<tr><th><?php esc_html_e( 'Orders', 'vpos' ); ?></th><td><?php echo esc_html( $revenue['order_count'] ); ?></td></tr>
			<tr><th><?php esc_html_e( 'Revenue', 'vpos' ); ?></th><td><?php echo esc_html( $revenue['revenue'] ); ?></td></tr>
			<tr><th><?php esc_html_e( 'Average Order Value', 'vpos' ); ?></th><td><?php echo esc_html( $revenue['average_order_value'] ); ?></td></tr>
		</tbody>
	</table>

	<h2><?php esc_html_e( 'Customer Growth', 'vpos' ); ?></h2>
	<table class="widefat striped">
		<tbody>
			<tr><th><?php esc_html_e( 'New Customers', 'vpos' ); ?></th><td><?php echo esc_html( $customer_growth['new_customers'] ); ?></td></tr>
		</tbody>
	</table>

	<h2><?php esc_html_e( 'Liabilities', 'vpos' ); ?></h2>
	<table class="widefat striped">
		<tbody>
			<tr><th><?php esc_html_e( 'Wallet Liability', 'vpos' ); ?></th><td><?php echo esc_html( $wallet_liability ); ?></td></tr>
			<tr><th><?php esc_html_e( 'Loyalty Liability', 'vpos' ); ?></th><td><?php echo esc_html( $loyalty_liability ); ?></td></tr>
		</tbody>
	</table>

	<h2><?php esc_html_e( 'Top Customers', 'vpos' ); ?></h2>
	<table class="widefat striped">
		<thead><tr><th><?php esc_html_e( 'Name', 'vpos' ); ?></th><th><?php esc_html_e( 'Mobile', 'vpos' ); ?></th><th><?php esc_html_e( 'Total Spent', 'vpos' ); ?></th><th><?php esc_html_e( 'Lifetime Value', 'vpos' ); ?></th></tr></thead>
		<tbody>
		<?php foreach ( $top_customers as $customer ) : ?>
			<tr>
				<td><?php echo esc_html( trim( $customer['first_name'] . ' ' . $customer['last_name'] ) ); ?></td>
				<td><?php echo esc_html( $customer['primary_mobile'] ); ?></td>
				<td><?php echo esc_html( $customer['total_spent'] ); ?></td>
				<td><?php echo esc_html( $customer['lifetime_value'] ); ?></td>
			</tr>
		<?php endforeach; ?>
		<?php if ( ! $top_customers ) : ?>
			<tr><td colspan="4"><?php esc_html_e( 'No customers yet.', 'vpos' ); ?></td></tr>
		<?php endif; ?>
		</tbody>
	</table>
</div>
