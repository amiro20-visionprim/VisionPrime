<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">سرچ کنسول گوگل — شکار پوزیشن با داده‌ی واقعی</h1>

	<?php if ( ! $configured ) : ?>
		<div class="vp-card">
			<h2>اتصال هنوز پیکربندی نشده</h2>
			<p class="description">
				برای استفاده از داده‌ی واقعی، ابتدا یک <strong>OAuth Client</strong> در
				<a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud Console</a>
				بسازید و <code>Client ID</code> و <code>Client Secret</code> را در صفحه‌ی
				<a href="<?php echo esc_url( admin_url( 'admin.php?page=vp-suite-settings' ) ); ?>">تنظیمات</a> وارد کنید.
			</p>
			<p class="description">
				در تنظیمات OAuth، حتماً این آدرس را به‌عنوان <strong>Authorized redirect URI</strong> اضافه کنید:
			</p>
			<p><code style="background:#f1f1f1;padding:6px 10px;display:inline-block;border-radius:4px;direction:ltr;"><?php echo esc_html( $redirect_uri ); ?></code></p>
			<p class="description">و API مربوطه را فعال کنید: <strong>Google Search Console API</strong>.</p>
		</div>

	<?php elseif ( ! $connected ) : ?>
		<div class="vp-card">
			<h2>اتصال به حساب گوگل</h2>
			<p class="description">پیکربندی انجام شده است. حالا با حساب گوگلی که سایت‌ها در سرچ کنسول آن ثبت‌اند وارد شوید.</p>
			<p><a class="button button-primary button-hero" href="<?php echo esc_url( $auth_url ); ?>">🔗 اتصال به Google Search Console</a></p>
		</div>

	<?php else : ?>
		<div class="vp-card">
			<h2>وضعیت اتصال</h2>
			<p>
				✅ متصل
				<?php if ( ! empty( $connection['connected_email'] ) ) : ?>
					به <strong><?php echo esc_html( $connection['connected_email'] ); ?></strong>
				<?php endif; ?>
			</p>
			<table class="form-table">
				<tr>
					<th><label>پراپرتی (سایت)</label></th>
					<td>
						<select id="vp-gsc-site" style="min-width:320px;">
							<?php if ( ! empty( $connection['site_url'] ) ) : ?>
								<option value="<?php echo esc_attr( $connection['site_url'] ); ?>" selected><?php echo esc_html( $connection['site_url'] ); ?></option>
							<?php else : ?>
								<option value="">— برای بارگذاری لیست، روی «بارگذاری سایت‌ها» بزنید —</option>
							<?php endif; ?>
						</select>
						<button class="button" id="vp-gsc-load-sites" type="button">بارگذاری سایت‌ها</button>
					</td>
				</tr>
				<tr>
					<th><label>بازه‌ی زمانی</label></th>
					<td>
						<select id="vp-gsc-days">
							<option value="28">۲۸ روز اخیر</option>
							<option value="90" selected>۹۰ روز اخیر</option>
							<option value="180">۶ ماه اخیر</option>
						</select>
					</td>
				</tr>
			</table>
			<p>
				<button class="button button-primary" id="vp-gsc-hunt" type="button">🎯 شکار پوزیشن (داده‌ی واقعی)</button>
				<button class="button" id="vp-gsc-strategy" type="button">🧠 استراتژی هوش مصنوعی روی داده‌ی واقعی</button>
				<a class="button" href="<?php echo esc_url( wp_nonce_url( add_query_arg( 'vp_gsc_disconnect', 1, $redirect_uri ), 'vp_gsc_disconnect' ) ); ?>" onclick="return confirm('اتصال قطع شود؟');">قطع اتصال</a>
			</p>
		</div>

		<div id="vp-gsc-result"></div>

		<div class="vp-card">
			<h2>راهنمای تفسیر</h2>
			<ul style="line-height:2;">
				<li><strong>فاصله‌ی نزدیک (صفحه ۲):</strong> کوئری‌هایی که در پوزیشن ۱۱ تا ۲۰ هستند و ایمپرشن واقعی دارند — با کمی تقویت محتوا و لینک‌سازی داخلی به صفحه‌ی اول می‌رسند. <em>اولویت اصلی شکار.</em></li>
				<li><strong>CTR پایین:</strong> کوئری‌هایی که رتبه‌ی خوبی دارند ولی کلیک کمتری از حد انتظار می‌گیرند — با بازنویسی عنوان و متادسکریپشن سریع رشد می‌کنند.</li>
				<li><strong>شکاف محتوایی:</strong> کوئری‌های پرایمپرشن با رتبه‌ی دورتر از صفحه ۲ — نیازمند محتوای جدید یا تقویت اساسی.</li>
			</ul>
		</div>
	<?php endif; ?>
</div>
