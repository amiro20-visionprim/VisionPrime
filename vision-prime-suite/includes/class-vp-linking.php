<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Real (not AI-guessed) internal linking within a brand site, plus
 * cross-brand linking between the holding's other multisite sites.
 * Both use WordPress's own search index, so suggestions always point to
 * content that actually exists. Runs automatically on publish (gated by
 * settings toggles) and is also exposed via AJAX for manual review.
 */
class VP_Linking {

	public function __construct() {
		add_action( 'wp_ajax_vp_linking_scan', array( $this, 'ajax_scan' ) );
	}

	public function ajax_scan() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		$keyword = sanitize_text_field( $_POST['keyword'] ?? '' );
		$post_id = absint( $_POST['post_id'] ?? 0 );

		if ( empty( $keyword ) ) {
			wp_send_json_error( array( 'message' => __( 'کلمه‌ی کلیدی الزامی است.', 'vp-suite' ) ) );
		}

		wp_send_json_success( self::suggest( $keyword, $post_id ) );
	}

	public static function suggest( $keyword, $exclude_post_id = 0 ) {
		return array(
			'internal' => self::internal_candidates( $keyword, $exclude_post_id ),
			'external' => self::external_candidates( $keyword ),
		);
	}

	public static function internal_candidates( $keyword, $exclude_post_id = 0, $limit = 6 ) {
		$query = new WP_Query(
			array(
				's'              => $keyword,
				'post_type'      => array( 'post', 'page', 'product' ),
				'post_status'    => 'publish',
				'posts_per_page' => $limit,
				'post__not_in'   => $exclude_post_id ? array( $exclude_post_id ) : array(),
				'no_found_rows'  => true,
			)
		);

		$out = array();
		foreach ( $query->posts as $p ) {
			$out[] = array(
				'post_id' => $p->ID,
				'title'   => get_the_title( $p ),
				'url'     => get_permalink( $p ),
			);
		}
		return $out;
	}

	/**
	 * Searches every other site in the multisite network for posts
	 * matching the keyword, so an article on one brand can link out to
	 * relevant content on a sibling brand within the same holding.
	 */
	public static function external_candidates( $keyword, $limit_per_site = 2, $limit_total = 6 ) {
		if ( ! is_multisite() ) {
			return array();
		}

		$out     = array();
		$current = get_current_blog_id();

		foreach ( get_sites( array( 'fields' => 'ids' ) ) as $site_id ) {
			if ( (int) $site_id === (int) $current ) {
				continue;
			}

			switch_to_blog( $site_id );

			$query = new WP_Query(
				array(
					's'              => $keyword,
					'post_type'      => array( 'post', 'page', 'product' ),
					'post_status'    => 'publish',
					'posts_per_page' => $limit_per_site,
					'no_found_rows'  => true,
				)
			);

			foreach ( $query->posts as $p ) {
				$out[] = array(
					'site_id'   => $site_id,
					'site_name' => get_bloginfo( 'name' ),
					'title'     => get_the_title( $p ),
					'url'       => get_permalink( $p ),
				);
			}

			restore_current_blog();

			if ( count( $out ) >= $limit_total ) {
				break;
			}
		}

		return array_slice( $out, 0, $limit_total );
	}

	/**
	 * Builds a "related reading" HTML block to append to post content.
	 * Appending a block (rather than rewriting inline anchor text) keeps
	 * the original AI-written prose intact while still adding real,
	 * existing-content links — internal and/or cross-brand.
	 */
	public static function build_links_block( $keyword, $exclude_post_id = 0 ) {
		$settings = VP_Settings::all();
		$html     = '';

		if ( ! empty( $settings['auto_internal_linking'] ) ) {
			$internal = self::internal_candidates( $keyword, $exclude_post_id, 4 );
			if ( $internal ) {
				$html .= '<div class="vp-related-links vp-related-internal"><h4>' . esc_html__( 'مطالب مرتبط', 'vp-suite' ) . '</h4><ul>';
				foreach ( $internal as $item ) {
					$html .= '<li><a href="' . esc_url( $item['url'] ) . '">' . esc_html( $item['title'] ) . '</a></li>';
				}
				$html .= '</ul></div>';
			}
		}

		if ( ! empty( $settings['auto_external_linking'] ) && is_multisite() ) {
			$external = self::external_candidates( $keyword, 2, 4 );
			if ( $external ) {
				$html .= '<div class="vp-related-links vp-related-external"><h4>' . esc_html__( 'از مجموعه‌ی ویژن پرایم', 'vp-suite' ) . '</h4><ul>';
				foreach ( $external as $item ) {
					$html .= '<li><a href="' . esc_url( $item['url'] ) . '" target="_blank" rel="noopener">' . esc_html( $item['site_name'] . ': ' . $item['title'] ) . '</a></li>';
				}
				$html .= '</ul></div>';
			}
		}

		return $html;
	}

	/**
	 * Appends the related-links block to a published post's content, if
	 * either linking toggle is enabled. Safe to call repeatedly: it skips
	 * if a block was already appended.
	 */
	public static function apply_to_post( $post_id, $keyword ) {
		$post = get_post( $post_id );
		if ( ! $post || false !== strpos( $post->post_content, 'vp-related-links' ) ) {
			return;
		}

		$block = self::build_links_block( $keyword, $post_id );
		if ( ! $block ) {
			return;
		}

		wp_update_post(
			array(
				'ID'           => $post_id,
				'post_content' => $post->post_content . $block,
			)
		);

		VP_Logger::log( 'linking', "لینک‌سازی داخلی/بین‌برندی برای پست #$post_id اعمال شد.", 'info' );
	}
}
