<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">گزارش عملکرد سیستم</h1>

	<div class="vp-grid">
		<div class="vp-card vp-card-accent">
			<h2>محتوای تولیدشده (۲۴ ساعت)</h2>
			<p style="font-size:28px;font-weight:700;"><?php echo (int) $stats['generated_total']; ?></p>
		</div>
		<div class="vp-card">
			<h2>منتشرشده</h2>
			<p style="font-size:28px;font-weight:700;"><?php echo (int) $stats['status_counts']['published']; ?></p>
		</div>
		<div class="vp-card">
			<h2>خطاهای سیستم</h2>
			<p style="font-size:28px;font-weight:700;color:<?php echo $stats['errors'] ? '#991b1b' : '#166534'; ?>;"><?php echo (int) $stats['errors']; ?></p>
		</div>
	</div>

	<div class="vp-two-col">
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

		<div class="vp-card">
			<h2>ارسال گزارش به ادمین/اپراتور</h2>
			<p>گزارش دایجست به‌صورت خودکار هر روز ساعت ۸ صبح ارسال می‌شود. برای ارسال فوری:</p>
			<form id="vp-report-form">
				<p>
					<label>بازه (ساعت): </label>
					<select name="hours">
						<option value="24">۲۴ ساعت</option>
						<option value="168">۷ روز</option>
						<option value="720">۳۰ روز</option>
					</select>
				</p>
				<p><button class="button button-primary" type="submit">ارسال گزارش الان</button></p>
			</form>
			<div id="vp-report-result"></div>
			<p class="description">گیرندگان گزارش از صفحه‌ی «تنظیمات» قابل تغییر هستند.</p>
		</div>
	</div>
</div>
