<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array|null $branch */
$is_edit = ! empty( $branch );
?>
<div class="wrap">
	<h1><?php echo $is_edit ? esc_html__( 'Edit Branch', 'vpos' ) : esc_html__( 'Create Branch', 'vpos' ); ?></h1>

	<?php if ( ! empty( $_GET['vpos_error'] ) ) : ?>
		<div class="notice notice-error"><p><?php echo esc_html( wp_unslash( $_GET['vpos_error'] ) ); ?></p></div>
	<?php endif; ?>

	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="vpos_<?php echo $is_edit ? 'update' : 'create'; ?>_branch" />
		<?php if ( $is_edit ) : ?><input type="hidden" name="id" value="<?php echo esc_attr( $branch['id'] ); ?>" /><?php endif; ?>
		<?php wp_nonce_field( 'vpos_' . ( $is_edit ? 'update' : 'create' ) . '_branch' ); ?>

		<table class="form-table">
			<tr><th><label for="name"><?php esc_html_e( 'Name', 'vpos' ); ?></label></th>
				<td><input type="text" id="name" name="name" class="regular-text" required value="<?php echo esc_attr( $branch['name'] ?? '' ); ?>" /></td></tr>
			<tr><th><label for="code"><?php esc_html_e( 'Code', 'vpos' ); ?></label></th>
				<td><input type="text" id="code" name="code" required value="<?php echo esc_attr( $branch['code'] ?? '' ); ?>" <?php echo $is_edit ? 'readonly' : ''; ?> /></td></tr>
			<tr><th><label for="type"><?php esc_html_e( 'Type', 'vpos' ); ?></label></th>
				<td><select id="type" name="type">
					<?php foreach ( VPOS_Branch_Repository::TYPES as $type ) : ?>
						<option value="<?php echo esc_attr( $type ); ?>" <?php selected( $branch['type'] ?? 'physical', $type ); ?>><?php echo esc_html( $type ); ?></option>
					<?php endforeach; ?>
				</select></td></tr>
			<?php if ( $is_edit ) : ?>
			<tr><th><label for="status"><?php esc_html_e( 'Status', 'vpos' ); ?></label></th>
				<td><select id="status" name="status">
					<?php foreach ( VPOS_Branch_Repository::STATUSES as $status ) : ?>
						<option value="<?php echo esc_attr( $status ); ?>" <?php selected( $branch['status'], $status ); ?>><?php echo esc_html( $status ); ?></option>
					<?php endforeach; ?>
				</select></td></tr>
			<?php endif; ?>
			<tr><th><label for="city"><?php esc_html_e( 'City', 'vpos' ); ?></label></th>
				<td><input type="text" id="city" name="city" value="<?php echo esc_attr( $branch['city'] ?? '' ); ?>" /></td></tr>
			<tr><th><label for="province"><?php esc_html_e( 'Province', 'vpos' ); ?></label></th>
				<td><input type="text" id="province" name="province" value="<?php echo esc_attr( $branch['province'] ?? '' ); ?>" /></td></tr>
			<tr><th><label for="address"><?php esc_html_e( 'Address', 'vpos' ); ?></label></th>
				<td><textarea id="address" name="address" class="large-text"><?php echo esc_textarea( $branch['address'] ?? '' ); ?></textarea></td></tr>
			<tr><th><label for="phone"><?php esc_html_e( 'Phone', 'vpos' ); ?></label></th>
				<td><input type="text" id="phone" name="phone" value="<?php echo esc_attr( $branch['phone'] ?? '' ); ?>" /></td></tr>
		</table>

		<?php submit_button( $is_edit ? __( 'Save Changes', 'vpos' ) : __( 'Create Branch', 'vpos' ) ); ?>
	</form>
</div>
