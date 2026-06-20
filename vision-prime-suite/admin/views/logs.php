<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">گزارش‌ها و لاگ سیستم</h1>
	<table class="widefat striped">
		<thead><tr><th>ماژول</th><th>سطح</th><th>پیام</th><th>تاریخ</th></tr></thead>
		<tbody>
		<?php foreach ( $logs as $log ) : ?>
			<tr>
				<td><?php echo esc_html( $log->module ); ?></td>
				<td><span class="vp-badge vp-badge-<?php echo esc_attr( $log->level ); ?>"><?php echo esc_html( $log->level ); ?></span></td>
				<td><?php echo esc_html( $log->message ); ?></td>
				<td><?php echo esc_html( $log->created_at ); ?></td>
			</tr>
		<?php endforeach; ?>
		<?php if ( empty( $logs ) ) : ?>
			<tr><td colspan="4">رویدادی ثبت نشده است.</td></tr>
		<?php endif; ?>
		</tbody>
	</table>
</div>
