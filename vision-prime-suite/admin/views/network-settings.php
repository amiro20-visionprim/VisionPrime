<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">تنظیمات شبکه VisionPrime Suite</h1>

	<div class="vp-card">
		<p class="description">
			از این صفحه می‌توانید یک کلید API مشترک را یک‌بار وارد کنید و آن را به‌صورت خودکار روی
			تمام <?php echo (int) count( $sites ); ?> سایت هلدینگ (به‌عنوان کلید با محدوده «shared») اعمال کنید.
			هر سایت در صورت نیاز همچنان می‌تواند از تنظیمات داخلی خودش یک کلید اختصاصی برای ماژول خاصی ثبت کند
			که در آن صورت به‌جای کلید مشترک استفاده می‌شود.
		</p>

		<?php if ( isset( $result ) && is_array( $result ) ) : ?>
			<?php if ( ! empty( $result['error'] ) ) : ?>
				<div class="notice notice-error"><p><?php echo esc_html( $result['error'] ); ?></p></div>
			<?php else : ?>
				<div class="notice notice-success"><p>
					کلید با موفقیت روی <?php echo (int) $result['count']; ?> سایت اعمال شد.
				</p></div>
			<?php endif; ?>
		<?php endif; ?>

		<form method="post">
			<?php wp_nonce_field( 'vp_network_save_apikey', 'vp_network_apikey_nonce' ); ?>
			<table class="form-table">
				<tr>
					<th><label>برچسب</label></th>
					<td><input type="text" name="label" class="regular-text" placeholder="کلید مشترک شبکه"></td>
				</tr>
				<tr>
					<th><label>کلید OpenRouter</label></th>
					<td>
						<input type="text" name="api_key" class="regular-text" dir="ltr" placeholder="sk-or-v1-..." required>
						<p class="description">این پلاگین فقط با OpenRouter کار می‌کند؛ کلید باید با <code>sk-or-</code> شروع شود.</p>
					</td>
				</tr>
			</table>
			<p><button class="button button-primary" type="submit">اعمال روی تمام سایت‌های شبکه</button></p>
		</form>
	</div>

	<div class="vp-card">
		<h2>سایت‌های هلدینگ</h2>
		<p class="description">تعداد سایت‌های فعال در این شبکه: <strong><?php echo (int) count( $sites ); ?></strong></p>
	</div>
</div>
