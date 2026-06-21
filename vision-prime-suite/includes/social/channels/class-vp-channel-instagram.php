<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once VP_SUITE_DIR . 'includes/social/channels/class-vp-channel-base.php';

/**
 * Real Instagram publishing via the Meta Graph API (Business/Creator
 * account linked to a Facebook Page). Instagram's content-publish API is
 * media-first: every post needs a public image URL, so this channel
 * resolves one from the post linked in the message (its featured image)
 * or a configured fallback, then does the official two-step container
 * flow: create media container -> publish container.
 *
 * account->config expects JSON:
 * {"ig_user_id":"...", "access_token":"...", "default_image_url":"..."}
 *
 * Setup (one-time, per holding brand's Instagram Business account):
 * 1. Convert the Instagram account to Business/Creator and link a Facebook Page.
 * 2. Create a Meta App, add the Instagram Graph API product.
 * 3. Request instagram_basic + instagram_content_publish + pages_show_list
 *    permissions (App Review required for production use beyond test users).
 * 4. Generate a long-lived Page access token and the IG Business account id.
 */
class VP_Channel_Instagram extends VP_Channel_Base {

	const API_BASE = 'https://graph.facebook.com/v19.0';

	public function get_key() {
		return 'instagram';
	}

	public function get_label() {
		return 'اینستاگرام';
	}

	public function send( $account, $message ) {
		$config       = json_decode( $account->config, true );
		$ig_user_id   = $config['ig_user_id'] ?? '';
		$access_token = $config['access_token'] ?? '';

		if ( empty( $ig_user_id ) || empty( $access_token ) ) {
			return new WP_Error( 'vp_instagram_config', __( 'ig_user_id و access_token باید در تنظیمات حساب اینستاگرام ثبت شوند.', 'vp-suite' ) );
		}

		$image_url = $this->resolve_image_url( $message, $config );
		if ( empty( $image_url ) ) {
			return new WP_Error( 'vp_instagram_no_image', __( 'اینستاگرام برای انتشار نیاز به تصویر دارد؛ تصویر شاخص پست یافت نشد و default_image_url هم تنظیم نشده.', 'vp-suite' ) );
		}

		$caption = wp_strip_all_tags( $message );

		$container = wp_remote_post(
			self::API_BASE . "/{$ig_user_id}/media",
			array(
				'timeout' => 30,
				'body'    => array(
					'image_url'    => $image_url,
					'caption'      => $caption,
					'access_token' => $access_token,
				),
			)
		);

		if ( is_wp_error( $container ) ) {
			return $container;
		}

		$container_data = json_decode( wp_remote_retrieve_body( $container ), true );
		if ( empty( $container_data['id'] ) ) {
			return new WP_Error( 'vp_instagram_container_failed', $container_data['error']['message'] ?? __( 'ساخت کانتینر رسانه ناموفق بود.', 'vp-suite' ) );
		}

		$publish = wp_remote_post(
			self::API_BASE . "/{$ig_user_id}/media_publish",
			array(
				'timeout' => 30,
				'body'    => array(
					'creation_id'  => $container_data['id'],
					'access_token' => $access_token,
				),
			)
		);

		if ( is_wp_error( $publish ) ) {
			return $publish;
		}

		$publish_data = json_decode( wp_remote_retrieve_body( $publish ), true );
		if ( empty( $publish_data['id'] ) ) {
			return new WP_Error( 'vp_instagram_publish_failed', $publish_data['error']['message'] ?? __( 'انتشار پست اینستاگرام ناموفق بود.', 'vp-suite' ) );
		}

		return array( 'media_id' => $publish_data['id'] );
	}

	public function get_stats( $account ) {
		$config       = json_decode( $account->config, true );
		$ig_user_id   = $config['ig_user_id'] ?? '';
		$access_token = $config['access_token'] ?? '';

		if ( empty( $ig_user_id ) || empty( $access_token ) ) {
			return array();
		}

		$response = wp_remote_get(
			self::API_BASE . "/{$ig_user_id}/insights?metric=impressions,reach,profile_views&period=day&access_token=" . rawurlencode( $access_token )
		);

		if ( is_wp_error( $response ) ) {
			return array();
		}

		$data       = json_decode( wp_remote_retrieve_body( $response ), true );
		$engagement = 0;
		foreach ( $data['data'] ?? array() as $metric ) {
			$engagement += (int) ( $metric['values'][0]['value'] ?? 0 );
		}

		return array( 'engagement' => $engagement );
	}

	/**
	 * Tries to find a usable public image: first the featured image of any
	 * post URL embedded in the message (the normal case when called from
	 * auto-distribute-on-publish), then the account's configured fallback.
	 */
	private function resolve_image_url( $message, $config ) {
		if ( preg_match( '#https?://\S+#', $message, $m ) ) {
			$post_id = url_to_postid( $m[0] );
			if ( $post_id && has_post_thumbnail( $post_id ) ) {
				$url = get_the_post_thumbnail_url( $post_id, 'large' );
				if ( $url ) {
					return $url;
				}
			}
		}

		return $config['default_image_url'] ?? '';
	}

	public function get_required_fields() {
		return array(
			array( 'key' => 'ig_user_id', 'label' => 'شناسه حساب اینستاگرام Business (IG User ID)', 'type' => 'text', 'placeholder' => '1784...' ),
			array( 'key' => 'access_token', 'label' => 'توکن دسترسی صفحه (Page Access Token)', 'type' => 'password', 'placeholder' => 'EAAB...' ),
			array( 'key' => 'default_image_url', 'label' => 'تصویر پیش‌فرض (در صورت نبود تصویر شاخص)', 'type' => 'text', 'placeholder' => 'https://example.com/default.jpg' ),
		);
	}

	public function get_notes() {
		return array(
			'باید: حساب اینستاگرام را به Business/Creator تبدیل و به یک صفحه فیسبوک متصل کنید.',
			'باید: مجوزهای instagram_content_publish و pages_show_list را در اپ متا فعال کنید.',
			'نباید: از توکن کوتاه‌مدت استفاده کنید؛ توکن طولانی‌مدت (long-lived) لازم است.',
			'نباید: انتظار انتشار بدون تصویر را داشته باشید — اینستاگرام بدون عکس پست منتشر نمی‌کند.',
		);
	}

	public function test_connection( $account ) {
		$config       = json_decode( $account->config, true );
		$ig_user_id   = $config['ig_user_id'] ?? '';
		$access_token = $config['access_token'] ?? '';

		if ( empty( $ig_user_id ) || empty( $access_token ) ) {
			return new WP_Error( 'vp_instagram_config', __( 'ig_user_id و access_token باید تنظیم شوند.', 'vp-suite' ) );
		}

		$response = wp_remote_get(
			self::API_BASE . "/{$ig_user_id}?fields=username&access_token=" . rawurlencode( $access_token ),
			array( 'timeout' => 15 )
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( empty( $data['username'] ) ) {
			return new WP_Error( 'vp_instagram_test_failed', $data['error']['message'] ?? __( 'احراز هویت اینستاگرام ناموفق بود.', 'vp-suite' ) );
		}

		return true;
	}
}
