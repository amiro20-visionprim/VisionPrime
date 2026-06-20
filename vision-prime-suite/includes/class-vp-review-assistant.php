<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Audits existing posts/products and proposes edits (title, SEO, content
 * tightening) that an operator must explicitly approve before anything is
 * changed live — nothing here writes to a post without confirmation.
 */
class VP_Review_Assistant {

	public function __construct() {
		add_action( 'wp_ajax_vp_review_scan', array( $this, 'ajax_scan' ) );
		add_action( 'wp_ajax_vp_review_apply', array( $this, 'ajax_apply' ) );
	}

	public function ajax_scan() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		$post_id = absint( $_POST['post_id'] ?? 0 );
		$post    = get_post( $post_id );
		if ( ! $post ) {
			wp_send_json_error( array( 'message' => __( 'محتوا یافت نشد.', 'vp-suite' ) ) );
		}

		$seo = VP_SEO_Engine::audit( $post->post_content, $post->post_title );
		if ( is_wp_error( $seo ) ) {
			wp_send_json_error( array( 'message' => $seo->get_error_message() ) );
		}

		wp_send_json_success( array( 'suggestions' => $seo ) );
	}

	public function ajax_apply() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_post', absint( $_POST['post_id'] ?? 0 ) ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		$post_id     = absint( $_POST['post_id'] ?? 0 );
		$suggestions = json_decode( wp_unslash( $_POST['suggestions'] ?? '{}' ), true );

		if ( ! $post_id || ! is_array( $suggestions ) ) {
			wp_send_json_error( array( 'message' => __( 'داده نامعتبر.', 'vp-suite' ) ) );
		}

		VP_Rankmath_Sync::apply( $post_id, $suggestions );
		VP_Logger::log( 'review_assistant', "پیشنهادات سئو برای پست #$post_id با تایید اپراتور اعمال شد.", 'info' );

		wp_send_json_success();
	}
}
