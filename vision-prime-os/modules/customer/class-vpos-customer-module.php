<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Wires the Customer/Order module's REST API and wp-admin UI. Same
 * pattern as VPOS_Tenant_Module: admin UI posts go straight to
 * repositories, REST is for external/API-key use.
 */
class VPOS_Customer_Module {

	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_rest' ) );
		add_action( 'vpos_admin_menu', array( $this, 'register_admin_menu' ) );
		add_action( 'admin_post_vpos_create_customer', array( $this, 'handle_create_customer' ) );
		add_action( 'admin_post_vpos_update_customer', array( $this, 'handle_update_customer' ) );
		add_action( 'admin_post_vpos_add_customer_note', array( $this, 'handle_add_note' ) );
		add_action( 'admin_post_vpos_add_customer_tag', array( $this, 'handle_add_tag' ) );
		add_action( 'admin_post_vpos_create_order', array( $this, 'handle_create_order' ) );
		add_action( 'admin_post_vpos_complete_order', array( $this, 'handle_complete_order' ) );
		add_action( 'admin_post_vpos_cancel_order', array( $this, 'handle_cancel_order' ) );
	}

	public function register_rest() {
		( new VPOS_Customer_REST() )->register_routes();
	}

	public function register_admin_menu( $parent ) {
		$cap = 'read';
		add_submenu_page( $parent, __( 'Customers', 'vpos' ), __( 'Customers', 'vpos' ), $cap, 'vpos-customers', array( $this, 'render_customers' ) );
		add_submenu_page( $parent, __( 'Customer 360', 'vpos' ), __( 'Customer 360', 'vpos' ), $cap, 'vpos-customer-edit', array( $this, 'render_customer_edit' ) );
		add_submenu_page( $parent, __( 'Orders', 'vpos' ), __( 'Orders', 'vpos' ), $cap, 'vpos-orders', array( $this, 'render_orders' ) );
		add_submenu_page( $parent, __( 'Order', 'vpos' ), __( 'Order', 'vpos' ), $cap, 'vpos-order-edit', array( $this, 'render_order_edit' ) );
	}

	/* ---------------- views ---------------- */

	public function render_customers() {
		$page   = max( 1, (int) ( $_GET['paged'] ?? 1 ) );
		$where  = array();
		if ( ! empty( $_GET['status'] ) ) {
			$where['status'] = sanitize_key( $_GET['status'] );
		}
		$result = ( new VPOS_Customer_Repository() )->paginate( $where, $page, 20 );
		include VPOS_DIR . 'modules/customer/views/customers.php';
	}

	public function render_customer_edit() {
		$id        = (int) ( $_GET['id'] ?? 0 );
		$customers = new VPOS_Customer_Repository();
		$customer  = $id ? $customers->find( $id ) : null;
		$notes     = $id ? $customers->get_notes( $id ) : array();
		$tags      = $id ? $customers->get_tags( $id ) : array();
		$events    = $id ? $customers->get_events( $id, 20 ) : array();
		$orders    = $id ? ( new VPOS_Order_Repository() )->paginate( array( 'customer_id' => $id ), 1, 20 )['items'] : array();
		include VPOS_DIR . 'modules/customer/views/customer-edit.php';
	}

	public function render_orders() {
		$page   = max( 1, (int) ( $_GET['paged'] ?? 1 ) );
		$where  = array();
		if ( ! empty( $_GET['status'] ) ) {
			$where['status'] = sanitize_key( $_GET['status'] );
		}
		$result = ( new VPOS_Order_Repository() )->paginate( $where, $page, 20 );
		include VPOS_DIR . 'modules/customer/views/orders.php';
	}

	public function render_order_edit() {
		$id    = (int) ( $_GET['id'] ?? 0 );
		$repo  = new VPOS_Order_Repository();
		$order = $id ? $repo->find( $id ) : null;
		$items = $id ? $repo->get_items( $id ) : array();
		include VPOS_DIR . 'modules/customer/views/order-edit.php';
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

	public function handle_create_customer() {
		$this->guard( 'vpos_create_customer', 'customer:create' );
		$result = ( new VPOS_Customer_Repository() )->create_customer( wp_unslash( $_POST ) );
		if ( is_wp_error( $result ) ) {
			$this->redirect_with_notice( 'vpos-customers', array(), $result->get_error_message() );
		}
		$this->redirect_with_notice( 'vpos-customer-edit', array( 'id' => $result ) );
	}

	public function handle_update_customer() {
		$this->guard( 'vpos_update_customer', 'customer:update' );
		$id     = (int) $_POST['id'];
		$result = ( new VPOS_Customer_Repository() )->update_customer( $id, wp_unslash( $_POST ) );
		$error  = is_wp_error( $result ) ? $result->get_error_message() : null;
		$this->redirect_with_notice( 'vpos-customer-edit', array( 'id' => $id ), $error );
	}

	public function handle_add_note() {
		$this->guard( 'vpos_add_customer_note', 'customer:update' );
		$id = (int) $_POST['customer_id'];
		( new VPOS_Customer_Repository() )->add_note( $id, wp_unslash( $_POST['note'] ?? '' ) );
		$this->redirect_with_notice( 'vpos-customer-edit', array( 'id' => $id ) );
	}

	public function handle_add_tag() {
		$this->guard( 'vpos_add_customer_tag', 'customer:update' );
		$id = (int) $_POST['customer_id'];
		( new VPOS_Customer_Repository() )->add_tag( $id, wp_unslash( $_POST['tag'] ?? '' ) );
		$this->redirect_with_notice( 'vpos-customer-edit', array( 'id' => $id ) );
	}

	public function handle_create_order() {
		$this->guard( 'vpos_create_order', 'order:create' );
		$data = wp_unslash( $_POST );
		$items = array();
		if ( ! empty( $data['product_name'] ) ) {
			$items[] = array(
				'product_name' => $data['product_name'],
				'quantity'     => $data['quantity'] ?? 1,
				'unit_price'   => $data['unit_price'] ?? 0,
			);
		}
		$result = ( new VPOS_Order_Repository() )->create_order( $data, $items );
		if ( is_wp_error( $result ) ) {
			$this->redirect_with_notice( 'vpos-orders', array(), $result->get_error_message() );
		}
		$this->redirect_with_notice( 'vpos-order-edit', array( 'id' => $result ) );
	}

	public function handle_complete_order() {
		$this->guard( 'vpos_complete_order', 'order:update' );
		$id     = (int) $_POST['id'];
		$result = ( new VPOS_Order_Repository() )->complete( $id );
		$error  = is_wp_error( $result ) ? $result->get_error_message() : null;
		$this->redirect_with_notice( 'vpos-order-edit', array( 'id' => $id ), $error );
	}

	public function handle_cancel_order() {
		$this->guard( 'vpos_cancel_order', 'order:update' );
		$id     = (int) $_POST['id'];
		$result = ( new VPOS_Order_Repository() )->cancel( $id );
		$error  = is_wp_error( $result ) ? $result->get_error_message() : null;
		$this->redirect_with_notice( 'vpos-order-edit', array( 'id' => $id ), $error );
	}
}
