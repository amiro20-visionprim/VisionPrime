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

	const AUTO_BATCH_SIZE = 3;
	const META_HASH       = '_vp_review_hash';
	const META_REVIEWED   = '_vp_review_last';

	public function __construct() {
		add_action( 'wp_ajax_vp_review_scan', array( $this, 'ajax_scan' ) );
		add_action( 'wp_ajax_vp_review_apply', array( $this, 'ajax_apply' ) );
	}

	public static function default_restructure_prompt() {
		return 'تو یک ویراستار ارشد محتوای فارسی هستی. ساختار HTML محتوای زیر را یک‌دست و استاندارد کن: تیترهای H2/H3 منطقی، پاراگراف‌های کوتاه و خوانا، بولت/لیست در جای مناسب، حذف تکرار و پرحرفی، بدون تغییر در واقعیت‌ها یا حذف اطلاعات مهم. فقط HTML نهایی را برگردان، بدون توضیح اضافه.';
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

	/**
	 * Automatic review entry point, run from VP_Cron. Walks a small batch of
	 * published posts/products (across every site on a multisite network)
	 * that haven't been reviewed under the *current* settings yet — tracked
	 * via a hash of the active prompts/toggles, so re-running after the
	 * operator edits the restructure prompt picks every post back up,
	 * including old/legacy content. Each enabled sub-pass runs
	 * independently and failures in one don't block the others.
	 */
	public static function run_auto_review() {
		if ( ! VP_Settings::get( 'review_auto_enabled' ) ) {
			return 0;
		}

		if ( is_multisite() ) {
			$count = 0;
			foreach ( get_sites( array( 'fields' => 'ids' ) ) as $site_id ) {
				switch_to_blog( $site_id );
				$count += self::process_site_batch();
				restore_current_blog();
			}
			return $count;
		}

		return self::process_site_batch();
	}

	private static function process_site_batch() {
		$hash = self::current_settings_hash();

		$posts = get_posts(
			array(
				'post_type'      => array( 'post', 'product' ),
				'post_status'    => 'publish',
				'posts_per_page' => self::AUTO_BATCH_SIZE,
				'meta_query'     => array(
					'relation' => 'OR',
					array( 'key' => self::META_HASH, 'compare' => 'NOT EXISTS' ),
					array( 'key' => self::META_HASH, 'value' => $hash, 'compare' => '!=' ),
				),
			)
		);

		$count = 0;
		foreach ( $posts as $post ) {
			self::review_post( $post, $hash );
			$count++;
		}

		return $count;
	}

	private static function current_settings_hash() {
		return md5( wp_json_encode( array(
			VP_Settings::get( 'review_restructure_prompt' ),
			VP_Settings::get( 'review_technical_enabled' ),
			VP_Settings::get( 'review_auto_categorize' ),
		) ) );
	}

	private static function review_post( $post, $hash ) {
		$content = $post->post_content;
		$changed = false;

		$restructure_prompt = VP_Settings::get( 'review_restructure_prompt' );
		if ( ! empty( $restructure_prompt ) ) {
			$result = self::restructure_content( $content, $restructure_prompt );
			if ( ! is_wp_error( $result ) && trim( $result ) !== '' ) {
				$content = $result;
				$changed = true;
			}
		}

		if ( VP_Settings::get( 'review_technical_enabled' ) ) {
			$fixed = self::technical_fix_pass( $content );
			if ( $fixed !== $content ) {
				$content = $fixed;
				$changed = true;
			}
		}

		if ( $changed ) {
			wp_update_post( array( 'ID' => $post->ID, 'post_content' => $content ) );
		}

		if ( VP_Settings::get( 'review_auto_categorize' ) && 'post' === $post->post_type ) {
			self::auto_categorize( $post );
		}

		update_post_meta( $post->ID, self::META_HASH, $hash );
		update_post_meta( $post->ID, self::META_REVIEWED, current_time( 'mysql' ) );

		VP_Logger::log( 'review_assistant', "بازبینی خودکار برای پست #{$post->ID} اجرا شد" . ( $changed ? ' (محتوا یک‌دست‌سازی شد)' : '' ) . '.', 'info' );
	}

	/**
	 * Restructures HTML body content per the operator's editable prompt.
	 * Used both by automatic review and (potentially) as a re-runnable
	 * standardization pass over old content whenever the prompt changes.
	 */
	public static function restructure_content( $content, $prompt = null ) {
		$prompt   = $prompt ?? VP_Settings::get( 'review_restructure_prompt' );
		$provider = VP_Settings::get( 'default_provider' );
		$model    = VP_AI_Providers::get_provider( $provider )['models'][0] ?? '';

		$messages = array(
			array( 'role' => 'system', 'content' => $prompt ),
			array( 'role' => 'user', 'content' => $content ),
		);

		return VP_Api_Manager::chat_with_fallback( 'content', $messages, $provider, $model );
	}

	/**
	 * Detects and fixes human-introduced technical issues: strips anchors
	 * whose href is actually broken (keeping the link text so no
	 * information is lost) and fills in missing image alt text using the
	 * image's filename/context as a real signal, never invented captions.
	 */
	public static function technical_fix_pass( $content ) {
		$audit = VP_Pre_Publish_QA::audit( $content );

		foreach ( $audit['broken_links'] as $broken ) {
			$url = $broken['url'];
			$content = preg_replace(
				'/<a[^>]+href=["\']' . preg_quote( $url, '/' ) . '["\'][^>]*>(.*?)<\/a>/is',
				'$1',
				$content
			);
		}

		foreach ( $audit['missing_alt'] as $tag ) {
			if ( preg_match( '/src=["\']([^"\']+)["\']/i', $tag, $m ) ) {
				$filename = pathinfo( wp_parse_url( $m[1], PHP_URL_PATH ), PATHINFO_FILENAME );
				$alt      = trim( str_replace( array( '-', '_' ), ' ', $filename ) );
				if ( '' === $alt ) {
					continue;
				}
				$new_tag = preg_match( '/\/>$/', $tag )
					? rtrim( $tag, '/> ' ) . ' alt="' . esc_attr( $alt ) . '" />'
					: rtrim( $tag, '> ' ) . ' alt="' . esc_attr( $alt ) . '">';
				$content = str_replace( $tag, $new_tag, $content );
			}
		}

		return $content;
	}

	/**
	 * Auto-categorizes a post into one of the site's REAL, already-existing
	 * categories (never invents new ones). Asks the AI to pick the single
	 * best match from the actual category list; if its answer doesn't
	 * match a real category exactly, nothing changes.
	 */
	public static function auto_categorize( $post ) {
		$categories = get_categories( array( 'hide_empty' => false ) );
		if ( empty( $categories ) ) {
			return false;
		}

		$names = wp_list_pluck( $categories, 'name' );

		$provider = VP_Settings::get( 'default_provider' );
		$model    = VP_AI_Providers::get_provider( $provider )['models'][0] ?? '';

		$messages = array(
			array(
				'role'    => 'system',
				'content' => 'فقط نام دقیق یکی از دسته‌بندی‌های زیر را، بدون هیچ توضیح اضافه، برگردان. اگر هیچ‌کدام مرتبط نبود، فقط بنویس: هیچکدام.',
			),
			array(
				'role'    => 'user',
				'content' => "دسته‌بندی‌های موجود سایت:\n" . implode( "\n", $names ) . "\n\nعنوان: {$post->post_title}\nخلاصه‌ی محتوا: " . wp_trim_words( wp_strip_all_tags( $post->post_content ), 80 ),
			),
		);

		$raw = VP_Api_Manager::chat_with_fallback( 'content', $messages, $provider, $model );
		if ( is_wp_error( $raw ) ) {
			return false;
		}

		$choice = trim( $raw );
		foreach ( $categories as $cat ) {
			if ( 0 === strcasecmp( trim( $cat->name ), $choice ) ) {
				wp_set_post_categories( $post->ID, array( $cat->term_id ), false );
				VP_Logger::log( 'review_assistant', "دسته‌بندی پست #{$post->ID} به «{$cat->name}» (دسته‌ی واقعی موجود سایت) تنظیم شد.", 'info' );
				return true;
			}
		}

		return false;
	}
}
