<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Customer Club authentication (Master Spec §18). Club members are
 * Customer Data Platform records, not WP users, so we can't use
 * wp_set_auth_cookie() — a small signed cookie (customer_id + expiry +
 * HMAC via wp_hash) stands in for a session. OTP delivery itself is left
 * to the Integration Hub (Phase 7, SMS gateway); here we only generate
 * and verify the code via a short-lived transient and fire a hook any
 * SMS integration can listen to.
 */
class VPOS_Club_Session {

	const COOKIE = 'vpos_club_session';
	const TTL    = 30 * DAY_IN_SECONDS;

	public static function request_otp( $mobile ) {
		$mobile = sanitize_text_field( $mobile );
		if ( ! $mobile ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'Mobile number is required.' );
		}
		$code = (string) wp_rand( 100000, 999999 );
		set_transient( 'vpos_club_otp_' . $mobile, $code, 5 * MINUTE_IN_SECONDS );
		/** SMS integrations (Phase 7) hook in here to actually deliver $code. */
		do_action( 'vpos_club_otp_generated', $mobile, $code );
		return true;
	}

	/** Verifies the OTP and logs the member in, auto-creating a Customer record on first login (source = customer_club). */
	public static function verify_otp( $mobile, $code ) {
		$mobile = sanitize_text_field( $mobile );
		$stored = get_transient( 'vpos_club_otp_' . $mobile );
		if ( ! $stored || ! hash_equals( $stored, (string) $code ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'Invalid or expired code.' );
		}
		delete_transient( 'vpos_club_otp_' . $mobile );

		$customers = new VPOS_Customer_Repository();
		$customer  = $customers->find_by_mobile( $mobile );
		if ( ! $customer ) {
			$id       = $customers->create_customer( array( 'primary_mobile' => $mobile, 'source' => 'customer_club' ) );
			$customer = $customers->find( $id );
		}
		self::set_cookie( $customer['id'] );
		return $customer;
	}

	private static function set_cookie( $customer_id ) {
		$expires = time() + self::TTL;
		$value   = $customer_id . '|' . $expires;
		$value  .= '|' . wp_hash( $value );
		setcookie( self::COOKIE, $value, $expires, COOKIEPATH, COOKIE_DOMAIN, is_ssl(), true );
	}

	public static function current_customer() {
		if ( empty( $_COOKIE[ self::COOKIE ] ) ) {
			return null;
		}
		$parts = explode( '|', wp_unslash( $_COOKIE[ self::COOKIE ] ) );
		if ( count( $parts ) !== 3 ) {
			return null;
		}
		list( $customer_id, $expires, $signature ) = $parts;
		if ( $expires < time() || ! hash_equals( wp_hash( $customer_id . '|' . $expires ), $signature ) ) {
			return null;
		}
		return ( new VPOS_Customer_Repository() )->find( (int) $customer_id );
	}

	public static function logout() {
		setcookie( self::COOKIE, '', time() - HOUR_IN_SECONDS, COOKIEPATH, COOKIE_DOMAIN, is_ssl(), true );
	}
}
