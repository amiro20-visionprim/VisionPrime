<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Wires the AI Intelligence Layer's REST API, wp-admin review queue, and a
 * daily job that scans for churn-risk customers — insights are always
 * suggested here and only ever applied through an explicit human
 * approve/reject, never automatically.
 */
class VPOS_Ai_Module {

	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_rest' ) );
		add_action( 'vpos_admin_menu', array( $this, 'register_admin_menu' ) );
		add_action( 'admin_post_vpos_approve_insight', array( $this, 'handle_approve' ) );
		add_action( 'admin_post_vpos_reject_insight', array( $this, 'handle_reject' ) );
		add_action( 'vpos_job_generate_churn_insights', array( $this, 'generate_churn_insights' ) );
		VPOS_Jobs::enqueue_recurring( 'generate_churn_insights', DAY_IN_SECONDS );
	}

	public function register_rest() {
		( new VPOS_Ai_REST() )->register_routes();
	}

	public function generate_churn_insights() {
		( new VPOS_Ai_Repository() )->generate_churn_risk_insights();
	}

	public function register_admin_menu( $parent ) {
		add_submenu_page( $parent, __( 'AI Insights', 'vpos' ), __( 'AI Insights', 'vpos' ), 'read', 'vpos-ai-insights', array( $this, 'render_insights' ) );
	}

	public function render_insights() {
		$page   = max( 1, (int) ( $_GET['paged'] ?? 1 ) );
		$result = ( new VPOS_Ai_Repository() )->paginate( array( 'status' => 'suggested' ), $page, 20 );
		include VPOS_DIR . 'modules/ai/views/insights.php';
	}

	private function guard( $nonce_action ) {
		check_admin_referer( $nonce_action );
		if ( ! VPOS_Context::can( 'ai:manage' ) ) {
			wp_die( esc_html__( 'You do not have permission to perform this action.', 'vpos' ) );
		}
	}

	public function handle_approve() {
		$this->guard( 'vpos_approve_insight' );
		$ctx    = VPOS_Context::resolve();
		$result = ( new VPOS_Ai_Repository() )->approve( (int) $_POST['id'], $ctx['user_id'] );
		$error  = is_wp_error( $result ) ? $result->get_error_message() : null;
		$args   = array( 'page' => 'vpos-ai-insights' );
		if ( $error ) {
			$args['vpos_error'] = rawurlencode( $error );
		}
		wp_safe_redirect( add_query_arg( $args, admin_url( 'admin.php' ) ) );
		exit;
	}

	public function handle_reject() {
		$this->guard( 'vpos_reject_insight' );
		$ctx = VPOS_Context::resolve();
		( new VPOS_Ai_Repository() )->reject( (int) $_POST['id'], $ctx['user_id'] );
		wp_safe_redirect( add_query_arg( array( 'page' => 'vpos-ai-insights' ), admin_url( 'admin.php' ) ) );
		exit;
	}
}
