<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolves which API key to use for a given module (content / seo /
 * competitor / image / social-channel) and performs the actual HTTP call.
 * Supports the "shared key for everything" vs "dedicated key per module"
 * choice required by the brief: each module looks up its own scope first,
 * falling back to the shared scope if no dedicated key exists.
 */
class VP_Api_Manager {

	public function __construct() {
		// Stateless service; nothing to hook on init.
	}

	public static function get_key( $provider, $scope = 'shared' ) {
		global $wpdb;
		$table = $wpdb->prefix . 'vp_api_keys';

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM $table WHERE provider = %s AND scope = %s AND is_active = 1 ORDER BY id DESC LIMIT 1",
				$provider,
				$scope
			)
		);

		if ( ! $row && 'shared' !== $scope ) {
			$row = $wpdb->get_row(
				$wpdb->prepare(
					"SELECT * FROM $table WHERE provider = %s AND scope = 'shared' AND is_active = 1 ORDER BY id DESC LIMIT 1",
					$provider
				)
			);
		}

		return $row ? $row->api_key : '';
	}

	public static function save_key( $provider, $scope, $label, $api_key, $meta = array() ) {
		global $wpdb;
		$wpdb->insert(
			$wpdb->prefix . 'vp_api_keys',
			array(
				'label'      => $label,
				'provider'   => $provider,
				'scope'      => $scope,
				'api_key'    => $api_key,
				'meta'       => wp_json_encode( $meta ),
				'is_active'  => 1,
				'created_at' => current_time( 'mysql' ),
				'updated_at' => current_time( 'mysql' ),
			),
			array( '%s', '%s', '%s', '%s', '%s', '%d', '%s', '%s' )
		);
		return $wpdb->insert_id;
	}

	public static function list_keys() {
		global $wpdb;
		return $wpdb->get_results( "SELECT id, label, provider, scope, is_active, created_at FROM {$wpdb->prefix}vp_api_keys ORDER BY id DESC" );
	}

	public static function delete_key( $id ) {
		global $wpdb;
		return $wpdb->delete( $wpdb->prefix . 'vp_api_keys', array( 'id' => absint( $id ) ), array( '%d' ) );
	}

	/**
	 * Performs a chat-completion style call against any registered provider.
	 *
	 * @param string $provider Provider key from VP_AI_Providers.
	 * @param string $model    Model id.
	 * @param array  $messages [['role'=>'system|user','content'=>'...']]
	 * @param string $scope    Key scope (e.g. 'content', 'seo', 'competitor').
	 */
	public static function chat( $provider, $model, $messages, $scope = 'shared' ) {
		$config = VP_AI_Providers::get_provider( $provider );
		if ( ! $config ) {
			return new WP_Error( 'vp_unknown_provider', __( 'Provider نامشخص است.', 'vp-suite' ) );
		}

		$key = self::get_key( $provider, $scope );
		if ( empty( $key ) ) {
			return new WP_Error( 'vp_missing_key', __( 'کلید API برای این سرویس ثبت نشده است.', 'vp-suite' ) );
		}

		$body = ( 'anthropic' === $provider )
			? array(
				'model'      => $model,
				'max_tokens' => 4096,
				'messages'   => array_values( array_filter( $messages, fn( $m ) => 'system' !== $m['role'] ) ),
				'system'     => self::extract_system( $messages ),
			)
			: array(
				'model'    => $model,
				'messages' => $messages,
			);

		$headers = array(
			'Content-Type' => 'application/json',
		);
		$headers[ $config['auth_header'] ] = $config['auth_prefix'] . $key;

		if ( 'openrouter' === $provider ) {
			$headers['HTTP-Referer'] = home_url();
			$headers['X-Title']      = 'VisionPrime Suite';
		}

		$response = wp_remote_post(
			$config['endpoint'],
			array(
				'headers' => $headers,
				'body'    => wp_json_encode( $body ),
				'timeout' => 90,
			)
		);

		if ( is_wp_error( $response ) ) {
			VP_Logger::log( 'api_manager', $response->get_error_message(), 'error', compact( 'provider', 'model' ) );
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( $code >= 400 ) {
			VP_Logger::log( 'api_manager', 'HTTP ' . $code . ' از ' . $provider, 'error', array( 'response' => $data ) );
			return new WP_Error( 'vp_api_error', sprintf( __( 'خطای سرویس %1$s (کد %2$d)', 'vp-suite' ), $provider, $code ) );
		}

		$text = self::extract_text( $provider, $data );
		VP_Logger::log( 'api_manager', "پاسخ موفق از $provider/$model", 'info' );

		return $text;
	}

	private static function extract_system( $messages ) {
		foreach ( $messages as $m ) {
			if ( 'system' === $m['role'] ) {
				return $m['content'];
			}
		}
		return '';
	}

	private static function extract_text( $provider, $data ) {
		if ( 'anthropic' === $provider ) {
			return isset( $data['content'][0]['text'] ) ? $data['content'][0]['text'] : '';
		}
		return isset( $data['choices'][0]['message']['content'] ) ? $data['choices'][0]['message']['content'] : '';
	}
}
