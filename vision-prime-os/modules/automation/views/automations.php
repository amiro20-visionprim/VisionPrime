<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array $result */
?>
<div class="wrap">
	<h1><?php esc_html_e( 'Automations', 'vpos' ); ?></h1>

	<?php if ( ! empty( $_GET['vpos_error'] ) ) : ?>
		<div class="notice notice-error"><p><?php echo esc_html( wp_unslash( $_GET['vpos_error'] ) ); ?></p></div>
	<?php endif; ?>

	<h2><?php esc_html_e( 'Create Automation', 'vpos' ); ?></h2>
	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="vpos_create_automation" />
		<?php wp_nonce_field( 'vpos_create_automation' ); ?>
		<table class="form-table">
			<tr><th><label for="name"><?php esc_html_e( 'Name', 'vpos' ); ?></label></th>
				<td><input type="text" id="name" name="name" class="regular-text" required /></td></tr>
			<tr><th><label for="trigger_event"><?php esc_html_e( 'Trigger', 'vpos' ); ?></label></th>
				<td><select id="trigger_event" name="trigger_event">
					<?php foreach ( VPOS_Automation_Repository::TRIGGERS as $trigger ) : ?>
						<option value="<?php echo esc_attr( $trigger ); ?>"><?php echo esc_html( $trigger ); ?></option>
					<?php endforeach; ?>
				</select></td></tr>
			<tr><th><label for="conditions"><?php esc_html_e( 'Conditions (JSON, optional)', 'vpos' ); ?></label></th>
				<td><textarea id="conditions" name="conditions" class="large-text code" rows="2" placeholder='{"min_total_spent": 100}'></textarea></td></tr>
			<tr><th><label for="actions"><?php esc_html_e( 'Actions (JSON array)', 'vpos' ); ?></label></th>
				<td><textarea id="actions" name="actions" class="large-text code" rows="3" required placeholder='[{"type": "add_tag", "params": {"tag": "new-customer"}}]'></textarea></td></tr>
		</table>
		<?php submit_button( __( 'Create Automation', 'vpos' ) ); ?>
	</form>

	<h2><?php esc_html_e( 'All Automations', 'vpos' ); ?></h2>
	<table class="widefat striped">
		<thead><tr>
			<th><?php esc_html_e( 'Name', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Trigger', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Status', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Runs', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Actions', 'vpos' ); ?></th>
		</tr></thead>
		<tbody>
		<?php foreach ( $result['items'] as $rule ) : ?>
			<tr>
				<td><?php echo esc_html( $rule['name'] ); ?></td>
				<td><?php echo esc_html( $rule['trigger_event'] ); ?></td>
				<td><?php echo esc_html( $rule['status'] ); ?></td>
				<td><?php echo esc_html( $rule['run_count'] ); ?></td>
				<td><a href="<?php echo esc_url( admin_url( 'admin.php?page=vpos-automation-edit&id=' . $rule['id'] ) ); ?>"><?php esc_html_e( 'Edit', 'vpos' ); ?></a></td>
			</tr>
		<?php endforeach; ?>
		<?php if ( ! $result['items'] ) : ?>
			<tr><td colspan="5"><?php esc_html_e( 'No automations yet.', 'vpos' ); ?></td></tr>
		<?php endif; ?>
		</tbody>
	</table>
</div>
