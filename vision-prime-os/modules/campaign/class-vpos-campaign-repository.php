<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Campaign blasts (Master Spec §16-17): targets a saved Segment, queues
 * one VPOS_Notification per matching customer, and never sends anything
 * directly itself — delivery is the notification dispatch hook's job.
 */
class VPOS_Campaign_Repository extends VPOS_Repository {

	protected $table = 'vpos_campaigns';

	const CHANNELS = array( 'sms', 'email', 'push' );
	const STATUSES = array( 'draft', 'scheduled', 'sending', 'sent', 'cancelled' );

	public static function schema() {
		VPOS_Migrator::register(
			'vpos_campaigns',
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			name VARCHAR(190) NOT NULL,
			channel VARCHAR(16) NOT NULL DEFAULT 'sms',
			segment_id BIGINT UNSIGNED NULL,
			subject VARCHAR(190) NULL,
			message TEXT NOT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'draft',
			scheduled_at DATETIME NULL,
			sent_at DATETIME NULL,
			recipient_count INT UNSIGNED NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			deleted_at DATETIME NULL,
			PRIMARY KEY  (id),
			KEY status (status)"
		);
	}

	private function ensure_campaigns_enabled() {
		$settings = ( new VPOS_Brand_Settings_Repository() )->get_for_current_site();
		if ( $settings && ! $settings['campaigns_enabled'] ) {
			return new WP_Error( VPOS_Response::ERROR_BUSINESS, 'Campaigns are disabled for this brand.' );
		}
		return true;
	}

	public function create_campaign( array $data ) {
		if ( empty( $data['name'] ) || empty( $data['message'] ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'name and message are required.' );
		}
		if ( isset( $data['channel'] ) && ! in_array( $data['channel'], self::CHANNELS, true ) ) {
			return new WP_Error( VPOS_Response::ERROR_VALIDATION, 'Invalid channel.', array( 'field' => 'channel' ) );
		}
		$data = wp_parse_args( $data, array( 'status' => 'draft', 'channel' => 'sms' ) );
		$id   = $this->insert( $data );
		VPOS_Audit::log( 'campaign:create', 'campaign', $id, null, $data );
		return $id;
	}

	public function update_campaign( $id, array $data ) {
		$before = $this->find( $id );
		if ( ! $before ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Campaign not found.' );
		}
		if ( 'draft' !== $before['status'] ) {
			return new WP_Error( VPOS_Response::ERROR_BUSINESS, 'Only draft campaigns can be edited.' );
		}
		$this->update( $id, $data );
		VPOS_Audit::log( 'campaign:update', 'campaign', $id, $before, $data );
		return $this->find( $id );
	}

	public function schedule( $id, $timestamp ) {
		$campaign = $this->find( $id );
		if ( ! $campaign ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Campaign not found.' );
		}
		if ( 'draft' !== $campaign['status'] ) {
			return new WP_Error( VPOS_Response::ERROR_BUSINESS, 'Only draft campaigns can be scheduled.' );
		}
		$this->update( $id, array( 'status' => 'scheduled', 'scheduled_at' => gmdate( 'Y-m-d H:i:s', $timestamp ) ) );
		VPOS_Jobs::enqueue_at( $timestamp, 'send_campaign', array( 'campaign_id' => $id ) );
		VPOS_Audit::log( 'campaign:schedule', 'campaign', $id, $campaign, array( 'scheduled_at' => $timestamp ) );
		return $this->find( $id );
	}

	/** Resolves the segment's current matches and queues one notification each; does not send anything itself. */
	public function send_now( $id ) {
		$campaign = $this->find( $id );
		if ( ! $campaign ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Campaign not found.' );
		}
		if ( ! in_array( $campaign['status'], array( 'draft', 'scheduled' ), true ) ) {
			return new WP_Error( VPOS_Response::ERROR_BUSINESS, 'Campaign has already been sent or was cancelled.' );
		}
		$enabled = $this->ensure_campaigns_enabled();
		if ( is_wp_error( $enabled ) ) {
			return $enabled;
		}

		$customer_ids  = $campaign['segment_id'] ? ( new VPOS_Segment_Repository() )->resolve_customer_ids( $campaign['segment_id'] ) : array();
		$notifications = new VPOS_Notification_Repository();
		foreach ( $customer_ids as $customer_id ) {
			$notifications->queue( $customer_id, $campaign['channel'], $campaign['subject'] ?: $campaign['name'], $campaign['message'], array( 'campaign_id' => $id ) );
		}
		$this->update( $id, array( 'status' => 'sent', 'sent_at' => current_time( 'mysql', true ), 'recipient_count' => count( $customer_ids ) ) );
		VPOS_Audit::log( 'campaign:send', 'campaign', $id, $campaign, array( 'recipient_count' => count( $customer_ids ) ) );
		return $this->find( $id );
	}

	public function cancel( $id ) {
		$campaign = $this->find( $id );
		if ( ! $campaign ) {
			return new WP_Error( VPOS_Response::ERROR_NOT_FOUND, 'Campaign not found.' );
		}
		if ( ! in_array( $campaign['status'], array( 'draft', 'scheduled' ), true ) ) {
			return new WP_Error( VPOS_Response::ERROR_BUSINESS, 'Only draft or scheduled campaigns can be cancelled.' );
		}
		$this->update( $id, array( 'status' => 'cancelled' ) );
		VPOS_Audit::log( 'campaign:cancel', 'campaign', $id, $campaign, array() );
		return $this->find( $id );
	}

	public function get_sends( $campaign_id, $page = 1, $limit = 20 ) {
		return ( new VPOS_Notification_Repository() )->paginate( array( 'campaign_id' => $campaign_id ), $page, $limit );
	}
}

VPOS_Campaign_Repository::schema();
