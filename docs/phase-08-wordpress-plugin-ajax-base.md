# Phase 08 — WordPress Plugin: Fully AJAX-Based Connector & Customer Account Display Layer

Status: **Complete**

## Scope

Builds the base WordPress plugin (`visionprime-connector`) and the
backend's plugin-facing API it talks to. The plugin is a connector +
read-only customer account display layer only:

- No checkout wallet/reward integration this phase (settings exist as
  inert placeholders for a future phase).
- No reward claim/redeem this phase (rewards is a static `{enabled:
  false}` placeholder end-to-end, same shape the rest of the system
  uses until the rewards module ships).
- No secrets (plugin API key, shared secret) are ever exposed to
  JavaScript, enqueued scripts, or page markup.
- Every plugin action — settings-page admin tools, My Account tabs,
  shortcodes — is AJAX-driven; nothing causes a full page reload or
  form POST.

## 1. Backend: Plugin API (`apps/api/src/modules/wp-plugin`)

Six GET-only endpoints, mounted at `/api/wp-plugin`:

- `GET /customer/me`
- `GET /customer/dashboard`
- `GET /customer/wallet`
- `GET /customer/points`
- `GET /customer/rewards`
- `GET /customer/tier`

### Authentication (`wp-plugin.middleware.ts`)

Every request must carry:

- `X-VP-Plugin-Api-Key` — verified against the WordPress connection's
  `plugin_api_key_hash` (scrypt, via the existing `verifyPluginApiKey`
  helper from Phase 04).
- `X-VP-Timestamp` / `X-VP-Signature` — HMAC-SHA256 over
  `${method}:${path}:${timestamp}` using the connection's decrypted
  shared secret, where `path` is relative to the `/api/wp-plugin`
  mount (e.g. `/customer/wallet`). Requests outside a 5-minute drift
  window are rejected.
- `X-VP-Wp-User-Id` (+ optional `X-VP-Wp-User-Email`/`-Name`) —
  identifies the WordPress user making the request.

On success, the WordPress user is resolved to a VisionPrime customer
via `customersRepository.findByMatchPriority({ wordpressUserId, email
})`, auto-provisioning a new customer record on first contact. The
resolved id is attached to `req.vpCustomerId` for the controller layer.
Any failure (missing header, bad key, bad signature, stale timestamp)
returns a generic `401 PLUGIN_AUTH_FAILED` — never a hint about which
check failed.

### Service / Controller

`WpPluginService` exposes `getMe`, `getWallet` (delegates to the
existing `WalletService.getWalletSummary`), `getPoints`/`getRewards`/
`getTier` (static disabled placeholders — no points/rewards/tier
modules exist yet), and `getDashboard` (aggregates all of the above).
`createWpPluginRouter` wires `requirePluginAuth` ahead of all six
routes.

### Tests

`wp-plugin.controller.spec.ts` (10 tests): WP user resolves to a
customer profile; repeat calls from the same WP user map to the same
customer (no duplicates); linking by `wordpress_user_id` finds an
existing customer instead of creating one; wallet/points/rewards/
dashboard shapes; missing headers / invalid API key / invalid
signature all return 401.

`build-test-app.ts` now unconditionally seeds a plugin API key hash +
shared secret on the in-memory WordPress connection so every test can
authenticate, and exports `TEST_PLUGIN_API_KEY`/
`TEST_PLUGIN_SHARED_SECRET` for building signed request headers.

## 2. WordPress Plugin (`apps/wordpress-plugin/visionprime-connector`)

```
visionprime-connector.php
includes/
  class-vp-logger.php
  class-vp-settings.php
  class-vp-auth.php
  class-vp-api-client.php
  class-vp-ajax.php
  class-vp-shortcodes.php
  class-vp-my-account.php
  class-vp-checkout.php        (placeholder only)
  class-vp-webhooks.php
  class-vp-woocommerce-hooks.php
  class-vp-loader.php
assets/js/visionprime-public.js
assets/js/visionprime-admin.js
assets/css/visionprime-public.css
assets/css/visionprime-admin.css
```

The bootstrap file constructs every collaborator via the constructor
and hands them to `VP_Loader`, the only class that calls
`add_action`/`add_filter` — every other class exposes a `register()`
method the loader calls, keeping wiring auditable in one place.

### Settings (Settings API, single option)

VisionPrime API URL, Plugin API Key, Shared Secret, Enable Wallet,
Enable Points, Enable Rewards, Enable Tier, Enable Checkout Wallet
(placeholder, always disabled in the UI), Enable Checkout Rewards
(placeholder, always disabled), Enable My Account Tabs, Enable Order
Webhooks, Enable Customer Webhooks, Debug Mode.

The API key and shared secret inputs are `type="password"`, rendered
blank with a "saved — leave blank to keep" placeholder when already
set, and re-saving the form without touching them preserves the
existing stored value (the sanitize callback only overwrites a secret
when the submitted value is non-empty). They are read only by
`VP_Api_Client` server-side and never reach `wp_localize_script` or
page markup.

### Server-to-server client (`VP_Api_Client`)

Signs every request with the same HMAC scheme the backend verifies,
sends the current WordPress user's identity headers (built by
`VP_Auth::current_user_identity_headers()`), and never surfaces a raw
backend error to the caller — every non-2xx/network failure is mapped
to one of a small set of friendly messages via
`friendly_message_for_status()`. GET responses are cached in a 30s
per-user transient (tracked in a registry option so "Clear Cache" can
actually find and delete them, since transients aren't otherwise
enumerable).

### AJAX (`VP_Ajax`, nonce + capability/login gated via `VP_Auth`)

Admin actions (`vp_admin_ajax` nonce + `current_user_can`):
`vp_test_connection`, `vp_register_webhooks`, `vp_sync_current_user`,
`vp_clear_cache`, `vp_send_test_event`, `vp_get_sync_status`.

Customer actions (`vp_customer_ajax` nonce + `is_user_logged_in`):
`vp_get_customer_dashboard`, `vp_get_wallet`, `vp_get_points`,
`vp_get_rewards`, `vp_get_tier`, `vp_refresh_account_data` (takes a
`component` param and re-fetches only that one component, bypassing
the cache — never a full-page refresh).

Every handler verifies the nonce and capability/login state before
touching anything else, sanitizes any input it reads, and replies only
via `wp_send_json_success`/`wp_send_json_error` — no raw PHP error or
backend error body ever reaches the response.

### My Account tabs (`VP_My_Account`)

VisionPrime Club, Wallet, Points, Rewards, Tier — added via
`woocommerce_account_menu_items` and rewrite endpoints, gated by
`Enable My Account Tabs` and each feature's own enable flag. Each tab
renders only a loading container; data loads via AJAX after the page
renders.

### Shortcodes (`VP_Shortcodes`)

`[visionprime_club]`, `[visionprime_wallet]`, `[visionprime_points]`,
`[visionprime_rewards]`, `[visionprime_tier]` — every shortcode renders
only `<div class="vp-component" data-vp-component="..."
data-vp-nonce="...">` container markup plus a loading message (or a
login prompt for logged-out visitors). No customer data is fetched or
rendered server-side in the shortcode; `assets/js/visionprime-public.js`
reads the container's `data-vp-component` attribute on page load and
fetches the matching AJAX action.

### Front-end behavior (`visionprime-public.js` / `visionprime-admin.js`)

Every container shows a loading state while its request is in flight,
disables its own refresh button during the request, and renders a
friendly error message (never raw API/backend text) on failure.
Refreshing a component only re-fetches that one component's container,
not the page or any sibling component. The admin settings page tools
behave the same way: buttons disable while a request is in flight and
show a single success/error line, with no other interaction with the
page.

### Webhooks (`VP_Webhooks`)

This plugin does not receive webhooks — WooCommerce order/customer
webhooks are received directly by the backend (Phase 06). "Register
Webhooks" just asks the backend to (re)confirm its subscriptions for
this site, gated by the Order/Customer Webhooks settings, and stores
the last result for display on the settings page.

## 3. Security Checklist

- [x] Plugin API key checked server-side (`verifyPluginApiKey` against
  the stored hash) — never trusted from the request alone.
- [x] HMAC-signed server-to-server calls (shared secret never leaves
  PHP, never reaches the browser).
- [x] WordPress user identity mapped to a VisionPrime customer
  (auto-provisioned in the auth middleware).
- [x] No API key or shared secret in any enqueued JS or page markup.
- [x] Every AJAX handler verifies its nonce before doing anything else.
- [x] Admin AJAX checks `current_user_can( 'manage_options' )`.
- [x] Customer AJAX checks `is_user_logged_in()`.
- [x] All inputs sanitized (`sanitize_text_field`, `sanitize_key`,
  `sanitize_url`, `wp_unslash`); all output escaped (`esc_html`,
  `esc_attr`, `.text()` instead of `.html()` for any customer-supplied
  string in JS).
- [x] No raw backend/API error text ever reaches a customer-facing
  response — only the small set of pre-written friendly messages.

## 4. Tests / Verification Performed

- `apps/api`: `npm run build` — clean. `npm run test` — full suite
  passes, including the new `wp-plugin.controller.spec.ts` (10 tests:
  identity resolution + dedup, wallet/points/rewards/dashboard shapes,
  missing headers / bad key / bad signature → 401).
- `apps/wordpress-plugin/visionprime-connector`: `php -l` clean on
  every PHP file; `node --check` clean on both JS assets.
- Settings save securely: verified by code path — secrets are only
  overwritten when the submitted field is non-empty; never echoed back
  into the rendered form value.
- API key not exposed in page source: verified by code path —
  `wp_localize_script` payloads (`visionprimePublic`,
  `visionprimeAdmin`) contain only the AJAX URL, a nonce, and a generic
  error string.
- Missing nonce / logged-out customer / non-capable admin: covered by
  `VP_Auth::require_admin_ajax()` / `require_customer_ajax()`, which
  every handler calls first and which `wp_send_json_error(..., 401/403)`
  on failure.

No live WordPress/WooCommerce environment or VisionPrime backend
credentials are available in this sandbox, so the plugin could not be
exercised against a running wp-admin or `wp_remote_request` round-trip;
verification here is build/lint/test-suite-based, matching the
constraint already noted in Phase 07.

## 5. Demo Steps

1. Install/activate the plugin on a WooCommerce site; go to Settings →
   VisionPrime, fill in API URL/Plugin API Key/Shared Secret, save.
2. Click "Test Connection" — should AJAX-call `/customer/me` and show
   a success/error line without reloading the page.
3. Click "Register Webhooks" (after enabling Order or Customer
   Webhooks) — AJAX call confirms the registration request was sent.
4. As a logged-in customer, visit a page with `[visionprime_wallet]`
   or the My Account → Wallet tab — container shows a loading state,
   then the wallet balance, loaded entirely via AJAX.
5. Click "Refresh" on that component — only that component re-fetches
   (uncached); the rest of the page is untouched.

## 6. Known Limitations / Deferred to Future Phases

- Checkout wallet/reward application at checkout — not implemented;
  `VP_Checkout` is an empty placeholder class and the corresponding
  settings are inert.
- Reward claim/redeem flows — backend points/rewards/tier modules
  don't exist yet; the plugin and API both return static
  `{enabled: false}` placeholders.
- No automated WP/WooCommerce integration test harness in this
  sandbox; verification is build/lint/unit-test based only (see §4).
