<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Thin accessor over the `vp_suite_settings` option. Every module reads
 * its prompts/toggles through here so the two-textbox prompt strategy
 * (article vs product, plus per-module SEO/competitor prompts) lives in
 * one predictable place.
 */
class VP_Settings {

	const OPTION = 'vp_suite_settings';

	public function __construct() {
		add_action( 'admin_init', array( $this, 'register' ) );
	}

	public function register() {
		register_setting( self::OPTION, self::OPTION );
	}

	public static function all() {
		$defaults = array(
			'shared_api_mode'   => true,
			'default_provider'  => 'openrouter',
			'article_prompt'    => VP_Content_Generator::default_prompt( 'article' ),
			'product_prompt'    => VP_Content_Generator::default_prompt( 'product' ),
			'seo_prompt'        => VP_SEO_Engine::default_prompt(),
			'competitor_prompt' => VP_Competitor_Analysis::default_prompt(),
			'rankmath_sync'     => true,
			'image_generation'  => true,
			'report_recipients' => get_option( 'admin_email' ),
			'log_retention_days' => 90,
			'gsc_client_id'     => '',
			'gsc_client_secret' => '',
			'auto_internal_linking'    => true,
			'auto_external_linking'    => true,
			'auto_social_distribution' => false,
		);

		return wp_parse_args( get_option( self::OPTION, array() ), $defaults );
	}

	public static function get( $key, $default = null ) {
		$all = self::all();
		return isset( $all[ $key ] ) ? $all[ $key ] : $default;
	}

	public static function update( $key, $value ) {
		$all         = self::all();
		$all[ $key ] = $value;
		update_option( self::OPTION, $all );
	}
}
