<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/** @var array $catalog */
?>
<div class="wrap vpos-help-wrap">
	<h1>آموزش و راهنمای اپراتور</h1>
	<p class="description">راهنمای تصویری هر بخش از VisionPrime OS — هر کارت توضیح می‌دهد آن بخش چه کاری می‌کند و اپراتور چطور باید از آن استفاده کند.</p>

	<?php foreach ( $catalog as $section ) : ?>
		<h2 class="vpos-help-group"><?php echo esc_html( $section['group'] ); ?></h2>
		<div class="vpos-help-grid">
			<?php foreach ( $section['items'] as $item ) : ?>
				<div class="vpos-help-card">
					<div class="vpos-help-card__head">
						<span class="dashicons <?php echo esc_attr( $item['icon'] ); ?>"></span>
						<h3><?php echo esc_html( $item['title'] ); ?></h3>
					</div>
					<p class="vpos-help-card__desc"><?php echo esc_html( $item['desc'] ); ?></p>
					<ol class="vpos-help-card__steps">
						<?php foreach ( $item['steps'] as $step ) : ?>
							<li><?php echo esc_html( $step ); ?></li>
						<?php endforeach; ?>
					</ol>
					<div class="vpos-help-card__footer">
						<?php if ( $item['perm'] ) : ?>
							<code class="vpos-help-card__perm"><?php echo esc_html( $item['perm'] ); ?></code>
						<?php endif; ?>
						<?php if ( $item['page'] ) : ?>
							<a class="button button-primary" href="<?php echo esc_url( admin_url( 'admin.php?page=' . $item['page'] ) ); ?>">ورود به بخش</a>
						<?php endif; ?>
					</div>
				</div>
			<?php endforeach; ?>
		</div>
	<?php endforeach; ?>
</div>
