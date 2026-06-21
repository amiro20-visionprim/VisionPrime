<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Master Spec §8 request context, mapped onto Multisite: the current site
 * IS the brand (no brand_id leakage is possible across a DB switch), so
 * context only needs to resolve branch scope + permissions within it.
 */
class VPOS_Context {

	private static $cache = null;

	public static function resolve() {
		if ( null !== self::$cache ) {
			return self::$cache;
		}

		$user           = wp_get_current_user();
		$is_super_admin = is_multisite() ? is_super_admin( $user->ID ) : user_can( $user, 'manage_options' );

		self::$cache = array(
			'user_id'         => $user->ID ? (string) $user->ID : null,
			'is_super_admin'  => (bool) $is_super_admin,
			'brand_id'        => (string) get_current_blog_id(),
			'branch_ids'      => VPOS_RBAC::instance()->get_user_branch_ids( $user->ID ),
			'permissions'     => VPOS_RBAC::instance()->get_user_permissions( $user->ID ),
			'ip_address'      => self::client_ip(),
			'user_agent'      => isset( $_SERVER['HTTP_USER_AGENT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ) : '',
		);

		return self::$cache;
	}

	public static function reset() {
		self::$cache = null;
	}

	public static function can( $permission ) {
		$ctx = self::resolve();
		return $ctx['is_super_admin'] || in_array( $permission, $ctx['permissions'], true );
	}

	public static function can_access_branch( $branch_id ) {
		$ctx = self::resolve();
		if ( $ctx['is_super_admin'] ) {
			return true;
		}
		return empty( $ctx['branch_ids'] ) || in_array( (string) $branch_id, $ctx['branch_ids'], true );
	}

	private static function client_ip() {
		if ( ! empty( $_SERVER['REMOTE_ADDR'] ) ) {
			return sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) );
		}
		return '';
	}
}
