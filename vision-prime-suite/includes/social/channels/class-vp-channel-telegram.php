<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once VP_SUITE_DIR . 'includes/social/channels/class-vp-channel-base.php';

/**
 * Fully working Telegram Bot API channel — used as the reference
 * implementation for the other "modular, config-ready" channels.
 * account->config expects JSON: {"bot_token":"...","chat_id":"..."}
 */
class VP_Channel_Telegram extends VP_Channel_Base {

	public function get_key() {
		return 'telegram';
	}

	public function get_label() {
		return 'تلگرام';
	}

	public function send( $account, $message ) {
		$config = json_decode( $account->config, true );
		$token  = $config['bot_token'] ?? '';
		$chat   = $config['chat_id'] ?? '';

		if ( empty( $token ) || empty( $chat ) ) {
			return new WP_Error( 'vp_telegram_config', __( 'تنظیمات بات تلگرام کامل نیست.', 'vp-suite' ) );
		}

		$response = wp_remote_post(
			"https://api.telegram.org/bot{$token}/sendMessage",
			array(
				'body'    => array(
					'chat_id'    => $chat,
					'text'       => wp_strip_all_tags( $message ),
					'parse_mode' => 'HTML',
				),
				'timeout' => 30,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( empty( $data['ok'] ) ) {
			return new WP_Error( 'vp_telegram_failed', $data['description'] ?? __( 'ارسال تلگرام ناموفق بود.', 'vp-suite' ) );
		}

		return array( 'message_id' => $data['result']['message_id'] ?? null );
	}

	public function get_stats( $account ) {
		// Telegram Bot API has no native "views" endpoint for bot-sent
		// messages in private/group chats; channel post views require
		// the channel's own forward stats, exposed once chat_id is a
		// public channel — left as a documented limitation for the catalog.
		return array( 'note' => __( 'آمار بازدید فقط برای کانال‌های عمومی در دسترس است.', 'vp-suite' ) );
	}

	public function get_required_fields() {
		return array(
			array( 'key' => 'bot_token', 'label' => 'توکن بات (Bot Token)', 'type' => 'password', 'placeholder' => '123456:ABC-DEF...' ),
			array( 'key' => 'chat_id', 'label' => 'شناسه چت/کانال (Chat ID)', 'type' => 'text', 'placeholder' => '@your_channel یا 123456789' ),
		);
	}

	public function get_notes() {
		return array(
			'باید: بات را ادمین کانال/گروه مقصد کنید تا بتواند پیام بفرستد.',
			'باید: chat_id کانال عمومی را با @ یا شناسه عددی واقعی وارد کنید.',
			'نباید: توکن بات را در جای دیگری منتشر کنید؛ هر کسی با توکن می‌تواند به‌جای شما پیام بفرستد.',
		);
	}

	public function test_connection( $account ) {
		$config = json_decode( $account->config, true );
		$token  = $config['bot_token'] ?? '';

		if ( empty( $token ) ) {
			return new WP_Error( 'vp_telegram_config', __( 'توکن بات تنظیم نشده است.', 'vp-suite' ) );
		}

		$response = wp_remote_get( "https://api.telegram.org/bot{$token}/getMe", array( 'timeout' => 15 ) );
		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( empty( $data['ok'] ) ) {
			return new WP_Error( 'vp_telegram_test_failed', $data['description'] ?? __( 'توکن بات نامعتبر است.', 'vp-suite' ) );
		}

		return true;
	}
}
