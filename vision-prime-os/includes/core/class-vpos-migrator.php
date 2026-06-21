<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Declarative schema registry. Modules describe tables once; the migrator
 * runs dbDelta for "site" tables on every brand site, and "network" tables
 * once on the main site (Organization-level data per Master Spec §11).
 */
class VPOS_Migrator {

	/** @var array<string,array> table_name => ['scope' => site|network, 'sql' => columns/keys] */
	private static $schemas = array();

	public static function register( $table, $scope, $definition ) {
		self::$schemas[ $table ] = array( 'scope' => $scope, 'definition' => $definition );
	}

	public static function run_for_current_site() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$charset_collate = $wpdb->get_charset_collate();

		foreach ( self::$schemas as $table => $schema ) {
			$is_network_table = 'network' === $schema['scope'];
			if ( $is_network_table && ! is_main_site() ) {
				continue;
			}
			$prefix     = $is_network_table ? $wpdb->base_prefix : $wpdb->prefix;
			$table_name = $prefix . $table;
			$sql        = "CREATE TABLE {$table_name} (\n{$schema['definition']}\n) {$charset_collate};";
			dbDelta( $sql );
		}
	}

	public static function table( $table, $is_network_table = false ) {
		global $wpdb;
		$prefix = $is_network_table ? $wpdb->base_prefix : $wpdb->prefix;
		return $prefix . $table;
	}
}
