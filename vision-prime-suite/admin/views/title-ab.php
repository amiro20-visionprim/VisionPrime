<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">تست A/B عنوان بر اساس CTR واقعی Search Console</h1>

	<div class="vp-card">
		<p>هر بار که عنوان یک پست منتشرشده تغییر کند، این ماژول بازه‌ی زمانی عنوان قبلی را می‌بندد و عنوان جدید را با تاریخ شروع ثبت می‌کند. این صفحه برای هر بازه، کلیک/ایمپرشن/CTR واقعی همان آدرس را از Search Console می‌گیرد و عنوان‌ها را بر اساس CTR واقعی مقایسه می‌کند — نه تخمین هوش مصنوعی.</p>
		<?php if ( ! $gsc_connected ) : ?>
			<p class="vp-error">برای مقایسه‌ی CTR ابتدا از منوی «سرچ کنسول» به Google متصل شوید.</p>
		<?php endif; ?>
		<p>
			<label>پست:
				<select id="vp-title-ab-post" class="regular-text">
					<option value="">— انتخاب کنید —</option>
					<?php foreach ( $posts as $p ) : ?>
						<option value="<?php echo esc_attr( $p->ID ); ?>"><?php echo esc_html( $p->post_title ); ?></option>
					<?php endforeach; ?>
				</select>
			</label>
			<button id="vp-title-ab-btn" class="button button-primary">مقایسه عنوان‌ها</button>
		</p>
	</div>

	<div id="vp-title-ab-result"></div>
</div>
