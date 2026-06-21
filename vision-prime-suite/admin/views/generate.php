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

	<div class="vp-card">
		<h2>افزودن انبوه عنوان به صف خودکار (تا ۲۰۰۰ عنوان)</h2>
		<p class="description">هر خط یک عنوان. بسته‌ی اول بلافاصله پردازش می‌شود؛ باقی عنوان‌ها به‌تدریج در پس‌زمینه (هر ۵ دقیقه چند مورد، یا با دکمه‌ی «پردازش الان») تولید می‌شوند. نتیجه‌ی هرکدام مثل تولید دستی در «صف انتشار» با وضعیت در-انتظار-بررسی ظاهر می‌شود.</p>
		<form id="vp-bulk-form">
			<table class="form-table">
				<tr>
					<th><label>نوع محتوا</label></th>
					<td>
						<select name="content_type">
							<option value="article">مقاله</option>
							<option value="product">محصول</option>
						</select>
					</td>
				</tr>
				<tr>
					<th><label>سرویس هوش مصنوعی</label></th>
					<td>
						<select name="provider" id="vp-bulk-provider">
							<?php foreach ( $providers as $key => $p ) : ?>
								<option value="<?php echo esc_attr( $key ); ?>" <?php selected( $key, $settings['default_provider'] ); ?>><?php echo esc_html( $p['label'] ); ?></option>
							<?php endforeach; ?>
						</select>
					</td>
				</tr>
				<tr>
					<th><label>مدل</label></th>
					<td><select name="model" id="vp-bulk-model"></select></td>
				</tr>
				<tr>
					<th><label>عنوان‌ها (هر خط یک عنوان، حداکثر ۲۰۰۰)</label></th>
					<td><textarea name="titles" id="vp-bulk-titles" rows="10" class="large-text" placeholder="عنوان اول&#10;عنوان دوم&#10;..."></textarea></td>
				</tr>
			</table>
			<p>
				<button class="button button-primary" type="submit">افزودن به صف خودکار</button>
				<span id="vp-bulk-count" class="description"></span>
			</p>
		</form>
		<div id="vp-bulk-result"></div>
	</div>

	<div class="vp-card">
		<h2>وضعیت زنده‌ی صف خودکار</h2>
		<p>
			<span id="vp-bulk-status"></span>
			<button class="button button-primary" id="vp-bulk-process-now" type="button">پردازش الان</button>
			<button class="button" id="vp-bulk-refresh" type="button">به‌روزرسانی فهرست</button>
		</p>
		<table class="form-table">
			<tr>
				<th><label>فیلتر وضعیت</label></th>
				<td>
					<select id="vp-bulk-filter-status">
						<option value="">همه</option>
						<option value="pending">در انتظار</option>
						<option value="done">انجام‌شده</option>
						<option value="failed">ناموفق</option>
					</select>
				</td>
			</tr>
		</table>
		<table class="widefat striped">
			<thead><tr><th>عنوان</th><th>نوع</th><th>وضعیت</th><th>خطا</th><th>زمان ثبت</th><th>عملیات</th></tr></thead>
			<tbody id="vp-bulk-table-body">
				<tr><td colspan="6">برای مشاهده‌ی فهرست، روی «به‌روزرسانی فهرست» کلیک کنید.</td></tr>
			</tbody>
		</table>
	</div>
</div>

<script>
	window.VPProviders = <?php echo wp_json_encode( $providers ); ?>;
</script>
