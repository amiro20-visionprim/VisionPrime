<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array $tiers */
?>
<div class="wrap">
	<h1><?php esc_html_e( 'Loyalty Tiers', 'vpos' ); ?></h1>

	<h2><?php esc_html_e( 'Add Tier', 'vpos' ); ?></h2>
	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="vpos_create_tier" />
		<?php wp_nonce_field( 'vpos_create_tier' ); ?>
		<table class="form-table">
			<tr><th><label for="name"><?php esc_html_e( 'Name', 'vpos' ); ?></label></th>
				<td><input type="text" id="name" name="name" class="regular-text" required /></td></tr>
			<tr><th><label for="min_points"><?php esc_html_e( 'Minimum Lifetime Points', 'vpos' ); ?></label></th>
				<td><input type="number" id="min_points" name="min_points" step="0.01" value="0" /></td></tr>
			<tr><th><label for="multiplier"><?php esc_html_e( 'Points Multiplier', 'vpos' ); ?></label></th>
				<td><input type="number" id="multiplier" name="multiplier" step="0.01" value="1" /></td></tr>
		</table>
		<?php submit_button( __( 'Add Tier', 'vpos' ) ); ?>
	</form>

	<h2><?php esc_html_e( 'All Tiers', 'vpos' ); ?></h2>
	<table class="widefat striped">
		<thead><tr><th><?php esc_html_e( 'Name', 'vpos' ); ?></th><th><?php esc_html_e( 'Min Points', 'vpos' ); ?></th><th><?php esc_html_e( 'Multiplier', 'vpos' ); ?></th></tr></thead>
		<tbody>
		<?php foreach ( $tiers as $tier ) : ?>
			<tr>
				<td><?php echo esc_html( $tier['name'] ); ?></td>
				<td><?php echo esc_html( $tier['min_points'] ); ?></td>
				<td><?php echo esc_html( $tier['multiplier'] ); ?></td>
			</tr>
		<?php endforeach; ?>
		<?php if ( ! $tiers ) : ?>
			<tr><td colspan="3"><?php esc_html_e( 'No tiers yet.', 'vpos' ); ?></td></tr>
		<?php endif; ?>
		</tbody>
	</table>
</div>
