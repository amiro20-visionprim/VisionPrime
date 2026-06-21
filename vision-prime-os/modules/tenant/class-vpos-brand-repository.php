<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Brands are network-level registry rows, each bound 1:1 to a WP Multisite
 * site (the brand's own database/tables = physical isolation, Master Spec
 * §1 "no data ever leaks between brands"). Creating a brand provisions a
 * new site and runs the per-site schema on it.
 */
class VPOS_Brand_Repository extends VPOS_Repository {

	protected $table   = 'vpos_brands';
	protected $network = true;

	const STATUSES = array( 'active', 'inactive', 'suspended', 'archived' );

	public static function schema() {
		VPOS_Migrator::register(
			'vpos_brands',
			'network',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			organization_id BIGINT UNSIGNED NOT NULL,
			blog_id BIGINT UNSIGNED NOT NULL,
			name VARCHAR(190) NOT NULL,
			slug VARCHAR(190) NOT NULL,
			legal_name VARCHAR(190) NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'active',
			logo_url VARCHAR(255) NULL,
			primary_color VARCHAR(16) NULL,
			secondary_color VARCHAR(16) NULL,
			timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Tehran',
			currency VARCHAR(8) NOT NULL DEFAULT 'IRR',
			language VARCHAR(8) NOT NULL DEFAULT 'fa',
			metadata LONGTEXT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY slug (slug),
			UNIQUE KEY blog_id (blog_id),
			KEY organization_id (organization_id),
			KEY status (status)"
		);
	}

	public function find_by_slug( $slug ) {
		global $wpdb;
		return $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$this->table_name()} WHERE slug = %s AND deleted_at IS NULL", $slug ),
			ARRAY_A
		);
	}

	public function find_by_blog_id( $blog_id ) {
		global $wpdb;
		return $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$this->table_name()} WHERE blog_id = %d AND deleted_at IS NULL", $blog_id ),
			ARRAY_A
		);
	}

	/** The brand row for the site the current request is running on. */
	public function current_brand() {
		return $this->find_by_blog_id( get_current_blog_id() );
	}

	/**
	 * Creates the brand's site (or reuses the current single site when
	 * Multisite isn't enabled and no brand exists yet), runs the schema on
	 * it, and registers the network brand row + default brand_settings.
	 */
	public function create_brand( $organization_id, array $data ) {
		if ( empty( $data['name'] ) || empty( $data['slug'] ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'name and slug are required.' );
		}
		$slug = sanitize_title( $data['slug'] );
		if ( $this->find_by_slug( $slug ) ) {
			return new WP_Error( VPOS_Response::ERROR_CONFLICT, 'Brand slug already exists.', array( 'field' => 'slug' ) );
		}

		$organizations = new VPOS_Organization_Repository();
		$organization  = $organizations->find( $organization_id );
		if ( ! $organization ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Organization not found.' );
		}

		$blog_id = $this->provision_site( $slug, $data['name'] );
		if ( is_wp_error( $blog_id ) ) {
			return $blog_id;
		}

		$row = wp_parse_args(
			$data,
			array(
				'organization_id' => $organization_id,
				'blog_id'         => $blog_id,
				'slug'            => $slug,
				'status'          => 'active',
				'timezone'        => 'Asia/Tehran',
				'currency'        => 'IRR',
				'language'        => 'fa',
				'metadata'        => '{}',
			)
		);
		if ( is_array( $row['metadata'] ) ) {
			$row['metadata'] = wp_json_encode( $row['metadata'] );
		}

		$id = $this->insert( $row );

		switch_to_blog( $blog_id );
		VPOS_Migrator::run_for_current_site();
		( new VPOS_Brand_Settings_Repository() )->create_default( $id );
		restore_current_blog();

		VPOS_Audit::log( 'brand:create', 'brand', $id, null, $row );
		return $id;
	}

	private function provision_site( $slug, $name ) {
		if ( is_multisite() ) {
			$domain = preg_replace( '#^https?://#', '', untrailingslashit( network_site_url() ) );
			$path   = '/' . $slug . '/';
			if ( domain_exists( $domain, $path, get_current_network_id() ) ) {
				return new WP_Error( VPOS_Response::ERROR_CONFLICT, 'A site already exists at this path.' );
			}
			$user_id = get_current_user_id() ?: 1;
			$blog_id = wpmu_create_blog( $domain, $path, $name, $user_id, array(), get_current_network_id() );
			if ( is_wp_error( $blog_id ) ) {
				return $blog_id;
			}
			return (int) $blog_id;
		}

		// Single-site fallback: only one brand can exist, bound to this site.
		if ( $this->has_any_brand() ) {
			return new WP_Error( VPOS_Response::ERROR_BUSINESS, 'Multiple brands require WordPress Multisite to be enabled.' );
		}
		return get_current_blog_id();
	}

	private function has_any_brand() {
		global $wpdb;
		return (bool) $wpdb->get_var( "SELECT id FROM {$this->table_name()} WHERE deleted_at IS NULL LIMIT 1" );
	}

	public function update_brand( $id, array $data ) {
		if ( isset( $data['status'] ) && ! in_array( $data['status'], self::STATUSES, true ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'Invalid status.', array( 'field' => 'status' ) );
		}
		$before = $this->find( $id );
		if ( ! $before ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Brand not found.' );
		}
		if ( isset( $data['metadata'] ) && is_array( $data['metadata'] ) ) {
			$data['metadata'] = wp_json_encode( $data['metadata'] );
		}
		unset( $data['slug'], $data['blog_id'], $data['organization_id'] );
		$this->update( $id, $data );
		VPOS_Audit::log( 'brand:update', 'brand', $id, $before, $data );
		return $this->find( $id );
	}

	/** True when this brand's status blocks day-to-day operations (Master Spec §1 rule 9). */
	public static function is_operational( array $brand ) {
		return 'active' === $brand['status'];
	}
}

VPOS_Brand_Repository::schema();
