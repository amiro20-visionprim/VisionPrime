<?php
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

/**
 * Business data (customers, wallet ledger, audit logs, ...) is never
 * dropped automatically — financial/audit records must survive plugin
 * removal. Only plugin options are cleaned up.
 */
delete_option( 'vpos_db_version' );
