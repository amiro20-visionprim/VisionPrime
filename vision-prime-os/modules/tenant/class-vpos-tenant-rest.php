<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * REST surface for Part 01 / Master Spec §11: Organization, Brand,
 * Branch, Brand Settings. Branch/Settings endpoints operate on the
 * brand's own site, so the controller switches blog context internally
 * and verifies non-super-admins can only ever touch their own brand.
 */
class VPOS_Tenant_REST extends VPOS_REST_Controller {

	public function register_routes() {
		register_rest_route( self::NAMESPACE_, '/admin/organizations', array(
			array( 'methods' => 'GET', 'callback' => array( $this, 'list_organizations' ), 'permission_callback' => $this->require_permission( 'organization:view' ) ),
			array( 'methods' => 'POST', 'callback' => array( $this, 'create_organization' ), 'permission_callback' => $this->require_permission( 'organization:create' ) ),
		) );
		register_rest_route( self::NAMESPACE_, '/admin/organizations/(?P<id>\d+)', array(
			array( 'methods' => 'GET', 'callback' => array( $this, 'get_organization' ), 'permission_callback' => $this->require_permission( 'organization:view' ) ),
			array( 'methods' => 'PATCH', 'callback' => array( $this, 'update_organization' ), 'permission_callback' => $this->require_permission( 'organization:update' ) ),
		) );

		register_rest_route( self::NAMESPACE_, '/admin/organizations/(?P<id>\d+)/brands', array(
			'methods' => 'POST', 'callback' => array( $this, 'create_brand' ), 'permission_callback' => $this->require_permission( 'brand:create' ),
		) );
		register_rest_route( self::NAMESPACE_, '/admin/brands', array(
			'methods' => 'GET', 'callback' => array( $this, 'list_brands' ), 'permission_callback' => $this->require_permission( 'brand:view' ),
		) );
		register_rest_route( self::NAMESPACE_, '/admin/brands/(?P<id>\d+)', array(
			array( 'methods' => 'GET', 'callback' => array( $this, 'get_brand' ), 'permission_callback' => $this->require_permission( 'brand:view' ) ),
			array( 'methods' => 'PATCH', 'callback' => array( $this, 'update_brand' ), 'permission_callback' => $this->require_permission( 'brand:update' ) ),
		) );
		register_rest_route( self::NAMESPACE_, '/admin/brands/(?P<id>\d+)/settings', array(
			'methods' => 'PATCH', 'callback' => array( $this, 'update_brand_settings' ), 'permission_callback' => $this->require_permission( 'brand:settings:update' ),
		) );

		register_rest_route( self::NAMESPACE_, '/admin/brands/(?P<id>\d+)/branches', array(
			array( 'methods' => 'GET', 'callback' => array( $this, 'list_branches' ), 'permission_callback' => $this->require_permission( 'branch:view' ) ),
			array( 'methods' => 'POST', 'callback' => array( $this, 'create_branch' ), 'permission_callback' => $this->require_permission( 'branch:create' ) ),
		) );
		register_rest_route( self::NAMESPACE_, '/admin/branches/(?P<id>\d+)', array(
			array( 'methods' => 'GET', 'callback' => array( $this, 'get_branch' ), 'permission_callback' => $this->require_permission( 'branch:view' ) ),
			array( 'methods' => 'PATCH', 'callback' => array( $this, 'update_branch' ), 'permission_callback' => $this->require_permission( 'branch:update' ) ),
			array( 'methods' => 'DELETE', 'callback' => array( $this, 'delete_branch' ), 'permission_callback' => $this->require_permission( 'branch:update' ) ),
		) );
	}

	/* ---------------- Organizations (network) ---------------- */

	public function list_organizations( WP_REST_Request $request ) {
		$repo  = new VPOS_Organization_Repository();
		$where = array();
		if ( $request->get_param( 'status' ) ) {
			$where['status'] = $request->get_param( 'status' );
		}
		$p      = $this->pagination_params( $request );
		$result = $repo->paginate( $where, $p['page'], $p['limit'] );
		return VPOS_Response::list( $result['items'], $result['page'], $result['limit'], $result['total'] );
	}

	public function create_organization( WP_REST_Request $request ) {
		$result = ( new VPOS_Organization_Repository() )->create( $request->get_json_params() );
		if ( is_wp_error( $result ) ) {
			return VPOS_Response::wp_error_to_response( $result );
		}
		return VPOS_Response::created( ( new VPOS_Organization_Repository() )->find( $result ) );
	}

	public function get_organization( WP_REST_Request $request ) {
		$org = ( new VPOS_Organization_Repository() )->find( (int) $request['id'] );
		if ( ! $org ) {
			return VPOS_Response::error( VPOS_Response::ERROR_NOT_FOUND, 'Organization not found.' );
		}
		return VPOS_Response::ok( $org );
	}

	public function update_organization( WP_REST_Request $request ) {
		$result = ( new VPOS_Organization_Repository() )->update_org( (int) $request['id'], $request->get_json_params() );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::ok( $result );
	}

	/* ---------------- Brands (network) ---------------- */

	public function create_brand( WP_REST_Request $request ) {
		$result = ( new VPOS_Brand_Repository() )->create_brand( (int) $request['id'], $request->get_json_params() );
		if ( is_wp_error( $result ) ) {
			return VPOS_Response::wp_error_to_response( $result );
		}
		return VPOS_Response::created( ( new VPOS_Brand_Repository() )->find( $result ) );
	}

	public function list_brands( WP_REST_Request $request ) {
		$repo  = new VPOS_Brand_Repository();
		$ctx   = VPOS_Context::resolve();
		$where = array();
		if ( $request->get_param( 'organization_id' ) ) {
			$where['organization_id'] = $request->get_param( 'organization_id' );
		}
		if ( $request->get_param( 'status' ) ) {
			$where['status'] = $request->get_param( 'status' );
		}
		if ( ! $ctx['is_super_admin'] ) {
			$where['blog_id'] = $ctx['brand_id'];
		}
		$p      = $this->pagination_params( $request );
		$result = $repo->paginate( $where, $p['page'], $p['limit'] );
		return VPOS_Response::list( $result['items'], $result['page'], $result['limit'], $result['total'] );
	}

	public function get_brand( WP_REST_Request $request ) {
		$brand = ( new VPOS_Brand_Repository() )->find( (int) $request['id'] );
		$denied = $this->deny_unless_own_brand( $brand );
		if ( $denied ) {
			return $denied;
		}
		$brand['settings'] = $this->with_brand_site( $brand, function () {
			return ( new VPOS_Brand_Settings_Repository() )->get_for_current_site();
		} );
		return VPOS_Response::ok( $brand );
	}

	public function update_brand( WP_REST_Request $request ) {
		$brand  = ( new VPOS_Brand_Repository() )->find( (int) $request['id'] );
		$denied = $this->deny_unless_own_brand( $brand );
		if ( $denied ) {
			return $denied;
		}
		$result = ( new VPOS_Brand_Repository() )->update_brand( (int) $request['id'], $request->get_json_params() );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::ok( $result );
	}

	public function update_brand_settings( WP_REST_Request $request ) {
		$brand  = ( new VPOS_Brand_Repository() )->find( (int) $request['id'] );
		$denied = $this->deny_unless_own_brand( $brand );
		if ( $denied ) {
			return $denied;
		}
		$result = $this->with_brand_site( $brand, function () use ( $request ) {
			return ( new VPOS_Brand_Settings_Repository() )->update_settings( $request->get_json_params() );
		} );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::ok( $result );
	}

	/* ---------------- Branches (per-brand site) ---------------- */

	public function list_branches( WP_REST_Request $request ) {
		$brand  = ( new VPOS_Brand_Repository() )->find( (int) $request['id'] );
		$denied = $this->deny_unless_own_brand( $brand );
		if ( $denied ) {
			return $denied;
		}
		$p = $this->pagination_params( $request );
		$result = $this->with_brand_site( $brand, function () use ( $request, $p ) {
			$filters = array();
			if ( $request->get_param( 'status' ) ) {
				$filters['status'] = $request->get_param( 'status' );
			}
			if ( $request->get_param( 'type' ) ) {
				$filters['type'] = $request->get_param( 'type' );
			}
			if ( $request->get_param( 'include_archived' ) ) {
				$filters['include_archived'] = true;
			}
			return ( new VPOS_Branch_Repository() )->paginate_active( $p['page'], $p['limit'], $filters );
		} );
		return VPOS_Response::list( $result['items'], $result['page'], $result['limit'], $result['total'] );
	}

	public function create_branch( WP_REST_Request $request ) {
		$brand  = ( new VPOS_Brand_Repository() )->find( (int) $request['id'] );
		$denied = $this->deny_unless_own_brand( $brand );
		if ( $denied ) {
			return $denied;
		}
		if ( ! VPOS_Brand_Repository::is_operational( $brand ) ) {
			return VPOS_Response::error( VPOS_Response::ERROR_BUSINESS, 'Brand is not active; operational actions are blocked.' );
		}
		$result = $this->with_brand_site( $brand, function () use ( $request ) {
			return ( new VPOS_Branch_Repository() )->create_branch( $request->get_json_params() );
		} );
		if ( is_wp_error( $result ) ) {
			return VPOS_Response::wp_error_to_response( $result );
		}
		$branch = $this->with_brand_site( $brand, function () use ( $result ) {
			return ( new VPOS_Branch_Repository() )->find( $result );
		} );
		return VPOS_Response::created( $branch );
	}

	/** Branch-by-id routes don't carry a brandId, so we must locate the brand by scanning sites the caller may access. Super admins pass brand_id explicitly; brand users are limited to their own site. */
	private function resolve_branch_brand( WP_REST_Request $request ) {
		$ctx = VPOS_Context::resolve();
		if ( ! $ctx['is_super_admin'] ) {
			return ( new VPOS_Brand_Repository() )->current_brand();
		}
		$brand_id = (int) $request->get_param( 'brand_id' );
		if ( ! $brand_id ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'brand_id query param is required for super admin.' );
		}
		return ( new VPOS_Brand_Repository() )->find( $brand_id );
	}

	public function get_branch( WP_REST_Request $request ) {
		$brand = $this->resolve_branch_brand( $request );
		if ( is_wp_error( $brand ) || ! $brand ) {
			return VPOS_Response::error( VPOS_Response::ERROR_NOT_FOUND, 'Brand or branch not found.' );
		}
		$branch = $this->with_brand_site( $brand, function () use ( $request ) {
			return ( new VPOS_Branch_Repository() )->find( (int) $request['id'] );
		} );
		if ( ! $branch ) {
			return VPOS_Response::error( VPOS_Response::ERROR_NOT_FOUND, 'Branch not found.' );
		}
		return VPOS_Response::ok( $branch );
	}

	public function update_branch( WP_REST_Request $request ) {
		$brand = $this->resolve_branch_brand( $request );
		if ( is_wp_error( $brand ) || ! $brand ) {
			return VPOS_Response::error( VPOS_Response::ERROR_NOT_FOUND, 'Brand or branch not found.' );
		}
		$result = $this->with_brand_site( $brand, function () use ( $request ) {
			return ( new VPOS_Branch_Repository() )->update_branch( (int) $request['id'], $request->get_json_params() );
		} );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::ok( $result );
	}

	public function delete_branch( WP_REST_Request $request ) {
		$brand = $this->resolve_branch_brand( $request );
		if ( is_wp_error( $brand ) || ! $brand ) {
			return VPOS_Response::error( VPOS_Response::ERROR_NOT_FOUND, 'Brand or branch not found.' );
		}
		$result = $this->with_brand_site( $brand, function () use ( $request ) {
			return ( new VPOS_Branch_Repository() )->archive( (int) $request['id'] );
		} );
		return is_wp_error( $result ) ? VPOS_Response::wp_error_to_response( $result ) : VPOS_Response::ok( array( 'archived' => true ) );
	}

	/* ---------------- helpers ---------------- */

	private function deny_unless_own_brand( $brand ) {
		if ( ! $brand ) {
			return VPOS_Response::error( VPOS_Response::ERROR_NOT_FOUND, 'Brand not found.' );
		}
		$ctx = VPOS_Context::resolve();
		if ( ! $ctx['is_super_admin'] && (string) $brand['blog_id'] !== (string) $ctx['brand_id'] ) {
			return VPOS_Response::error( VPOS_Response::ERROR_FORBIDDEN, 'You cannot access another brand.' );
		}
		return null;
	}

	private function with_brand_site( $brand, callable $callback ) {
		$switched = is_multisite() && (int) $brand['blog_id'] !== get_current_blog_id();
		if ( $switched ) {
			switch_to_blog( $brand['blog_id'] );
		}
		try {
			return $callback();
		} finally {
			if ( $switched ) {
				restore_current_blog();
			}
		}
	}
}
