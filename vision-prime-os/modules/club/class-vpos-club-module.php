<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Customer Club (Master Spec §18): a server-rendered WordPress front end
 * — shortcodes/templates, not a SPA — so brands can drop it into any
 * page via the block/shortcode editor. Forms post to admin-post.php
 * (nopriv, since club members aren't WP users) and redirect back.
 */
class VPOS_Club_Module {

	public function __construct() {
		add_shortcode( 'vpos_club_login', array( $this, 'render_login' ) );
		add_shortcode( 'vpos_club_dashboard', array( $this, 'render_dashboard' ) );
		add_action( 'admin_post_nopriv_vpos_club_request_otp', array( $this, 'handle_request_otp' ) );
		add_action( 'admin_post_nopriv_vpos_club_verify_otp', array( $this, 'handle_verify_otp' ) );
		add_action( 'admin_post_nopriv_vpos_club_logout', array( $this, 'handle_logout' ) );
		add_action( 'admin_post_nopriv_vpos_club_redeem', array( $this, 'handle_redeem' ) );
	}

	public function render_login() {
		if ( VPOS_Club_Session::current_customer() ) {
			return '<p>' . esc_html__( 'You are already logged in.', 'vpos' ) . '</p>';
		}
		ob_start();
		include VPOS_DIR . 'modules/club/views/login.php';
		return ob_get_clean();
	}

	public function render_dashboard() {
		$customer = VPOS_Club_Session::current_customer();
		if ( ! $customer ) {
			return '<p>' . esc_html__( 'Please log in to view your account.', 'vpos' ) . '</p>';
		}
		$wallet      = new VPOS_Wallet_Repository();
		$loyalty     = new VPOS_Loyalty_Repository();
		$orders      = ( new VPOS_Order_Repository() )->paginate( array( 'customer_id' => $customer['id'] ), 1, 10 )['items'];
		$rewards     = ( new VPOS_Reward_Repository() )->list_active( 1, 50 )['items'];
		$balance     = $wallet->balance( $customer['id'] );
		$points      = $loyalty->balance( $customer['id'] );
		$tier        = $loyalty->current_tier( $customer['id'] );
		ob_start();
		include VPOS_DIR . 'modules/club/views/dashboard.php';
		return ob_get_clean();
	}

	public function handle_request_otp() {
		check_admin_referer( 'vpos_club_request_otp' );
		$result = VPOS_Club_Session::request_otp( $_POST['mobile'] ?? '' );
		$args   = array( 'vpos_club' => 'otp_sent', 'mobile' => rawurlencode( wp_unslash( $_POST['mobile'] ?? '' ) ) );
		if ( is_wp_error( $result ) ) {
			$args = array( 'vpos_club_error' => rawurlencode( $result->get_error_message() ) );
		}
		$this->redirect_back( $args );
	}

	public function handle_verify_otp() {
		check_admin_referer( 'vpos_club_verify_otp' );
		$result = VPOS_Club_Session::verify_otp( $_POST['mobile'] ?? '', $_POST['code'] ?? '' );
		$args   = is_wp_error( $result ) ? array( 'vpos_club_error' => rawurlencode( $result->get_error_message() ) ) : array();
		$this->redirect_back( $args );
	}

	public function handle_logout() {
		VPOS_Club_Session::logout();
		$this->redirect_back( array() );
	}

	public function handle_redeem() {
		check_admin_referer( 'vpos_club_redeem' );
		$customer = VPOS_Club_Session::current_customer();
		if ( ! $customer ) {
			$this->redirect_back( array() );
		}
		$result = ( new VPOS_Reward_Repository() )->redeem( $customer['id'], (int) ( $_POST['reward_id'] ?? 0 ) );
		$args   = is_wp_error( $result ) ? array( 'vpos_club_error' => rawurlencode( $result->get_error_message() ) ) : array();
		$this->redirect_back( $args );
	}

	private function redirect_back( array $args ) {
		$referer = wp_get_referer() ?: home_url();
		wp_safe_redirect( $args ? add_query_arg( $args, $referer ) : $referer );
		exit;
	}
}
