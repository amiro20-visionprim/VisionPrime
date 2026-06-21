<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array $result */
?>
<div class="wrap">
	<h1><?php esc_html_e( 'Branches', 'vpos' ); ?>
		<a href="<?php echo esc_url( admin_url( 'admin.php?page=vpos-branch-edit' ) ); ?>" class="page-title-action"><?php esc_html_e( 'Add New', 'vpos' ); ?></a>
	</h1>

	<?php if ( ! empty( $_GET['vpos_error'] ) ) : ?>
		<div class="notice notice-error"><p><?php echo esc_html( wp_unslash( $_GET['vpos_error'] ) ); ?></p></div>
	<?php endif; ?>

	<table class="widefat striped">
		<thead><tr>
			<th><?php esc_html_e( 'Name', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Code', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Type', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'City', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Status', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Phone', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Created', 'vpos' ); ?></th>
			<th><?php esc_html_e( 'Actions', 'vpos' ); ?></th>
		</tr></thead>
		<tbody>
		<?php foreach ( $result['items'] as $branch ) : ?>
			<tr>
				<td><?php echo esc_html( $branch['name'] ); ?></td>
				<td><?php echo esc_html( $branch['code'] ); ?></td>
				<td><?php echo esc_html( $branch['type'] ); ?></td>
				<td><?php echo esc_html( $branch['city'] ); ?></td>
				<td><?php echo esc_html( $branch['status'] ); ?></td>
				<td><?php echo esc_html( $branch['phone'] ); ?></td>
				<td><?php echo esc_html( $branch['created_at'] ); ?></td>
				<td>
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=vpos-branch-edit&id=' . $branch['id'] ) ); ?>"><?php esc_html_e( 'Edit', 'vpos' ); ?></a>
					<?php if ( 'archived' !== $branch['status'] ) : ?>
						| <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline" onsubmit="return confirm('<?php echo esc_js( __( 'Archive this branch?', 'vpos' ) ); ?>');">
							<input type="hidden" name="action" value="vpos_archive_branch" />
							<input type="hidden" name="id" value="<?php echo esc_attr( $branch['id'] ); ?>" />
							<?php wp_nonce_field( 'vpos_archive_branch' ); ?>
							<button type="submit" class="button-link"><?php esc_html_e( 'Archive', 'vpos' ); ?></button>
						</form>
					<?php endif; ?>
				</td>
			</tr>
		<?php endforeach; ?>
		<?php if ( ! $result['items'] ) : ?>
			<tr><td colspan="8"><?php esc_html_e( 'No branches yet.', 'vpos' ); ?></td></tr>
		<?php endif; ?>
		</tbody>
	</table>
</div>
