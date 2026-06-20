<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">کاتالوگ قابلیت‌ها و راهنمای اپراتور</h1>
	<div class="vp-catalog">
		<?php foreach ( $sections as $section ) : ?>
			<div class="vp-card">
				<h2><?php echo esc_html( $section['title'] ); ?></h2>
				<p><?php echo esc_html( $section['desc'] ); ?></p>
				<ol>
					<?php foreach ( $section['steps'] as $step ) : ?>
						<li><?php echo esc_html( $step ); ?></li>
					<?php endforeach; ?>
				</ol>
			</div>
		<?php endforeach; ?>
	</div>
</div>
