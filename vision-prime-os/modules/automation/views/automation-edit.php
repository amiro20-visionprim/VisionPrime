<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array|null $rule */
/** @var array $runs */
if ( ! $rule ) {
	echo '<div class="wrap"><p>' . esc_html__( 'Automation not found.', 'vpos' ) . '</p></div>';
	return;
}
?>
<div class="wrap">
	<h1><?php echo esc_html( $rule['name'] ); ?></h1>

	<?php if ( ! empty( $_GET['vpos_error'] ) ) : ?>
		<div class="notice notice-error"><p><?php echo esc_html( wp_unslash( $_GET['vpos_error'] ) ); ?></p></div>
	<?php endif; ?>

	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="vpos_update_automation" />
		<input type="hidden" name="id" value="<?php echo esc_attr( $rule['id'] ); ?>" />
		<?php wp_nonce_field( 'vpos_update_automation' ); ?>
		<table class="form-table">
			<tr><th><label for="name"><?php esc_html_e( 'Name', 'vpos' ); ?></label></th>
				<td><input type="text" id="name" name="name" class="regular-text" value="<?php echo esc_attr( $rule['name'] ); ?>" /></td></tr>
			<tr><th><label for="trigger_event"><?php esc_html_e( 'Trigger', 'vpos' ); ?></label></th>
				<td><select id="trigger_event" name="trigger_event">
					<?php foreach ( VPOS_Automation_Repository::TRIGGERS as $trigger ) : ?>
						<option value="<?php echo esc_attr( $trigger ); ?>" <?php selected( $rule['trigger_event'], $trigger ); ?>><?php echo esc_html( $trigger ); ?></option>
					<?php endforeach; ?>
				</select></td></tr>
			<tr><th><label for="status"><?php esc_html_e( 'Status', 'vpos' ); ?></label></th>
				<td><select id="status" name="status">
					<option value="active" <?php selected( $rule['status'], 'active' ); ?>><?php esc_html_e( 'active', 'vpos' ); ?></option>
					<option value="inactive" <?php selected( $rule['status'], 'inactive' ); ?>><?php esc_html_e( 'inactive', 'vpos' ); ?></option>
				</select></td></tr>
			<tr><th><label for="conditions"><?php esc_html_e( 'Conditions (JSON)', 'vpos' ); ?></label></th>
				<td><textarea id="conditions" name="conditions" class="large-text code" rows="2"><?php echo esc_textarea( $rule['conditions'] ); ?></textarea></td></tr>
			<tr><th><label for="actions"><?php esc_html_e( 'Actions (JSON array)', 'vpos' ); ?></label></th>
				<td><textarea id="actions" name="actions" class="large-text code" rows="3"><?php echo esc_textarea( $rule['actions'] ); ?></textarea></td></tr>
		</table>
		<?php submit_button( __( 'Save Changes', 'vpos' ) ); ?>
	</form>

	<h2><?php esc_html_e( 'Run History', 'vpos' ); ?></h2>
	<table class="widefat striped">
		<thead><tr><th><?php esc_html_e( 'Customer', 'vpos' ); ?></th><th><?php esc_html_e( 'Status', 'vpos' ); ?></th><th><?php esc_html_e( 'Error', 'vpos' ); ?></th><th><?php esc_html_e( 'Created', 'vpos' ); ?></th></tr></thead>
		<tbody>
		<?php foreach ( $runs['items'] as $run ) : ?>
			<tr>
				<td><?php echo esc_html( $run['customer_id'] ); ?></td>
				<td><?php echo esc_html( $run['status'] ); ?></td>
				<td><?php echo esc_html( $run['error'] ); ?></td>
				<td><?php echo esc_html( $run['created_at'] ); ?></td>
			</tr>
		<?php endforeach; ?>
		<?php if ( ! $runs['items'] ) : ?>
			<tr><td colspan="4"><?php esc_html_e( 'No runs yet.', 'vpos' ); ?></td></tr>
		<?php endif; ?>
		</tbody>
	</table>
</div>
