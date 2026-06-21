<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Wires Loyalty + Rewards REST/admin UI and their hook into the Order
 * Engine: completed orders earn points (tier-multiplied), cancelled
 * orders reverse them — same pattern as the Wallet module.
 */
class VPOS_Loyalty_Module {

	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_rest' ) );
		add_action( 'vpos_admin_menu', array( $this, 'register_admin_menu' ) );
		add_action( 'admin_post_vpos_create_tier', array( $this, 'handle_create_tier' ) );
		add_action( 'admin_post_vpos_create_reward', array( $this, 'handle_create_reward' ) );
		add_action( 'admin_post_vpos_update_reward', array( $this, 'handle_update_reward' ) );
		add_action( 'admin_post_vpos_redeem_reward', array( $this, 'handle_redeem_reward' ) );
		add_action( 'vpos_order_completed', array( $this, 'on_order_completed' ), 10, 2 );
		add_action( 'vpos_order_cancelled', array( $this, 'on_order_cancelled' ), 10, 3 );
		add_filter( 'vpos_customer_360', array( $this, 'add_loyalty_section' ), 10, 2 );
	}

	public function register_rest() {
		( new VPOS_Loyalty_REST() )->register_routes();
	}

	public function on_order_completed( $order_id, array $order ) {
		( new VPOS_Loyalty_Repository() )->apply_order_points( $order_id, $order );
	}

	public function on_order_cancelled( $order_id, array $order, $was_completed ) {
		if ( $was_completed ) {
			( new VPOS_Loyalty_Repository() )->reverse_order_points( $order_id );
		}
	}

	public function add_loyalty_section( array $profile, $customer_id ) {
		$loyalty               = new VPOS_Loyalty_Repository();
		$redemptions           = ( new VPOS_Reward_Repository() )->get_redemptions( $customer_id, 1, 10 );
		$profile['loyalty']    = array( 'balance' => $loyalty->balance( $customer_id ), 'tier' => $loyalty->current_tier( $customer_id ) );
		$profile['rewards']    = array( 'redemptions' => $redemptions['items'] );
		return $profile;
	}

	public function register_admin_menu( $parent ) {
		add_submenu_page( $parent, __( 'Loyalty Tiers', 'vpos' ), __( 'Loyalty Tiers', 'vpos' ), 'read', 'vpos-loyalty-tiers', array( $this, 'render_tiers' ) );
		add_submenu_page( $parent, __( 'Rewards', 'vpos' ), __( 'Rewards', 'vpos' ), 'read', 'vpos-rewards', array( $this, 'render_rewards' ) );
		add_submenu_page( $parent, __( 'Redeem Reward', 'vpos' ), __( 'Redeem Reward', 'vpos' ), 'read', 'vpos-redeem', array( $this, 'render_redeem' ) );
	}

	public function render_tiers() {
		$tiers = ( new VPOS_Loyalty_Repository() )->list_tiers();
		include VPOS_DIR . 'modules/loyalty/views/tiers.php';
	}

	public function render_rewards() {
		$page   = max( 1, (int) ( $_GET['paged'] ?? 1 ) );
		$result = ( new VPOS_Reward_Repository() )->paginate( array(), $page, 20 );
		include VPOS_DIR . 'modules/loyalty/views/rewards.php';
	}

	public function render_redeem() {
		$customer_id = (int) ( $_GET['customer_id'] ?? 0 );
		$customer    = $customer_id ? ( new VPOS_Customer_Repository() )->find( $customer_id ) : null;
		$loyalty     = new VPOS_Loyalty_Repository();
		$balance     = $customer_id ? $loyalty->balance( $customer_id ) : 0;
		$rewards     = ( new VPOS_Reward_Repository() )->list_active( 1, 100 )['items'];
		$redemptions = $customer_id ? ( new VPOS_Reward_Repository() )->get_redemptions( $customer_id, 1, 20 )['items'] : array();
		include VPOS_DIR . 'modules/loyalty/views/redeem.php';
	}

	private function guard( $nonce_action, $permission ) {
		check_admin_referer( $nonce_action );
		if ( ! VPOS_Context::can( $permission ) ) {
			wp_die( esc_html__( 'You do not have permission to perform this action.', 'vpos' ) );
		}
	}

	public function handle_create_tier() {
		$this->guard( 'vpos_create_tier', 'loyalty:manage' );
		( new VPOS_Loyalty_Repository() )->create_tier( wp_unslash( $_POST ) );
		wp_safe_redirect( admin_url( 'admin.php?page=vpos-loyalty-tiers' ) );
		exit;
	}

	public function handle_create_reward() {
		$this->guard( 'vpos_create_reward', 'reward:manage' );
		( new VPOS_Reward_Repository() )->create_reward( wp_unslash( $_POST ) );
		wp_safe_redirect( admin_url( 'admin.php?page=vpos-rewards' ) );
		exit;
	}

	public function handle_update_reward() {
		$this->guard( 'vpos_update_reward', 'reward:manage' );
		( new VPOS_Reward_Repository() )->update_reward( (int) $_POST['id'], wp_unslash( $_POST ) );
		wp_safe_redirect( admin_url( 'admin.php?page=vpos-rewards' ) );
		exit;
	}

	public function handle_redeem_reward() {
		$this->guard( 'vpos_redeem_reward', 'reward:redeem' );
		$customer_id = (int) $_POST['customer_id'];
		$result      = ( new VPOS_Reward_Repository() )->redeem( $customer_id, (int) $_POST['reward_id'] );
		$args        = array( 'page' => 'vpos-redeem', 'customer_id' => $customer_id );
		if ( is_wp_error( $result ) ) {
			$args['vpos_error'] = rawurlencode( $result->get_error_message() );
		}
		wp_safe_redirect( add_query_arg( $args, admin_url( 'admin.php' ) ) );
		exit;
	}
}
