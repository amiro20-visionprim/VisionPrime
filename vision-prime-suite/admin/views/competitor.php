<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">تحلیل رقبا و موقعیت‌یابی سئو</h1>

	<nav class="vp-tabs">
		<button type="button" class="vp-tab-btn vp-tab-active" data-tab="analyze">اجرای تحلیل جدید</button>
		<button type="button" class="vp-tab-btn" data-tab="history">تاریخچه‌ی گزارش‌ها <?php echo $reports ? '(' . (int) count( $reports ) . ')' : ''; ?></button>
	</nav>

	<section class="vp-tab-panel" data-tab="analyze">
		<div class="vp-card">
			<h2>تحلیل کلمه‌ی کلیدی و رقبا</h2>
			<form id="vp-competitor-form">
				<table class="form-table">
					<tr><th><label>کلمه‌ی کلیدی هدف</label></th><td><input type="text" name="keyword" class="regular-text" required></td></tr>
					<tr><th><label>رقبا (اختیاری، هر خط یک URL)</label></th><td><textarea name="competitors" rows="4" class="large-text"></textarea></td></tr>
				</table>
				<p><button class="button button-primary" type="submit">اجرای تحلیل</button></p>
			</form>
			<div id="vp-competitor-result"></div>
		</div>
	</section>

	<section class="vp-tab-panel" data-tab="history" hidden>
		<div class="vp-card">
			<h2>تاریخچه‌ی گزارش‌ها</h2>
			<table class="widefat striped">
				<thead><tr><th>کلمه‌ی کلیدی</th><th>وضعیت</th><th>تاریخ</th></tr></thead>
				<tbody>
				<?php foreach ( $reports as $r ) : ?>
					<tr><td><?php echo esc_html( $r->keyword ); ?></td><td><?php echo esc_html( $r->status ); ?></td><td><?php echo esc_html( $r->created_at ); ?></td></tr>
				<?php endforeach; ?>
				<?php if ( empty( $reports ) ) : ?>
					<tr><td colspan="3">گزارشی ثبت نشده است.</td></tr>
				<?php endif; ?>
				</tbody>
			</table>
		</div>
	</section>
</div>
