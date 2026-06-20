<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">داشبورد VisionPrime Suite</h1>

	<div class="vp-grid">
		<div class="vp-card vp-card-accent">
			<h2>سرویس‌های هوش مصنوعی فعال</h2>
			<p><?php echo count( $providers ); ?> سرویس / <?php echo count( VP_AI_Providers::all_models() ); ?> مدل قابل سوییچ.</p>
		</div>
		<div class="vp-card">
			<h2>وضعیت Rank Math</h2>
			<p><?php echo VP_Rankmath_Sync::is_active() ? '✅ متصل و فعال' : '⚠️ نصب/فعال نیست'; ?></p>
		</div>
		<div class="vp-card">
			<h2>آیتم‌های در صف</h2>
			<p><?php echo count( VP_Queue::get_jobs( 'pending_review', 999 ) ); ?> در انتظار بررسی</p>
		</div>
	</div>

	<div class="vp-two-col">
		<div class="vp-card">
			<h2>آخرین آیتم‌های تولیدشده</h2>
			<table class="widefat striped">
				<thead><tr><th>عنوان</th><th>نوع</th><th>وضعیت</th><th>مدل</th></tr></thead>
				<tbody>
				<?php foreach ( $jobs as $job ) : ?>
					<tr>
						<td><?php echo esc_html( $job->title ); ?></td>
						<td><?php echo esc_html( $job->job_type ); ?></td>
						<td><span class="vp-badge vp-badge-<?php echo esc_attr( $job->status ); ?>"><?php echo esc_html( $job->status ); ?></span></td>
						<td><?php echo esc_html( $job->model ); ?></td>
					</tr>
				<?php endforeach; ?>
				<?php if ( empty( $jobs ) ) : ?>
					<tr><td colspan="4">هنوز محتوایی تولید نشده است.</td></tr>
				<?php endif; ?>
				</tbody>
			</table>
		</div>

		<div class="vp-card">
			<h2>آخرین رویدادهای سیستم</h2>
			<ul class="vp-log-list">
				<?php foreach ( $logs as $log ) : ?>
					<li class="vp-log-<?php echo esc_attr( $log->level ); ?>">
						<strong><?php echo esc_html( $log->module ); ?></strong> — <?php echo esc_html( $log->message ); ?>
						<span class="vp-log-time"><?php echo esc_html( $log->created_at ); ?></span>
					</li>
				<?php endforeach; ?>
				<?php if ( empty( $logs ) ) : ?>
					<li>رویدادی ثبت نشده است.</li>
				<?php endif; ?>
			</ul>
		</div>
	</div>
</div>
