<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array $result */
?>
<div class="wrap">
	<h1><?php esc_html_e( 'Rewards Catalog', 'vpos' ); ?></h1>

	<h2><?php esc_html_e( 'Add Reward', 'vpos' ); ?></h2>
	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="vpos_create_reward" />
		<?php wp_nonce_field( 'vpos_create_reward' ); ?>
		<table class="form-table">
			<tr><th><label for="name"><?php esc_html_e( 'Name', 'vpos' ); ?></label></th>
				<td><input type="text" id="name" name="name" class="regular-text" required /></td></tr>
			<tr><th><label for="description"><?php esc_html_e( 'Description', 'vpos' ); ?></label></th>
				<td><textarea id="description" name="description" class="large-text" rows="2"></textarea></td></tr>
			<tr><th><label for="points_cost"><?php esc_html_e( 'Points Cost', 'vpos' ); ?></label></th>
				<td><input type="number" id="points_cost" name="points_cost" step="0.01" required /></td></tr>
			<tr><th><label for="stock"><?php esc_html_e( 'Stock (blank = unlimited)', 'vpos' ); ?></label></th>
				<td><input type="number" id="stock" name="stock" /></td></tr>
		</table>
		<?php submit_button( __( 'Add Reward', 'vpos' ) ); ?>
	</form>

	<h2><?php esc_html_e( 'All Rewards', 'vpos' ); ?></h2>
	<table class="widefat striped">
		<thead><tr>
			<th><?php esc_html_e( 'Name', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Points Cost', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Stock', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Status', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Actions', 'vpos' ); ?></th>
		</tr></thead>
		<tbody>
		<?php foreach ( $result['items'] as $reward ) : ?>
			<tr>
				<td><?php echo esc_html( $reward['name'] ); ?></td>
				<td><?php echo esc_html( $reward['points_cost'] ); ?></td>
				<td><?php echo null === $reward['stock'] ? esc_html__( 'Unlimited', 'vpos' ) : esc_html( $reward['stock'] ); ?></td>
				<td>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
						<input type="hidden" name="action" value="vpos_update_reward" />
						<input type="hidden" name="id" value="<?php echo esc_attr( $reward['id'] ); ?>" />
						<?php wp_nonce_field( 'vpos_update_reward' ); ?>
						<select name="status" onchange="this.form.submit()">
							<?php foreach ( VPOS_Reward_Repository::STATUSES as $status ) : ?>
								<option value="<?php echo esc_attr( $status ); ?>" <?php selected( $reward['status'], $status ); ?>><?php echo esc_html( $status ); ?></option>
							<?php endforeach; ?>
						</select>
					</form>
				</td>
				<td><a href="<?php echo esc_url( admin_url( 'admin.php?page=vpos-redeem' ) ); ?>"><?php esc_html_e( 'Redeem', 'vpos' ); ?></a></td>
			</tr>
		<?php endforeach; ?>
		<?php if ( ! $result['items'] ) : ?>
			<tr><td colspan="5"><?php esc_html_e( 'No rewards yet.', 'vpos' ); ?></td></tr>
		<?php endif; ?>
		</tbody>
	</table>
</div>
