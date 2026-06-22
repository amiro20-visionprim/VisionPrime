<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">گزارش عملکرد سیستم</h1>

	<div class="vp-grid">
		<div class="vp-card vp-card-accent">
			<h2>محتوای تولیدشده (۲۴ ساعت)</h2>
			<p class="vp-stat-number"><?php echo (int) $stats['generated_total']; ?></p>
		</div>
		<div class="vp-card">
			<h2>منتشرشده</h2>
			<p class="vp-stat-number"><?php echo (int) $stats['status_counts']['published']; ?></p>
		</div>
		<div class="vp-card">
			<h2>خطاهای سیستم</h2>
			<p class="vp-stat-number <?php echo $stats['errors'] ? 'vp-error' : 'vp-success'; ?>"><?php echo (int) $stats['errors']; ?></p>
		</div>
	</div>

	<nav class="vp-tabs">
		<button type="button" class="vp-tab-btn vp-tab-active" data-tab="breakdown">تفکیک وضعیت و فعالیت‌ها</button>
		<button type="button" class="vp-tab-btn" data-tab="send">ارسال گزارش</button>
		<button type="button" class="vp-tab-btn" data-tab="anomaly">بررسی ناهنجاری</button>
	</nav>

	<section class="vp-tab-panel" data-tab="breakdown">
		<div class="vp-card">
			<h2>تفکیک وضعیت محتوا</h2>
			<table class="widefat striped">
				<thead><tr><th>وضعیت</th><th>تعداد</th></tr></thead>
				<tbody>
				<?php foreach ( $stats['status_counts'] as $status => $count ) : ?>
					<tr><td><span class="vp-badge vp-badge-<?php echo esc_attr( $status ); ?>"><?php echo esc_html( $status ); ?></span></td><td><?php echo (int) $count; ?></td></tr>
				<?php endforeach; ?>
				</tbody>
			</table>
			<h3>سایر فعالیت‌ها</h3>
			<ul>
				<li>اجرای تحلیل رقبا: <?php echo (int) $stats['competitor_runs']; ?></li>
				<li>ارسال سوشال — موفق: <?php echo (int) $stats['social_sent']; ?> / ناموفق: <?php echo (int) $stats['social_failed']; ?></li>
			</ul>
		</div>
	</section>

	<section class="vp-tab-panel" data-tab="send" hidden>
		<div class="vp-card">
			<h2>ارسال گزارش به ادمین/اپراتور</h2>
			<p>گزارش دایجست به‌صورت خودکار هر روز ساعت ۸ صبح ارسال می‌شود. برای ارسال فوری:</p>
			<form id="vp-report-form">
				<table class="form-table">
					<tr>
						<th><label>بازه</label></th>
						<td>
							<select name="hours">
								<option value="24">۲۴ ساعت</option>
								<option value="168">۷ روز</option>
								<option value="720">۳۰ روز</option>
							</select>
						</td>
					</tr>
				</table>
				<p><button class="button button-primary" type="submit">ارسال گزارش الان</button></p>
			</form>
			<div id="vp-report-result"></div>
			<p class="description">گیرندگان گزارش از صفحه‌ی «تنظیمات» قابل تغییر هستند.</p>
		</div>
	</section>

	<section class="vp-tab-panel" data-tab="anomaly" hidden>
		<div class="vp-card">
			<h2>بررسی ناهنجاری (افت کلیک واقعی، اسپایک خطا، شکست سوشال)</h2>
			<p>این بررسی هر روز به‌صورت خودکار اجرا می‌شود و در صورت یافتن ناهنجاری، فوراً ایمیل هشدار می‌فرستد. برای اجرای فوری:</p>
			<p><button id="vp-anomaly-check-btn" class="button">بررسی ناهنجاری الان</button></p>
			<div id="vp-anomaly-result"></div>
		</div>
	</section>
</div>
