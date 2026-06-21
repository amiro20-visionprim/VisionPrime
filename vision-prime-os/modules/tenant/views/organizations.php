<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array $result */
?>
<div class="wrap">
	<h1><?php esc_html_e( 'Organizations', 'vpos' ); ?>
		<a href="<?php echo esc_url( admin_url( 'admin.php?page=vpos-organization-edit' ) ); ?>" class="page-title-action"><?php esc_html_e( 'Add New', 'vpos' ); ?></a>
	</h1>

	<?php if ( ! empty( $_GET['vpos_error'] ) ) : ?>
		<div class="notice notice-error"><p><?php echo esc_html( wp_unslash( $_GET['vpos_error'] ) ); ?></p></div>
	<?php endif; ?>

	<table class="widefat striped">
		<thead><tr>
			<th><?php esc_html_e( 'Name', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Status', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Country', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Timezone', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Created', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Actions', 'vpos' ); ?></th>
		</tr></thead>
		<tbody>
		<?php foreach ( $result['items'] as $org ) : ?>
			<tr>
				<td><?php echo esc_html( $org['name'] ); ?></td>
				<td><?php echo esc_html( $org['status'] ); ?></td>
				<td><?php echo esc_html( $org['country'] ); ?></td>
				<td><?php echo esc_html( $org['timezone'] ); ?></td>
				<td><?php echo esc_html( $org['created_at'] ); ?></td>
				<td><a href="<?php echo esc_url( admin_url( 'admin.php?page=vpos-organization-edit&id=' . $org['id'] ) ); ?>"><?php esc_html_e( 'Edit', 'vpos' ); ?></a></td>
			</tr>
		<?php endforeach; ?>
		<?php if ( ! $result['items'] ) : ?>
			<tr><td colspan="6"><?php esc_html_e( 'No organizations yet.', 'vpos' ); ?></td></tr>
		<?php endif; ?>
		</tbody>
	</table>
</div>
