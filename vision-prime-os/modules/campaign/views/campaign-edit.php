<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array|null $campaign */
/** @var array $sends */
/** @var array $segments */
if ( ! $campaign ) {
	echo '<div class="wrap"><p>' . esc_html__( 'Campaign not found.', 'vpos' ) . '</p></div>';
	return;
}
$editable = 'draft' === $campaign['status'];
?>
<div class="wrap">
	<h1><?php echo esc_html( $campaign['name'] ); ?> — <?php echo esc_html( $campaign['status'] ); ?></h1>

	<?php if ( ! empty( $_GET['vpos_error'] ) ) : ?>
		<div class="notice notice-error"><p><?php echo esc_html( wp_unslash( $_GET['vpos_error'] ) ); ?></p></div>
	<?php endif; ?>

	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="vpos_update_campaign" />
		<input type="hidden" name="id" value="<?php echo esc_attr( $campaign['id'] ); ?>" />
		<?php wp_nonce_field( 'vpos_update_campaign' ); ?>
		<table class="form-table">
			<tr><th><label for="name"><?php esc_html_e( 'Name', 'vpos' ); ?></label></th>
				<td><input type="text" id="name" name="name" class="regular-text" value="<?php echo esc_attr( $campaign['name'] ); ?>" <?php disabled( ! $editable ); ?> /></td></tr>
			<tr><th><label for="segment_id"><?php esc_html_e( 'Segment', 'vpos' ); ?></label></th>
				<td><select id="segment_id" name="segment_id" <?php disabled( ! $editable ); ?>>
					<option value=""><?php esc_html_e( '— All customers —', 'vpos' ); ?></option>
					<?php foreach ( $segments as $segment ) : ?>
						<option value="<?php echo esc_attr( $segment['id'] ); ?>" <?php selected( $campaign['segment_id'], $segment['id'] ); ?>><?php echo esc_html( $segment['name'] ); ?></option>
					<?php endforeach; ?>
				</select></td></tr>
			<tr><th><label for="subject"><?php esc_html_e( 'Subject', 'vpos' ); ?></label></th>
				<td><input type="text" id="subject" name="subject" class="regular-text" value="<?php echo esc_attr( $campaign['subject'] ); ?>" <?php disabled( ! $editable ); ?> /></td></tr>
			<tr><th><label for="message"><?php esc_html_e( 'Message', 'vpos' ); ?></label></th>
				<td><textarea id="message" name="message" class="large-text" rows="3" <?php disabled( ! $editable ); ?>><?php echo esc_textarea( $campaign['message'] ); ?></textarea></td></tr>
		</table>
		<?php if ( $editable ) : ?>
			<?php submit_button( __( 'Save Changes', 'vpos' ) ); ?>
		<?php endif; ?>
	</form>

	<?php if ( in_array( $campaign['status'], array( 'draft', 'scheduled' ), true ) ) : ?>
		<h2><?php esc_html_e( 'Schedule', 'vpos' ); ?></h2>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="vpos_schedule_campaign" />
			<input type="hidden" name="id" value="<?php echo esc_attr( $campaign['id'] ); ?>" />
			<?php wp_nonce_field( 'vpos_schedule_campaign' ); ?>
			<input type="datetime-local" name="scheduled_at" required />
			<?php submit_button( __( 'Schedule', 'vpos' ), 'secondary', '', false ); ?>
		</form>

		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
			<input type="hidden" name="action" value="vpos_send_campaign" />
			<input type="hidden" name="id" value="<?php echo esc_attr( $campaign['id'] ); ?>" />
			<?php wp_nonce_field( 'vpos_send_campaign' ); ?>
			<?php submit_button( __( 'Send Now', 'vpos' ), 'primary', '', false ); ?>
		</form>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
			<input type="hidden" name="action" value="vpos_cancel_campaign" />
			<input type="hidden" name="id" value="<?php echo esc_attr( $campaign['id'] ); ?>" />
			<?php wp_nonce_field( 'vpos_cancel_campaign' ); ?>
			<?php submit_button( __( 'Cancel Campaign', 'vpos' ), 'delete', '', false ); ?>
		</form>
	<?php endif; ?>

	<h2><?php esc_html_e( 'Sends', 'vpos' ); ?></h2>
	<table class="widefat striped">
		<thead><tr><th><?php esc_html_e( 'Customer', 'vpos' ); ?></th><th><?php esc_html_e( 'Channel', 'vpos' ); ?></th><th><?php esc_html_e( 'Status', 'vpos' ); ?></th><th><?php esc_html_e( 'Created', 'vpos' ); ?></th></tr></thead>
		<tbody>
		<?php foreach ( $sends['items'] as $send ) : ?>
			<tr>
				<td><?php echo esc_html( $send['customer_id'] ); ?></td>
				<td><?php echo esc_html( $send['channel'] ); ?></td>
				<td><?php echo esc_html( $send['status'] ); ?></td>
				<td><?php echo esc_html( $send['created_at'] ); ?></td>
			</tr>
		<?php endforeach; ?>
		<?php if ( ! $sends['items'] ) : ?>
			<tr><td colspan="4"><?php esc_html_e( 'Not sent yet.', 'vpos' ); ?></td></tr>
		<?php endif; ?>
		</tbody>
	</table>
</div>
