<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolves which OpenRouter API key to use for a given module (content / seo
 * / competitor / image / social-channel) and performs the actual HTTP call.
 * The plugin talks to a single gateway (OpenRouter) so every key is expected
 * to look like "sk-or-v1-...", and one key unlocks every underlying model —
 * there is no per-vendor key format to get wrong.
 */
class VP_Api_Manager {

	const PROVIDER = 'openrouter';

	public function __construct() {
		add_action( 'wp_ajax_vp_apikey_test', array( $this, 'ajax_test_key' ) );
		add_action( 'wp_ajax_vp_apikey_toggle', array( $this, 'ajax_toggle_key' ) );
		add_action( 'wp_ajax_vp_apikey_delete', array( $this, 'ajax_delete_key' ) );
	}

	/**
	 * Validates a key with a real, minimal round-trip call before it's
	 * relied upon — this is what surfaces a bad/expired/mistyped key
	 * immediately instead of leaving it silently first-in-line in the
	 * fallback chain where it would keep failing every later attempt.
	 */
	public function ajax_test_key() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		$id = absint( $_POST['id'] ?? 0 );
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}vp_api_keys WHERE id = %d", $id ) );
		if ( ! $row ) {
			wp_send_json_error( array( 'message' => __( 'کلید یافت نشد.', 'vp-suite' ) ) );
		}

		if ( ! self::is_valid_key_format( $row->api_key ) ) {
			wp_send_json_error( array( 'message' => __( 'این مقدار فرمت یک کلید OpenRouter معتبر را ندارد (باید با sk-or- شروع شود).', 'vp-suite' ) ) );
		}

		$result = self::test_key( $row->api_key );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}

		wp_send_json_success( array( 'message' => __( 'اتصال موفق بود؛ کلید معتبر است.', 'vp-suite' ) ) );
	}

	public function ajax_toggle_key() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		$id = absint( $_POST['id'] ?? 0 );
		global $wpdb;
		$wpdb->query( $wpdb->prepare( "UPDATE {$wpdb->prefix}vp_api_keys SET is_active = 1 - is_active, updated_at = %s WHERE id = %d", current_time( 'mysql' ), $id ) );

		wp_send_json_success();
	}

	public function ajax_delete_key() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		self::delete_key( absint( $_POST['id'] ?? 0 ) );
		wp_send_json_success();
	}

	/**
	 * OpenRouter keys are unambiguous: they always start with "sk-or-".
	 * Anything else pasted into this field can never work against the
	 * gateway this plugin talks to.
	 */
	public static function is_valid_key_format( $api_key ) {
		return (bool) preg_match( '/^sk-or-/', (string) $api_key );
	}

	/**
	 * Minimal real request against OpenRouter to confirm a key actually
	 * works, independent of any module's prompts/scope.
	 */
	public static function test_key( $api_key, $model = '' ) {
		if ( ! self::is_valid_key_format( $api_key ) ) {
			return new WP_Error( 'vp_bad_key_format', __( 'این مقدار فرمت یک کلید OpenRouter معتبر را ندارد (باید با sk-or- شروع شود).', 'vp-suite' ) );
		}

		if ( empty( $model ) ) {
			$models = VP_AI_Providers::get_provider( self::PROVIDER )['models'] ?? array();
			$model  = $models[0] ?? '';
		}
		if ( empty( $model ) ) {
			return new WP_Error( 'vp_no_model', __( 'مدلی برای این سرویس تعریف نشده است.', 'vp-suite' ) );
		}

		$messages = array( array( 'role' => 'user', 'content' => 'سلام' ) );
		$result   = self::request( $model, $messages, $api_key );

		if ( is_wp_error( $result ) ) {
			return $result;
		}

		return true;
	}

	public static function get_key( $scope = 'shared' ) {
		global $wpdb;
		$table = $wpdb->prefix . 'vp_api_keys';

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM $table WHERE scope = %s AND is_active = 1 ORDER BY priority ASC, id DESC LIMIT 1",
				$scope
			)
		);

		if ( ! $row && 'shared' !== $scope ) {
			$row = $wpdb->get_row(
				$wpdb->prepare( "SELECT * FROM $table WHERE scope = 'shared' AND is_active = 1 ORDER BY priority ASC, id DESC LIMIT 1" )
			);
		}

		return $row ? $row->api_key : '';
	}

	public static function save_key( $scope, $label, $api_key, $meta = array(), $priority = 100 ) {
		global $wpdb;
		$wpdb->insert(
			$wpdb->prefix . 'vp_api_keys',
			array(
				'label'      => $label,
				'provider'   => self::PROVIDER,
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
		return $wpdb->get_results( "SELECT id, label, scope, priority, is_active, created_at FROM {$wpdb->prefix}vp_api_keys ORDER BY priority ASC, id DESC" );
	}

	/**
	 * Returns the ordered list of candidate keys for a scope, across both
	 * dedicated and shared keys, lowest priority first. This is the
	 * backbone of the multi-key fallback chain: if a key hits a rate limit
	 * or errors, the caller walks to the next row.
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
	 * Performs a chat-completion style call against OpenRouter.
	 *
	 * @param string $model    Model id (e.g. "openai/gpt-4o-mini").
	 * @param array  $messages [['role'=>'system|user','content'=>'...']]
	 * @param string $scope    Key scope (e.g. 'content', 'seo', 'competitor').
	 */
	public static function chat( $model, $messages, $scope = 'shared' ) {
		$key = self::get_key( $scope );
		if ( empty( $key ) ) {
			return new WP_Error( 'vp_missing_key', __( 'کلید API برای این بخش ثبت نشده است.', 'vp-suite' ) );
		}
		return self::request( $model, $messages, $key );
	}

	/**
	 * Walks the priority-ordered key chain for a scope and tries each key in
	 * turn until one succeeds, so a rate-limited/dead key doesn't stall the
	 * whole ecosystem — the next ready alternative is tried automatically.
	 *
	 * @param string      $scope          Key scope (content/seo/competitor/image/...).
	 * @param array       $messages       Chat messages.
	 * @param string|null $unused         Kept for call-site compatibility (provider is no longer selectable).
	 * @param string|null $preferred_model Model id to use, if any.
	 */
	public static function chat_with_fallback( $scope, $messages, $unused = null, $preferred_model = null ) {
		$chain = self::get_key_chain( $scope );
		if ( empty( $chain ) ) {
			return new WP_Error( 'vp_missing_key', __( 'هیچ کلید API فعالی ثبت نشده است.', 'vp-suite' ) );
		}

		$model      = $preferred_model ?: self::pick_default_model();
		$last_error = new WP_Error( 'vp_all_failed', __( 'تمام کلیدهای ثبت‌شده ناموفق بودند.', 'vp-suite' ) );

		foreach ( $chain as $row ) {
			$result = self::request( $model, $messages, $row->api_key );

			if ( ! is_wp_error( $result ) ) {
				return $result;
			}

			$last_error = $result;
			VP_Logger::log(
				'api_manager',
				sprintf( 'تلاش با کلید «%1$s» ناموفق بود، رفتن به جایگزین بعدی: %2$s', $row->label, $result->get_error_message() ),
				'warning',
				array( 'scope' => $scope, 'priority' => $row->priority )
			);
		}

		return $last_error;
	}

	private static function pick_default_model() {
		$config = VP_AI_Providers::get_provider( self::PROVIDER );
		return $config['models'][0] ?? '';
	}

	private static function request( $model, $messages, $key ) {
		$config = VP_AI_Providers::get_provider( self::PROVIDER );

		if ( empty( $key ) ) {
			return new WP_Error( 'vp_missing_key', __( 'کلید API خالی است.', 'vp-suite' ) );
		}

		$body = array(
			'model'    => $model,
			'messages' => $messages,
		);

		$headers = array(
			'Content-Type'  => 'application/json',
			'HTTP-Referer'  => home_url(),
			'X-Title'       => 'VisionPrime Suite',
		);
		$headers[ $config['auth_header'] ] = $config['auth_prefix'] . $key;

		$response = wp_remote_post(
			$config['endpoint'],
			array(
				'headers' => $headers,
				'body'    => wp_json_encode( $body ),
				'timeout' => 90,
			)
		);

		return self::handle_response( $model, $response );
	}

	private static function handle_response( $model, $response ) {
		if ( is_wp_error( $response ) ) {
			VP_Logger::log( 'api_manager', $response->get_error_message(), 'error', compact( 'model' ) );
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( $code >= 400 ) {
			$detail = self::extract_error_message( $data );
			VP_Logger::log( 'api_manager', 'HTTP ' . $code . ' از OpenRouter' . ( $detail ? ": $detail" : '' ), 'error', array( 'response' => $data ) );
			return new WP_Error(
				'vp_api_error',
				sprintf( __( 'خطای OpenRouter (کد %1$d)%2$s', 'vp-suite' ), $code, $detail ? ": $detail" : '' )
			);
		}

		$text = self::extract_text( $data );
		if ( '' === $text ) {
			VP_Logger::log( 'api_manager', "پاسخ خالی از $model", 'warning', array( 'response' => $data ) );
			return new WP_Error( 'vp_empty_response', __( 'پاسخ سرویس خالی بود.', 'vp-suite' ) );
		}

		VP_Logger::log( 'api_manager', "پاسخ موفق از $model", 'info' );

		return $text;
	}

	private static function extract_error_message( $data ) {
		if ( isset( $data['error']['message'] ) ) {
			return $data['error']['message'];
		}
		if ( isset( $data['message'] ) ) {
			return $data['message'];
		}
		return '';
	}

	private static function extract_text( $data ) {
		return isset( $data['choices'][0]['message']['content'] ) ? $data['choices'][0]['message']['content'] : '';
	}
}
