<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">تقویم محتوایی</h1>

	<div class="vp-card">
		<h2>افزودن مورد به تقویم</h2>
		<form id="vp-calendar-form">
			<table class="form-table">
				<tr>
					<th><label>نوع</label></th>
					<td>
						<select name="job_type">
							<option value="article">مقاله</option>
							<option value="product">محصول</option>
						</select>
					</td>
				</tr>
				<tr><th><label>موضوع</label></th><td><input type="text" name="topic" class="regular-text" required></td></tr>
				<tr><th><label>کلمه‌ی کلیدی</label></th><td><input type="text" name="keyword" class="regular-text"></td></tr>
				<tr>
					<th><label>سرویس</label></th>
					<td>
						<select name="provider">
							<?php foreach ( $providers as $key => $p ) : ?>
								<option value="<?php echo esc_attr( $key ); ?>"><?php echo esc_html( $p['label'] ); ?></option>
							<?php endforeach; ?>
						</select>
					</td>
				</tr>
				<tr><th><label>زمان تولید</label></th><td><input type="datetime-local" name="scheduled_at" required></td></tr>
				<tr>
					<th><label>انتشار خودکار</label></th>
					<td><label><input type="checkbox" name="auto_publish"> بعد از تولید، بدون نیاز به تایید دستی منتشر شود</label></td>
				</tr>
			</table>
			<p><button class="button button-primary" type="submit">افزودن به تقویم</button></p>
		</form>
	</div>

	<div class="vp-card vp-card-accent">
		<h2>🧠 برنامه‌ی هوشمند روزانه (با یک پرامپت)</h2>
		<p class="description" style="color:#eee;">به‌جای افزودن تک‌تک، یک بریف کلی بده تا هوش مصنوعی برای کل روز موضوع، کلمه‌ی کلیدی و نوع محتوا تولید کند و خودش با فاصله‌ی زمانی منطقی در همان روز به تقویم اضافه شود.</p>
		<form id="vp-calendar-smart-form">
			<table class="form-table">
				<tr>
					<th><label style="color:#fff;">بریف / موضوع کلی روز</label></th>
					<td><textarea name="brief" rows="3" class="large-text" placeholder="مثلاً: امروز روی محصولات تخفیف‌دار و راهنمای خرید فصل تمرکز کن..." required></textarea></td>
				</tr>
				<tr>
					<th><label style="color:#fff;">تاریخ</label></th>
					<td><input type="date" name="date" required></td>
				</tr>
				<tr>
					<th><label style="color:#fff;">تعداد آیتم</label></th>
					<td><input type="number" name="count" value="5" min="1" max="30"></td>
				</tr>
				<tr>
					<th><label style="color:#fff;">سرویس</label></th>
					<td>
						<select name="provider">
							<?php foreach ( $providers as $key => $p ) : ?>
								<option value="<?php echo esc_attr( $key ); ?>"><?php echo esc_html( $p['label'] ); ?></option>
							<?php endforeach; ?>
						</select>
					</td>
				</tr>
				<tr>
					<th><label style="color:#fff;">انتشار خودکار</label></th>
					<td><label style="color:#fff;"><input type="checkbox" name="auto_publish"> بدون تایید دستی منتشر شود</label></td>
				</tr>
			</table>
			<p><button class="button button-primary" type="submit">📅 ساخت برنامه‌ی روزانه</button></p>
		</form>
		<div id="vp-calendar-smart-result"></div>
	</div>

	<div class="vp-card">
		<h2>برنامه‌ی پیش‌رو</h2>
		<table class="widefat striped">
			<thead><tr><th>موضوع</th><th>نوع</th><th>کلمه‌ی کلیدی</th><th>زمان</th><th>انتشار خودکار</th><th>وضعیت</th><th>عملیات</th></tr></thead>
			<tbody>
			<?php foreach ( $entries as $e ) : ?>
				<tr data-entry-id="<?php echo esc_attr( $e->id ); ?>">
					<td><?php echo esc_html( $e->topic ); ?></td>
					<td><?php echo esc_html( $e->job_type ); ?></td>
					<td><?php echo esc_html( $e->keyword ); ?></td>
					<td><?php echo esc_html( $e->scheduled_at ); ?></td>
					<td><?php echo $e->auto_publish ? '✅' : '❌'; ?></td>
					<td><span class="vp-badge"><?php echo esc_html( $e->status ); ?></span></td>
					<td>
						<?php if ( 'pending' === $e->status ) : ?>
							<button class="button vp-calendar-delete">حذف</button>
						<?php else : ?>
							<em>—</em>
						<?php endif; ?>
					</td>
				</tr>
			<?php endforeach; ?>
			<?php if ( empty( $entries ) ) : ?>
				<tr><td colspan="7">موردی در تقویم ثبت نشده است.</td></tr>
			<?php endif; ?>
			</tbody>
		</table>
		<p class="description">هر مورد در زمان تعیین‌شده به‌صورت خودکار توسط زمان‌بند سیستم تولید می‌شود و در «صف انتشار» قرار می‌گیرد؛ اگر «انتشار خودکار» فعال باشد، بدون نیاز به تایید دستی منتشر می‌شود.</p>
	</div>
</div>
