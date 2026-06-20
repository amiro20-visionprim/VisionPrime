<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Adds a "VisionPrime SEO" meta box to the post/product editor so an
 * operator can run the deep SEO audit and push every field into Rank Math
 * without leaving the edit screen — the one-click sync the brief asks for.
 */
class VP_SEO_Metabox {

	public function __construct() {
		add_action( 'add_meta_boxes', array( $this, 'register' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	public function register() {
		$post_types = array( 'post' );
		if ( post_type_exists( 'product' ) ) {
			$post_types[] = 'product';
		}

		foreach ( $post_types as $post_type ) {
			add_meta_box(
				'vp_seo_metabox',
				'سئوی VisionPrime',
				array( $this, 'render' ),
				$post_type,
				'side',
				'high'
			);
		}
	}

	public function enqueue( $hook ) {
		if ( ! in_array( $hook, array( 'post.php', 'post-new.php' ), true ) ) {
			return;
		}

		wp_enqueue_script( 'vp-suite-metabox', VP_SUITE_URL . 'admin/assets/js/metabox.js', array( 'jquery' ), VP_SUITE_VERSION, true );
		wp_localize_script(
			'vp-suite-metabox',
			'VPSeoBox',
			array(
				'ajaxUrl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'vp_suite_nonce' ),
			)
		);
	}

	public function render( $post ) {
		$rankmath = VP_Rankmath_Sync::is_active();
		?>
		<div class="vp-seo-box" data-post-id="<?php echo esc_attr( $post->ID ); ?>">
			<p>
				<?php if ( $rankmath ) : ?>
					<span style="color:#166534;">Rank Math متصل است؛ نتایج مستقیم سینک می‌شوند.</span>
				<?php else : ?>
					<span style="color:#92400e;">Rank Math فعال نیست — تحلیل نمایش داده می‌شود ولی سینک انجام نمی‌شود.</span>
				<?php endif; ?>
			</p>
			<button type="button" class="button button-primary" id="vp-seo-run">تحلیل و سینک سئو</button>
			<div id="vp-seo-output" style="margin-top:10px;font-size:12px;"></div>
		</div>
		<?php
	}
}
