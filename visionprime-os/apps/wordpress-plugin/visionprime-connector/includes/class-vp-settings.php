<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Settings page + storage for the connector. All values live in a single
 * option (`visionprime_connector_settings`) via the WordPress Settings
 * API, with per-field sanitize callbacks. The plugin API key and shared
 * secret are stored here (server-side PHP option storage only) and are
 * read only by VP_Api_Client — never passed to wp_localize_script, never
 * echoed into page markup or enqueued JS.
 */
class VP_Settings {

	const OPTION_KEY    = 'visionprime_connector_settings';
	const OPTION_GROUP  = 'visionprime_connector_settings_group';
	const PAGE_SLUG     = 'visionprime-connector';
	const CAPABILITY    = 'manage_options';

	/** @var array<string, mixed>|null */
	private $cache = null;

	public function register_settings(): void {
		register_setting(
			self::OPTION_GROUP,
			self::OPTION_KEY,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( $this, 'sanitize' ),
				'default'           => $this->defaults(),
			)
		);
	}

	public function register_menu(): void {
		add_options_page(
			__( 'VisionPrime Connector', 'visionprime-connector' ),
			__( 'VisionPrime', 'visionprime-connector' ),
			self::CAPABILITY,
			self::PAGE_SLUG,
			array( $this, 'render_settings_page' )
		);
	}

	/** @return array<string, mixed> */
	public function defaults(): array {
		return array(
			'api_url'                  => '',
			'plugin_api_key'           => '',
			'shared_secret'            => '',
			'enable_wallet'            => true,
			'enable_points'            => false,
			'enable_rewards'           => false,
			'enable_tier'              => false,
			'enable_checkout_wallet'   => false,
			'enable_checkout_rewards'  => false,
			'enable_my_account_tabs'   => true,
			'enable_order_webhooks'    => false,
			'enable_customer_webhooks' => false,
			'debug_mode'               => false,
		);
	}

	/**
	 * @param array<string, mixed> $input
	 * @return array<string, mixed>
	 */
	public function sanitize( $input ): array {
		$input    = is_array( $input ) ? $input : array();
		$existing = $this->all();

		$sanitized = array(
			'api_url'        => isset( $input['api_url'] ) ? sanitize_url( wp_unslash( $input['api_url'] ) ) : $existing['api_url'],
			'plugin_api_key' => isset( $input['plugin_api_key'] ) && '' !== $input['plugin_api_key']
				? sanitize_text_field( wp_unslash( $input['plugin_api_key'] ) )
				: $existing['plugin_api_key'],
			'shared_secret'  => isset( $input['shared_secret'] ) && '' !== $input['shared_secret']
				? sanitize_text_field( wp_unslash( $input['shared_secret'] ) )
				: $existing['shared_secret'],
		);

		foreach ( $this->boolean_keys() as $key ) {
			$sanitized[ $key ] = ! empty( $input[ $key ] );
		}

		return $sanitized;
	}

	/** @return string[] */
	private function boolean_keys(): array {
		return array(
			'enable_wallet',
			'enable_points',
			'enable_rewards',
			'enable_tier',
			'enable_checkout_wallet',
			'enable_checkout_rewards',
			'enable_my_account_tabs',
			'enable_order_webhooks',
			'enable_customer_webhooks',
			'debug_mode',
		);
	}

	/** @return array<string, mixed> */
	public function all(): array {
		if ( null === $this->cache ) {
			$this->cache = wp_parse_args( get_option( self::OPTION_KEY, array() ), $this->defaults() );
		}
		return $this->cache;
	}

	public function get_api_url(): string {
		return (string) $this->all()['api_url'];
	}

	public function get_plugin_api_key(): string {
		return (string) $this->all()['plugin_api_key'];
	}

	public function get_shared_secret(): string {
		return (string) $this->all()['shared_secret'];
	}

	public function is_feature_enabled( string $key ): bool {
		$all = $this->all();
		return ! empty( $all[ $key ] );
	}

	public function is_wallet_enabled(): bool {
		return $this->is_feature_enabled( 'enable_wallet' );
	}

	public function is_points_enabled(): bool {
		return $this->is_feature_enabled( 'enable_points' );
	}

	public function is_rewards_enabled(): bool {
		return $this->is_feature_enabled( 'enable_rewards' );
	}

	public function is_tier_enabled(): bool {
		return $this->is_feature_enabled( 'enable_tier' );
	}

	public function is_checkout_wallet_enabled(): bool {
		return $this->is_feature_enabled( 'enable_checkout_wallet' );
	}

	public function is_checkout_rewards_enabled(): bool {
		return $this->is_feature_enabled( 'enable_checkout_rewards' );
	}

	public function is_my_account_tabs_enabled(): bool {
		return $this->is_feature_enabled( 'enable_my_account_tabs' );
	}

	public function is_order_webhooks_enabled(): bool {
		return $this->is_feature_enabled( 'enable_order_webhooks' );
	}

	public function is_customer_webhooks_enabled(): bool {
		return $this->is_feature_enabled( 'enable_customer_webhooks' );
	}

	public function is_debug_mode_enabled(): bool {
		return $this->is_feature_enabled( 'debug_mode' );
	}

	public function is_configured(): bool {
		return '' !== $this->get_api_url() && '' !== $this->get_plugin_api_key() && '' !== $this->get_shared_secret();
	}

	public function render_settings_page(): void {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			return;
		}

		$values = $this->all();
		?>
		<div class="wrap visionprime-connector-settings">
			<h1><?php esc_html_e( 'VisionPrime Connector', 'visionprime-connector' ); ?></h1>

			<div id="vp-admin-notice" class="vp-admin-notice" style="display:none;"></div>

			<form method="post" action="options.php">
				<?php settings_fields( self::OPTION_GROUP ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="vp_api_url"><?php esc_html_e( 'VisionPrime API URL', 'visionprime-connector' ); ?></label></th>
						<td><input type="url" id="vp_api_url" name="<?php echo esc_attr( self::OPTION_KEY ); ?>[api_url]" value="<?php echo esc_attr( $values['api_url'] ); ?>" class="regular-text" placeholder="https://api.example.com" /></td>
					</tr>
					<tr>
						<th scope="row"><label for="vp_plugin_api_key"><?php esc_html_e( 'Plugin API Key', 'visionprime-connector' ); ?></label></th>
						<td>
							<input type="password" id="vp_plugin_api_key" name="<?php echo esc_attr( self::OPTION_KEY ); ?>[plugin_api_key]" value="" class="regular-text" autocomplete="new-password" placeholder="<?php echo $values['plugin_api_key'] ? esc_attr__( '•••••••• (saved — leave blank to keep)', 'visionprime-connector' ) : ''; ?>" />
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="vp_shared_secret"><?php esc_html_e( 'Shared Secret', 'visionprime-connector' ); ?></label></th>
						<td>
							<input type="password" id="vp_shared_secret" name="<?php echo esc_attr( self::OPTION_KEY ); ?>[shared_secret]" value="" class="regular-text" autocomplete="new-password" placeholder="<?php echo $values['shared_secret'] ? esc_attr__( '•••••••• (saved — leave blank to keep)', 'visionprime-connector' ) : ''; ?>" />
						</td>
					</tr>
					<?php
					$this->render_checkbox_row( 'enable_wallet', __( 'Enable Wallet', 'visionprime-connector' ), $values );
					$this->render_checkbox_row( 'enable_points', __( 'Enable Points', 'visionprime-connector' ), $values );
					$this->render_checkbox_row( 'enable_rewards', __( 'Enable Rewards', 'visionprime-connector' ), $values );
					$this->render_checkbox_row( 'enable_tier', __( 'Enable Tier', 'visionprime-connector' ), $values );
					$this->render_checkbox_row( 'enable_checkout_wallet', __( 'Enable Checkout Wallet', 'visionprime-connector' ), $values );
					$this->render_checkbox_row( 'enable_checkout_rewards', __( 'Enable Checkout Rewards (not yet implemented)', 'visionprime-connector' ), $values, true );
					$this->render_checkbox_row( 'enable_my_account_tabs', __( 'Enable My Account Tabs', 'visionprime-connector' ), $values );
					$this->render_checkbox_row( 'enable_order_webhooks', __( 'Enable Order Webhooks', 'visionprime-connector' ), $values );
					$this->render_checkbox_row( 'enable_customer_webhooks', __( 'Enable Customer Webhooks', 'visionprime-connector' ), $values );
					$this->render_checkbox_row( 'debug_mode', __( 'Debug Mode', 'visionprime-connector' ), $values );
					?>
				</table>
				<?php submit_button( __( 'Save Settings', 'visionprime-connector' ) ); ?>
			</form>

			<hr />

			<h2><?php esc_html_e( 'Connection', 'visionprime-connector' ); ?></h2>
			<p>
				<button type="button" class="button" id="vp-test-connection"><?php esc_html_e( 'Test Connection', 'visionprime-connector' ); ?></button>
				<button type="button" class="button" id="vp-register-webhooks"><?php esc_html_e( 'Register Webhooks', 'visionprime-connector' ); ?></button>
				<button type="button" class="button" id="vp-sync-current-user"><?php esc_html_e( 'Sync Current User', 'visionprime-connector' ); ?></button>
				<button type="button" class="button" id="vp-clear-cache"><?php esc_html_e( 'Clear Cache', 'visionprime-connector' ); ?></button>
				<button type="button" class="button" id="vp-send-test-event"><?php esc_html_e( 'Send Test Event', 'visionprime-connector' ); ?></button>
			</p>
			<div id="vp-connection-result" class="vp-connection-result" aria-live="polite"></div>

			<h2><?php esc_html_e( 'Sync Status', 'visionprime-connector' ); ?></h2>
			<div id="vp-sync-status" class="vp-sync-status" aria-live="polite"><?php esc_html_e( 'Loading…', 'visionprime-connector' ); ?></div>
		</div>
		<?php
	}

	/** @param array<string, mixed> $values */
	private function render_checkbox_row( string $key, string $label, array $values, bool $placeholder_only = false ): void {
		$checked = ! empty( $values[ $key ] );
		?>
		<tr>
			<th scope="row"><?php echo esc_html( $label ); ?></th>
			<td>
				<label>
					<input
						type="checkbox"
						name="<?php echo esc_attr( self::OPTION_KEY ); ?>[<?php echo esc_attr( $key ); ?>]"
						value="1"
						<?php checked( $checked ); ?>
						<?php disabled( $placeholder_only ); ?>
					/>
					<?php esc_html_e( 'Enabled', 'visionprime-connector' ); ?>
				</label>
				<?php if ( $placeholder_only ) : ?>
					<p class="description"><?php esc_html_e( 'Reserved for a future phase. Has no effect yet.', 'visionprime-connector' ); ?></p>
				<?php endif; ?>
			</td>
		</tr>
		<?php
	}
}
