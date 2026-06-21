<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array|null $customer */
/** @var array $ledger */
/** @var float $balance */
?>
<div class="wrap">
	<h1><?php esc_html_e( 'Wallet', 'vpos' ); ?></h1>

	<?php if ( ! empty( $_GET['vpos_error'] ) ) : ?>
		<div class="notice notice-error"><p><?php echo esc_html( wp_unslash( $_GET['vpos_error'] ) ); ?></p></div>
	<?php endif; ?>

	<form method="get" action="<?php echo esc_url( admin_url( 'admin.php' ) ); ?>">
		<input type="hidden" name="page" value="vpos-wallet" />
		<label><?php esc_html_e( 'Customer ID', 'vpos' ); ?>
			<input type="number" name="customer_id" value="<?php echo esc_attr( $customer['id'] ?? '' ); ?>" required />
		</label>
		<?php submit_button( __( 'Load Wallet', 'vpos' ), 'secondary', '', false ); ?>
	</form>

	<?php if ( $customer ) : ?>
		<h2><?php printf( esc_html__( 'Balance: %s', 'vpos' ), esc_html( $balance ) ); ?></h2>

		<table class="form-table">
			<tr>
				<td>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
						<input type="hidden" name="action" value="vpos_wallet_credit" />
						<input type="hidden" name="customer_id" value="<?php echo esc_attr( $customer['id'] ); ?>" />
						<?php wp_nonce_field( 'vpos_wallet_credit' ); ?>
						<input type="number" name="amount" step="0.01" min="0.01" required placeholder="<?php esc_attr_e( 'amount', 'vpos' ); ?>" />
						<input type="text" name="reason" placeholder="<?php esc_attr_e( 'reason', 'vpos' ); ?>" />
						<?php submit_button( __( 'Credit', 'vpos' ), 'primary', '', false ); ?>
					</form>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
						<input type="hidden" name="action" value="vpos_wallet_debit" />
						<input type="hidden" name="customer_id" value="<?php echo esc_attr( $customer['id'] ); ?>" />
						<?php wp_nonce_field( 'vpos_wallet_debit' ); ?>
						<input type="number" name="amount" step="0.01" min="0.01" required placeholder="<?php esc_attr_e( 'amount', 'vpos' ); ?>" />
						<input type="text" name="reason" placeholder="<?php esc_attr_e( 'reason', 'vpos' ); ?>" />
						<?php submit_button( __( 'Debit', 'vpos' ), 'secondary', '', false ); ?>
					</form>
				</td>
			</tr>
		</table>

		<h2><?php esc_html_e( 'Ledger', 'vpos' ); ?></h2>
		<table class="widefat striped">
			<thead><tr>
				<th><?php esc_html_e( 'Date', 'vpos' ); ?></th>
				<th><?php esc_html_e( 'Type', 'vpos' ); ?></th>
				<th><?php esc_html_e( 'Direction', 'vpos' ); ?></th>
				<th><?php esc_html_e( 'Amount', 'vpos' ); ?></th>
				<th><?php esc_html_e( 'Reason', 'vpos' ); ?></th>
				<th><?php esc_html_e( 'Actions', 'vpos' ); ?></th>
			</tr></thead>
			<tbody>
			<?php foreach ( $ledger['items'] as $entry ) : ?>
				<tr>
					<td><?php echo esc_html( $entry['created_at'] ); ?></td>
					<td><?php echo esc_html( $entry['transaction_type'] ); ?></td>
					<td><?php echo esc_html( $entry['direction'] ); ?></td>
					<td><?php echo esc_html( $entry['amount'] ); ?></td>
					<td><?php echo esc_html( $entry['reason'] ); ?></td>
					<td>
						<?php if ( 'confirmed' === $entry['status'] && empty( $entry['reversal_of_id'] ) ) : ?>
							<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
								<input type="hidden" name="action" value="vpos_wallet_reverse" />
								<input type="hidden" name="entry_id" value="<?php echo esc_attr( $entry['id'] ); ?>" />
								<input type="hidden" name="customer_id" value="<?php echo esc_attr( $customer['id'] ); ?>" />
								<?php wp_nonce_field( 'vpos_wallet_reverse' ); ?>
								<input type="text" name="reason" placeholder="<?php esc_attr_e( 'reason', 'vpos' ); ?>" required />
								<?php submit_button( __( 'Reverse', 'vpos' ), 'delete', '', false ); ?>
							</form>
						<?php endif; ?>
					</td>
				</tr>
			<?php endforeach; ?>
			<?php if ( ! $ledger['items'] ) : ?>
				<tr><td colspan="6"><?php esc_html_e( 'No ledger entries yet.', 'vpos' ); ?></td></tr>
			<?php endif; ?>
			</tbody>
		</table>
	<?php endif; ?>
</div>
