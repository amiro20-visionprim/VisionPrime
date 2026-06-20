<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registry/dispatcher for social channels. Each channel is a separate
 * class implementing send()/get_stats() so adding a new platform never
 * touches this file's core logic — just register it below.
 */
class VP_Social_Manager {

	private static $channels = array();

	public function __construct() {
		$this->register_channels();
		add_action( 'wp_ajax_vp_social_send', array( $this, 'ajax_send' ) );
		add_action( 'wp_ajax_vp_social_save_account', array( $this, 'ajax_save_account' ) );
	}

	private function register_channels() {
		require_once VP_SUITE_DIR . 'includes/social/channels/class-vp-channel-base.php';
		require_once VP_SUITE_DIR . 'includes/social/channels/class-vp-channel-telegram.php';
		require_once VP_SUITE_DIR . 'includes/social/channels/class-vp-channel-email.php';
		require_once VP_SUITE_DIR . 'includes/social/channels/class-vp-channel-generic-webhook.php';
		require_once VP_SUITE_DIR . 'includes/social/channels/class-vp-channel-instagram.php';

		self::$channels = array(
			'telegram'  => new VP_Channel_Telegram(),
			'email'     => new VP_Channel_Email(),
			// Real Meta Graph API publishing (Business/Creator account +
			// linked Facebook Page + Meta App permissions required).
			'instagram' => new VP_Channel_Instagram(),
			// WhatsApp / Bale / Rubika / eitaa / iGap each require
			// platform-specific business APIs; wired through the same
			// webhook-style adapter until each holding provides its own
			// credentials, so the UI/queue/stats are ready on day one.
			'whatsapp'  => new VP_Channel_Generic_Webhook( 'whatsapp', 'واتس‌اپ' ),
			'bale'      => new VP_Channel_Generic_Webhook( 'bale', 'بله' ),
			'rubika'    => new VP_Channel_Generic_Webhook( 'rubika', 'روبیکا' ),
			'igap'      => new VP_Channel_Generic_Webhook( 'igap', 'آی‌گپ' ),
			'eitaa'     => new VP_Channel_Generic_Webhook( 'eitaa', 'ایتا' ),
		);
	}

	public static function get_channels() {
		return self::$channels;
	}

	public static function get_channel( $key ) {
		return self::$channels[ $key ] ?? null;
	}

	/**
	 * Aggregates send/engagement metrics per channel from vp_social_posts,
	 * powering the social analytics dashboard. Engagement (views/reactions)
	 * is read from the per-account stats option refreshed by VP_Cron.
	 *
	 * @return array channel_key => ['label','sent','failed','accounts','engagement']
	 */
	public static function get_channel_stats() {
		global $wpdb;

		$rows = $wpdb->get_results(
			"SELECT a.channel AS channel, p.status AS status, COUNT(*) AS c
			 FROM {$wpdb->prefix}vp_social_posts p
			 INNER JOIN {$wpdb->prefix}vp_social_accounts a ON a.id = p.account_id
			 GROUP BY a.channel, p.status"
		);

		$stats = array();
		foreach ( self::$channels as $key => $channel ) {
			$stats[ $key ] = array(
				'label'      => $channel->get_label(),
				'sent'       => 0,
				'failed'     => 0,
				'accounts'   => 0,
				'engagement' => 0,
			);
		}

		foreach ( $rows as $row ) {
			if ( ! isset( $stats[ $row->channel ] ) ) {
				continue;
			}
			if ( 'sent' === $row->status ) {
				$stats[ $row->channel ]['sent'] += (int) $row->c;
			} elseif ( 'failed' === $row->status ) {
				$stats[ $row->channel ]['failed'] += (int) $row->c;
			}
		}

		$accounts = $wpdb->get_results( "SELECT id, channel FROM {$wpdb->prefix}vp_social_accounts WHERE is_active = 1" );
		foreach ( $accounts as $acc ) {
			if ( ! isset( $stats[ $acc->channel ] ) ) {
				continue;
			}
			$stats[ $acc->channel ]['accounts']++;
			$engagement = get_option( 'vp_social_stats_' . $acc->id );
			if ( is_array( $engagement ) && isset( $engagement['engagement'] ) ) {
				$stats[ $acc->channel ]['engagement'] += (int) $engagement['engagement'];
			}
		}

		return $stats;
	}

	/**
	 * Auto-distributes a freshly published post to every active social
	 * account, so an operator doesn't have to manually copy/paste the link
	 * into each channel. Triggered from VP_Queue::approve_and_publish()
	 * when the 'auto_social_distribution' setting is enabled.
	 *
	 * @param int    $post_id Newly published post.
	 * @param object $job     The originating vp_jobs row (for the title).
	 */
	public static function distribute_on_publish( $post_id, $job ) {
		global $wpdb;
		$accounts = $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}vp_social_accounts WHERE is_active = 1" );
		if ( ! $accounts ) {
			return;
		}

		$message = $job->title . "\n" . get_permalink( $post_id );

		foreach ( $accounts as $account ) {
			$channel = self::get_channel( $account->channel );
			if ( ! $channel ) {
				continue;
			}

			$result = $channel->send( $account, $message );

			$wpdb->insert(
				$wpdb->prefix . 'vp_social_posts',
				array(
					'account_id' => $account->id,
					'job_id'     => $job->id,
					'status'     => is_wp_error( $result ) ? 'failed' : 'sent',
					'payload'    => wp_json_encode( array( 'message' => $message ) ),
					'response'   => wp_json_encode( is_wp_error( $result ) ? array( 'error' => $result->get_error_message() ) : $result ),
					'sent_at'    => current_time( 'mysql' ),
					'created_at' => current_time( 'mysql' ),
				)
			);

			if ( is_wp_error( $result ) ) {
				VP_Logger::log( 'social_manager', 'توزیع خودکار ناموفق در ' . $account->channel . ': ' . $result->get_error_message(), 'error' );
			} else {
				VP_Logger::log( 'social_manager', "توزیع خودکار پست #$post_id در کانال {$account->channel} انجام شد.", 'info' );
			}
		}
	}

	public function ajax_save_account() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		global $wpdb;
		$channel = sanitize_key( $_POST['channel'] ?? '' );
		$label   = sanitize_text_field( $_POST['label'] ?? '' );
		$config  = wp_unslash( $_POST['config'] ?? '{}' );

		$wpdb->insert(
			$wpdb->prefix . 'vp_social_accounts',
			array(
				'channel'    => $channel,
				'label'      => $label,
				'config'     => $config,
				'is_active'  => 1,
				'created_at' => current_time( 'mysql' ),
				'updated_at' => current_time( 'mysql' ),
			)
		);

		VP_Logger::log( 'social_manager', "حساب «$label» برای کانال $channel ثبت شد.", 'info' );

		wp_send_json_success( array( 'id' => $wpdb->insert_id ) );
	}

	public function ajax_send() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'publish_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		$account_id = absint( $_POST['account_id'] ?? 0 );
		$message    = wp_kses_post( $_POST['message'] ?? '' );

		global $wpdb;
		$account = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}vp_social_accounts WHERE id = %d", $account_id ) );
		if ( ! $account ) {
			wp_send_json_error( array( 'message' => __( 'حساب یافت نشد.', 'vp-suite' ) ) );
		}

		$channel = self::get_channel( $account->channel );
		if ( ! $channel ) {
			wp_send_json_error( array( 'message' => __( 'کانال پشتیبانی نمی‌شود.', 'vp-suite' ) ) );
		}

		$result = $channel->send( $account, $message );

		$wpdb->insert(
			$wpdb->prefix . 'vp_social_posts',
			array(
				'account_id' => $account_id,
				'status'     => is_wp_error( $result ) ? 'failed' : 'sent',
				'payload'    => wp_json_encode( array( 'message' => $message ) ),
				'response'   => wp_json_encode( is_wp_error( $result ) ? array( 'error' => $result->get_error_message() ) : $result ),
				'sent_at'    => current_time( 'mysql' ),
				'created_at' => current_time( 'mysql' ),
			)
		);

		if ( is_wp_error( $result ) ) {
			VP_Logger::log( 'social_manager', $result->get_error_message(), 'error', array( 'channel' => $account->channel ) );
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}

		VP_Logger::log( 'social_manager', "پیام در کانال {$account->channel} ارسال شد.", 'info' );
		wp_send_json_success( $result );
	}
}
