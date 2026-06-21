<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">سرچ کنسول گوگل — شکار پوزیشن با داده‌ی واقعی</h1>

	<div class="vp-card vp-gsc-steps">
		<ol style="display:flex;gap:10px;list-style:none;padding:0;margin:0;flex-wrap:wrap;">
			<li class="vp-step <?php echo $configured ? 'vp-step-done' : 'vp-step-active'; ?>">۱. ساخت OAuth Client + ذخیره در تنظیمات</li>
			<li class="vp-step <?php echo $configured ? ( $connected ? 'vp-step-done' : 'vp-step-active' ) : ''; ?>">۲. اتصال به حساب گوگل</li>
			<li class="vp-step <?php echo $connected ? 'vp-step-active' : ''; ?>">۳. انتخاب پراپرتی و شکار پوزیشن</li>
		</ol>
	</div>

	<?php if ( ! $configured ) : ?>
		<div class="vp-card">
			<h2>گام ۱ از ۳ — پیکربندی OAuth (یک‌بار، برای این سایت)</h2>
			<ol style="line-height:2;">
				<li>وارد <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud Console</a> شوید و یک <strong>OAuth Client (Web application)</strong> بسازید.</li>
				<li><strong>Google Search Console API</strong> را برای همان پروژه فعال کنید.</li>
				<li>آدرس زیر را عیناً به‌عنوان <strong>Authorized redirect URI</strong> اضافه کنید:
					<br>
					<span style="display:inline-flex;align-items:center;gap:6px;margin-top:6px;">
						<code id="vp-gsc-redirect" style="background:#f1f1f1;padding:6px 10px;display:inline-block;border-radius:4px;direction:ltr;"><?php echo esc_html( $redirect_uri ); ?></code>
						<button type="button" class="button vp-copy-btn" data-copy-target="vp-gsc-redirect">کپی</button>
					</span>
				</li>
				<li><code>Client ID</code> و <code>Client Secret</code> را در صفحه‌ی <a href="<?php echo esc_url( admin_url( 'admin.php?page=vp-suite-settings' ) ); ?>">تنظیمات</a> وارد و ذخیره کنید.</li>
			</ol>
			<p class="description">⚠️ این مراحل فقط یک‌بار برای هر سایت لازم است؛ پس از ذخیره‌ی Client ID/Secret این صفحه خودش به گام بعد می‌رود.</p>
		</div>

	<?php elseif ( ! $connected ) : ?>
		<div class="vp-card">
			<h2>گام ۲ از ۳ — اتصال به حساب گوگل</h2>
			<p>✅ OAuth Client ذخیره شده است.</p>
			<p class="description">حالا با همان حساب گوگلی که سایت‌ها (پراپرتی‌ها) در Search Console آن ثبت‌اند وارد شوید.</p>
			<p><a class="button button-primary button-hero" href="<?php echo esc_url( $auth_url ); ?>">🔗 اتصال به Google Search Console</a></p>
			<p class="description">اگر با خطای <code>redirect_uri_mismatch</code> مواجه شدید، آدرس گام قبل را دوباره با دقت در Google Cloud Console بررسی کنید (باید دقیقاً یکسان باشد).</p>
		</div>

	<?php else : ?>
		<div class="vp-card">
			<h2>گام ۳ از ۳ — وضعیت اتصال</h2>
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
