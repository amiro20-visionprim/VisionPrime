<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Keyword cannibalization detection — real data, not guessing.
 * Within a single site: uses actual Google Search Console rows (query +
 * page dimensions) to find queries where multiple URLs on the same site
 * are competing for ranking. Across the holding: scans every brand site's
 * published posts (Rank Math focus keyword, or the title as a fallback)
 * to find the same target keyword used on more than one site, so brands
 * aren't unintentionally competing with each other in the SERPs.
 */
class VP_Cannibalization {

	public function __construct() {
		add_action( 'wp_ajax_vp_cannibalization_scan', array( $this, 'ajax_scan' ) );
	}

	public function ajax_scan() {
		check_ajax_referer( 'vp_suite_nonce', 'nonce' );
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_send_json_error( array( 'message' => __( 'دسترسی غیرمجاز.', 'vp-suite' ) ), 403 );
		}

		$days = absint( $_POST['days'] ?? 90 );

		wp_send_json_success(
			array(
				'within_site' => self::detect_within_site( $days ),
				'cross_site'  => self::detect_cross_site(),
			)
		);
	}

	/**
	 * Groups real GSC rows by query and flags any query where 2+ distinct
	 * URLs on this site receive meaningful impressions — a textbook sign
	 * that pages are splitting ranking signal for the same intent.
	 */
	public static function detect_within_site( $days = 90, $min_impr = 10 ) {
		if ( ! class_exists( 'VP_Search_Console' ) || ! VP_Search_Console::is_connected() ) {
			return new WP_Error( 'vp_gsc_not_connected', __( 'برای تشخیص کانیبالیزیشن داخلی، ابتدا به Google Search Console متصل شوید.', 'vp-suite' ) );
		}

		$conn = VP_Search_Console::get_connection();
		if ( empty( $conn['site_url'] ) ) {
			return new WP_Error( 'vp_gsc_no_site', __( 'پراپرتی سرچ کنسول انتخاب نشده است.', 'vp-suite' ) );
		}

		$rows = VP_Search_Console::query_analytics(
			$conn['site_url'],
			array(
				'startDate'  => gmdate( 'Y-m-d', time() - max( 7, $days ) * DAY_IN_SECONDS ),
				'endDate'    => gmdate( 'Y-m-d', time() - DAY_IN_SECONDS ),
				'dimensions' => array( 'query', 'page' ),
				'rowLimit'   => 5000,
			)
		);

		if ( is_wp_error( $rows ) ) {
			return $rows;
		}

		$by_query = array();
		foreach ( $rows as $row ) {
			$impr = (int) ( $row['impressions'] ?? 0 );
			if ( $impr < $min_impr ) {
				continue;
			}

			$query = $row['keys'][0] ?? '';
			$page  = $row['keys'][1] ?? '';
			if ( '' === $query || '' === $page ) {
				continue;
			}

			$by_query[ $query ][ $page ] = array(
				'page'        => $page,
				'impressions' => $impr,
				'clicks'      => (int) ( $row['clicks'] ?? 0 ),
				'position'    => round( $row['position'] ?? 0, 1 ),
			);
		}

		$flagged = array();
		foreach ( $by_query as $query => $pages ) {
			if ( count( $pages ) < 2 ) {
				continue;
			}
			$flagged[] = array(
				'query' => $query,
				'pages' => array_values( $pages ),
			);
		}

		usort(
			$flagged,
			function ( $a, $b ) {
				return count( $b['pages'] ) <=> count( $a['pages'] );
			}
		);

		return $flagged;
	}

	/**
	 * Walks every site in the multisite network and collects each published
	 * post's target keyword (Rank Math focus keyword, falling back to the
	 * title), then flags keywords that show up on more than one brand site.
	 */
	public static function detect_cross_site( $limit_per_site = 300 ) {
		if ( ! is_multisite() ) {
			return array();
		}

		$by_keyword = array();

		foreach ( get_sites( array( 'fields' => 'ids' ) ) as $site_id ) {
			switch_to_blog( $site_id );

			$query = new WP_Query(
				array(
					'post_type'      => array( 'post', 'page', 'product' ),
					'post_status'    => 'publish',
					'posts_per_page' => $limit_per_site,
					'no_found_rows'  => true,
				)
			);

			$site_name = get_bloginfo( 'name' );

			foreach ( $query->posts as $p ) {
				$keyword = get_post_meta( $p->ID, 'rank_math_focus_keyword', true );
				if ( empty( $keyword ) ) {
					$keyword = wp_trim_words( get_the_title( $p ), 4, '' );
				}
				$keyword = trim( mb_strtolower( $keyword ) );
				if ( '' === $keyword ) {
					continue;
				}

				$by_keyword[ $keyword ][] = array(
					'site_id'   => $site_id,
					'site_name' => $site_name,
					'title'     => get_the_title( $p ),
					'url'       => get_permalink( $p ),
				);
			}

			restore_current_blog();
		}

		$flagged = array();
		foreach ( $by_keyword as $keyword => $entries ) {
			$distinct_sites = array_unique( array_column( $entries, 'site_id' ) );
			if ( count( $distinct_sites ) < 2 ) {
				continue;
			}
			$flagged[] = array(
				'keyword' => $keyword,
				'entries' => $entries,
			);
		}

		usort(
			$flagged,
			function ( $a, $b ) {
				return count( $b['entries'] ) <=> count( $a['entries'] );
			}
		);

		return $flagged;
	}
}
