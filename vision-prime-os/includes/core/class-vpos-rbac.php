<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Action-based RBAC (Master Spec §10). Roles are thin permission bags;
 * real access is role permissions ∩ branch scope, never role name alone.
 * Built on WP roles/capabilities so wp-admin's own gatekeeping is reused.
 */
class VPOS_RBAC {

	const META_BRANCH_IDS = 'vpos_branch_ids';

	private static $instance;

	/** @var array<string,string[]> role => permissions */
	private $role_permissions = array(
		'vpos_super_admin'      => array( '*' ),
		'vpos_brand_owner'      => array( 'brand:update', 'brand:settings:update', 'customer:*', 'order:*', 'wallet:*', 'loyalty:*', 'reward:*', 'campaign:*', 'automation:*', 'finance:*', 'report:*', 'integration:manage', 'audit:view', 'settings:manage' ),
		'vpos_brand_admin'      => array( 'customer:*', 'order:*', 'wallet:view', 'loyalty:*', 'reward:*', 'campaign:*', 'automation:*', 'report:view', 'audit:view' ),
		'vpos_crm_manager'      => array( 'customer:*', 'segment:*', 'campaign:view', 'report:view' ),
		'vpos_marketing_manager' => array( 'campaign:*', 'segment:*', 'automation:*', 'report:view' ),
		'vpos_finance_manager'  => array( 'wallet:view', 'wallet:adjust', 'wallet:reverse', 'wallet:export', 'finance:*', 'report:view' ),
		'vpos_branch_manager'   => array( 'customer:view', 'order:view', 'order:create', 'wallet:view', 'reward:view', 'reward:redeem' ),
		'vpos_cashier'          => array( 'customer:view', 'order:create', 'wallet:view', 'wallet:credit', 'wallet:debit', 'reward:redeem' ),
		'vpos_support_agent'    => array( 'customer:view', 'customer:update', 'wallet:view', 'reward:view' ),
	);

	public static function instance() {
		if ( ! self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function register_capabilities() {
		foreach ( $this->role_permissions as $role => $permissions ) {
			if ( ! get_role( $role ) ) {
				add_role( $role, $this->label_for( $role ), array( 'read' => true ) );
			}
		}
	}

	private function label_for( $role ) {
		return ucwords( str_replace( array( 'vpos_', '_' ), array( '', ' ' ), $role ) );
	}

	/** Permission strings the user holds, expanded from their VPOS roles. */
	public function get_user_permissions( $user_id ) {
		$user = get_userdata( $user_id );
		if ( ! $user ) {
			return array();
		}
		$permissions = array();
		foreach ( $user->roles as $role ) {
			if ( isset( $this->role_permissions[ $role ] ) ) {
				$permissions = array_merge( $permissions, $this->role_permissions[ $role ] );
			}
		}
		return array_values( array_unique( $permissions ) );
	}

	public function user_has_permission( $user_id, $permission ) {
		$permissions = $this->get_user_permissions( $user_id );
		if ( in_array( '*', $permissions, true ) ) {
			return true;
		}
		if ( in_array( $permission, $permissions, true ) ) {
			return true;
		}
		list( $resource ) = explode( ':', $permission ) + array( '' );
		return in_array( $resource . ':*', $permissions, true );
	}

	/** Empty array = no branch restriction (brand-wide access). */
	public function get_user_branch_ids( $user_id ) {
		$ids = get_user_meta( $user_id, self::META_BRANCH_IDS, true );
		return is_array( $ids ) ? array_map( 'strval', $ids ) : array();
	}

	public function set_user_branch_ids( $user_id, array $branch_ids ) {
		update_user_meta( $user_id, self::META_BRANCH_IDS, array_map( 'strval', $branch_ids ) );
	}
}
