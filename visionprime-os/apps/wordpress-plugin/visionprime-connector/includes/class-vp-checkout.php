<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * WooCommerce checkout wallet/reward reservation integration (Phase 09).
 *
 * Reservation model: applying wallet credit at checkout NEVER debits the
 * wallet directly — it only creates a reservation on the VisionPrime
 * backend (see /docs/phase-09-checkout-wallet-reward-reservations.md).
 * The ledger debit only happens when the order's payment completes
 * (confirm); a failed/cancelled order releases the reservation instead.
 * Reward checkout is base-structure only — every reward AJAX action
 * reports "not available yet" until a reward catalog ships.
 *
 * The cart_key used to look up a reservation across validate → reserve →
 * release → confirm is the WooCommerce session's customer/cart id, which
 * stays stable for one shopper's checkout attempt; it is stashed as
 * order meta on order creation so the confirm/release hooks (which run
 * after the customer's PHP session may have moved on) can still find it.
 */
class VP_Checkout {

	const SESSION_RESERVATION_KEY = 'vp_wallet_reservation';
	const ORDER_META_CART_KEY     = '_vp_wallet_cart_key';
	const ORDER_META_RESERVATION  = '_vp_wallet_reservation_id';

	/** @var VP_Settings */
	private $settings;

	/** @var VP_Auth */
	private $auth;

	/** @var VP_Api_Client */
	private $api_client;

	/** @var VP_Logger */
	private $logger;

	public function __construct( VP_Settings $settings, VP_Auth $auth, VP_Api_Client $api_client, VP_Logger $logger ) {
		$this->settings   = $settings;
		$this->auth       = $auth;
		$this->api_client = $api_client;
		$this->logger     = $logger;
	}

	public function register(): void {
		// Customer-facing checkout AJAX — exact action names from spec.
		add_action( 'wp_ajax_vp_apply_wallet_credit', array( $this, 'handle_apply_wallet_credit' ) );
		add_action( 'wp_ajax_vp_remove_wallet_credit', array( $this, 'handle_remove_wallet_credit' ) );
		add_action( 'wp_ajax_vp_apply_reward_to_cart', array( $this, 'handle_apply_reward_to_cart' ) );
		add_action( 'wp_ajax_vp_remove_reward_from_cart', array( $this, 'handle_remove_reward_from_cart' ) );
		add_action( 'wp_ajax_vp_validate_checkout_reward', array( $this, 'handle_validate_checkout_reward' ) );

		if ( ! $this->settings->is_checkout_wallet_enabled() ) {
			return;
		}

		// Renders the wallet widget into the checkout page (AJAX-driven,
		// see assets/js/visionprime-public.js — no full page reload).
		add_action( 'woocommerce_review_order_before_payment', array( $this, 'render_wallet_widget' ) );

		// Applies/removes the wallet fee on every cart/totals recalculation,
		// including WooCommerce's own update_order_review AJAX endpoint —
		// this is what lets totals refresh without a page reload.
		add_action( 'woocommerce_cart_calculate_fees', array( $this, 'apply_wallet_fee' ) );

		// Stamps the reservation's cart_key onto the order so it survives
		// past the checkout AJAX request into the payment/order lifecycle.
		add_action( 'woocommerce_checkout_create_order', array( $this, 'stamp_order_with_reservation' ), 10, 2 );

		// Payment success -> confirm (ledger debit). Failure/cancellation
		// -> release (no debit). Refund -> reversal credit.
		add_action( 'woocommerce_payment_complete', array( $this, 'confirm_reservation_for_order' ) );
		add_action( 'woocommerce_order_status_cancelled', array( $this, 'release_reservation_for_order' ) );
		add_action( 'woocommerce_order_status_failed', array( $this, 'release_reservation_for_order' ) );
	}

	/* ---------------------------------------------------------------- */
	/* Cart key                                                          */
	/* ---------------------------------------------------------------- */

	/** Stable per-shopper-session identifier used as the reservation's cart_key. */
	private function get_cart_key(): string {
		if ( function_exists( 'WC' ) && WC()->session ) {
			return 'wc-session-' . WC()->session->get_customer_id();
		}
		return 'wc-user-' . get_current_user_id();
	}

	/* ---------------------------------------------------------------- */
	/* Wallet AJAX                                                       */
	/* ---------------------------------------------------------------- */

	public function handle_apply_wallet_credit(): void {
		$this->auth->require_customer_ajax();

		if ( ! $this->settings->is_checkout_wallet_enabled() ) {
			wp_send_json_error( array( 'message' => __( 'Wallet checkout is not enabled.', 'visionprime-connector' ) ) );
		}

		$amount = isset( $_REQUEST['amount'] ) ? (float) wp_unslash( $_REQUEST['amount'] ) : 0.0;
		if ( $amount <= 0 ) {
			wp_send_json_error( array( 'message' => __( 'Enter an amount greater than zero.', 'visionprime-connector' ) ) );
		}

		$cart_key = $this->get_cart_key();

		// Never trust the frontend amount as final — validate against the
		// backend-computed available balance first.
		$validation = $this->api_client->post( '/checkout/wallet/validate', array( 'cartKey' => $cart_key, 'amount' => $amount ) );
		if ( ! $validation['ok'] ) {
			wp_send_json_error( array( 'message' => $validation['message'] ?? __( 'Could not validate your wallet amount.', 'visionprime-connector' ) ) );
		}
		if ( empty( $validation['body']['valid'] ) ) {
			wp_send_json_error( array( 'message' => $validation['body']['message'] ?? __( 'That amount is not available.', 'visionprime-connector' ) ) );
		}

		$reservation = $this->api_client->post( '/checkout/wallet/reserve', array( 'cartKey' => $cart_key, 'amount' => $amount ) );
		if ( ! $reservation['ok'] ) {
			wp_send_json_error( array( 'message' => $reservation['message'] ?? __( 'Could not reserve your wallet credit.', 'visionprime-connector' ) ) );
		}

		WC()->session->set( self::SESSION_RESERVATION_KEY, $reservation['body'] );

		wp_send_json_success(
			array(
				'reservation'          => $reservation['body'],
				'availableBalanceCents' => $validation['body']['availableBalanceCents'] ?? null,
			)
		);
	}

	public function handle_remove_wallet_credit(): void {
		$this->auth->require_customer_ajax();

		$cart_key = $this->get_cart_key();
		$result   = $this->api_client->post( '/checkout/wallet/release', array( 'cartKey' => $cart_key ) );
		if ( ! $result['ok'] ) {
			wp_send_json_error( array( 'message' => $result['message'] ?? __( 'Could not remove your wallet credit.', 'visionprime-connector' ) ) );
		}

		WC()->session->__unset( self::SESSION_RESERVATION_KEY );

		wp_send_json_success( $result['body'] );
	}

	/** Adds the active reservation as a negative cart fee — the only place
	 * a wallet reservation affects the displayed total. Never touches the
	 * wallet ledger; that only happens on order payment completion. */
	public function apply_wallet_fee( $cart ): void {
		if ( is_admin() && ! defined( 'DOING_AJAX' ) ) {
			return;
		}
		if ( ! function_exists( 'WC' ) || ! WC()->session ) {
			return;
		}

		$reservation = WC()->session->get( self::SESSION_RESERVATION_KEY );
		if ( empty( $reservation ) || empty( $reservation['amountCents'] ) || 'active' !== ( $reservation['status'] ?? '' ) ) {
			return;
		}

		$amount = ( (int) $reservation['amountCents'] ) / 100;
		if ( $amount <= 0 ) {
			return;
		}

		$cart->add_fee( __( 'Wallet Credit Applied', 'visionprime-connector' ), -1 * $amount, false );
	}

	/** @param WC_Order $order */
	public function stamp_order_with_reservation( $order, $data ): void {
		if ( ! function_exists( 'WC' ) || ! WC()->session ) {
			return;
		}

		$reservation = WC()->session->get( self::SESSION_RESERVATION_KEY );
		if ( empty( $reservation ) ) {
			return;
		}

		$order->update_meta_data( self::ORDER_META_CART_KEY, $this->get_cart_key() );
		$order->update_meta_data( self::ORDER_META_RESERVATION, $reservation['id'] ?? '' );
	}

	public function confirm_reservation_for_order( $order_id ): void {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}
		$cart_key = $order->get_meta( self::ORDER_META_CART_KEY );
		if ( ! $cart_key ) {
			return;
		}

		$result = $this->api_client->post(
			'/checkout/wallet/confirm',
			array( 'cartKey' => $cart_key, 'woocommerceOrderId' => (string) $order_id )
		);

		if ( ! $result['ok'] ) {
			// Confirm failing must not block order completion — flag for
			// manual reconciliation via the order notes instead.
			$this->logger->error( 'Wallet reservation confirm failed', array( 'orderId' => $order_id, 'message' => $result['message'] ?? null ) );
			$order->add_order_note( __( 'VisionPrime wallet credit could not be confirmed automatically. Please check manually.', 'visionprime-connector' ) );
			return;
		}

		if ( function_exists( 'WC' ) && WC()->session ) {
			WC()->session->__unset( self::SESSION_RESERVATION_KEY );
		}
	}

	public function release_reservation_for_order( $order_id ): void {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}
		$cart_key = $order->get_meta( self::ORDER_META_CART_KEY );
		if ( ! $cart_key ) {
			return;
		}

		$this->api_client->post( '/checkout/wallet/release', array( 'cartKey' => $cart_key ) );

		if ( function_exists( 'WC' ) && WC()->session ) {
			WC()->session->__unset( self::SESSION_RESERVATION_KEY );
		}
	}

	public function render_wallet_widget(): void {
		if ( ! is_user_logged_in() ) {
			return;
		}

		printf(
			'<div class="vp-checkout-wallet" data-vp-nonce="%s"><p class="vp-loading">%s</p></div>',
			esc_attr( $this->auth->customer_nonce() ),
			esc_html__( 'Loading your wallet…', 'visionprime-connector' )
		);
	}

	/* ---------------------------------------------------------------- */
	/* Reward AJAX — base structure only, see checkout.service.ts        */
	/* ---------------------------------------------------------------- */

	public function handle_apply_reward_to_cart(): void {
		$this->auth->require_customer_ajax();
		wp_send_json_error( array( 'message' => __( 'Rewards are not available yet.', 'visionprime-connector' ) ) );
	}

	public function handle_remove_reward_from_cart(): void {
		$this->auth->require_customer_ajax();
		$cart_key = $this->get_cart_key();
		$result   = $this->api_client->post( '/checkout/reward/release', array( 'cartKey' => $cart_key ) );
		if ( ! $result['ok'] ) {
			wp_send_json_error( array( 'message' => $result['message'] ?? __( 'Could not remove the reward.', 'visionprime-connector' ) ) );
		}
		wp_send_json_success( $result['body'] );
	}

	public function handle_validate_checkout_reward(): void {
		$this->auth->require_customer_ajax();
		$cart_key = $this->get_cart_key();
		$result   = $this->api_client->post( '/checkout/reward/validate', array( 'cartKey' => $cart_key ) );
		if ( ! $result['ok'] ) {
			wp_send_json_error( array( 'message' => $result['message'] ?? __( 'Could not validate the reward.', 'visionprime-connector' ) ) );
		}
		wp_send_json_success( $result['body'] );
	}
}
