<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">صف انتشار</h1>
	<table class="widefat striped">
		<thead><tr><th>عنوان</th><th>نوع</th><th>وضعیت</th><th>سرویس/مدل</th><th>تاریخ</th><th>عملیات</th></tr></thead>
		<tbody>
		<?php foreach ( $jobs as $job ) : ?>
			<tr data-job-id="<?php echo esc_attr( $job->id ); ?>">
				<td><?php echo esc_html( $job->title ); ?></td>
				<td><?php echo esc_html( $job->job_type ); ?></td>
				<td><span class="vp-badge vp-badge-<?php echo esc_attr( $job->status ); ?>"><?php echo esc_html( $job->status ); ?></span></td>
				<td><?php echo esc_html( $job->provider . ' / ' . $job->model ); ?></td>
				<td><?php echo esc_html( $job->created_at ); ?></td>
				<td>
					<?php if ( 'pending_review' === $job->status ) : ?>
						<button class="button button-primary vp-queue-action" data-action="approve">تایید و انتشار</button>
						<button class="button vp-queue-action" data-action="schedule_draft">ذخیره پیش‌نویس</button>
						<button class="button vp-queue-action" data-action="reject">رد</button>
					<?php else : ?>
						<em>—</em>
					<?php endif; ?>
				</td>
			</tr>
		<?php endforeach; ?>
		<?php if ( empty( $jobs ) ) : ?>
			<tr><td colspan="6">صف خالی است.</td></tr>
		<?php endif; ?>
		</tbody>
	</table>
</div>
