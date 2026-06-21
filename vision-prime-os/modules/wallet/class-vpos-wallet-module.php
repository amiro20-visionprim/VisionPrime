<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Wires the Wallet module's REST API, wp-admin UI, and its hook into the
 * Order Engine: completed orders may earn cashback, cancelled orders
 * reverse it — all without VPOS_Order_Repository knowing Wallet exists.
 */
class VPOS_Wallet_Module {

	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_rest' ) );
		add_action( 'vpos_admin_menu', array( $this, 'register_admin_menu' ) );
		add_action( 'admin_post_vpos_wallet_credit', array( $this, 'handle_credit' ) );
		add_action( 'admin_post_vpos_wallet_debit', array( $this, 'handle_debit' ) );
		add_action( 'admin_post_vpos_wallet_reverse', array( $this, 'handle_reverse' ) );
		add_action( 'vpos_order_completed', array( $this, 'on_order_completed' ), 10, 2 );
		add_action( 'vpos_order_cancelled', array( $this, 'on_order_cancelled' ), 10, 3 );
		add_filter( 'vpos_customer_360', array( $this, 'add_wallet_section' ), 10, 2 );
	}

	public function register_rest() {
		( new VPOS_Wallet_REST() )->register_routes();
	}

	public function on_order_completed( $order_id, array $order ) {
		( new VPOS_Wallet_Repository() )->apply_order_cashback( $order_id, $order );
	}

	public function on_order_cancelled( $order_id, array $order, $was_completed ) {
		if ( $was_completed ) {
			( new VPOS_Wallet_Repository() )->reverse_order_cashback( $order_id );
		}
	}

	public function add_wallet_section( array $profile, $customer_id ) {
		$repo               = new VPOS_Wallet_Repository();
		$ledger             = $repo->get_ledger( $customer_id, 1, 10 );
		$profile['wallet']  = array( 'balance' => $repo->balance( $customer_id ), 'recent_entries' => $ledger['items'] );
		return $profile;
	}

	public function register_admin_menu( $parent ) {
		add_submenu_page( $parent, __( 'Wallet', 'vpos' ), __( 'Wallet', 'vpos' ), 'read', 'vpos-wallet', array( $this, 'render_wallet' ) );
	}

	public function render_wallet() {
		$customer_id = (int) ( $_GET['customer_id'] ?? 0 );
		$customer    = $customer_id ? ( new VPOS_Customer_Repository() )->find( $customer_id ) : null;
		$repo        = new VPOS_Wallet_Repository();
		$page        = max( 1, (int) ( $_GET['paged'] ?? 1 ) );
		$ledger      = $customer_id ? $repo->get_ledger( $customer_id, $page, 20 ) : array( 'items' => array(), 'total' => 0, 'page' => 1, 'limit' => 20 );
		$balance     = $customer_id ? $repo->balance( $customer_id ) : 0;
		include VPOS_DIR . 'modules/wallet/views/wallet.php';
	}

	private function guard( $nonce_action, $permission ) {
		check_admin_referer( $nonce_action );
		if ( ! VPOS_Context::can( $permission ) ) {
			wp_die( esc_html__( 'You do not have permission to perform this action.', 'vpos' ) );
		}
	}

	private function redirect_with_notice( $customer_id, $error = null ) {
		$args = array( 'page' => 'vpos-wallet', 'customer_id' => $customer_id );
		if ( $error ) {
			$args['vpos_error'] = rawurlencode( $error );
		}
		wp_safe_redirect( add_query_arg( $args, admin_url( 'admin.php' ) ) );
		exit;
	}

	public function handle_credit() {
		$this->guard( 'vpos_wallet_credit', 'wallet:credit' );
		$id     = (int) $_POST['customer_id'];
		$result = ( new VPOS_Wallet_Repository() )->credit( $id, (float) $_POST['amount'], 'manual', array( 'reason' => wp_unslash( $_POST['reason'] ?? '' ) ) );
		$this->redirect_with_notice( $id, is_wp_error( $result ) ? $result->get_error_message() : null );
	}

	public function handle_debit() {
		$this->guard( 'vpos_wallet_debit', 'wallet:debit' );
		$id     = (int) $_POST['customer_id'];
		$result = ( new VPOS_Wallet_Repository() )->debit( $id, (float) $_POST['amount'], 'manual', array( 'reason' => wp_unslash( $_POST['reason'] ?? '' ) ) );
		$this->redirect_with_notice( $id, is_wp_error( $result ) ? $result->get_error_message() : null );
	}

	public function handle_reverse() {
		$this->guard( 'vpos_wallet_reverse', 'wallet:reverse' );
		$entry_id    = (int) $_POST['entry_id'];
		$customer_id = (int) $_POST['customer_id'];
		$result      = ( new VPOS_Wallet_Repository() )->reverse( $entry_id, wp_unslash( $_POST['reason'] ?? '' ) );
		$this->redirect_with_notice( $customer_id, is_wp_error( $result ) ? $result->get_error_message() : null );
	}
}
