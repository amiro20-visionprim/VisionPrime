<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array|null $customer */
/** @var float $balance */
/** @var array $rewards */
/** @var array $redemptions */
?>
<div class="wrap">
	<h1><?php esc_html_e( 'Redeem Reward', 'vpos' ); ?></h1>

	<?php if ( ! empty( $_GET['vpos_error'] ) ) : ?>
		<div class="notice notice-error"><p><?php echo esc_html( wp_unslash( $_GET['vpos_error'] ) ); ?></p></div>
	<?php endif; ?>

	<form method="get" action="<?php echo esc_url( admin_url( 'admin.php' ) ); ?>">
		<input type="hidden" name="page" value="vpos-redeem" />
		<label><?php esc_html_e( 'Customer ID', 'vpos' ); ?>
			<input type="number" name="customer_id" value="<?php echo esc_attr( $customer['id'] ?? '' ); ?>" required />
		</label>
		<?php submit_button( __( 'Load', 'vpos' ), 'secondary', '', false ); ?>
	</form>

	<?php if ( $customer ) : ?>
		<h2><?php printf( esc_html__( 'Points Balance: %s', 'vpos' ), esc_html( $balance ) ); ?></h2>

		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="vpos_redeem_reward" />
			<input type="hidden" name="customer_id" value="<?php echo esc_attr( $customer['id'] ); ?>" />
			<?php wp_nonce_field( 'vpos_redeem_reward' ); ?>
			<select name="reward_id" required>
				<?php foreach ( $rewards as $reward ) : ?>
					<option value="<?php echo esc_attr( $reward['id'] ); ?>"><?php echo esc_html( $reward['name'] . ' (' . $reward['points_cost'] . ')' ); ?></option>
				<?php endforeach; ?>
			</select>
			<?php submit_button( __( 'Redeem', 'vpos' ), 'primary', '', false ); ?>
		</form>

		<h2><?php esc_html_e( 'Redemption History', 'vpos' ); ?></h2>
		<table class="widefat striped">
			<thead><tr><th><?php esc_html_e( 'Reward', 'vpos' ); ?></th><th><?php esc_html_e( 'Points Spent', 'vpos' ); ?></th><th><?php esc_html_e( 'Date', 'vpos' ); ?></th></tr></thead>
			<tbody>
			<?php foreach ( $redemptions as $r ) : ?>
				<tr>
					<td><?php echo esc_html( $r['name'] ); ?></td>
					<td><?php echo esc_html( $r['points_spent'] ); ?></td>
					<td><?php echo esc_html( $r['created_at'] ); ?></td>
				</tr>
			<?php endforeach; ?>
			<?php if ( ! $redemptions ) : ?>
				<tr><td colspan="3"><?php esc_html_e( 'No redemptions yet.', 'vpos' ); ?></td></tr>
			<?php endif; ?>
			</tbody>
		</table>
	<?php endif; ?>
</div>
