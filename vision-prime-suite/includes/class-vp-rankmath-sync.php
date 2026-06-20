<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Writes VP_SEO_Engine output into every Rank Math meta field so nothing
 * is left blank: focus keyword, title, description, social/OG fields,
 * pillar/cornerstone flag, and the score field itself.
 */
class VP_Rankmath_Sync {

	public function __construct() {
		add_action( 'admin_notices', array( $this, 'maybe_warn_missing' ) );
	}

	public static function is_active() {
		return defined( 'RANK_MATH_VERSION' ) || class_exists( 'RankMath' );
	}

	public function maybe_warn_missing() {
		if ( ! self::is_active() && VP_Settings::get( 'rankmath_sync' ) && current_user_can( 'manage_options' ) ) {
			$screen = get_current_screen();
			if ( $screen && false !== strpos( $screen->id, 'vp-suite' ) ) {
				echo '<div class="notice notice-warning"><p>' .
					esc_html__( 'افزونه Rank Math نصب/فعال نیست. سینک خودکار غیرفعال است تا زمان نصب آن.', 'vp-suite' ) .
					'</p></div>';
			}
		}
	}

	public static function apply( $post_id, $seo_data ) {
		if ( ! self::is_active() ) {
			return false;
		}

		$map = array(
			'rank_math_focus_keyword'    => $seo_data['focus_keyword'] ?? '',
			'rank_math_title'            => $seo_data['meta_title'] ?? '',
			'rank_math_description'      => $seo_data['meta_description'] ?? '',
			'rank_math_facebook_title'   => $seo_data['meta_title'] ?? '',
			'rank_math_facebook_description' => $seo_data['meta_description'] ?? '',
			'rank_math_twitter_title'    => $seo_data['meta_title'] ?? '',
			'rank_math_twitter_description' => $seo_data['meta_description'] ?? '',
			'rank_math_seo_score'        => $seo_data['seo_score'] ?? '',
			'rank_math_pillar_content'   => ! empty( $seo_data['is_pillar'] ) ? 'on' : '',
		);

		foreach ( $map as $meta_key => $value ) {
			if ( '' !== $value ) {
				update_post_meta( $post_id, $meta_key, $value );
			}
		}

		if ( ! empty( $seo_data['slug'] ) ) {
			wp_update_post( array( 'ID' => $post_id, 'post_name' => sanitize_title( $seo_data['slug'] ) ) );
		}

		VP_Logger::log( 'rankmath_sync', "فیلدهای Rank Math برای پست #$post_id بروزرسانی شد.", 'info' );

		return true;
	}
}
