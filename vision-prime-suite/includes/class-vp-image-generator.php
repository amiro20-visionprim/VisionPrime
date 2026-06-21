<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Generates a unique featured image per article/product via any provider
 * that exposes an image_models list (OpenRouter image models, DALL·E,
 * Stability AI, Imagen). Falls back gracefully if image generation is
 * disabled in settings.
 */
class VP_Image_Generator {

	public function __construct() {
		add_action( 'wp_ajax_vp_generate_image', array( $this, 'ajax_generate' ) );
	}

	public function ajax_generate() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'upload_files' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		if ( ! VP_Settings::get( 'image_generation' ) ) {
			wp_send_json_error( array( 'message' => __( 'تولید تصویر در تنظیمات غیرفعال است.', 'vp-suite' ) ) );
		}

		$prompt = sanitize_text_field( $_POST['prompt'] ?? '' );
		$model  = sanitize_text_field( $_POST['model'] ?? '' );

		$result = self::generate( $prompt, $model );

		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}

		wp_send_json_success( $result );
	}

	public static function generate( $prompt, $model ) {
		$config = VP_AI_Providers::get_provider();
		if ( empty( $config['image_models'] ) ) {
			return new WP_Error( 'vp_no_image_model', __( 'این سرویس از تولید تصویر پشتیبانی نمی‌کند.', 'vp-suite' ) );
		}

		$key = VP_Api_Manager::get_key( 'image' );
		if ( empty( $key ) ) {
			return new WP_Error( 'vp_missing_key', __( 'کلید API تصویر ثبت نشده است.', 'vp-suite' ) );
		}

		$response = wp_remote_post(
			'https://openrouter.ai/api/v1/images/generations',
			array(
				'headers' => array(
					'Authorization' => 'Bearer ' . $key,
					'Content-Type'  => 'application/json',
				),
				'body'    => wp_json_encode(
					array(
						'model'  => $model ?: $config['image_models'][0],
						'prompt' => $prompt,
						'n'      => 1,
						'size'   => '1024x1024',
					)
				),
				'timeout' => 120,
			)
		);

		if ( is_wp_error( $response ) ) {
			VP_Logger::log( 'image_generator', $response->get_error_message(), 'error' );
			return $response;
		}

		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		$url  = $data['data'][0]['url'] ?? null;

		if ( ! $url ) {
			return new WP_Error( 'vp_image_failed', __( 'تولید تصویر ناموفق بود.', 'vp-suite' ) );
		}

		VP_Logger::log( 'image_generator', 'تصویر یونیک تولید شد.', 'info' );

		return array( 'url' => $url );
	}
}
