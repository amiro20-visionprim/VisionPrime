<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Wires the Tenant module's REST API and wp-admin UI. Admin UI posts go
 * straight to repositories (no REST round-trip needed inside wp-admin);
 * the REST API in class-vpos-tenant-rest.php is for external/API-key use.
 */
class VPOS_Tenant_Module {

	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_rest' ) );
		add_action( 'vpos_admin_menu', array( $this, 'register_admin_menu' ) );
		add_action( 'admin_post_vpos_create_organization', array( $this, 'handle_create_organization' ) );
		add_action( 'admin_post_vpos_update_organization', array( $this, 'handle_update_organization' ) );
		add_action( 'admin_post_vpos_create_brand', array( $this, 'handle_create_brand' ) );
		add_action( 'admin_post_vpos_update_brand', array( $this, 'handle_update_brand' ) );
		add_action( 'admin_post_vpos_update_brand_settings', array( $this, 'handle_update_brand_settings' ) );
		add_action( 'admin_post_vpos_create_branch', array( $this, 'handle_create_branch' ) );
		add_action( 'admin_post_vpos_update_branch', array( $this, 'handle_update_branch' ) );
		add_action( 'admin_post_vpos_archive_branch', array( $this, 'handle_archive_branch' ) );
	}

	public function register_rest() {
		( new VPOS_Tenant_REST() )->register_routes();
	}

	public function register_admin_menu( $parent ) {
		$cap = 'read';
		if ( is_main_site() ) {
			add_submenu_page( $parent, __( 'Organizations', 'vpos' ), __( 'Organizations', 'vpos' ), $cap, 'vpos-organizations', array( $this, 'render_organizations' ) );
			add_submenu_page( $parent, __( 'Organization', 'vpos' ), __( 'Organization', 'vpos' ), $cap, 'vpos-organization-edit', array( $this, 'render_organization_edit' ) );
			add_submenu_page( $parent, __( 'Brands', 'vpos' ), __( 'Brands', 'vpos' ), $cap, 'vpos-brands', array( $this, 'render_brands' ) );
			add_submenu_page( $parent, __( 'Brand', 'vpos' ), __( 'Brand', 'vpos' ), $cap, 'vpos-brand-edit', array( $this, 'render_brand_edit' ) );
		}
		add_submenu_page( $parent, __( 'Brand Settings', 'vpos' ), __( 'Brand Settings', 'vpos' ), $cap, 'vpos-brand-settings', array( $this, 'render_brand_settings' ) );
		add_submenu_page( $parent, __( 'Branches', 'vpos' ), __( 'Branches', 'vpos' ), $cap, 'vpos-branches', array( $this, 'render_branches' ) );
		add_submenu_page( $parent, __( 'Branch', 'vpos' ), __( 'Branch', 'vpos' ), $cap, 'vpos-branch-edit', array( $this, 'render_branch_edit' ) );
	}

	/* ---------------- views ---------------- */

	public function render_organizations() {
		$repo  = new VPOS_Organization_Repository();
		$page  = max( 1, (int) ( $_GET['paged'] ?? 1 ) );
		$result = $repo->paginate( array(), $page, 20 );
		include VPOS_DIR . 'modules/tenant/views/organizations.php';
	}

	public function render_organization_edit() {
		$id  = (int) ( $_GET['id'] ?? 0 );
		$org = $id ? ( new VPOS_Organization_Repository() )->find( $id ) : null;
		include VPOS_DIR . 'modules/tenant/views/organization-edit.php';
	}

	public function render_brands() {
		$repo   = new VPOS_Brand_Repository();
		$page   = max( 1, (int) ( $_GET['paged'] ?? 1 ) );
		$where  = array();
		if ( ! empty( $_GET['organization_id'] ) ) {
			$where['organization_id'] = (int) $_GET['organization_id'];
		}
		$result        = $repo->paginate( $where, $page, 20 );
		$organizations = ( new VPOS_Organization_Repository() )->paginate( array(), 1, 200 )['items'];
		include VPOS_DIR . 'modules/tenant/views/brands.php';
	}

	public function render_brand_edit() {
		$id    = (int) ( $_GET['id'] ?? 0 );
		$brand = $id ? ( new VPOS_Brand_Repository() )->find( $id ) : null;
		include VPOS_DIR . 'modules/tenant/views/brand-edit.php';
	}

	public function render_brand_settings() {
		if ( ! VPOS_Context::can( 'brand:settings:update' ) && ! VPOS_Context::can( 'brand:view' ) ) {
			wp_die( esc_html__( 'You do not have permission to view this page.', 'vpos' ) );
		}
		$settings = ( new VPOS_Brand_Settings_Repository() )->get_for_current_site();
		include VPOS_DIR . 'modules/tenant/views/brand-settings.php';
	}

	public function render_branches() {
		$page    = max( 1, (int) ( $_GET['paged'] ?? 1 ) );
		$filters = array();
		if ( ! empty( $_GET['include_archived'] ) ) {
			$filters['include_archived'] = true;
		}
		$result = ( new VPOS_Branch_Repository() )->paginate_active( $page, 20, $filters );
		include VPOS_DIR . 'modules/tenant/views/branches.php';
	}

	public function render_branch_edit() {
		$id     = (int) ( $_GET['id'] ?? 0 );
		$branch = $id ? ( new VPOS_Branch_Repository() )->find( $id ) : null;
		include VPOS_DIR . 'modules/tenant/views/branch-edit.php';
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

	public function handle_create_organization() {
		$this->guard( 'vpos_create_organization', 'organization:create' );
		$result = ( new VPOS_Organization_Repository() )->create( wp_unslash( $_POST ) );
		if ( is_wp_error( $result ) ) {
			$this->redirect_with_notice( 'vpos-organizations', array(), $result->get_error_message() );
		}
		$this->redirect_with_notice( 'vpos-organization-edit', array( 'id' => $result ) );
	}

	public function handle_update_organization() {
		$this->guard( 'vpos_update_organization', 'organization:update' );
		$id     = (int) $_POST['id'];
		$result = ( new VPOS_Organization_Repository() )->update_org( $id, wp_unslash( $_POST ) );
		$error  = is_wp_error( $result ) ? $result->get_error_message() : null;
		$this->redirect_with_notice( 'vpos-organization-edit', array( 'id' => $id ), $error );
	}

	public function handle_create_brand() {
		$this->guard( 'vpos_create_brand', 'brand:create' );
		$organization_id = (int) $_POST['organization_id'];
		$result           = ( new VPOS_Brand_Repository() )->create_brand( $organization_id, wp_unslash( $_POST ) );
		if ( is_wp_error( $result ) ) {
			$this->redirect_with_notice( 'vpos-brands', array(), $result->get_error_message() );
		}
		$this->redirect_with_notice( 'vpos-brand-edit', array( 'id' => $result ) );
	}

	public function handle_update_brand() {
		$this->guard( 'vpos_update_brand', 'brand:update' );
		$id     = (int) $_POST['id'];
		$result = ( new VPOS_Brand_Repository() )->update_brand( $id, wp_unslash( $_POST ) );
		$error  = is_wp_error( $result ) ? $result->get_error_message() : null;
		$this->redirect_with_notice( 'vpos-brand-edit', array( 'id' => $id ), $error );
	}

	public function handle_update_brand_settings() {
		$this->guard( 'vpos_update_brand_settings', 'brand:settings:update' );
		$data = wp_unslash( $_POST );
		foreach ( array( 'wallet_enabled', 'loyalty_enabled', 'rewards_enabled', 'campaigns_enabled', 'customer_club_enabled' ) as $flag ) {
			$data[ $flag ] = isset( $data[ $flag ] ) ? 1 : 0;
		}
		$result = ( new VPOS_Brand_Settings_Repository() )->update_settings( $data );
		$error  = is_wp_error( $result ) ? $result->get_error_message() : null;
		$this->redirect_with_notice( 'vpos-brand-settings', array(), $error );
	}

	public function handle_create_branch() {
		$this->guard( 'vpos_create_branch', 'branch:create' );
		$brand = ( new VPOS_Brand_Repository() )->current_brand();
		if ( ! $brand || ! VPOS_Brand_Repository::is_operational( $brand ) ) {
			$this->redirect_with_notice( 'vpos-branches', array(), __( 'Brand is not active; operational actions are blocked.', 'vpos' ) );
		}
		$result = ( new VPOS_Branch_Repository() )->create_branch( wp_unslash( $_POST ) );
		if ( is_wp_error( $result ) ) {
			$this->redirect_with_notice( 'vpos-branches', array(), $result->get_error_message() );
		}
		$this->redirect_with_notice( 'vpos-branch-edit', array( 'id' => $result ) );
	}

	public function handle_update_branch() {
		$this->guard( 'vpos_update_branch', 'branch:update' );
		$id     = (int) $_POST['id'];
		$result = ( new VPOS_Branch_Repository() )->update_branch( $id, wp_unslash( $_POST ) );
		$error  = is_wp_error( $result ) ? $result->get_error_message() : null;
		$this->redirect_with_notice( 'vpos-branch-edit', array( 'id' => $id ), $error );
	}

	public function handle_archive_branch() {
		$this->guard( 'vpos_archive_branch', 'branch:update' );
		( new VPOS_Branch_Repository() )->archive( (int) $_POST['id'] );
		$this->redirect_with_notice( 'vpos-branches', array() );
	}
}
