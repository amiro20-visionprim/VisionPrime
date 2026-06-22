<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">تنظیمات VisionPrime Suite</h1>

	<nav class="vp-tabs">
		<button type="button" class="vp-tab-btn vp-tab-active" data-tab="apikey">کلید API</button>
		<button type="button" class="vp-tab-btn" data-tab="content">سیاست محتوا</button>
		<button type="button" class="vp-tab-btn" data-tab="review">بازبینی و کیفیت</button>
		<button type="button" class="vp-tab-btn" data-tab="automation">اتوماسیون و توزیع</button>
		<button type="button" class="vp-tab-btn" data-tab="gsc">Search Console</button>
		<button type="button" class="vp-tab-btn" data-tab="reports">گزارش‌گیری</button>
	</nav>

	<!-- ===================== کلید API ===================== -->
	<section class="vp-tab-panel" data-tab="apikey">
		<div class="vp-card vp-card-accent">
			<h2>این پلاگین فقط با OpenRouter کار می‌کند</h2>
			<p>یک کلید OpenRouter به‌تنهایی به همه‌ی مدل‌های هوش مصنوعی (GPT، Claude، Gemini، Llama، DeepSeek و...) دسترسی می‌دهد؛ دیگر لازم نیست سرویس درست را از یک لیست انتخاب کنید. کلید معتبر همیشه با <code style="background:rgba(255,255,255,.15);padding:2px 6px;border-radius:4px;">sk-or-</code> شروع می‌شود.</p>
		</div>

		<div class="vp-card">
			<h2>سقف توکن خروجی</h2>
			<form method="post">
				<?php wp_nonce_field( 'vp_suite_save_settings', 'vp_suite_settings_nonce' ); ?>
				<table class="form-table">
					<tr>
						<th><label>حداکثر توکن خروجی هر درخواست</label></th>
						<td>
							<input type="number" name="max_tokens" value="<?php echo esc_attr( $settings['max_tokens'] ); ?>" min="256" max="32000" step="256">
							<p class="description">اگر اعتبار حساب OpenRouter کم باشد و خطای «۴۰۲ — نیاز به اعتبار بیشتر» بگیرید، این عدد را کم کنید. عدد بزرگ‌تر یعنی محتوای طولانی‌تر و کامل‌تر اما نیاز به اعتبار بیشتر؛ عدد کوچک‌تر ریسک قطع‌شدن محتوای بلند را افزایش می‌دهد. مقدار پیشنهادی برای اکثر مقالات: ۴۰۰۰ تا ۶۰۰۰.</p>
						</td>
					</tr>
				</table>
				<p><button class="button button-primary" type="submit">ذخیره</button></p>
			</form>
		</div>

		<div class="vp-card">
			<h2>افزودن کلید جدید</h2>
			<form method="post">
				<?php wp_nonce_field( 'vp_suite_save_apikey', 'vp_suite_apikey_nonce' ); ?>
				<table class="form-table">
					<tr>
						<th><label>برچسب</label></th>
						<td><input type="text" name="label" class="regular-text" placeholder="مثلاً: کلید اصلی" required></td>
					</tr>
					<tr>
						<th><label>Scope</label></th>
						<td>
							<select name="scope">
								<option value="shared">مشترک (شامل همه‌ی بخش‌ها)</option>
								<option value="content">تولید محتوا</option>
								<option value="seo">موتور سئو</option>
								<option value="competitor">تحلیل رقبا</option>
								<option value="image">تولید تصویر</option>
							</select>
							<p class="description">اگر مطمئن نیستید، «مشترک» را انتخاب کنید.</p>
						</td>
					</tr>
					<tr>
						<th><label>کلید OpenRouter</label></th>
						<td>
							<span style="display:inline-flex;align-items:center;gap:6px;width:100%;">
								<input type="text" name="api_key" class="regular-text" dir="ltr" autocomplete="off" id="vp-api-key-field" placeholder="sk-or-v1-..." required style="font-family:monospace;">
								<button type="button" class="button vp-toggle-visibility" data-target="vp-api-key-field">پنهان</button>
							</span>
							<p class="description">کلید باید با <code>sk-or-</code> شروع شود، وگرنه ذخیره نمی‌شود.</p>
						</td>
					</tr>
					<tr>
						<th><label>اولویت</label></th>
						<td>
							<input type="number" name="priority" class="small-text" value="100" min="1" max="999">
							<p class="description">عدد کوچک‌تر = اولویت بالاتر. اگر کلید با اولویت بالاتر به محدودیت بخورد یا خطا بدهد، سیستم به‌صورت خودکار سراغ کلید بعدی می‌رود.</p>
						</td>
					</tr>
				</table>
				<p><button class="button button-primary" type="submit">ذخیره کلید</button></p>
			</form>
		</div>

		<div class="vp-card">
			<h2>کلیدهای ثبت‌شده</h2>
			<table class="widefat striped">
				<thead><tr><th>برچسب</th><th>Scope</th><th>اولویت</th><th>وضعیت</th><th>تاریخ</th><th>عملیات</th></tr></thead>
				<tbody>
				<?php foreach ( $keys as $k ) : ?>
					<tr data-key-id="<?php echo esc_attr( $k->id ); ?>">
						<td><?php echo esc_html( $k->label ); ?></td>
						<td><?php echo esc_html( $k->scope ); ?></td>
						<td><?php echo esc_html( $k->priority ); ?></td>
						<td class="vp-key-status"><?php echo $k->is_active ? '✅ فعال' : '⛔️ غیرفعال'; ?></td>
						<td><?php echo esc_html( $k->created_at ); ?></td>
						<td>
							<button type="button" class="button vp-apikey-test" data-id="<?php echo esc_attr( $k->id ); ?>">تست اتصال</button>
							<button type="button" class="button vp-apikey-toggle" data-id="<?php echo esc_attr( $k->id ); ?>"><?php echo $k->is_active ? 'غیرفعال‌سازی' : 'فعال‌سازی'; ?></button>
							<button type="button" class="button vp-apikey-delete" data-id="<?php echo esc_attr( $k->id ); ?>">حذف</button>
							<div class="vp-apikey-test-result" data-id="<?php echo esc_attr( $k->id ); ?>"></div>
						</td>
					</tr>
				<?php endforeach; ?>
				<?php if ( empty( $keys ) ) : ?>
					<tr><td colspan="6">کلیدی ثبت نشده است.</td></tr>
				<?php endif; ?>
				</tbody>
			</table>
			<p class="description">اگر کلید جدیدی اضافه کرده‌اید ولی محتوا تولید نمی‌شود، با «تست اتصال» مطمئن شوید معتبر است، و کلیدهای قدیمی/نامعتبر را غیرفعال یا حذف کنید — کلید با اولویت بالاتر (عدد کوچک‌تر) همیشه زودتر امتحان می‌شود.</p>
		</div>
	</section>

	<!-- ===================== سیاست محتوا ===================== -->
	<section class="vp-tab-panel" data-tab="content" hidden>
		<div class="vp-card">
			<h2>سیاست‌های محتوا (دو پرامپت‌باکس مجزا)</h2>
			<form method="post">
				<?php wp_nonce_field( 'vp_suite_save_settings', 'vp_suite_settings_nonce' ); ?>
				<table class="form-table">
					<tr>
						<th><label>پرامپت سیاست مقاله</label></th>
						<td><textarea name="article_prompt" rows="5" class="large-text"><?php echo esc_textarea( $settings['article_prompt'] ); ?></textarea></td>
					</tr>
					<tr>
						<th><label>پرامپت سیاست محصول</label></th>
						<td><textarea name="product_prompt" rows="5" class="large-text"><?php echo esc_textarea( $settings['product_prompt'] ); ?></textarea></td>
					</tr>
					<tr>
						<th><label>پرامپت موتور سئو</label></th>
						<td><textarea name="seo_prompt" rows="5" class="large-text"><?php echo esc_textarea( $settings['seo_prompt'] ); ?></textarea></td>
					</tr>
					<tr>
						<th><label>پرامپت استراتژیست تحلیل رقبا</label></th>
						<td><textarea name="competitor_prompt" rows="5" class="large-text"><?php echo esc_textarea( $settings['competitor_prompt'] ); ?></textarea></td>
					</tr>
					<tr>
						<th><label>پرامپت برنامه‌ی هوشمند روزانه‌ی تقویم محتوایی</label></th>
						<td>
							<textarea name="calendar_smart_prompt" rows="5" class="large-text"><?php echo esc_textarea( $settings['calendar_smart_prompt'] ); ?></textarea>
							<p class="description">وقتی در «تقویم محتوایی» از حالت «برنامه‌ی هوشمند روزانه» استفاده می‌کنید، این پرامپت سیستم برای تبدیل بریف شما به فهرست موضوعات روزانه به‌کار می‌رود.</p>
						</td>
					</tr>
					<tr>
						<th><label>هویت/لحن برند این سایت</label></th>
						<td>
							<textarea name="brand_voice" rows="3" class="large-text" placeholder="مثلاً: لحن دوستانه و غیررسمی، خطاب به مخاطب جوان، از اصطلاحات تخصصی سنگین پرهیز شود..."><?php echo esc_textarea( $settings['brand_voice'] ); ?></textarea>
							<p class="description">به پرامپت تولید محتوای این سایت (مقاله/محصول) اضافه می‌شود تا هر برند صدای خودش را حفظ کند؛ هر سایت در شبکه‌ی چندسایتی می‌تواند هویت متفاوتی داشته باشد.</p>
						</td>
					</tr>
				</table>
				<p><button class="button button-primary" type="submit">ذخیره تنظیمات</button></p>
			</form>
		</div>
	</section>

	<!-- ===================== بازبینی و کیفیت ===================== -->
	<section class="vp-tab-panel" data-tab="review" hidden>
		<div class="vp-card">
			<h2>بازبینی محتوا (Review) — دستی و خودکار</h2>
			<form method="post">
				<?php wp_nonce_field( 'vp_suite_save_settings', 'vp_suite_settings_nonce' ); ?>
				<table class="form-table">
					<tr>
						<th><label>بازبینی خودکار (در کنار بازبینی دستی)</label></th>
						<td>
							<label class="vp-switch"><input type="checkbox" name="review_auto_enabled" <?php checked( $settings['review_auto_enabled'] ); ?>><span class="vp-switch-slider"></span></label>
							<p class="description">هر ساعت چند پست/محصول (حتی قدیمی) که هنوز با تنظیمات فعلی این بخش بازبینی نشده‌اند را خودکار پردازش می‌کند؛ بازبینی دستی تک‌پستی همچنان از صفحه‌ی بازبینی در دسترس است و مستقل از این گزینه کار می‌کند.</p>
						</td>
					</tr>
					<tr>
						<th><label>پرامپت یک‌دست‌سازی ساختار محتوا</label></th>
						<td>
							<textarea name="review_restructure_prompt" rows="5" class="large-text"><?php echo esc_textarea( $settings['review_restructure_prompt'] ); ?></textarea>
							<p class="description">هر بار این پرامپت را تغییر دهید، در دور بعدی بازبینی خودکار، حتی محتوای قدیمی که قبلاً با نسخه‌ی قبلی پرامپت بازبینی شده، دوباره با نسخه‌ی جدید پردازش می‌شود.</p>
						</td>
					</tr>
					<tr>
						<th><label>بازبینی فنی (رفع لینک شکسته/alt گم‌شده)</label></th>
						<td><label class="vp-switch"><input type="checkbox" name="review_technical_enabled" <?php checked( $settings['review_technical_enabled'] ); ?>><span class="vp-switch-slider"></span></label></td>
					</tr>
					<tr>
						<th><label>دسته‌بندی خودکار مقالات</label></th>
						<td><label class="vp-switch"><input type="checkbox" name="review_auto_categorize" <?php checked( $settings['review_auto_categorize'] ); ?>><span class="vp-switch-slider"></span></label></td>
					</tr>
					<tr>
						<th><label>کنترل کیفیت پیش از انتشار (QA)</label></th>
						<td><label class="vp-switch"><input type="checkbox" name="pre_publish_qa" <?php checked( $settings['pre_publish_qa'] ); ?>><span class="vp-switch-slider"></span></label></td>
					</tr>
				</table>
				<p><button class="button button-primary" type="submit">ذخیره تنظیمات</button></p>
			</form>
		</div>
	</section>

	<!-- ===================== اتوماسیون و توزیع ===================== -->
	<section class="vp-tab-panel" data-tab="automation" hidden>
		<div class="vp-card">
			<h2>اتوماسیون و توزیع</h2>
			<form method="post">
				<?php wp_nonce_field( 'vp_suite_save_settings', 'vp_suite_settings_nonce' ); ?>
				<div class="vp-toggle-grid">
					<div class="vp-toggle-row">
						<label class="vp-switch"><input type="checkbox" name="shared_api_mode" <?php checked( $settings['shared_api_mode'] ); ?>><span class="vp-switch-slider"></span></label>
						<div><strong>کلید مشترک برای همه‌ی بخش‌ها</strong></div>
					</div>
					<div class="vp-toggle-row">
						<label class="vp-switch"><input type="checkbox" name="rankmath_sync" <?php checked( $settings['rankmath_sync'] ); ?>><span class="vp-switch-slider"></span></label>
						<div><strong>سینک خودکار Rank Math</strong></div>
					</div>
					<div class="vp-toggle-row">
						<label class="vp-switch"><input type="checkbox" name="image_generation" <?php checked( $settings['image_generation'] ); ?>><span class="vp-switch-slider"></span></label>
						<div><strong>تولید تصویر یونیک</strong></div>
					</div>
					<div class="vp-toggle-row">
						<label class="vp-switch"><input type="checkbox" name="auto_internal_linking" <?php checked( $settings['auto_internal_linking'] ); ?>><span class="vp-switch-slider"></span></label>
						<div><strong>لینک‌سازی داخلی خودکار</strong><p class="description">با انتشار هر محتوا، لینک به مطالب مرتبط واقعی همین سایت اضافه می‌شود.</p></div>
					</div>
					<div class="vp-toggle-row">
						<label class="vp-switch"><input type="checkbox" name="auto_external_linking" <?php checked( $settings['auto_external_linking'] ); ?>><span class="vp-switch-slider"></span></label>
						<div><strong>لینک‌سازی بین‌برندی خودکار</strong><p class="description">لینک به مطالب مرتبط در سایر سایت‌های هلدینگ اضافه می‌شود.</p></div>
					</div>
					<div class="vp-toggle-row">
						<label class="vp-switch"><input type="checkbox" name="auto_social_distribution" <?php checked( $settings['auto_social_distribution'] ); ?>><span class="vp-switch-slider"></span></label>
						<div><strong>توزیع خودکار سوشال هنگام انتشار</strong><p class="description">هر محتوای منتشرشده به‌صورت خودکار به همه‌ی حساب‌های فعال شبکه‌های اجتماعی ارسال می‌شود.</p></div>
					</div>
					<div class="vp-toggle-row">
						<label class="vp-switch"><input type="checkbox" name="competitor_auto_scan" <?php checked( $settings['competitor_auto_scan'] ); ?>><span class="vp-switch-slider"></span></label>
						<div><strong>تحلیل خودکار رقبا (بر اساس Search Console)</strong><p class="description">نیازمند اتصال فعال به Search Console است.</p></div>
					</div>
				</div>
				<p><button class="button button-primary" type="submit">ذخیره تنظیمات</button></p>
			</form>
		</div>
	</section>

	<!-- ===================== Search Console ===================== -->
	<section class="vp-tab-panel" data-tab="gsc" hidden>
		<div class="vp-card">
			<h2>Google Search Console (داده‌ی واقعی رتبه)</h2>
			<form method="post">
				<?php wp_nonce_field( 'vp_suite_save_settings', 'vp_suite_settings_nonce' ); ?>
				<table class="form-table">
					<tr>
						<th><label>GSC Client ID</label></th>
						<td><input type="text" name="gsc_client_id" class="large-text" dir="ltr" value="<?php echo esc_attr( $settings['gsc_client_id'] ); ?>"></td>
					</tr>
					<tr>
						<th><label>GSC Client Secret</label></th>
						<td>
							<span style="display:inline-flex;align-items:center;gap:6px;width:100%;">
								<input type="password" name="gsc_client_secret" class="large-text" dir="ltr" autocomplete="new-password" id="vp-gsc-secret-field" value="<?php echo esc_attr( $settings['gsc_client_secret'] ); ?>">
								<button type="button" class="button vp-toggle-visibility" data-target="vp-gsc-secret-field">نمایش</button>
							</span>
							<p class="description">از <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud Console</a> یک OAuth Client بسازید و این آدرس را به‌عنوان redirect URI اضافه کنید: <code style="direction:ltr;"><?php echo esc_html( admin_url( 'admin.php?page=vp-suite-search-console' ) ); ?></code></p>
						</td>
					</tr>
				</table>
				<p><button class="button button-primary" type="submit">ذخیره تنظیمات</button></p>
			</form>
		</div>
	</section>

	<!-- ===================== گزارش‌گیری ===================== -->
	<section class="vp-tab-panel" data-tab="reports" hidden>
		<div class="vp-card">
			<h2>گزارش‌گیری و نگهداری</h2>
			<form method="post">
				<?php wp_nonce_field( 'vp_suite_save_settings', 'vp_suite_settings_nonce' ); ?>
				<table class="form-table">
					<tr>
						<th><label>گیرندگان گزارش (ایمیل، با کاما جدا کنید)</label></th>
						<td><input type="text" name="report_recipients" class="large-text" value="<?php echo esc_attr( $settings['report_recipients'] ); ?>"></td>
					</tr>
					<tr>
						<th><label>نگهداری لاگ (روز)</label></th>
						<td><input type="number" name="log_retention_days" value="<?php echo esc_attr( $settings['log_retention_days'] ); ?>" min="1" max="3650"></td>
					</tr>
				</table>
				<p><button class="button button-primary" type="submit">ذخیره تنظیمات</button></p>
			</form>
		</div>
	</section>
</div>
