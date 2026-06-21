<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array $result */
?>
<div class="wrap">
	<h1><?php esc_html_e( 'Integration Logs', 'vpos' ); ?></h1>
	<table class="widefat striped">
		<thead><tr>
			<th><?php esc_html_e( 'Channel', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Provider', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Recipient', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Status', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Response', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Created', 'vpos' ); ?></th>
		</tr></thead>
		<tbody>
		<?php foreach ( $result['items'] as $log ) : ?>
			<tr>
				<td><?php echo esc_html( $log['channel'] ); ?></td>
				<td><?php echo esc_html( $log['provider'] ); ?></td>
				<td><?php echo esc_html( $log['recipient'] ); ?></td>
				<td><?php echo esc_html( $log['status'] ); ?></td>
				<td><?php echo esc_html( $log['response'] ); ?></td>
				<td><?php echo esc_html( $log['created_at'] ); ?></td>
			</tr>
		<?php endforeach; ?>
		<?php if ( ! $result['items'] ) : ?>
			<tr><td colspan="6"><?php esc_html_e( 'No integration activity yet.', 'vpos' ); ?></td></tr>
		<?php endif; ?>
		</tbody>
	</table>
</div>
