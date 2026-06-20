<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Google Search Console integration — the data-driven heart of the SEO
 * strategy module. Instead of asking an AI to *guess* how a site ranks,
 * this pulls the REAL Search Analytics data (actual position, impressions,
 * clicks, CTR per query) straight from the site's GSC property via the
 * official Webmasters API, then hunts concrete ranking opportunities from
 * those numbers:
 *
 *   - "striking distance"  → queries sitting on page 2 (pos 11-20) with
 *                            real impressions, one push away from page 1.
 *   - "low CTR"            → queries already on page 1 whose CTR is below
 *                            the expected curve → title/meta rewrite wins.
 *   - "content gap"        → high-impression queries ranking past page 2,
 *                            where new/strengthened content is warranted.
 *
 * The real numbers are then optionally handed to the AI strategist so its
 * action plan is grounded in actual data, not speculation.
 *
 * Auth is OAuth 2.0 (offline) using the operator's own Google Cloud OAuth
 * client; only a read-only Search Console scope is requested.
 */
class VP_Search_Console {

	const OPTION       = 'vp_gsc_connection';
	const TOKEN_CACHE  = 'vp_gsc_access_token';
	const SCOPE        = 'https://www.googleapis.com/auth/webmasters.readonly';
	const PAGE_SLUG    = 'vp-suite-search-console';

	public function __construct() {
		add_action( 'admin_init', array( $this, 'maybe_handle_oauth' ) );
		add_action( 'wp_ajax_vp_gsc_list_sites', array( $this, 'ajax_list_sites' ) );
		add_action( 'wp_ajax_vp_gsc_set_site', array( $this, 'ajax_set_site' ) );
		add_action( 'wp_ajax_vp_gsc_hunt', array( $this, 'ajax_hunt' ) );
		add_action( 'wp_ajax_vp_gsc_ai_strategy', array( $this, 'ajax_ai_strategy' ) );
	}

	/* ---------------------------------------------------------------------
	 * Connection state
	 * ------------------------------------------------------------------- */

	public static function get_connection() {
		return wp_parse_args(
			get_option( self::OPTION, array() ),
			array(
				'refresh_token'   => '',
				'site_url'        => '',
				'connected_email' => '',
			)
		);
	}

	private static function save_connection( $data ) {
		update_option( self::OPTION, array_merge( self::get_connection(), $data ), false );
	}

	/** Operator-supplied OAuth client lives in plugin settings. */
	public static function is_configured() {
		return VP_Settings::get( 'gsc_client_id' ) && VP_Settings::get( 'gsc_client_secret' );
	}

	public static function is_connected() {
		$conn = self::get_connection();
		return ! empty( $conn['refresh_token'] );
	}

	public static function get_redirect_uri() {
		return admin_url( 'admin.php?page=' . self::PAGE_SLUG );
	}

	/* ---------------------------------------------------------------------
	 * OAuth 2.0 flow
	 * ------------------------------------------------------------------- */

	public static function get_auth_url() {
		$params = array(
			'client_id'     => VP_Settings::get( 'gsc_client_id' ),
			'redirect_uri'  => self::get_redirect_uri(),
			'response_type' => 'code',
			'scope'         => self::SCOPE,
			'access_type'   => 'offline',
			'prompt'        => 'consent',
			'state'         => wp_create_nonce( 'vp_gsc_oauth' ),
		);
		return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query( $params );
	}

	/**
	 * Runs on admin_init; completes the OAuth handshake when Google
	 * redirects back to our page with ?code=, and handles disconnect.
	 */
	public function maybe_handle_oauth() {
		if ( ! is_admin() || empty( $_GET['page'] ) || self::PAGE_SLUG !== $_GET['page'] ) {
			return;
		}
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		// Disconnect.
		if ( ! empty( $_GET['vp_gsc_disconnect'] ) && check_admin_referer( 'vp_gsc_disconnect' ) ) {
			delete_option( self::OPTION );
			delete_transient( self::TOKEN_CACHE );
			VP_Logger::log( 'search_console', 'اتصال Google Search Console قطع شد.', 'info' );
			wp_safe_redirect( self::get_redirect_uri() );
			exit;
		}

		// OAuth callback.
		if ( isset( $_GET['code'] ) ) {
			if ( empty( $_GET['state'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_GET['state'] ) ), 'vp_gsc_oauth' ) ) {
				VP_Logger::log( 'search_console', 'state نامعتبر در بازگشت OAuth.', 'error' );
				return;
			}
			$result = self::exchange_code( sanitize_text_field( wp_unslash( $_GET['code'] ) ) );
			if ( is_wp_error( $result ) ) {
				VP_Logger::log( 'search_console', 'تبادل کد OAuth ناموفق: ' . $result->get_error_message(), 'error' );
			}
			wp_safe_redirect( self::get_redirect_uri() );
			exit;
		}
	}

	private static function exchange_code( $code ) {
		$response = wp_remote_post(
			'https://oauth2.googleapis.com/token',
			array(
				'timeout' => 30,
				'body'    => array(
					'code'          => $code,
					'client_id'     => VP_Settings::get( 'gsc_client_id' ),
					'client_secret' => VP_Settings::get( 'gsc_client_secret' ),
					'redirect_uri'  => self::get_redirect_uri(),
					'grant_type'    => 'authorization_code',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( empty( $data['refresh_token'] ) ) {
			return new WP_Error( 'vp_gsc_no_refresh', __( 'توکن دریافت نشد. مطمئن شوید دسترسی offline و prompt=consent تنظیم شده است.', 'vp-suite' ) );
		}

		self::save_connection( array( 'refresh_token' => $data['refresh_token'] ) );

		// Cache the just-issued access token to skip an immediate refresh.
		if ( ! empty( $data['access_token'] ) ) {
			set_transient( self::TOKEN_CACHE, $data['access_token'], max( 60, (int) ( $data['expires_in'] ?? 3600 ) - 120 ) );
		}

		// Capture the connected account email for the UI (best-effort).
		self::capture_account_email();

		VP_Logger::log( 'search_console', 'اتصال Google Search Console برقرار شد.', 'info' );
		return true;
	}

	private static function capture_account_email() {
		$token = self::get_access_token();
		if ( is_wp_error( $token ) ) {
			return;
		}
		$response = wp_remote_get(
			'https://www.googleapis.com/oauth2/v2/userinfo',
			array( 'timeout' => 20, 'headers' => array( 'Authorization' => 'Bearer ' . $token ) )
		);
		if ( ! is_wp_error( $response ) ) {
			$data = json_decode( wp_remote_retrieve_body( $response ), true );
			if ( ! empty( $data['email'] ) ) {
				self::save_connection( array( 'connected_email' => sanitize_email( $data['email'] ) ) );
			}
		}
	}

	/**
	 * Returns a valid access token, refreshing via the stored refresh token
	 * and caching it in a transient until shortly before it expires.
	 */
	public static function get_access_token() {
		$cached = get_transient( self::TOKEN_CACHE );
		if ( $cached ) {
			return $cached;
		}

		$conn = self::get_connection();
		if ( empty( $conn['refresh_token'] ) ) {
			return new WP_Error( 'vp_gsc_not_connected', __( 'به Google Search Console متصل نشده‌اید.', 'vp-suite' ) );
		}

		$response = wp_remote_post(
			'https://oauth2.googleapis.com/token',
			array(
				'timeout' => 30,
				'body'    => array(
					'client_id'     => VP_Settings::get( 'gsc_client_id' ),
					'client_secret' => VP_Settings::get( 'gsc_client_secret' ),
					'refresh_token' => $conn['refresh_token'],
					'grant_type'    => 'refresh_token',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( empty( $data['access_token'] ) ) {
			return new WP_Error( 'vp_gsc_refresh_failed', __( 'تازه‌سازی توکن ناموفق بود. ممکن است نیاز به اتصال مجدد باشد.', 'vp-suite' ) );
		}

		$ttl = max( 60, (int) ( $data['expires_in'] ?? 3600 ) - 120 );
		set_transient( self::TOKEN_CACHE, $data['access_token'], $ttl );

		return $data['access_token'];
	}

	/* ---------------------------------------------------------------------
	 * Search Console API
	 * ------------------------------------------------------------------- */

	/** Lists the GSC properties the connected account can access. */
	public static function list_sites() {
		$token = self::get_access_token();
		if ( is_wp_error( $token ) ) {
			return $token;
		}

		$response = wp_remote_get(
			'https://www.googleapis.com/webmasters/v3/sites',
			array( 'timeout' => 30, 'headers' => array( 'Authorization' => 'Bearer ' . $token ) )
		);
		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$data  = json_decode( wp_remote_retrieve_body( $response ), true );
		$sites = array();
		foreach ( ( $data['siteEntry'] ?? array() ) as $entry ) {
			// Only properties we can actually read analytics from.
			if ( in_array( $entry['permissionLevel'] ?? '', array( 'siteOwner', 'siteFullUser', 'siteRestrictedUser' ), true ) ) {
				$sites[] = $entry['siteUrl'];
			}
		}
		return $sites;
	}

	/**
	 * Raw Search Analytics query.
	 *
	 * @param string $site_url GSC property (e.g. https://example.com/ or sc-domain:example.com).
	 * @param array  $args     Overrides merged into the API body.
	 */
	public static function query_analytics( $site_url, $args = array() ) {
		$token = self::get_access_token();
		if ( is_wp_error( $token ) ) {
			return $token;
		}

		$body = wp_parse_args(
			$args,
			array(
				'startDate'  => gmdate( 'Y-m-d', time() - 90 * DAY_IN_SECONDS ),
				'endDate'    => gmdate( 'Y-m-d', time() - DAY_IN_SECONDS ),
				'dimensions' => array( 'query' ),
				'rowLimit'   => 1000,
			)
		);

		$endpoint = 'https://www.googleapis.com/webmasters/v3/sites/' . rawurlencode( $site_url ) . '/searchAnalytics/query';

		$response = wp_remote_post(
			$endpoint,
			array(
				'timeout' => 60,
				'headers' => array(
					'Authorization' => 'Bearer ' . $token,
					'Content-Type'  => 'application/json',
				),
				'body'    => wp_json_encode( $body ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( $code >= 400 ) {
			$msg = $data['error']['message'] ?? ( 'HTTP ' . $code );
			VP_Logger::log( 'search_console', 'خطای API سرچ کنسول: ' . $msg, 'error' );
			return new WP_Error( 'vp_gsc_api', sprintf( __( 'خطای Search Console: %s', 'vp-suite' ), $msg ) );
		}

		return $data['rows'] ?? array();
	}

	/* ---------------------------------------------------------------------
	 * Opportunity hunting on REAL data
	 * ------------------------------------------------------------------- */

	/**
	 * Rough expected organic CTR by average position. Used to flag queries
	 * that rank well but under-earn clicks (a title/meta optimization win).
	 */
	public static function expected_ctr( $position ) {
		$p = (int) round( $position );
		$curve = array(
			1 => 0.28, 2 => 0.16, 3 => 0.11, 4 => 0.08, 5 => 0.06,
			6 => 0.045, 7 => 0.035, 8 => 0.03, 9 => 0.025, 10 => 0.022,
		);
		if ( $p < 1 ) {
			$p = 1;
		}
		return $curve[ $p ] ?? 0.02;
	}

	/**
	 * Pulls real Search Analytics rows and buckets them into actionable
	 * opportunity groups based on actual position/impressions/CTR.
	 *
	 * @param string $site_url GSC property.
	 * @param int    $days     Lookback window in days.
	 * @param int    $min_impr Minimum impressions for a query to count.
	 */
	public static function find_opportunities( $site_url, $days = 90, $min_impr = 20 ) {
		$rows = self::query_analytics(
			$site_url,
			array(
				'startDate'  => gmdate( 'Y-m-d', time() - max( 7, (int) $days ) * DAY_IN_SECONDS ),
				'endDate'    => gmdate( 'Y-m-d', time() - DAY_IN_SECONDS ),
				'dimensions' => array( 'query', 'page' ),
				'rowLimit'   => 2000,
			)
		);

		if ( is_wp_error( $rows ) ) {
			return $rows;
		}

		$striking = array();
		$low_ctr  = array();
		$gap      = array();

		foreach ( $rows as $row ) {
			$impr = (int) ( $row['impressions'] ?? 0 );
			if ( $impr < $min_impr ) {
				continue;
			}

			$item = array(
				'query'       => $row['keys'][0] ?? '',
				'page'        => $row['keys'][1] ?? '',
				'clicks'      => (int) ( $row['clicks'] ?? 0 ),
				'impressions' => $impr,
				'ctr'         => round( ( $row['ctr'] ?? 0 ) * 100, 2 ),
				'position'    => round( $row['position'] ?? 0, 1 ),
			);
			$pos = $item['position'];

			if ( $pos > 10 && $pos <= 20 ) {
				// Page 2 — the prime "striking distance" hunt.
				$item['potential'] = $impr; // bigger impressions = bigger win.
				$striking[]        = $item;
			} elseif ( $pos >= 1 && $pos <= 10 ) {
				$expected = self::expected_ctr( $pos );
				if ( ( $row['ctr'] ?? 0 ) < $expected * 0.6 ) {
					$item['expected_ctr'] = round( $expected * 100, 2 );
					$low_ctr[]            = $item;
				}
			} elseif ( $pos > 20 ) {
				$gap[] = $item;
			}
		}

		// Sort each bucket by the metric that matters most for it.
		usort( $striking, fn( $a, $b ) => $b['impressions'] <=> $a['impressions'] );
		usort( $low_ctr, fn( $a, $b ) => $b['impressions'] <=> $a['impressions'] );
		usort( $gap, fn( $a, $b ) => $b['impressions'] <=> $a['impressions'] );

		return array(
			'site_url'          => $site_url,
			'window_days'       => (int) $days,
			'fetched'           => count( $rows ),
			'striking_distance' => array_slice( $striking, 0, 50 ),
			'low_ctr'           => array_slice( $low_ctr, 0, 50 ),
			'content_gap'       => array_slice( $gap, 0, 50 ),
			'summary'           => array(
				'striking' => count( $striking ),
				'low_ctr'  => count( $low_ctr ),
				'gap'      => count( $gap ),
			),
		);
	}

	/**
	 * Hands the REAL opportunity data to the AI strategist so the action
	 * plan is grounded in actual numbers. Stores the result in the
	 * competitor reports table so it shows in that module's history.
	 */
	public static function ai_strategy( $opportunities ) {
		$provider = VP_Settings::get( 'default_provider' );
		$model    = VP_AI_Providers::get_provider( $provider )['models'][0] ?? '';

		$lines = array();
		foreach ( array_slice( $opportunities['striking_distance'], 0, 20 ) as $o ) {
			$lines[] = "• «{$o['query']}» | پوزیشن {$o['position']} | {$o['impressions']} ایمپرشن | CTR {$o['ctr']}% | صفحه: {$o['page']}";
		}
		$low = array();
		foreach ( array_slice( $opportunities['low_ctr'], 0, 10 ) as $o ) {
			$low[] = "• «{$o['query']}» | پوزیشن {$o['position']} | CTR فعلی {$o['ctr']}% (مورد انتظار ~{$o['expected_ctr']}%) | صفحه: {$o['page']}";
		}

		$user = "این داده‌ی واقعی از Google Search Console سایت است (نه حدس). بر اساس همین اعداد، یک برنامه‌ی عملِ دقیق برای شکار پوزیشن بده.\n\n"
			. "کوئری‌های فاصله‌ی نزدیک (صفحه ۲، آماده‌ی صعود به صفحه ۱):\n" . implode( "\n", $lines ) . "\n\n"
			. "کوئری‌های با CTR پایین (رتبه خوب ولی کلیک کم — نیاز به بازنویسی عنوان/متا):\n" . implode( "\n", $low ) . "\n\n"
			. "برای هر کوئری مهم بگو: چه تغییری در محتوا/عنوان/لینک‌سازی داخلی لازم است و چرا. خروجی JSON با کلیدهای quick_wins, title_rewrites, content_actions, priority_order.";

		$messages = array(
			array( 'role' => 'system', 'content' => VP_Settings::get( 'competitor_prompt' ) ),
			array( 'role' => 'user', 'content' => $user ),
		);

		$raw = VP_Api_Manager::chat_with_fallback( 'competitor', $messages, $provider, $model );
		if ( is_wp_error( $raw ) ) {
			return $raw;
		}

		global $wpdb;
		$wpdb->insert(
			$wpdb->prefix . 'vp_competitor_reports',
			array(
				'keyword'    => 'GSC: ' . ( $opportunities['site_url'] ?? '' ),
				'target_url' => $opportunities['site_url'] ?? '',
				'provider'   => $provider,
				'findings'   => $raw,
				'status'     => 'gsc_real_data',
				'created_at' => current_time( 'mysql' ),
				'updated_at' => current_time( 'mysql' ),
			)
		);

		VP_Logger::log( 'search_console', 'استراتژی مبتنی بر داده‌ی واقعی GSC تولید شد.', 'info' );

		return array( 'report_id' => $wpdb->insert_id, 'raw' => $raw );
	}

	/* ---------------------------------------------------------------------
	 * AJAX
	 * ------------------------------------------------------------------- */

	private function guard() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}
	}

	public function ajax_list_sites() {
		$this->guard();
		$sites = self::list_sites();
		if ( is_wp_error( $sites ) ) {
			wp_send_json_error( array( 'message' => $sites->get_error_message() ) );
		}
		wp_send_json_success( array( 'sites' => $sites, 'current' => self::get_connection()['site_url'] ) );
	}

	public function ajax_set_site() {
		$this->guard();
		$site = esc_url_raw( wp_unslash( $_POST['site_url'] ?? '' ) );
		if ( empty( $site ) && ! empty( $_POST['site_url'] ) ) {
			// sc-domain: properties aren't valid URLs; keep them verbatim.
			$site = sanitize_text_field( wp_unslash( $_POST['site_url'] ) );
		}
		self::save_connection( array( 'site_url' => $site ) );
		wp_send_json_success( array( 'site_url' => $site ) );
	}

	public function ajax_hunt() {
		$this->guard();
		$conn = self::get_connection();
		if ( empty( $conn['site_url'] ) ) {
			wp_send_json_error( array( 'message' => __( 'ابتدا یک پراپرتی (سایت) را انتخاب کنید.', 'vp-suite' ) ) );
		}
		$days = absint( $_POST['days'] ?? 90 );
		$data = self::find_opportunities( $conn['site_url'], $days ?: 90 );
		if ( is_wp_error( $data ) ) {
			wp_send_json_error( array( 'message' => $data->get_error_message() ) );
		}
		wp_send_json_success( $data );
	}

	public function ajax_ai_strategy() {
		$this->guard();
		$conn = self::get_connection();
		if ( empty( $conn['site_url'] ) ) {
			wp_send_json_error( array( 'message' => __( 'ابتدا یک پراپرتی را انتخاب کنید.', 'vp-suite' ) ) );
		}
		$days = absint( $_POST['days'] ?? 90 );
		$data = self::find_opportunities( $conn['site_url'], $days ?: 90 );
		if ( is_wp_error( $data ) ) {
			wp_send_json_error( array( 'message' => $data->get_error_message() ) );
		}
		$strategy = self::ai_strategy( $data );
		if ( is_wp_error( $strategy ) ) {
			wp_send_json_error( array( 'message' => $strategy->get_error_message() ) );
		}
		wp_send_json_success( $strategy );
	}
}
