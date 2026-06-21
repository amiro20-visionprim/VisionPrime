<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registry of supported AI providers/models. OpenRouter is treated as a
 * single gateway that exposes many underlying models, so switching models
 * for OpenRouter is just a dropdown — no separate key per model needed.
 * Direct provider integrations are kept for holdings that prefer to bypass
 * OpenRouter for a specific vendor.
 */
class VP_AI_Providers {

	public static function get_providers() {
		return array(
			'openrouter' => array(
				'label'        => 'OpenRouter (Gateway)',
				'endpoint'     => 'https://openrouter.ai/api/v1/chat/completions',
				'auth_header'  => 'Authorization',
				'auth_prefix'  => 'Bearer ',
				'models'       => array(
					'openai/gpt-4o',
					'openai/gpt-4o-mini',
					'anthropic/claude-3.7-sonnet',
					'anthropic/claude-3.5-haiku',
					'google/gemini-2.0-pro',
					'google/gemini-2.0-flash',
					'meta-llama/llama-3.3-70b-instruct',
					'mistralai/mistral-large',
					'mistralai/mixtral-8x22b-instruct',
					'deepseek/deepseek-chat',
					'deepseek/deepseek-r1',
					'qwen/qwen-2.5-72b-instruct',
					'cohere/command-r-plus',
					'x-ai/grok-2',
					'perplexity/sonar-large',
				),
				'image_models' => array(
					'openai/dall-e-3',
					'stability-ai/sdxl',
					'google/imagen-3',
				),
			),
			'openai'      => array(
				'label'       => 'OpenAI (Direct)',
				'endpoint'    => 'https://api.openai.com/v1/chat/completions',
				'auth_header' => 'Authorization',
				'auth_prefix' => 'Bearer ',
				'models'      => array( 'gpt-4o', 'gpt-4o-mini' ),
				'image_models' => array( 'dall-e-3' ),
			),
			'anthropic'   => array(
				'label'       => 'Anthropic (Direct)',
				'endpoint'    => 'https://api.anthropic.com/v1/messages',
				'auth_header' => 'x-api-key',
				'auth_prefix' => '',
				// Anthropic's "-latest" aliases always resolve to the newest
				// snapshot of that model line, so this list never goes stale.
				'models'      => array( 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest' ),
				'image_models' => array(),
			),
			'google'      => array(
				'label'       => 'Google Gemini (Direct)',
				'endpoint'    => 'https://generativelanguage.googleapis.com/v1beta/models',
				'auth_header' => 'x-goog-api-key',
				'auth_prefix' => '',
				'models'      => array( 'gemini-2.0-flash', 'gemini-1.5-pro' ),
				'image_models' => array( 'imagen-3' ),
			),
			'stability'   => array(
				'label'       => 'Stability AI (Direct - Images)',
				'endpoint'    => 'https://api.stability.ai/v2beta/stable-image/generate/sd3',
				'auth_header' => 'Authorization',
				'auth_prefix' => 'Bearer ',
				'models'      => array(),
				'image_models' => array( 'sd3', 'sdxl' ),
			),
		);
	}

	public static function get_provider( $key ) {
		$providers = self::get_providers();
		return isset( $providers[ $key ] ) ? $providers[ $key ] : null;
	}

	public static function all_models() {
		$models = array();
		foreach ( self::get_providers() as $key => $provider ) {
			foreach ( $provider['models'] as $model ) {
				$models[] = array(
					'provider' => $key,
					'model'    => $model,
					'label'    => $provider['label'] . ' — ' . $model,
				);
			}
		}
		return $models;
	}
}
