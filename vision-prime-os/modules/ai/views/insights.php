<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array $result */
?>
<div class="wrap">
	<h1><?php esc_html_e( 'AI Insights', 'vpos' ); ?></h1>

	<?php if ( ! empty( $_GET['vpos_error'] ) ) : ?>
		<div class="notice notice-error"><p><?php echo esc_html( wp_unslash( $_GET['vpos_error'] ) ); ?></p></div>
	<?php endif; ?>

	<table class="widefat striped">
		<thead><tr>
			<th><?php esc_html_e( 'Type', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Customer', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Suggested Action', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Actions', 'vpos' ); ?></th>
		</tr></thead>
		<tbody>
		<?php foreach ( $result['items'] as $insight ) : ?>
			<tr>
				<td><?php echo esc_html( $insight['type'] ); ?></td>
				<td><?php echo esc_html( $insight['customer_id'] ); ?></td>
				<td><code><?php echo esc_html( $insight['suggested_action'] ); ?></code></td>
				<td>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
						<input type="hidden" name="action" value="vpos_approve_insight" />
						<input type="hidden" name="id" value="<?php echo esc_attr( $insight['id'] ); ?>" />
						<?php wp_nonce_field( 'vpos_approve_insight' ); ?>
						<?php submit_button( __( 'Approve', 'vpos' ), 'primary', '', false ); ?>
					</form>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
						<input type="hidden" name="action" value="vpos_reject_insight" />
						<input type="hidden" name="id" value="<?php echo esc_attr( $insight['id'] ); ?>" />
						<?php wp_nonce_field( 'vpos_reject_insight' ); ?>
						<?php submit_button( __( 'Reject', 'vpos' ), '', '', false ); ?>
					</form>
				</td>
			</tr>
		<?php endforeach; ?>
		<?php if ( ! $result['items'] ) : ?>
			<tr><td colspan="4"><?php esc_html_e( 'No pending insights.', 'vpos' ); ?></td></tr>
		<?php endif; ?>
		</tbody>
	</table>
</div>
