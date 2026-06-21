<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Wires the Reports REST API and a single wp-admin dashboard page —
 * Reports has no events of its own to react to, so unlike every other
 * module this one only registers, it never listens.
 */
class VPOS_Report_Module {

	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_rest' ) );
		add_action( 'vpos_admin_menu', array( $this, 'register_admin_menu' ) );
	}

	public function register_rest() {
		( new VPOS_Report_REST() )->register_routes();
	}

	public function register_admin_menu( $parent ) {
		add_submenu_page( $parent, __( 'Reports', 'vpos' ), __( 'Reports', 'vpos' ), 'read', 'vpos-reports', array( $this, 'render_reports' ) );
	}

	public function render_reports() {
		$reports = new VPOS_Report_Repository();
		$from    = isset( $_GET['from'] ) ? sanitize_text_field( wp_unslash( $_GET['from'] ) ) : null;
		$to      = isset( $_GET['to'] ) ? sanitize_text_field( wp_unslash( $_GET['to'] ) ) : null;
		$revenue          = $reports->revenue_summary( $from, $to );
		$customer_growth  = $reports->customer_growth( $from, $to );
		$wallet_liability = $reports->wallet_liability();
		$loyalty_liability = $reports->loyalty_liability();
		$top_customers    = $reports->top_customers( 10 );
		include VPOS_DIR . 'modules/report/views/reports.php';
	}
}
