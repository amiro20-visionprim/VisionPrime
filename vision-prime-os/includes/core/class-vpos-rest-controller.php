<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Base for every REST controller: namespace, permission gate, validation
 * helper, and standard envelopes — so each module's controller is just
 * route registration + a handler body (Master Spec §9, §10).
 */
abstract class VPOS_REST_Controller {

	const NAMESPACE_ = 'visionprime/v1';

	abstract public function register_routes();

	/** Wrap a permission string into a REST permission_callback. */
	protected function require_permission( $permission ) {
		return function () use ( $permission ) {
			if ( ! is_user_logged_in() ) {
				return VPOS_Response::error( VPOS_Response::ERROR_UNAUTHORIZED, 'Authentication required.' );
			}
			if ( ! VPOS_Context::can( $permission ) ) {
				return VPOS_Response::error( VPOS_Response::ERROR_FORBIDDEN, 'You do not have permission to perform this action.' );
			}
			return true;
		};
	}

	/** Validates $data against a simple required/type schema, returns WP_Error|true. */
	protected function validate( array $data, array $schema ) {
		foreach ( $schema as $field => $rules ) {
			$required = ! empty( $rules['required'] );
			$value    = isset( $data[ $field ] ) ? $data[ $field ] : null;

			if ( $required && ( null === $value || '' === $value ) ) {
				return new WP_Error(
					VPOS_Response::ERROR_VALIDATION,
					sprintf( '%s is required.', $field ),
					array( 'field' => $field )
				);
			}
			if ( null !== $value && isset( $rules['type'] ) && ! $this->type_matches( $value, $rules['type'] ) ) {
				return new WP_Error(
					VPOS_Response::ERROR_VALIDATION,
					sprintf( '%s must be of type %s.', $field, $rules['type'] ),
					array( 'field' => $field )
				);
			}
			if ( null !== $value && '' !== $value && isset( $rules['enum'] ) && ! in_array( $value, $rules['enum'], true ) ) {
				return new WP_Error(
					VPOS_Response::ERROR_VALIDATION,
					sprintf( '%s must be one of: %s.', $field, implode( ', ', $rules['enum'] ) ),
					array( 'field' => $field )
				);
			}
		}
		return true;
	}

	private function type_matches( $value, $type ) {
		switch ( $type ) {
			case 'string':
				return is_string( $value );
			case 'int':
				return is_numeric( $value );
			case 'bool':
				return is_bool( $value ) || in_array( $value, array( '0', '1', 0, 1, true, false ), true );
			case 'array':
				return is_array( $value );
			default:
				return true;
		}
	}

	protected function pagination_params( WP_REST_Request $request ) {
		return array(
			'page'  => (int) $request->get_param( 'page' ) ?: 1,
			'limit' => (int) $request->get_param( 'limit' ) ?: 20,
		);
	}
}
