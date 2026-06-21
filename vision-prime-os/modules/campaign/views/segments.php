<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array $result */
?>
<div class="wrap">
	<h1><?php esc_html_e( 'Segments', 'vpos' ); ?></h1>

	<?php if ( ! empty( $_GET['vpos_error'] ) ) : ?>
		<div class="notice notice-error"><p><?php echo esc_html( wp_unslash( $_GET['vpos_error'] ) ); ?></p></div>
	<?php endif; ?>

	<h2><?php esc_html_e( 'Create Segment', 'vpos' ); ?></h2>
	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="vpos_create_segment" />
		<?php wp_nonce_field( 'vpos_create_segment' ); ?>
		<table class="form-table">
			<tr><th><label for="name"><?php esc_html_e( 'Name', 'vpos' ); ?></label></th>
				<td><input type="text" id="name" name="name" class="regular-text" required /></td></tr>
			<tr><th><label for="description"><?php esc_html_e( 'Description', 'vpos' ); ?></label></th>
				<td><input type="text" id="description" name="description" class="regular-text" /></td></tr>
			<tr><th><label for="rules"><?php esc_html_e( 'Rules (JSON)', 'vpos' ); ?></label></th>
				<td><textarea id="rules" name="rules" class="large-text code" rows="3" placeholder='{"min_total_spent": 100, "tags": ["vip"]}'></textarea></td></tr>
		</table>
		<?php submit_button( __( 'Create Segment', 'vpos' ) ); ?>
	</form>

	<h2><?php esc_html_e( 'All Segments', 'vpos' ); ?></h2>
	<table class="widefat striped">
		<thead><tr>
			<th><?php esc_html_e( 'Name', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Description', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Created', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Actions', 'vpos' ); ?></th>
		</tr></thead>
		<tbody>
		<?php foreach ( $result['items'] as $segment ) : ?>
			<tr>
				<td><?php echo esc_html( $segment['name'] ); ?></td>
				<td><?php echo esc_html( $segment['description'] ); ?></td>
				<td><?php echo esc_html( $segment['created_at'] ); ?></td>
				<td><a href="<?php echo esc_url( admin_url( 'admin.php?page=vpos-segment-edit&id=' . $segment['id'] ) ); ?>"><?php esc_html_e( 'Edit', 'vpos' ); ?></a></td>
			</tr>
		<?php endforeach; ?>
		<?php if ( ! $result['items'] ) : ?>
			<tr><td colspan="4"><?php esc_html_e( 'No segments yet.', 'vpos' ); ?></td></tr>
		<?php endif; ?>
		</tbody>
	</table>
</div>
