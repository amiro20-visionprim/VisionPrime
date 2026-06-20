<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Automated pre-publish quality check: broken links, images missing alt
 * text, and thin content. Runs on every publish (gated by the
 * 'pre_publish_qa' setting) and logs findings rather than blocking
 * publishing — the operator already approved the content, so this is a
 * safety net surfaced in the logs, not a hard gate.
 */
class VP_Pre_Publish_QA {

	const MIN_WORDS = 300;

	public static function audit( $content ) {
		return array(
			'broken_links' => self::find_broken_links( $content ),
			'missing_alt'  => self::find_missing_alt( $content ),
			'word_count'   => self::word_count( $content ),
			'thin_content' => self::word_count( $content ) < self::MIN_WORDS,
		);
	}

	public static function run_and_log( $post_id, $content ) {
		$result = self::audit( $content );

		$issues = array();
		if ( $result['broken_links'] ) {
			$issues[] = count( $result['broken_links'] ) . ' لینک شکسته';
		}
		if ( $result['missing_alt'] ) {
			$issues[] = count( $result['missing_alt'] ) . ' تصویر بدون alt';
		}
		if ( $result['thin_content'] ) {
			$issues[] = 'محتوای کم‌حجم (' . $result['word_count'] . ' کلمه)';
		}

		if ( $issues ) {
			VP_Logger::log(
				'pre_publish_qa',
				"هشدار کیفیت برای پست #$post_id: " . implode( '، ', $issues ),
				'warning',
				$result
			);
		} else {
			VP_Logger::log( 'pre_publish_qa', "بررسی کیفیت پست #$post_id بدون ایراد بود.", 'info' );
		}

		return $result;
	}

	private static function find_broken_links( $content ) {
		preg_match_all( '/<a[^>]+href=["\']([^"\']+)["\']/i', $content, $matches );
		$broken = array();

		foreach ( array_unique( $matches[1] ?? array() ) as $url ) {
			if ( 0 !== strpos( $url, 'http' ) ) {
				continue;
			}

			$response = wp_remote_head( $url, array( 'timeout' => 8, 'redirection' => 3 ) );
			if ( is_wp_error( $response ) ) {
				$broken[] = array( 'url' => $url, 'error' => $response->get_error_message() );
				continue;
			}

			$code = wp_remote_retrieve_response_code( $response );
			if ( $code >= 400 ) {
				$broken[] = array( 'url' => $url, 'code' => $code );
			}
		}

		return $broken;
	}

	private static function find_missing_alt( $content ) {
		preg_match_all( '/<img[^>]*>/i', $content, $matches );
		$missing = array();

		foreach ( $matches[0] ?? array() as $tag ) {
			if ( ! preg_match( '/alt=["\'][^"\']+["\']/i', $tag ) ) {
				$missing[] = $tag;
			}
		}

		return $missing;
	}

	private static function word_count( $content ) {
		return count( preg_split( '/\s+/u', trim( wp_strip_all_tags( $content ) ), -1, PREG_SPLIT_NO_EMPTY ) );
	}
}
