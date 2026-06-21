<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Wires the Automation Engine's REST API, wp-admin UI, and its hooks into
 * every existing domain event (customer created, order completed/
 * cancelled) — same hook-based pattern as Wallet/Loyalty, so this module
 * reacts without any other module knowing it exists.
 */
class VPOS_Automation_Module {

	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_rest' ) );
		add_action( 'vpos_admin_menu', array( $this, 'register_admin_menu' ) );
		add_action( 'admin_post_vpos_create_automation', array( $this, 'handle_create_rule' ) );
		add_action( 'admin_post_vpos_update_automation', array( $this, 'handle_update_rule' ) );
		add_action( 'vpos_customer_created', array( $this, 'on_customer_created' ) );
		add_action( 'vpos_order_completed', array( $this, 'on_order_completed' ), 10, 2 );
		add_action( 'vpos_order_cancelled', array( $this, 'on_order_cancelled' ), 10, 2 );
	}

	public function register_rest() {
		( new VPOS_Automation_REST() )->register_routes();
	}

	public function on_customer_created( $customer_id ) {
		( new VPOS_Automation_Repository() )->handle_event( 'customer_created', $customer_id );
	}

	public function on_order_completed( $order_id, array $order ) {
		( new VPOS_Automation_Repository() )->handle_event( 'order_completed', $order['customer_id'], array( 'order_id' => $order_id ) );
	}

	public function on_order_cancelled( $order_id, array $order ) {
		( new VPOS_Automation_Repository() )->handle_event( 'order_cancelled', $order['customer_id'], array( 'order_id' => $order_id ) );
	}

	public function register_admin_menu( $parent ) {
		add_submenu_page( $parent, __( 'Automations', 'vpos' ), __( 'Automations', 'vpos' ), 'read', 'vpos-automations', array( $this, 'render_automations' ) );
		add_submenu_page( $parent, __( 'Automation', 'vpos' ), __( 'Automation', 'vpos' ), 'read', 'vpos-automation-edit', array( $this, 'render_automation_edit' ) );
	}

	public function render_automations() {
		$page   = max( 1, (int) ( $_GET['paged'] ?? 1 ) );
		$result = ( new VPOS_Automation_Repository() )->paginate( array(), $page, 20 );
		include VPOS_DIR . 'modules/automation/views/automations.php';
	}

	public function render_automation_edit() {
		$id   = (int) ( $_GET['id'] ?? 0 );
		$rule = $id ? ( new VPOS_Automation_Repository() )->find( $id ) : null;
		$runs = $id ? ( new VPOS_Automation_Repository() )->get_runs( $id, 1, 20 ) : array( 'items' => array(), 'total' => 0 );
		include VPOS_DIR . 'modules/automation/views/automation-edit.php';
	}

	private function guard( $nonce_action, $permission ) {
		check_admin_referer( $nonce_action );
		if ( ! VPOS_Context::can( $permission ) ) {
			wp_die( esc_html__( 'You do not have permission to perform this action.', 'vpos' ) );
		}
	}

	private function redirect_with_notice( $page, array $extra, $error = null ) {
		$args = array_merge( array( 'page' => $page ), $extra );
		if ( $error ) {
			$args['vpos_error'] = rawurlencode( $error );
		}
		wp_safe_redirect( add_query_arg( $args, admin_url( 'admin.php' ) ) );
		exit;
	}

	public function handle_create_rule() {
		$this->guard( 'vpos_create_automation', 'automation:manage' );
		$data              = wp_unslash( $_POST );
		$data['conditions'] = ! empty( $data['conditions'] ) ? json_decode( $data['conditions'], true ) : array();
		$data['actions']    = ! empty( $data['actions'] ) ? json_decode( $data['actions'], true ) : array();
		$result            = ( new VPOS_Automation_Repository() )->create_rule( $data );
		if ( is_wp_error( $result ) ) {
			$this->redirect_with_notice( 'vpos-automations', array(), $result->get_error_message() );
		}
		$this->redirect_with_notice( 'vpos-automation-edit', array( 'id' => $result ) );
	}

	public function handle_update_rule() {
		$this->guard( 'vpos_update_automation', 'automation:manage' );
		$id                = (int) $_POST['id'];
		$data              = wp_unslash( $_POST );
		$data['conditions'] = ! empty( $data['conditions'] ) ? json_decode( $data['conditions'], true ) : array();
		$data['actions']    = ! empty( $data['actions'] ) ? json_decode( $data['actions'], true ) : array();
		$result            = ( new VPOS_Automation_Repository() )->update_rule( $id, $data );
		$error             = is_wp_error( $result ) ? $result->get_error_message() : null;
		$this->redirect_with_notice( 'vpos-automation-edit', array( 'id' => $id ), $error );
	}
}
