<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Wires Segments/Campaigns/Notifications REST API, wp-admin UI, and the
 * background job that fires a scheduled campaign at its scheduled time
 * (Master Spec §16-17, §31).
 */
class VPOS_Campaign_Module {

	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_rest' ) );
		add_action( 'vpos_admin_menu', array( $this, 'register_admin_menu' ) );
		add_action( 'vpos_job_send_campaign', array( $this, 'on_send_campaign_job' ) );
		add_action( 'admin_post_vpos_create_segment', array( $this, 'handle_create_segment' ) );
		add_action( 'admin_post_vpos_update_segment', array( $this, 'handle_update_segment' ) );
		add_action( 'admin_post_vpos_create_campaign', array( $this, 'handle_create_campaign' ) );
		add_action( 'admin_post_vpos_update_campaign', array( $this, 'handle_update_campaign' ) );
		add_action( 'admin_post_vpos_schedule_campaign', array( $this, 'handle_schedule_campaign' ) );
		add_action( 'admin_post_vpos_send_campaign', array( $this, 'handle_send_campaign' ) );
		add_action( 'admin_post_vpos_cancel_campaign', array( $this, 'handle_cancel_campaign' ) );
		add_filter( 'vpos_customer_360', array( $this, 'add_notifications_section' ), 10, 2 );
	}

	public function add_notifications_section( array $profile, $customer_id ) {
		$notifications              = ( new VPOS_Notification_Repository() )->get_for_customer( $customer_id, 1, 10 );
		$profile['notifications']   = array( 'unread_count' => ( new VPOS_Notification_Repository() )->unread_count( $customer_id ), 'recent' => $notifications['items'] );
		return $profile;
	}

	public function register_rest() {
		( new VPOS_Campaign_REST() )->register_routes();
	}

	public function on_send_campaign_job( array $args ) {
		( new VPOS_Campaign_Repository() )->send_now( (int) $args['campaign_id'] );
	}

	public function register_admin_menu( $parent ) {
		$cap = 'read';
		add_submenu_page( $parent, __( 'Segments', 'vpos' ), __( 'Segments', 'vpos' ), $cap, 'vpos-segments', array( $this, 'render_segments' ) );
		add_submenu_page( $parent, __( 'Segment', 'vpos' ), __( 'Segment', 'vpos' ), $cap, 'vpos-segment-edit', array( $this, 'render_segment_edit' ) );
		add_submenu_page( $parent, __( 'Campaigns', 'vpos' ), __( 'Campaigns', 'vpos' ), $cap, 'vpos-campaigns', array( $this, 'render_campaigns' ) );
		add_submenu_page( $parent, __( 'Campaign', 'vpos' ), __( 'Campaign', 'vpos' ), $cap, 'vpos-campaign-edit', array( $this, 'render_campaign_edit' ) );
	}

	/* ---------------- views ---------------- */

	public function render_segments() {
		$page   = max( 1, (int) ( $_GET['paged'] ?? 1 ) );
		$result = ( new VPOS_Segment_Repository() )->paginate( array(), $page, 20 );
		include VPOS_DIR . 'modules/campaign/views/segments.php';
	}

	public function render_segment_edit() {
		$id      = (int) ( $_GET['id'] ?? 0 );
		$segment = $id ? ( new VPOS_Segment_Repository() )->find( $id ) : null;
		$count   = $id ? ( new VPOS_Segment_Repository() )->count_customers( $id ) : 0;
		include VPOS_DIR . 'modules/campaign/views/segment-edit.php';
	}

	public function render_campaigns() {
		$page   = max( 1, (int) ( $_GET['paged'] ?? 1 ) );
		$result = ( new VPOS_Campaign_Repository() )->paginate( array(), $page, 20 );
		include VPOS_DIR . 'modules/campaign/views/campaigns.php';
	}

	public function render_campaign_edit() {
		$id       = (int) ( $_GET['id'] ?? 0 );
		$campaign = $id ? ( new VPOS_Campaign_Repository() )->find( $id ) : null;
		$sends    = $id ? ( new VPOS_Campaign_Repository() )->get_sends( $id, 1, 20 ) : array( 'items' => array(), 'total' => 0 );
		$segments = ( new VPOS_Segment_Repository() )->paginate( array(), 1, 200 )['items'];
		include VPOS_DIR . 'modules/campaign/views/campaign-edit.php';
	}

	/* ---------------- admin-post handlers ---------------- */

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

	public function handle_create_segment() {
		$this->guard( 'vpos_create_segment', 'segment:manage' );
		$data         = wp_unslash( $_POST );
		$data['rules'] = ! empty( $data['rules'] ) ? json_decode( $data['rules'], true ) : array();
		$result       = ( new VPOS_Segment_Repository() )->create_segment( $data );
		if ( is_wp_error( $result ) ) {
			$this->redirect_with_notice( 'vpos-segments', array(), $result->get_error_message() );
		}
		$this->redirect_with_notice( 'vpos-segment-edit', array( 'id' => $result ) );
	}

	public function handle_update_segment() {
		$this->guard( 'vpos_update_segment', 'segment:manage' );
		$id           = (int) $_POST['id'];
		$data         = wp_unslash( $_POST );
		$data['rules'] = ! empty( $data['rules'] ) ? json_decode( $data['rules'], true ) : array();
		$result       = ( new VPOS_Segment_Repository() )->update_segment( $id, $data );
		$error        = is_wp_error( $result ) ? $result->get_error_message() : null;
		$this->redirect_with_notice( 'vpos-segment-edit', array( 'id' => $id ), $error );
	}

	public function handle_create_campaign() {
		$this->guard( 'vpos_create_campaign', 'campaign:manage' );
		$result = ( new VPOS_Campaign_Repository() )->create_campaign( wp_unslash( $_POST ) );
		if ( is_wp_error( $result ) ) {
			$this->redirect_with_notice( 'vpos-campaigns', array(), $result->get_error_message() );
		}
		$this->redirect_with_notice( 'vpos-campaign-edit', array( 'id' => $result ) );
	}

	public function handle_update_campaign() {
		$this->guard( 'vpos_update_campaign', 'campaign:manage' );
		$id     = (int) $_POST['id'];
		$result = ( new VPOS_Campaign_Repository() )->update_campaign( $id, wp_unslash( $_POST ) );
		$error  = is_wp_error( $result ) ? $result->get_error_message() : null;
		$this->redirect_with_notice( 'vpos-campaign-edit', array( 'id' => $id ), $error );
	}

	public function handle_schedule_campaign() {
		$this->guard( 'vpos_schedule_campaign', 'campaign:manage' );
		$id        = (int) $_POST['id'];
		$timestamp = strtotime( wp_unslash( $_POST['scheduled_at'] ?? '' ) );
		$result    = $timestamp ? ( new VPOS_Campaign_Repository() )->schedule( $id, $timestamp ) :
			new WP_Error( VPOS_Response::ERROR_VALIDATION, 'A valid scheduled_at is required.' );
		$error     = is_wp_error( $result ) ? $result->get_error_message() : null;
		$this->redirect_with_notice( 'vpos-campaign-edit', array( 'id' => $id ), $error );
	}

	public function handle_send_campaign() {
		$this->guard( 'vpos_send_campaign', 'campaign:manage' );
		$id     = (int) $_POST['id'];
		$result = ( new VPOS_Campaign_Repository() )->send_now( $id );
		$error  = is_wp_error( $result ) ? $result->get_error_message() : null;
		$this->redirect_with_notice( 'vpos-campaign-edit', array( 'id' => $id ), $error );
	}

	public function handle_cancel_campaign() {
		$this->guard( 'vpos_cancel_campaign', 'campaign:manage' );
		$id     = (int) $_POST['id'];
		$result = ( new VPOS_Campaign_Repository() )->cancel( $id );
		$error  = is_wp_error( $result ) ? $result->get_error_message() : null;
		$this->redirect_with_notice( 'vpos-campaign-edit', array( 'id' => $id ), $error );
	}
}
