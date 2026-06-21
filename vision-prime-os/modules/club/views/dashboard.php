<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array $customer */
/** @var float $balance */
/** @var float $points */
/** @var array|null $tier */
/** @var array $orders */
/** @var array $rewards */
?>
<div class="vpos-club-dashboard">
	<?php if ( ! empty( $_GET['vpos_club_error'] ) ) : ?>
		<p class="vpos-club-error"><?php echo esc_html( wp_unslash( $_GET['vpos_club_error'] ) ); ?></p>
	<?php endif; ?>

	<h2><?php printf( esc_html__( 'Welcome, %s', 'vpos' ), esc_html( $customer['first_name'] ?: $customer['primary_mobile'] ) ); ?></h2>
	<p>
		<?php printf( esc_html__( 'Wallet balance: %s', 'vpos' ), esc_html( $balance ) ); ?><br />
		<?php printf( esc_html__( 'Points balance: %s', 'vpos' ), esc_html( $points ) ); ?><br />
		<?php if ( $tier ) : ?>
			<?php printf( esc_html__( 'Tier: %s', 'vpos' ), esc_html( $tier['name'] ) ); ?>
		<?php endif; ?>
	</p>

	<h3><?php esc_html_e( 'Available Rewards', 'vpos' ); ?></h3>
	<ul>
		<?php foreach ( $rewards as $reward ) : ?>
			<li>
				<?php echo esc_html( $reward['name'] . ' — ' . $reward['points_cost'] . ' ' . __( 'points', 'vpos' ) ); ?>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
					<input type="hidden" name="action" value="vpos_club_redeem" />
					<input type="hidden" name="reward_id" value="<?php echo esc_attr( $reward['id'] ); ?>" />
					<?php wp_nonce_field( 'vpos_club_redeem' ); ?>
					<button type="submit"><?php esc_html_e( 'Redeem', 'vpos' ); ?></button>
				</form>
			</li>
		<?php endforeach; ?>
		<?php if ( ! $rewards ) : ?>
			<li><?php esc_html_e( 'No rewards available right now.', 'vpos' ); ?></li>
		<?php endif; ?>
	</ul>

	<h3><?php esc_html_e( 'Recent Orders', 'vpos' ); ?></h3>
	<ul>
		<?php foreach ( $orders as $order ) : ?>
			<li><?php echo esc_html( $order['order_number'] . ' — ' . $order['status'] . ' — ' . $order['total'] ); ?></li>
		<?php endforeach; ?>
		<?php if ( ! $orders ) : ?>
			<li><?php esc_html_e( 'No orders yet.', 'vpos' ); ?></li>
		<?php endif; ?>
	</ul>

	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="vpos_club_logout" />
		<button type="submit"><?php esc_html_e( 'Log Out', 'vpos' ); ?></button>
	</form>
</div>
