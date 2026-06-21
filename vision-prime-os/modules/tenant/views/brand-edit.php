<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array|null $brand */
if ( ! $brand ) {
	echo '<div class="wrap"><p>' . esc_html__( 'Brand not found.', 'vpos' ) . '</p></div>';
	return;
}
?>
<div class="wrap">
	<h1><?php echo esc_html( $brand['name'] ); ?></h1>

	<?php if ( ! empty( $_GET['vpos_error'] ) ) : ?>
		<div class="notice notice-error"><p><?php echo esc_html( wp_unslash( $_GET['vpos_error'] ) ); ?></p></div>
	<?php endif; ?>

	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="vpos_update_brand" />
		<input type="hidden" name="id" value="<?php echo esc_attr( $brand['id'] ); ?>" />
		<?php wp_nonce_field( 'vpos_update_brand' ); ?>
		<table class="form-table">
			<tr><th><?php esc_html_e( 'Slug', 'vpos' ); ?></th><td><?php echo esc_html( $brand['slug'] ); ?></td></tr>
			<tr><th><?php esc_html_e( 'Site ID', 'vpos' ); ?></th><td><?php echo esc_html( $brand['blog_id'] ); ?></td></tr>
			<tr><th><label for="name"><?php esc_html_e( 'Name', 'vpos' ); ?></label></th>
				<td><input type="text" id="name" name="name" class="regular-text" value="<?php echo esc_attr( $brand['name'] ); ?>" /></td></tr>
			<tr><th><label for="status"><?php esc_html_e( 'Status', 'vpos' ); ?></label></th>
				<td><select id="status" name="status">
					<?php foreach ( VPOS_Brand_Repository::STATUSES as $status ) : ?>
						<option value="<?php echo esc_attr( $status ); ?>" <?php selected( $brand['status'], $status ); ?>><?php echo esc_html( $status ); ?></option>
					<?php endforeach; ?>
				</select></td></tr>
			<tr><th><label for="currency"><?php esc_html_e( 'Currency', 'vpos' ); ?></label></th>
				<td><input type="text" id="currency" name="currency" value="<?php echo esc_attr( $brand['currency'] ); ?>" /></td></tr>
			<tr><th><label for="language"><?php esc_html_e( 'Language', 'vpos' ); ?></label></th>
				<td><input type="text" id="language" name="language" value="<?php echo esc_attr( $brand['language'] ); ?>" /></td></tr>
			<tr><th><label for="primary_color"><?php esc_html_e( 'Primary Color', 'vpos' ); ?></label></th>
				<td><input type="text" id="primary_color" name="primary_color" value="<?php echo esc_attr( $brand['primary_color'] ); ?>" /></td></tr>
			<tr><th><label for="secondary_color"><?php esc_html_e( 'Secondary Color', 'vpos' ); ?></label></th>
				<td><input type="text" id="secondary_color" name="secondary_color" value="<?php echo esc_attr( $brand['secondary_color'] ); ?>" /></td></tr>
		</table>
		<?php submit_button( __( 'Save Changes', 'vpos' ) ); ?>
	</form>

	<p><a href="<?php echo esc_url( get_site_url( $brand['blog_id'], '/wp-admin/admin.php?page=vpos-brand-settings' ) ); ?>"><?php esc_html_e( 'Edit Brand Settings →', 'vpos' ); ?></a></p>
</div>
