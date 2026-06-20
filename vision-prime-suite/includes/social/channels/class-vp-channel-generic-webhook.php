<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once VP_SUITE_DIR . 'includes/social/channels/class-vp-channel-base.php';

/**
 * Generic adapter for platforms whose official APIs require per-business
 * registration (Instagram Graph API, WhatsApp Business API, Bale, Rubika,
 * iGap, Eitaa). Operators paste the platform's own webhook/send endpoint
 * and headers in the account config; once VisionPrime registers real
 * business API credentials, this same UI/queue/stats pipeline keeps
 * working without any code change — only the config values differ.
 *
 * config expects: {"endpoint":"https://...","headers":{...},"payload_template":"..."}
 */
class VP_Channel_Generic_Webhook extends VP_Channel_Base {

	private $key;
	private $label;

	public function __construct( $key, $label ) {
		$this->key   = $key;
		$this->label = $label;
	}

	public function get_key() {
		return $this->key;
	}

	public function get_label() {
		return $this->label;
	}

	public function send( $account, $message ) {
		$config   = json_decode( $account->config, true );
		$endpoint = $config['endpoint'] ?? '';

		if ( empty( $endpoint ) ) {
			return new WP_Error(
				'vp_channel_not_configured',
				sprintf(
					/* translators: %s: platform label */
					__( 'برای %s هنوز endpoint رسمی API ثبت نشده است. در کاتالوگ راهنما مراحل اتصال را ببینید.', 'vp-suite' ),
					$this->label
				)
			);
		}

		$headers = is_array( $config['headers'] ?? null ) ? $config['headers'] : array();

		$response = wp_remote_post(
			$endpoint,
			array(
				'headers' => array_merge( array( 'Content-Type' => 'application/json' ), $headers ),
				'body'    => wp_json_encode( array( 'text' => wp_strip_all_tags( $message ) ) ),
				'timeout' => 30,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		if ( $code >= 400 ) {
			return new WP_Error( 'vp_channel_http_error', sprintf( 'HTTP %d از %s', $code, $this->label ) );
		}

		return array( 'http_code' => $code );
	}
}
