<?php if ( ! defined( 'ABSPATH' ) ) exit; ?>
<div class="wrap vp-suite-wrap" dir="rtl">
	<h1 class="vp-title">داشبورد یکپارچه‌ی KPI شبکه (۷ روز گذشته)</h1>

	<div class="vp-card">
		<table class="widefat striped">
			<thead>
				<tr>
					<th>برند / سایت</th>
					<th>محتوای تولیدشده</th>
					<th>در صف بررسی</th>
					<th>خطاها</th>
					<th>سوشال (موفق/ناموفق)</th>
					<th>کلیک واقعی GSC</th>
				</tr>
			</thead>
			<tbody>
				<?php foreach ( $rows as $r ) : ?>
					<tr>
						<td><a href="<?php echo esc_url( $r['url'] ); ?>" target="_blank"><?php echo esc_html( $r['name'] ); ?></a></td>
						<td><?php echo (int) $r['generated_7d']; ?></td>
						<td><?php echo (int) $r['pending_queue']; ?></td>
						<td><?php echo (int) $r['errors_7d']; ?></td>
						<td><?php echo (int) $r['social_sent_7d']; ?> / <?php echo (int) $r['social_failed_7d']; ?></td>
						<td><?php echo $r['gsc_connected'] ? (int) $r['gsc_clicks_7d'] : '—'; ?></td>
					</tr>
				<?php endforeach; ?>
			</tbody>
			<tfoot>
				<tr style="font-weight:bold;">
					<td>مجموع شبکه</td>
					<td><?php echo (int) $totals['generated']; ?></td>
					<td>—</td>
					<td><?php echo (int) $totals['errors']; ?></td>
					<td><?php echo (int) $totals['social_sent']; ?> / <?php echo (int) $totals['social_failed']; ?></td>
					<td><?php echo (int) $totals['gsc_clicks_7d']; ?></td>
				</tr>
			</tfoot>
		</table>
	</div>
</div>
