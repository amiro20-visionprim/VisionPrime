<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">تنظیمات VisionPrime Suite</h1>

	<div class="vp-card">
		<h2>سیاست‌های محتوا (دو پرامپت‌باکس مجزا)</h2>
		<form method="post">
			<?php wp_nonce_field( 'vp_suite_save_settings', 'vp_suite_settings_nonce' ); ?>
			<table class="form-table">
				<tr>
					<th><label>سرویس پیش‌فرض</label></th>
					<td>
						<select name="default_provider">
							<?php foreach ( $providers as $key => $p ) : ?>
								<option value="<?php echo esc_attr( $key ); ?>" <?php selected( $key, $settings['default_provider'] ); ?>><?php echo esc_html( $p['label'] ); ?></option>
							<?php endforeach; ?>
						</select>
					</td>
				</tr>
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
					<th><label>هویت/لحن برند این سایت</label></th>
					<td>
						<textarea name="brand_voice" rows="3" class="large-text" placeholder="مثلاً: لحن دوستانه و غیررسمی، خطاب به مخاطب جوان، از اصطلاحات تخصصی سنگین پرهیز شود..."><?php echo esc_textarea( $settings['brand_voice'] ); ?></textarea>
						<p class="description">به پرامپت تولید محتوای این سایت (مقاله/محصول) اضافه می‌شود تا هر برند صدای خودش را حفظ کند؛ هر سایت در شبکه‌ی چندسایتی می‌تواند هویت متفاوتی داشته باشد.</p>
					</td>
				</tr>
				<tr>
					<th><label>کنترل کیفیت پیش از انتشار (QA)</label></th>
					<td><label><input type="checkbox" name="pre_publish_qa" <?php checked( $settings['pre_publish_qa'] ); ?>> فعال</label> <p class="description">بررسی خودکار لینک‌های شکسته، تصاویر بدون alt و محتوای کم‌حجم قبل از انتشار نهایی.</p></td>
				</tr>
				<tr>
					<th><label>کلید مشترک برای همه‌ی بخش‌ها</label></th>
					<td><label><input type="checkbox" name="shared_api_mode" <?php checked( $settings['shared_api_mode'] ); ?>> فعال</label></td>
				</tr>
				<tr>
					<th><label>سینک خودکار Rank Math</label></th>
					<td><label><input type="checkbox" name="rankmath_sync" <?php checked( $settings['rankmath_sync'] ); ?>> فعال</label></td>
				</tr>
				<tr>
					<th><label>تولید تصویر یونیک</label></th>
					<td><label><input type="checkbox" name="image_generation" <?php checked( $settings['image_generation'] ); ?>> فعال</label></td>
				</tr>
				<tr>
					<th><label>لینک‌سازی داخلی خودکار</label></th>
					<td><label><input type="checkbox" name="auto_internal_linking" <?php checked( $settings['auto_internal_linking'] ); ?>> فعال</label> <p class="description">با انتشار هر محتوا، لینک به مطالب مرتبط واقعی همین سایت اضافه می‌شود.</p></td>
				</tr>
				<tr>
					<th><label>لینک‌سازی بین‌برندی خودکار</label></th>
					<td><label><input type="checkbox" name="auto_external_linking" <?php checked( $settings['auto_external_linking'] ); ?>> فعال</label> <p class="description">لینک به مطالب مرتبط در سایر سایت‌های هلدینگ (شبکه‌ی چندسایتی) اضافه می‌شود.</p></td>
				</tr>
				<tr>
					<th><label>توزیع خودکار سوشال هنگام انتشار</label></th>
					<td><label><input type="checkbox" name="auto_social_distribution" <?php checked( $settings['auto_social_distribution'] ); ?>> فعال</label> <p class="description">هر محتوای منتشرشده به‌صورت خودکار به همه‌ی حساب‌های فعال شبکه‌های اجتماعی ارسال می‌شود.</p></td>
				</tr>
				<tr>
					<th><label>گیرندگان گزارش (ایمیل، با کاما جدا کنید)</label></th>
					<td><input type="text" name="report_recipients" class="large-text" value="<?php echo esc_attr( $settings['report_recipients'] ); ?>"></td>
				</tr>
				<tr>
					<th><label>نگهداری لاگ (روز)</label></th>
					<td><input type="number" name="log_retention_days" value="<?php echo esc_attr( $settings['log_retention_days'] ); ?>" min="1" max="3650"></td>
				</tr>
				<tr>
					<th colspan="2"><h3 style="margin:8px 0;">Google Search Console (داده‌ی واقعی رتبه)</h3></th>
				</tr>
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

	<div class="vp-card">
		<h2>کلیدهای API (مشترک یا مجزا به ازای هر بخش)</h2>
		<form method="post">
			<?php wp_nonce_field( 'vp_suite_save_apikey', 'vp_suite_apikey_nonce' ); ?>
			<table class="form-table">
				<tr>
					<th><label>سرویس</label></th>
					<td>
						<select name="provider">
							<?php foreach ( $providers as $key => $p ) : ?>
								<option value="<?php echo esc_attr( $key ); ?>"><?php echo esc_html( $p['label'] ); ?></option>
							<?php endforeach; ?>
						</select>
					</td>
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
					</td>
				</tr>
				<tr><th><label>برچسب</label></th><td><input type="text" name="label" class="regular-text" required></td></tr>
				<tr><th><label>کلید API</label></th><td>
						<span style="display:inline-flex;align-items:center;gap:6px;">
							<input type="password" name="api_key" class="regular-text" dir="ltr" autocomplete="new-password" id="vp-api-key-field" required>
							<button type="button" class="button vp-toggle-visibility" data-target="vp-api-key-field">نمایش</button>
						</span>
						<p class="description">این فیلد توسط مدیریت کلمه‌عبور مرورگر پر نمی‌شود؛ مقدار کلید را مستقیماً اینجا وارد یا پیست کنید.</p>
					</td></tr>
				<tr>
					<th><label>اولویت</label></th>
					<td>
						<input type="number" name="priority" class="small-text" value="100" min="1" max="999">
						<p class="description">عدد کوچک‌تر = اولویت بالاتر. اگر کلید با اولویت بالاتر به محدودیت بخورد یا خطا بدهد، سیستم به‌صورت خودکار سراغ کلید بعدی (اولویت پایین‌تر) در همین Scope یا Scope مشترک می‌رود.</p>
					</td>
				</tr>
			</table>
			<p><button class="button button-primary" type="submit">ذخیره کلید</button></p>
		</form>

		<table class="widefat striped">
			<thead><tr><th>برچسب</th><th>سرویس</th><th>Scope</th><th>اولویت</th><th>وضعیت</th><th>تاریخ</th></tr></thead>
			<tbody>
			<?php foreach ( $keys as $k ) : ?>
				<tr>
					<td><?php echo esc_html( $k->label ); ?></td>
					<td><?php echo esc_html( $k->provider ); ?></td>
					<td><?php echo esc_html( $k->scope ); ?></td>
					<td><?php echo esc_html( $k->priority ); ?></td>
					<td><?php echo $k->is_active ? '✅' : '❌'; ?></td>
					<td><?php echo esc_html( $k->created_at ); ?></td>
				</tr>
			<?php endforeach; ?>
			<?php if ( empty( $keys ) ) : ?>
				<tr><td colspan="6">کلیدی ثبت نشده است.</td></tr>
			<?php endif; ?>
			</tbody>
		</table>
		<p class="description">برای هر بخش (محتوا/سئو/رقبا/تصویر) می‌توانید چند کلید با اولویت‌های متفاوت ثبت کنید تا زنجیره‌ی جایگزین خودکار شکل بگیرد.</p>
	</div>
</div>
