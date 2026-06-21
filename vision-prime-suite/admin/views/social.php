<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">مدیریت شبکه‌های اجتماعی</h1>

	<div class="vp-card">
		<h2>آمار تعاملی هر پلتفرم</h2>
		<table class="widefat striped">
			<thead><tr><th>پلتفرم</th><th>حساب‌های فعال</th><th>ارسال موفق</th><th>ارسال ناموفق</th><th>تعامل کل</th></tr></thead>
			<tbody>
			<?php foreach ( $stats as $key => $s ) : ?>
				<tr>
					<td><strong><?php echo esc_html( $s['label'] ); ?></strong></td>
					<td><?php echo (int) $s['accounts']; ?></td>
					<td style="color:#166534;"><?php echo (int) $s['sent']; ?></td>
					<td style="color:<?php echo $s['failed'] ? '#991b1b' : '#888'; ?>;"><?php echo (int) $s['failed']; ?></td>
					<td><?php echo (int) $s['engagement']; ?></td>
				</tr>
			<?php endforeach; ?>
			</tbody>
		</table>
		<p class="description">آمار تعامل به‌صورت ساعتی توسط زمان‌بند به‌روزرسانی می‌شود (در صورت پشتیبانی API هر پلتفرم).</p>
	</div>

	<div class="vp-card">
		<h2>افزودن حساب جدید</h2>
		<form id="vp-social-account-form">
			<table class="form-table">
				<tr>
					<th><label>کانال</label></th>
					<td>
						<select name="channel" id="vp-social-channel-select">
							<?php foreach ( $channels as $key => $ch ) : ?>
								<option value="<?php echo esc_attr( $key ); ?>"><?php echo esc_html( $ch->get_label() ); ?></option>
							<?php endforeach; ?>
						</select>
					</td>
				</tr>
				<tr><th><label>برچسب</label></th><td><input type="text" name="label" class="regular-text" required></td></tr>
			</table>

			<?php foreach ( $channels as $key => $ch ) : ?>
				<div class="vp-social-channel-fields" data-channel="<?php echo esc_attr( $key ); ?>" style="display:none;">
					<table class="form-table">
						<?php foreach ( $ch->get_required_fields() as $field ) : ?>
							<tr>
								<th><label><?php echo esc_html( $field['label'] ); ?></label></th>
								<td>
									<input
										type="<?php echo esc_attr( $field['type'] ); ?>"
										class="regular-text vp-social-field"
										data-field-key="<?php echo esc_attr( $field['key'] ); ?>"
										placeholder="<?php echo esc_attr( $field['placeholder'] ?? '' ); ?>"
										autocomplete="new-password"
									>
								</td>
							</tr>
						<?php endforeach; ?>
					</table>
					<?php if ( $ch->get_notes() ) : ?>
						<ul class="vp-social-notes">
							<?php foreach ( $ch->get_notes() as $note ) : ?>
								<li><?php echo esc_html( $note ); ?></li>
							<?php endforeach; ?>
						</ul>
					<?php endif; ?>
				</div>
			<?php endforeach; ?>

			<p><button class="button button-primary" type="submit">ذخیره حساب</button></p>
		</form>
	</div>

	<div class="vp-card">
		<h2>حساب‌های ثبت‌شده</h2>
		<table class="widefat striped">
			<thead><tr><th>برچسب</th><th>کانال</th><th>وضعیت</th><th>تست اتصال</th><th>ارسال پیام تستی</th></tr></thead>
			<tbody>
			<?php foreach ( $accounts as $acc ) : ?>
				<tr>
					<td><?php echo esc_html( $acc->label ); ?></td>
					<td><?php echo esc_html( $acc->channel ); ?></td>
					<td><?php echo $acc->is_active ? '✅' : '❌'; ?></td>
					<td>
						<button class="button vp-social-test-btn" data-account-id="<?php echo esc_attr( $acc->id ); ?>">تست اتصال</button>
						<span class="vp-social-test-result" data-account-id="<?php echo esc_attr( $acc->id ); ?>"></span>
					</td>
					<td>
						<form class="vp-social-send-form" data-account-id="<?php echo esc_attr( $acc->id ); ?>">
							<input type="text" name="message" placeholder="متن پیام" required>
							<button class="button">ارسال</button>
						</form>
					</td>
				</tr>
			<?php endforeach; ?>
			<?php if ( empty( $accounts ) ) : ?>
				<tr><td colspan="5">حسابی ثبت نشده است.</td></tr>
			<?php endif; ?>
			</tbody>
		</table>
	</div>
</div>
