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

	public static function save_key( $provider, $scope, $label, $api_key, $meta = array(), $priority = 100 ) {
		global $wpdb;
		$wpdb->insert(
			$wpdb->prefix . 'vp_api_keys',
			array(
				'label'      => $label,
				'provider'   => $provider,
				'scope'      => $scope,
				'api_key'    => $api_key,
				'meta'       => wp_json_encode( $meta ),
				'priority'   => absint( $priority ),
				'is_active'  => 1,
				'created_at' => current_time( 'mysql' ),
				'updated_at' => current_time( 'mysql' ),
			),
			array( '%s', '%s', '%s', '%s', '%s', '%d', '%d', '%s', '%s' )
		);
		return $wpdb->insert_id;
	}

	public static function list_keys() {
		global $wpdb;
		return $wpdb->get_results( "SELECT id, label, provider, scope, priority, is_active, created_at FROM {$wpdb->prefix}vp_api_keys ORDER BY priority ASC, id DESC" );
	}

	/**
	 * Returns the ordered list of candidate (provider, model) pairs for a
	 * scope, across both dedicated and shared keys, lowest priority first.
	 * This is the backbone of the multi-API fallback chain: if a provider
	 * hits a rate limit or errors, the caller walks to the next row.
	 */
	public static function get_key_chain( $scope = 'shared' ) {
		global $wpdb;
		$table = $wpdb->prefix . 'vp_api_keys';

		if ( 'shared' === $scope ) {
			$rows = $wpdb->get_results(
				$wpdb->prepare( "SELECT * FROM $table WHERE scope = %s AND is_active = 1 ORDER BY priority ASC, id ASC", 'shared' )
			);
		} else {
			$rows = $wpdb->get_results(
				$wpdb->prepare(
					"SELECT * FROM $table WHERE (scope = %s OR scope = 'shared') AND is_active = 1 ORDER BY priority ASC, id ASC",
					$scope
				)
			);
		}

		return $rows ? $rows : array();
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
		$key = self::get_key( $provider, $scope );
		if ( empty( $key ) ) {
			return new WP_Error( 'vp_missing_key', __( 'کلید API برای این سرویس ثبت نشده است.', 'vp-suite' ) );
		}
		return self::request( $provider, $model, $messages, $key );
	}

	/**
	 * Walks the priority-ordered key chain for a scope and tries each
	 * provider in turn until one succeeds. This is what every AI-calling
	 * module should use so that a rate-limited/dead key doesn't stall the
	 * whole ecosystem — the next ready alternative is tried automatically.
	 *
	 * @param string      $scope             Key scope (content/seo/competitor/image/...).
	 * @param array       $messages          Chat messages.
	 * @param string|null $preferred_provider Tried first if it has a key in the chain.
	 * @param string|null $preferred_model    Model to use with the preferred provider.
	 */
	public static function chat_with_fallback( $scope, $messages, $preferred_provider = null, $preferred_model = null ) {
		$chain = self::get_key_chain( $scope );
		if ( empty( $chain ) ) {
			return new WP_Error( 'vp_missing_key', __( 'هیچ کلید API فعالی برای این بخش ثبت نشده است.', 'vp-suite' ) );
		}

		if ( $preferred_provider ) {
			usort(
				$chain,
				function ( $a, $b ) use ( $preferred_provider ) {
					$a_match = ( $a->provider === $preferred_provider ) ? 0 : 1;
					$b_match = ( $b->provider === $preferred_provider ) ? 0 : 1;
					return $a_match <=> $b_match;
				}
			);
		}

		$last_error = new WP_Error( 'vp_all_failed', __( 'تمام سرویس‌های ثبت‌شده ناموفق بودند.', 'vp-suite' ) );

		foreach ( $chain as $row ) {
			$model = ( $preferred_provider && $row->provider === $preferred_provider && $preferred_model )
				? $preferred_model
				: self::pick_default_model( $row->provider );

			if ( ! $model ) {
				continue;
			}

			$result = self::request( $row->provider, $model, $messages, $row->api_key );

			if ( ! is_wp_error( $result ) ) {
				return $result;
			}

			$last_error = $result;
			VP_Logger::log(
				'api_manager',
				sprintf( 'تلاش با %1$s ناموفق بود، رفتن به جایگزین بعدی: %2$s', $row->provider, $result->get_error_message() ),
				'warning',
				array( 'scope' => $scope, 'priority' => $row->priority )
			);
		}

		return $last_error;
	}

	private static function pick_default_model( $provider ) {
		$config = VP_AI_Providers::get_provider( $provider );
		if ( ! $config || empty( $config['models'] ) ) {
			return '';
		}
		return $config['models'][0];
	}

	private static function request( $provider, $model, $messages, $key ) {
		$config = VP_AI_Providers::get_provider( $provider );
		if ( ! $config ) {
			return new WP_Error( 'vp_unknown_provider', __( 'Provider نامشخص است.', 'vp-suite' ) );
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
