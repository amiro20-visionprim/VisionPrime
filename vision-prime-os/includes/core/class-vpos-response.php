<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Standardizes every REST response/error shape across the whole plugin
 * (see Master Spec §9) so controllers never hand-roll JSON envelopes.
 */
class VPOS_Response {

	const ERROR_VALIDATION   = 'VALIDATION_ERROR';
	const ERROR_UNAUTHORIZED = 'UNAUTHORIZED';
	const ERROR_FORBIDDEN    = 'FORBIDDEN';
	const ERROR_NOT_FOUND    = 'NOT_FOUND';
	const ERROR_CONFLICT     = 'CONFLICT';
	const ERROR_BUSINESS     = 'BUSINESS_RULE_VIOLATION';
	const ERROR_RATE_LIMITED = 'RATE_LIMITED';
	const ERROR_INTERNAL     = 'INTERNAL_SERVER_ERROR';

	private static $status_map = array(
		self::ERROR_VALIDATION   => 400,
		self::ERROR_UNAUTHORIZED => 401,
		self::ERROR_FORBIDDEN    => 403,
		self::ERROR_NOT_FOUND    => 404,
		self::ERROR_CONFLICT     => 409,
		self::ERROR_BUSINESS     => 422,
		self::ERROR_RATE_LIMITED => 429,
		self::ERROR_INTERNAL     => 500,
	);

	private static function meta() {
		return array(
			'request_id' => wp_generate_uuid4(),
			'timestamp'  => gmdate( 'Y-m-d\TH:i:s.v\Z' ),
		);
	}

	public static function ok( $data ) {
		return new WP_REST_Response( array( 'data' => $data, 'meta' => self::meta() ), 200 );
	}

	public static function created( $data ) {
		return new WP_REST_Response( array( 'data' => $data, 'meta' => self::meta() ), 201 );
	}

	public static function list( array $items, $page, $limit, $total ) {
		return new WP_REST_Response(
			array(
				'data'       => $items,
				'pagination' => array(
					'page'        => (int) $page,
					'limit'       => (int) $limit,
					'total'       => (int) $total,
					'total_pages' => $limit > 0 ? (int) ceil( $total / $limit ) : 0,
				),
				'meta'       => self::meta(),
			),
			200
		);
	}

	public static function error( $code, $message, array $details = array() ) {
		$status = isset( self::$status_map[ $code ] ) ? self::$status_map[ $code ] : 500;
		return new WP_REST_Response(
			array(
				'error' => array(
					'code'    => $code,
					'message' => $message,
					'details' => $details,
				),
				'meta'  => self::meta(),
			),
			$status
		);
	}

	public static function wp_error_to_response( WP_Error $error ) {
		$code = $error->get_error_code();
		if ( ! isset( self::$status_map[ $code ] ) ) {
			$code = self::ERROR_INTERNAL;
		}
		return self::error( $code, $error->get_error_message(), (array) $error->get_error_data() );
	}
}
