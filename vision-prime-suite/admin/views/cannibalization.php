<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">تشخیص کانیبالیزیشن کلمه‌ی کلیدی</h1>

	<div class="vp-card">
		<p>این ابزار با داده‌ی واقعی بررسی می‌کند که آیا چند صفحه روی همین سایت برای یک کوئری در سرچ کنسول رقابت می‌کنند (کانیبالیزیشن داخلی)، و آیا چند سایت از هلدینگ روی یک کلمه‌ی کلیدی یکسان کار می‌کنند (رقابت بین‌برندی ناخواسته).</p>
		<p>
			<label>بازه (روز): <input type="number" id="vp-cannibal-days" value="90" min="7" max="365" class="small-text"></label>
			<button id="vp-cannibal-scan" class="button button-primary">شروع بررسی</button>
		</p>
		<?php if ( ! $gsc_connected ) : ?>
			<p class="vp-error">برای تشخیص کانیبالیزیشن داخلی ابتدا از منوی «سرچ کنسول» به Google متصل شوید؛ بررسی بین‌برندی بدون نیاز به این اتصال انجام می‌شود.</p>
		<?php endif; ?>
		<?php if ( ! $is_multisite ) : ?>
			<p class="vp-error">بررسی بین‌برندی فقط روی شبکه‌ی چندسایتی (Multisite) معنا دارد.</p>
		<?php endif; ?>
	</div>

	<div id="vp-cannibal-result"></div>
</div>
