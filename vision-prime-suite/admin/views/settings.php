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
				<tr><th><label>کلید API</label></th><td><input type="password" name="api_key" class="regular-text" required></td></tr>
			</table>
			<p><button class="button button-primary" type="submit">ذخیره کلید</button></p>
		</form>

		<table class="widefat striped">
			<thead><tr><th>برچسب</th><th>سرویس</th><th>Scope</th><th>وضعیت</th><th>تاریخ</th></tr></thead>
			<tbody>
			<?php foreach ( $keys as $k ) : ?>
				<tr>
					<td><?php echo esc_html( $k->label ); ?></td>
					<td><?php echo esc_html( $k->provider ); ?></td>
					<td><?php echo esc_html( $k->scope ); ?></td>
					<td><?php echo $k->is_active ? '✅' : '❌'; ?></td>
					<td><?php echo esc_html( $k->created_at ); ?></td>
				</tr>
			<?php endforeach; ?>
			<?php if ( empty( $keys ) ) : ?>
				<tr><td colspan="5">کلیدی ثبت نشده است.</td></tr>
			<?php endif; ?>
			</tbody>
		</table>
	</div>
</div>
