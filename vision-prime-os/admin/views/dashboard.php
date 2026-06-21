<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array $ctx */
$brand_name = get_bloginfo( 'name' );
?>
<div class="wrap vpos-wrap">
	<h1><?php esc_html_e( 'VisionPrime OS', 'vpos' ); ?></h1>

	<div class="vpos-card">
		<h2><?php esc_html_e( 'Brand', 'vpos' ); ?>: <?php echo esc_html( $brand_name ); ?></h2>
		<table class="widefat striped">
			<tbody>
				<tr><th><?php esc_html_e( 'Brand ID (Site ID)', 'vpos' ); ?></th><td><?php echo esc_html( $ctx['brand_id'] ); ?></td></tr>
				<tr><th><?php esc_html_e( 'Super Admin', 'vpos' ); ?></th><td><?php echo $ctx['is_super_admin'] ? esc_html__( 'Yes', 'vpos' ) : esc_html__( 'No', 'vpos' ); ?></td></tr>
				<tr><th><?php esc_html_e( 'Branch scope', 'vpos' ); ?></th><td><?php echo $ctx['branch_ids'] ? esc_html( implode( ', ', $ctx['branch_ids'] ) ) : esc_html__( 'All branches', 'vpos' ); ?></td></tr>
				<tr><th><?php esc_html_e( 'Permissions', 'vpos' ); ?></th><td><?php echo esc_html( implode( ', ', $ctx['permissions'] ) ?: '—' ); ?></td></tr>
				<tr><th><?php esc_html_e( 'Job queue', 'vpos' ); ?></th><td><?php echo VPOS_Jobs::has_action_scheduler() ? esc_html__( 'Action Scheduler', 'vpos' ) : esc_html__( 'WP-Cron fallback', 'vpos' ); ?></td></tr>
				<tr><th><?php esc_html_e( 'DB schema version', 'vpos' ); ?></th><td><?php echo esc_html( VPOS_DB_VERSION ); ?></td></tr>
			</tbody>
		</table>
	</div>

	<p class="description">
		<?php esc_html_e( 'Tenant, Customer, Wallet and other modules will appear here as each phase is built.', 'vpos' ); ?>
	</p>
</div>
