<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array $result */
?>
<div class="wrap">
	<h1><?php esc_html_e( 'Campaigns', 'vpos' ); ?></h1>

	<?php if ( ! empty( $_GET['vpos_error'] ) ) : ?>
		<div class="notice notice-error"><p><?php echo esc_html( wp_unslash( $_GET['vpos_error'] ) ); ?></p></div>
	<?php endif; ?>

	<h2><?php esc_html_e( 'Create Campaign', 'vpos' ); ?></h2>
	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="vpos_create_campaign" />
		<?php wp_nonce_field( 'vpos_create_campaign' ); ?>
		<table class="form-table">
			<tr><th><label for="name"><?php esc_html_e( 'Name', 'vpos' ); ?></label></th>
				<td><input type="text" id="name" name="name" class="regular-text" required /></td></tr>
			<tr><th><label for="channel"><?php esc_html_e( 'Channel', 'vpos' ); ?></label></th>
				<td><select id="channel" name="channel">
					<?php foreach ( VPOS_Campaign_Repository::CHANNELS as $channel ) : ?>
						<option value="<?php echo esc_attr( $channel ); ?>"><?php echo esc_html( $channel ); ?></option>
					<?php endforeach; ?>
				</select></td></tr>
			<tr><th><label for="message"><?php esc_html_e( 'Message', 'vpos' ); ?></label></th>
				<td><textarea id="message" name="message" class="large-text" rows="3" required></textarea></td></tr>
		</table>
		<?php submit_button( __( 'Create Campaign', 'vpos' ) ); ?>
	</form>

	<h2><?php esc_html_e( 'All Campaigns', 'vpos' ); ?></h2>
	<table class="widefat striped">
		<thead><tr>
			<th><?php esc_html_e( 'Name', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Channel', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Status', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Recipients', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Created', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Actions', 'vpos' ); ?></th>
		</tr></thead>
		<tbody>
		<?php foreach ( $result['items'] as $campaign ) : ?>
			<tr>
				<td><?php echo esc_html( $campaign['name'] ); ?></td>
				<td><?php echo esc_html( $campaign['channel'] ); ?></td>
				<td><?php echo esc_html( $campaign['status'] ); ?></td>
				<td><?php echo esc_html( $campaign['recipient_count'] ); ?></td>
				<td><?php echo esc_html( $campaign['created_at'] ); ?></td>
				<td><a href="<?php echo esc_url( admin_url( 'admin.php?page=vpos-campaign-edit&id=' . $campaign['id'] ) ); ?>"><?php esc_html_e( 'Edit', 'vpos' ); ?></a></td>
			</tr>
		<?php endforeach; ?>
		<?php if ( ! $result['items'] ) : ?>
			<tr><td colspan="6"><?php esc_html_e( 'No campaigns yet.', 'vpos' ); ?></td></tr>
		<?php endif; ?>
		</tbody>
	</table>
</div>
