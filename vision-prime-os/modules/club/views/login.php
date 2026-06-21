<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
$mobile     = isset( $_GET['mobile'] ) ? sanitize_text_field( wp_unslash( $_GET['mobile'] ) ) : '';
$otp_sent   = isset( $_GET['vpos_club'] ) && 'otp_sent' === $_GET['vpos_club'];
?>
<div class="vpos-club-login">
	<?php if ( ! empty( $_GET['vpos_club_error'] ) ) : ?>
		<p class="vpos-club-error"><?php echo esc_html( wp_unslash( $_GET['vpos_club_error'] ) ); ?></p>
	<?php endif; ?>

	<?php if ( ! $otp_sent ) : ?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="vpos_club_request_otp" />
			<?php wp_nonce_field( 'vpos_club_request_otp' ); ?>
			<label><?php esc_html_e( 'Mobile Number', 'vpos' ); ?>
				<input type="text" name="mobile" required />
			</label>
			<button type="submit"><?php esc_html_e( 'Send Code', 'vpos' ); ?></button>
		</form>
	<?php else : ?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="vpos_club_verify_otp" />
			<input type="hidden" name="mobile" value="<?php echo esc_attr( $mobile ); ?>" />
			<?php wp_nonce_field( 'vpos_club_verify_otp' ); ?>
			<p><?php printf( esc_html__( 'We sent a code to %s.', 'vpos' ), esc_html( $mobile ) ); ?></p>
			<label><?php esc_html_e( 'Verification Code', 'vpos' ); ?>
				<input type="text" name="code" required />
			</label>
			<button type="submit"><?php esc_html_e( 'Verify & Log In', 'vpos' ); ?></button>
		</form>
	<?php endif; ?>
</div>
