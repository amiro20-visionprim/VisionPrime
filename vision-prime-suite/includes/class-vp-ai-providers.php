<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registry of supported AI providers/models. This plugin is built around a
 * single gateway — OpenRouter — whose keys always look like "sk-or-v1-...".
 * One key unlocks every underlying model (OpenAI, Anthropic, Google, Meta,
 * Mistral, DeepSeek, ...), so there is no "pick the right provider for your
 * key format" step left for the operator to get wrong.
 */
class VP_AI_Providers {

	public static function get_providers() {
		return array(
			'openrouter' => array(
				'label'        => 'OpenRouter (Gateway)',
				'endpoint'     => 'https://openrouter.ai/api/v1/chat/completions',
				'auth_header'  => 'Authorization',
				'auth_prefix'  => 'Bearer ',
				'key_prefix'   => 'sk-or-',
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
		);
	}

	/**
	 * The $key argument is accepted only for call-site backward
	 * compatibility (older settings may still hold a stale provider name
	 * like "openai" from before the OpenRouter-only redesign); since
	 * OpenRouter is the only gateway this plugin talks to, it's always what
	 * gets returned.
	 */
	public static function get_provider( $key = 'openrouter' ) {
		return self::get_providers()['openrouter'];
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
