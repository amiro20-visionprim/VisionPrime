<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Lightweight debug logger. Writes to the PHP error log only when Debug
 * Mode is enabled, and keeps a short rolling buffer (last 50 entries) in
 * an option so the admin settings page can show recent activity without
 * needing file system access.
 *
 * Never logs the plugin API key or shared secret — only metadata
 * (action name, status code, customer/wp user id).
 */
class VP_Logger {

	const OPTION_KEY = 'visionprime_connector_log_buffer';
	const MAX_ENTRIES = 50;

	/** @var VP_Settings */
	private $settings;

	public function __construct( VP_Settings $settings ) {
		$this->settings = $settings;
	}

	public function debug( string $message, array $context = array() ): void {
		$this->write( 'debug', $message, $context );
	}

	public function info( string $message, array $context = array() ): void {
		$this->write( 'info', $message, $context );
	}

	public function error( string $message, array $context = array() ): void {
		$this->write( 'error', $message, $context );
	}

	private function write( string $level, string $message, array $context ): void {
		$entry = array(
			'level'   => $level,
			'message' => $message,
			'context' => $context,
			'time'    => current_time( 'mysql' ),
		);

		if ( $this->settings->is_debug_mode_enabled() ) {
			// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
			error_log( sprintf( '[VisionPrime Connector] [%s] %s %s', $level, $message, wp_json_encode( $context ) ) );
		}

		if ( 'error' !== $level && ! $this->settings->is_debug_mode_enabled() ) {
			// Errors are always buffered for admin visibility; non-error
			// entries are only buffered when debugging is on, to avoid
			// option bloat on a busy production store.
			return;
		}

		$buffer   = get_option( self::OPTION_KEY, array() );
		$buffer[] = $entry;
		if ( count( $buffer ) > self::MAX_ENTRIES ) {
			$buffer = array_slice( $buffer, -self::MAX_ENTRIES );
		}
		update_option( self::OPTION_KEY, $buffer, false );
	}

	/** @return array<int, array<string, mixed>> */
	public function get_recent_entries(): array {
		return get_option( self::OPTION_KEY, array() );
	}

	public function clear(): void {
		delete_option( self::OPTION_KEY );
	}
}
