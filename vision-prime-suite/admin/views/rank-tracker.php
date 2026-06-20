<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">تاریخچه رتبه و تشخیص افت محتوا</h1>

	<div class="vp-card">
		<p>این بخش هر روز یک اسنپ‌شات واقعی از داده‌ی Search Console (پوزیشن، ایمپرشن، کلیک، CTR) ذخیره می‌کند تا روند رتبه‌ی هر کوئری/صفحه در طول زمان قابل پیگیری باشد و افت ترافیک واقعی صفحات شناسایی شود.</p>
		<?php if ( ! $gsc_connected ) : ?>
			<p class="vp-error">برای جمع‌آوری اسنپ‌شات ابتدا از منوی «سرچ کنسول» به Google متصل شوید.</p>
		<?php endif; ?>
	</div>

	<div class="vp-card">
		<h2>تاریخچه‌ی رتبه</h2>
		<p>
			<label>کوئری: <input type="text" id="vp-rank-query" class="regular-text"></label>
			<label>صفحه: <input type="text" id="vp-rank-page" class="regular-text"></label>
			<button id="vp-rank-history-btn" class="button button-primary">نمایش تاریخچه</button>
		</p>
		<div id="vp-rank-history-result"></div>
	</div>

	<div class="vp-card">
		<h2>تشخیص افت محتوا (Content Decay)</h2>
		<p>
			<label>بازه‌ی مقایسه (روز): <input type="number" id="vp-decay-window" value="30" min="7" max="180" class="small-text"></label>
			<label>حداقل درصد افت: <input type="number" id="vp-decay-ratio" value="25" min="5" max="90" class="small-text"></label>
			<button id="vp-decay-scan-btn" class="button button-primary">بررسی افت محتوا</button>
		</p>
		<div id="vp-decay-result"></div>
	</div>
</div>
