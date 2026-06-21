<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array|null $settings */
if ( ! $settings ) {
	echo '<div class="wrap"><p>' . esc_html__( 'Brand settings not found.', 'vpos' ) . '</p></div>';
	return;
}
$flags = array(
	'wallet_enabled'        => __( 'Wallet', 'vpos' ),
	'loyalty_enabled'       => __( 'Loyalty', 'vpos' ),
	'rewards_enabled'       => __( 'Rewards', 'vpos' ),
	'campaigns_enabled'     => __( 'Campaigns', 'vpos' ),
	'customer_club_enabled' => __( 'Customer Club', 'vpos' ),
);
?>
<div class="wrap">
	<h1><?php esc_html_e( 'Brand Settings', 'vpos' ); ?></h1>

	<?php if ( ! empty( $_GET['vpos_error'] ) ) : ?>
		<div class="notice notice-error"><p><?php echo esc_html( wp_unslash( $_GET['vpos_error'] ) ); ?></p></div>
	<?php endif; ?>

	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="vpos_update_brand_settings" />
		<?php wp_nonce_field( 'vpos_update_brand_settings' ); ?>
		<table class="form-table">
			<tr><th><label for="club_domain"><?php esc_html_e( 'Club Domain', 'vpos' ); ?></label></th>
				<td><input type="text" id="club_domain" name="club_domain" class="regular-text" value="<?php echo esc_attr( $settings['club_domain'] ); ?>" /></td></tr>
			<tr><th><label for="sms_sender_name"><?php esc_html_e( 'SMS Sender Name', 'vpos' ); ?></label></th>
				<td><input type="text" id="sms_sender_name" name="sms_sender_name" value="<?php echo esc_attr( $settings['sms_sender_name'] ); ?>" /></td></tr>
			<tr><th><label for="support_phone"><?php esc_html_e( 'Support Phone', 'vpos' ); ?></label></th>
				<td><input type="text" id="support_phone" name="support_phone" value="<?php echo esc_attr( $settings['support_phone'] ); ?>" /></td></tr>
			<tr><th><label for="support_email"><?php esc_html_e( 'Support Email', 'vpos' ); ?></label></th>
				<td><input type="email" id="support_email" name="support_email" value="<?php echo esc_attr( $settings['support_email'] ); ?>" /></td></tr>
			<tr><th><label for="terms_url"><?php esc_html_e( 'Terms URL', 'vpos' ); ?></label></th>
				<td><input type="url" id="terms_url" name="terms_url" class="regular-text" value="<?php echo esc_attr( $settings['terms_url'] ); ?>" /></td></tr>
			<tr><th><label for="privacy_url"><?php esc_html_e( 'Privacy URL', 'vpos' ); ?></label></th>
				<td><input type="url" id="privacy_url" name="privacy_url" class="regular-text" value="<?php echo esc_attr( $settings['privacy_url'] ); ?>" /></td></tr>
			<?php foreach ( $flags as $key => $label ) : ?>
			<tr><th><label for="<?php echo esc_attr( $key ); ?>"><?php echo esc_html( $label ); ?></label></th>
				<td><input type="checkbox" id="<?php echo esc_attr( $key ); ?>" name="<?php echo esc_attr( $key ); ?>" <?php checked( (int) $settings[ $key ], 1 ); ?> /></td></tr>
			<?php endforeach; ?>
		</table>
		<?php submit_button( __( 'Save Settings', 'vpos' ) ); ?>
	</form>
</div>
