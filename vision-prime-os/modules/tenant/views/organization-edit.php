<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array|null $org */
$is_edit = ! empty( $org );
?>
<div class="wrap">
	<h1><?php echo $is_edit ? esc_html__( 'Edit Organization', 'vpos' ) : esc_html__( 'Create Organization', 'vpos' ); ?></h1>

	<?php if ( ! empty( $_GET['vpos_error'] ) ) : ?>
		<div class="notice notice-error"><p><?php echo esc_html( wp_unslash( $_GET['vpos_error'] ) ); ?></p></div>
	<?php endif; ?>

	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="vpos_<?php echo $is_edit ? 'update' : 'create'; ?>_organization" />
		<?php if ( $is_edit ) : ?><input type="hidden" name="id" value="<?php echo esc_attr( $org['id'] ); ?>" /><?php endif; ?>
		<?php wp_nonce_field( 'vpos_' . ( $is_edit ? 'update' : 'create' ) . '_organization' ); ?>

		<table class="form-table">
			<tr><th><label for="name"><?php esc_html_e( 'Name', 'vpos' ); ?></label></th>
				<td><input type="text" id="name" name="name" class="regular-text" required value="<?php echo esc_attr( $org['name'] ?? '' ); ?>" /></td></tr>
			<tr><th><label for="legal_name"><?php esc_html_e( 'Legal Name', 'vpos' ); ?></label></th>
				<td><input type="text" id="legal_name" name="legal_name" class="regular-text" value="<?php echo esc_attr( $org['legal_name'] ?? '' ); ?>" /></td></tr>
			<?php if ( $is_edit ) : ?>
			<tr><th><label for="status"><?php esc_html_e( 'Status', 'vpos' ); ?></label></th>
				<td><select id="status" name="status">
					<?php foreach ( VPOS_Organization_Repository::STATUSES as $status ) : ?>
						<option value="<?php echo esc_attr( $status ); ?>" <?php selected( $org['status'], $status ); ?>><?php echo esc_html( $status ); ?></option>
					<?php endforeach; ?>
				</select></td></tr>
			<?php endif; ?>
			<tr><th><label for="country"><?php esc_html_e( 'Country', 'vpos' ); ?></label></th>
				<td><input type="text" id="country" name="country" value="<?php echo esc_attr( $org['country'] ?? '' ); ?>" /></td></tr>
			<tr><th><label for="timezone"><?php esc_html_e( 'Timezone', 'vpos' ); ?></label></th>
				<td><input type="text" id="timezone" name="timezone" value="<?php echo esc_attr( $org['timezone'] ?? 'Asia/Tehran' ); ?>" /></td></tr>
			<tr><th><label for="default_currency"><?php esc_html_e( 'Default Currency', 'vpos' ); ?></label></th>
				<td><input type="text" id="default_currency" name="default_currency" value="<?php echo esc_attr( $org['default_currency'] ?? 'IRR' ); ?>" /></td></tr>
		</table>

		<?php submit_button( $is_edit ? __( 'Save Changes', 'vpos' ) : __( 'Create Organization', 'vpos' ) ); ?>
	</form>
</div>
