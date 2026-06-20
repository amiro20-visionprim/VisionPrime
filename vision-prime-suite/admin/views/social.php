<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">مدیریت شبکه‌های اجتماعی</h1>

	<div class="vp-card">
		<h2>افزودن حساب جدید</h2>
		<form id="vp-social-account-form">
			<table class="form-table">
				<tr>
					<th><label>کانال</label></th>
					<td>
						<select name="channel">
							<?php foreach ( $channels as $key => $ch ) : ?>
								<option value="<?php echo esc_attr( $key ); ?>"><?php echo esc_html( $ch->get_label() ); ?></option>
							<?php endforeach; ?>
						</select>
					</td>
				</tr>
				<tr><th><label>برچسب</label></th><td><input type="text" name="label" class="regular-text" required></td></tr>
				<tr>
					<th><label>کانفیگ (JSON)</label></th>
					<td>
						<textarea name="config" rows="4" class="large-text" placeholder='{"bot_token":"...","chat_id":"..."}'></textarea>
						<p class="description">برای تلگرام: bot_token و chat_id. برای ایمیل: to و subject. برای سایر کانال‌ها: endpoint و headers رسمی API همان پلتفرم (به کاتالوگ راهنما مراجعه کنید).</p>
					</td>
				</tr>
			</table>
			<p><button class="button button-primary" type="submit">ذخیره حساب</button></p>
		</form>
	</div>

	<div class="vp-card">
		<h2>حساب‌های ثبت‌شده</h2>
		<table class="widefat striped">
			<thead><tr><th>برچسب</th><th>کانال</th><th>وضعیت</th><th>ارسال پیام تستی</th></tr></thead>
			<tbody>
			<?php foreach ( $accounts as $acc ) : ?>
				<tr>
					<td><?php echo esc_html( $acc->label ); ?></td>
					<td><?php echo esc_html( $acc->channel ); ?></td>
					<td><?php echo $acc->is_active ? '✅' : '❌'; ?></td>
					<td>
						<form class="vp-social-send-form" data-account-id="<?php echo esc_attr( $acc->id ); ?>">
							<input type="text" name="message" placeholder="متن پیام" required>
							<button class="button">ارسال</button>
						</form>
					</td>
				</tr>
			<?php endforeach; ?>
			<?php if ( empty( $accounts ) ) : ?>
				<tr><td colspan="4">حسابی ثبت نشده است.</td></tr>
			<?php endif; ?>
			</tbody>
		</table>
	</div>
</div>
