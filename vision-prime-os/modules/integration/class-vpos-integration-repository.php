<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Integration Hub (Master Spec §27): the actual delivery layer behind
 * vpos_notification_dispatch (Phase 5) and vpos_club_otp_generated
 * (Phase 4) — both of those hooks fire intent only, this is what finally
 * consumes them. Providers are pluggable per channel via
 * apply_filters('vpos_integration_provider_{channel}', null) returning a
 * callable( $payload ): bool|WP_Error; with no provider registered (dev/
 * test default) delivery falls back to a log-only no-op so the rest of
 * the plugin works without any gateway configured.
 */
class VPOS_Integration_Repository extends VPOS_Repository {

	protected $table          = 'vpos_integration_logs';
	protected $soft_deletable = false;

	const CHANNELS = array( 'sms', 'email', 'push', 'in_app' );

	public static function schema() {
		VPOS_Migrator::register(
			'vpos_integration_logs',
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			channel VARCHAR(16) NOT NULL,
			provider VARCHAR(64) NOT NULL DEFAULT 'log',
			recipient VARCHAR(190) NULL,
			payload LONGTEXT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'sent',
			response TEXT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			KEY channel (channel),
			KEY status (status)"
		);
	}

	/** Delivers via the registered provider for $channel, logging the attempt either way. */
	public function deliver( $channel, $recipient, array $payload ) {
		if ( ! in_array( $channel, self::CHANNELS, true ) ) {
			$channel = 'in_app';
		}
		$provider = apply_filters( "vpos_integration_provider_{$channel}", null );

		if ( is_callable( $provider ) ) {
			$result   = $provider( $payload );
			$status   = is_wp_error( $result ) ? 'failed' : 'sent';
			$response = is_wp_error( $result ) ? $result->get_error_message() : 'delivered';
			$name     = 'custom';
		} else {
			$status   = 'logged';
			$response = 'No provider registered; logged only.';
			$name     = 'log';
		}

		$this->insert(
			array(
				'channel'   => $channel,
				'provider'  => $name,
				'recipient' => $recipient,
				'payload'   => wp_json_encode( $payload ),
				'status'    => $status,
				'response'  => $response,
			)
		);

		return 'failed' === $status ? new WP_Error( VPOS_Response::ERROR_BUSINESS, $response ) : true;
	}
}

VPOS_Integration_Repository::schema();
