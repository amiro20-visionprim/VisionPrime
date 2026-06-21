<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Per-customer notification log (Master Spec §17/§31): every message a
 * customer is owed, whether triggered by a Campaign blast or a future
 * Automation rule, is queued here once. This layer never sends anything
 * itself — it only records intent/outcome and fires a dispatch hook for
 * the actual SMS/email/push gateway (left to the Phase 7 integrations
 * layer) to consume.
 */
class VPOS_Notification_Repository extends VPOS_Repository {

	protected $table          = 'vpos_notifications';
	protected $soft_deletable = false;

	const CHANNELS = array( 'sms', 'email', 'push', 'in_app' );

	public static function schema() {
		VPOS_Migrator::register(
			'vpos_notifications',
			'site',
			"id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			customer_id BIGINT UNSIGNED NOT NULL,
			campaign_id BIGINT UNSIGNED NULL,
			channel VARCHAR(16) NOT NULL DEFAULT 'in_app',
			title VARCHAR(190) NULL,
			body TEXT NOT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'pending',
			error TEXT NULL,
			read_at DATETIME NULL,
			metadata LONGTEXT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			PRIMARY KEY  (id),
			KEY customer_id (customer_id),
			KEY campaign_id (campaign_id),
			KEY status (status)"
		);
	}

	public function queue( $customer_id, $channel, $title, $body, array $extra = array() ) {
		if ( ! in_array( $channel, self::CHANNELS, true ) ) {
			$channel = 'in_app';
		}
		$id = $this->insert(
			array(
				'customer_id' => $customer_id,
				'campaign_id' => $extra['campaign_id'] ?? null,
				'channel'     => $channel,
				'title'       => $title,
				'body'        => $body,
				'status'      => 'pending',
				'metadata'    => wp_json_encode( $extra ),
			)
		);
		do_action( 'vpos_notification_dispatch', $id, $this->find( $id ) );
		return $id;
	}

	public function mark_sent( $id ) {
		$this->update( $id, array( 'status' => 'sent' ) );
	}

	public function mark_failed( $id, $error ) {
		$this->update( $id, array( 'status' => 'failed', 'error' => $error ) );
	}

	public function mark_read( $id, $customer_id ) {
		global $wpdb;
		return $wpdb->update(
			$this->table_name(),
			array( 'status' => 'read', 'read_at' => current_time( 'mysql', true ) ),
			array( 'id' => $id, 'customer_id' => $customer_id )
		);
	}

	public function get_for_customer( $customer_id, $page = 1, $limit = 20 ) {
		return $this->paginate( array( 'customer_id' => $customer_id ), $page, $limit );
	}

	public function unread_count( $customer_id ) {
		global $wpdb;
		return (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM {$this->table_name()} WHERE customer_id = %d AND status != 'read'", $customer_id )
		);
	}
}

VPOS_Notification_Repository::schema();
