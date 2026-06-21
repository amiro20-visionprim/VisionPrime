<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">تولید محتوا و صف انتشار</h1>

	<nav class="vp-tabs">
		<button type="button" class="vp-tab-btn vp-tab-active" data-tab="single">تولید تکی</button>
		<button type="button" class="vp-tab-btn" data-tab="bulk">افزودن انبوه</button>
		<button type="button" class="vp-tab-btn" data-tab="queue">صف انتشار <?php echo $jobs ? '(' . (int) count( $jobs ) . ')' : ''; ?></button>
	</nav>

	<!-- ===================== تولید تکی ===================== -->
	<section class="vp-tab-panel" data-tab="single">
		<div class="vp-card">
			<h2>تولید محتوای سئوشده</h2>
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
						<th><label>مدل (OpenRouter)</label></th>
						<td>
							<select name="model" id="vp-model">
								<?php foreach ( $models as $m ) : ?>
									<option value="<?php echo esc_attr( $m ); ?>"><?php echo esc_html( $m ); ?></option>
								<?php endforeach; ?>
							</select>
						</td>
					</tr>
				</table>
				<p><button class="button button-primary" type="submit">تولید محتوا</button></p>
			</form>
			<div id="vp-generate-result"></div>
		</div>
		<p class="description">پرامپت‌های پیش‌فرض مقاله/محصول از صفحه‌ی «تنظیمات» قابل ویرایش هستند.</p>
	</section>

	<!-- ===================== افزودن انبوه ===================== -->
	<section class="vp-tab-panel" data-tab="bulk" hidden>
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
						<th><label>مدل (OpenRouter)</label></th>
						<td>
							<select name="model" id="vp-bulk-model">
								<?php foreach ( $models as $m ) : ?>
									<option value="<?php echo esc_attr( $m ); ?>"><?php echo esc_html( $m ); ?></option>
								<?php endforeach; ?>
							</select>
						</td>
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
	</section>

	<!-- ===================== صف انتشار ===================== -->
	<section class="vp-tab-panel" data-tab="queue" hidden>
		<div class="vp-card">
			<h2>صف انتشار</h2>
			<table class="widefat striped">
				<thead><tr><th>عنوان</th><th>نوع</th><th>وضعیت</th><th>مدل</th><th>تاریخ</th><th>عملیات</th></tr></thead>
				<tbody>
				<?php foreach ( $jobs as $job ) : ?>
					<tr data-job-id="<?php echo esc_attr( $job->id ); ?>">
						<td><?php echo esc_html( $job->title ); ?></td>
						<td><?php echo esc_html( $job->job_type ); ?></td>
						<td><span class="vp-badge vp-badge-<?php echo esc_attr( $job->status ); ?>"><?php echo esc_html( $job->status ); ?></span></td>
						<td><?php echo esc_html( $job->model ); ?></td>
						<td><?php echo esc_html( $job->created_at ); ?></td>
						<td>
							<?php if ( 'pending_review' === $job->status ) : ?>
								<button class="button button-primary vp-queue-action" data-action="approve">تایید و انتشار</button>
								<button class="button vp-queue-action" data-action="schedule_draft">ذخیره پیش‌نویس</button>
								<button class="button vp-queue-action" data-action="reject">رد</button>
								<div class="vp-schedule-row">
									<input type="datetime-local" class="vp-schedule-input">
									<button class="button vp-queue-schedule">زمان‌بندی انتشار</button>
								</div>
							<?php elseif ( 'scheduled' === $job->status ) : ?>
								<span class="vp-badge vp-badge-info">انتشار در: <?php echo esc_html( $job->scheduled_at ); ?></span>
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
	</section>
</div>
