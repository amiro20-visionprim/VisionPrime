<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array $result */
/** @var array $organizations */
?>
<div class="wrap">
	<h1><?php esc_html_e( 'Brands', 'vpos' ); ?></h1>

	<?php if ( ! empty( $_GET['vpos_error'] ) ) : ?>
		<div class="notice notice-error"><p><?php echo esc_html( wp_unslash( $_GET['vpos_error'] ) ); ?></p></div>
	<?php endif; ?>

	<h2><?php esc_html_e( 'Create Brand', 'vpos' ); ?></h2>
	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="vpos_create_brand" />
		<?php wp_nonce_field( 'vpos_create_brand' ); ?>
		<table class="form-table">
			<tr><th><label for="organization_id"><?php esc_html_e( 'Organization', 'vpos' ); ?></label></th>
				<td><select id="organization_id" name="organization_id" required>
					<?php foreach ( $organizations as $org ) : ?>
						<option value="<?php echo esc_attr( $org['id'] ); ?>"><?php echo esc_html( $org['name'] ); ?></option>
					<?php endforeach; ?>
				</select></td></tr>
			<tr><th><label for="name"><?php esc_html_e( 'Name', 'vpos' ); ?></label></th>
				<td><input type="text" id="name" name="name" class="regular-text" required /></td></tr>
			<tr><th><label for="slug"><?php esc_html_e( 'Slug', 'vpos' ); ?></label></th>
				<td><input type="text" id="slug" name="slug" class="regular-text" required placeholder="brand-a" /></td></tr>
		</table>
		<?php submit_button( __( 'Create Brand', 'vpos' ) ); ?>
	</form>

	<h2><?php esc_html_e( 'All Brands', 'vpos' ); ?></h2>
	<table class="widefat striped">
		<thead><tr>
			<th><?php esc_html_e( 'Name', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Slug', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Organization', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Status', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Currency', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Language', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Created', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Actions', 'vpos' ); ?></th>
		</tr></thead>
		<tbody>
		<?php foreach ( $result['items'] as $brand ) : ?>
			<tr>
				<td><?php echo esc_html( $brand['name'] ); ?></td>
				<td><?php echo esc_html( $brand['slug'] ); ?></td>
				<td><?php echo esc_html( $brand['organization_id'] ); ?></td>
				<td><?php echo esc_html( $brand['status'] ); ?></td>
				<td><?php echo esc_html( $brand['currency'] ); ?></td>
				<td><?php echo esc_html( $brand['language'] ); ?></td>
				<td><?php echo esc_html( $brand['created_at'] ); ?></td>
				<td><a href="<?php echo esc_url( admin_url( 'admin.php?page=vpos-brand-edit&id=' . $brand['id'] ) ); ?>"><?php esc_html_e( 'Edit', 'vpos' ); ?></a></td>
			</tr>
		<?php endforeach; ?>
		<?php if ( ! $result['items'] ) : ?>
			<tr><td colspan="8"><?php esc_html_e( 'No brands yet.', 'vpos' ); ?></td></tr>
		<?php endif; ?>
		</tbody>
	</table>
</div>
