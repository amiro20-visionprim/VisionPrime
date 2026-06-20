<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">تولید محتوای سئوشده</h1>

	<div class="vp-card">
		<form id="vp-generate-form">
			<table class="form-table">
				<tr>
					<th><label>نوع محتوا</label></th>
					<td>
						<select name="content_type" id="vp-content-type">
							<option value="article">مقاله</option>
							<option value="product">محصول</option>
						</select>
					</td>
				</tr>
				<tr>
					<th><label>موضوع</label></th>
					<td><input type="text" name="topic" class="regular-text" required></td>
				</tr>
				<tr>
					<th><label>کلمه‌ی کلیدی هدف</label></th>
					<td><input type="text" name="keyword" class="regular-text"></td>
				</tr>
				<tr>
					<th><label>سرویس هوش مصنوعی</label></th>
					<td>
						<select name="provider" id="vp-provider">
							<?php foreach ( $providers as $key => $p ) : ?>
								<option value="<?php echo esc_attr( $key ); ?>" <?php selected( $key, $settings['default_provider'] ); ?>><?php echo esc_html( $p['label'] ); ?></option>
							<?php endforeach; ?>
						</select>
					</td>
				</tr>
				<tr>
					<th><label>مدل</label></th>
					<td>
						<select name="model" id="vp-model"></select>
					</td>
				</tr>
			</table>
			<p><button class="button button-primary" type="submit">تولید محتوا</button></p>
		</form>
		<div id="vp-generate-result"></div>
	</div>

	<p class="description">پرامپت‌های پیش‌فرض مقاله/محصول از صفحه‌ی «تنظیمات» قابل ویرایش هستند.</p>
</div>

<script>
	window.VPProviders = <?php echo wp_json_encode( $providers ); ?>;
</script>
