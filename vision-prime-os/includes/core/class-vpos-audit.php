<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Append-only audit trail (Master Spec §28). No update/delete is ever
 * exposed — sensitive actions write once, admin UI only reads.
 */
class VPOS_Audit {

	const TABLE = 'vpos_audit_logs';

	public static function schema() {
		VPOS_Migrator::register(
			self::TABLE,
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			actor_id BIGINT UNSIGNED NULL,
			actor_type VARCHAR(32) NOT NULL DEFAULT 'user',
			action VARCHAR(64) NOT NULL,
			entity_type VARCHAR(64) NOT NULL,
			entity_id VARCHAR(64) NULL,
			before_data LONGTEXT NULL,
			after_data LONGTEXT NULL,
			ip_address VARCHAR(64) NULL,
			user_agent VARCHAR(255) NULL,
			meta LONGTEXT NULL,
			created_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			KEY action (action),
			KEY entity (entity_type, entity_id),
			KEY created_at (created_at)"
		);
	}

	public static function log( $action, $entity_type, $entity_id = null, array $before = null, array $after = null, array $meta = array() ) {
		global $wpdb;
		$ctx = VPOS_Context::resolve();

		$wpdb->insert(
			VPOS_Migrator::table( self::TABLE ),
			array(
				'actor_id'    => $ctx['user_id'],
				'actor_type'  => $ctx['user_id'] ? 'user' : 'system',
				'action'      => $action,
				'entity_type' => $entity_type,
				'entity_id'   => $entity_id,
				'before_data' => null === $before ? null : wp_json_encode( $before ),
				'after_data'  => null === $after ? null : wp_json_encode( $after ),
				'ip_address'  => $ctx['ip_address'],
				'user_agent'  => $ctx['user_agent'],
				'meta'        => wp_json_encode( $meta ),
				'created_at'  => current_time( 'mysql', true ),
			)
		);
	}
}

VPOS_Audit::schema();
