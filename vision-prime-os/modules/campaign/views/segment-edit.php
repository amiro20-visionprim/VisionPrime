<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array|null $segment */
/** @var int $count */
if ( ! $segment ) {
	echo '<div class="wrap"><p>' . esc_html__( 'Segment not found.', 'vpos' ) . '</p></div>';
	return;
}
?>
<div class="wrap">
	<h1><?php echo esc_html( $segment['name'] ); ?></h1>

	<?php if ( ! empty( $_GET['vpos_error'] ) ) : ?>
		<div class="notice notice-error"><p><?php echo esc_html( wp_unslash( $_GET['vpos_error'] ) ); ?></p></div>
	<?php endif; ?>

	<p><?php printf( esc_html__( 'Currently matches %d customers.', 'vpos' ), (int) $count ); ?></p>

	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="vpos_update_segment" />
		<input type="hidden" name="id" value="<?php echo esc_attr( $segment['id'] ); ?>" />
		<?php wp_nonce_field( 'vpos_update_segment' ); ?>
		<table class="form-table">
			<tr><th><label for="name"><?php esc_html_e( 'Name', 'vpos' ); ?></label></th>
				<td><input type="text" id="name" name="name" class="regular-text" value="<?php echo esc_attr( $segment['name'] ); ?>" /></td></tr>
			<tr><th><label for="description"><?php esc_html_e( 'Description', 'vpos' ); ?></label></th>
				<td><input type="text" id="description" name="description" class="regular-text" value="<?php echo esc_attr( $segment['description'] ); ?>" /></td></tr>
			<tr><th><label for="rules"><?php esc_html_e( 'Rules (JSON)', 'vpos' ); ?></label></th>
				<td><textarea id="rules" name="rules" class="large-text code" rows="3"><?php echo esc_textarea( $segment['rules'] ); ?></textarea></td></tr>
		</table>
		<?php submit_button( __( 'Save Changes', 'vpos' ) ); ?>
	</form>
</div>
