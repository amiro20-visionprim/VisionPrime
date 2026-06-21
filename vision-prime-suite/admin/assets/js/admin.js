(function ($) {
	'use strict';

	function postAjax(action, data) {
		return $.post(VPSuite.ajaxUrl, Object.assign({ action: action, nonce: VPSuite.nonce }, data));
	}

	$(function () {
		// --- Generate page: dynamic model list per provider ---
		var $providerSelect = $('#vp-provider');
		var $modelSelect = $('#vp-model');

		function refreshModels() {
			if (!window.VPProviders || !$providerSelect.length) return;
			var provider = window.VPProviders[$providerSelect.val()];
			$modelSelect.empty();
			if (provider && provider.models) {
				provider.models.forEach(function (m) {
					$modelSelect.append($('<option>').val(m).text(m));
				});
			}
		}
		$providerSelect.on('change', refreshModels);
		refreshModels();

		$('#vp-generate-form').on('submit', function (e) {
			e.preventDefault();
			var $form = $(this);
			var $result = $('#vp-generate-result');
			$result.html('<p>در حال تولید محتوا...</p>');

			postAjax('vp_generate_content', {
				content_type: $form.find('[name=content_type]').val(),
				topic: $form.find('[name=topic]').val(),
				keyword: $form.find('[name=keyword]').val(),
				provider: $form.find('[name=provider]').val(),
				model: $form.find('[name=model]').val()
			}).done(function (res) {
				if (res.success) {
					$result.html('<div class="vp-card"><h3>پیش‌نمایش (وضعیت: در انتظار بررسی)</h3>' + res.data.content + '</div>');
				} else {
					$result.html('<p class="vp-error">' + res.data.message + '</p>');
				}
			}).fail(function () {
				$result.html('<p class="vp-error">خطای ارتباط با سرور.</p>');
			});
		});

		// --- Queue actions ---
		$(document).on('click', '.vp-queue-action', function () {
			var $btn = $(this);
			var $row = $btn.closest('tr');
			var jobId = $row.data('job-id');
			var action = $btn.data('action');

			$btn.prop('disabled', true);
			postAjax('vp_queue_action', { job_id: jobId, queue_action: action }).done(function (res) {
				if (res.success) {
					location.reload();
				} else {
					alert(res.data.message);
					$btn.prop('disabled', false);
				}
			});
		});

		// --- Competitor analysis ---
		$('#vp-competitor-form').on('submit', function (e) {
			e.preventDefault();
			var $form = $(this);
			var $result = $('#vp-competitor-result');
			$result.html('<p>در حال تحلیل...</p>');

			postAjax('vp_competitor_scan', {
				keyword: $form.find('[name=keyword]').val(),
				competitors: $form.find('[name=competitors]').val()
			}).done(function (res) {
				if (res.success) {
					$result.html('<div class="vp-card"><pre>' + JSON.stringify(res.data, null, 2) + '</pre></div>');
				} else {
					$result.html('<p class="vp-error">' + res.data.message + '</p>');
				}
			});
		});

		// --- Review assistant ---
		$('#vp-review-form').on('submit', function (e) {
			e.preventDefault();
			var $form = $(this);
			var postId = $form.find('[name=post_id]').val();
			var $result = $('#vp-review-result');
			$result.html('<p>در حال بررسی...</p>');

			postAjax('vp_review_scan', { post_id: postId }).done(function (res) {
				if (!res.success) {
					$result.html('<p class="vp-error">' + res.data.message + '</p>');
					return;
				}
				var s = res.data.suggestions;
				var html = '<div class="vp-card"><pre>' + JSON.stringify(s, null, 2) + '</pre>' +
					'<button class="button button-primary vp-apply-review">تایید و اعمال روی پست</button></div>';
				$result.html(html).find('.vp-apply-review').data('post-id', postId).data('suggestions', s);
			});
		});

		$(document).on('click', '.vp-apply-review', function () {
			var $btn = $(this);
			postAjax('vp_review_apply', {
				post_id: $btn.data('post-id'),
				suggestions: JSON.stringify($btn.data('suggestions'))
			}).done(function (res) {
				alert(res.success ? 'اعمال شد.' : res.data.message);
			});
		});

		// --- Social: add account ---
		$('#vp-social-account-form').on('submit', function (e) {
			e.preventDefault();
			var $form = $(this);
			postAjax('vp_social_save_account', {
				channel: $form.find('[name=channel]').val(),
				label: $form.find('[name=label]').val(),
				config: $form.find('[name=config]').val()
			}).done(function (res) {
				if (res.success) location.reload();
				else alert(res.data.message);
			});
		});

		// --- Reports: send on demand ---
		$('#vp-report-form').on('submit', function (e) {
			e.preventDefault();
			var $result = $('#vp-report-result');
			$result.html('<p>در حال ارسال گزارش...</p>');
			postAjax('vp_send_report', { hours: $(this).find('[name=hours]').val() }).done(function (res) {
				$result.html('<p class="' + (res.success ? '' : 'vp-error') + '">' +
					(res.success ? res.data.message : res.data.message) + '</p>');
			}).fail(function () {
				$result.html('<p class="vp-error">خطای ارتباط با سرور.</p>');
			});
		});

		// --- Queue: schedule a timed publish ---
		$(document).on('click', '.vp-queue-schedule', function () {
			var $row = $(this).closest('tr');
			var when = $row.find('.vp-schedule-input').val();
			if (!when) { alert('ابتدا زمان انتشار را انتخاب کنید.'); return; }
			postAjax('vp_queue_action', {
				job_id: $row.data('job-id'),
				queue_action: 'schedule',
				scheduled_at: when
			}).done(function (res) {
				if (res.success) location.reload();
				else alert(res.data.message);
			});
		});

		// --- Social: send test message ---
		$(document).on('submit', '.vp-social-send-form', function (e) {
			e.preventDefault();
			var $form = $(this);
			postAjax('vp_social_send', {
				account_id: $form.data('account-id'),
				message: $form.find('[name=message]').val()
			}).done(function (res) {
				alert(res.success ? 'ارسال شد.' : res.data.message);
			});
		});

		// --- Content calendar ---
		$('#vp-calendar-form').on('submit', function (e) {
			e.preventDefault();
			var $form = $(this);
			postAjax('vp_calendar_add', {
				job_type: $form.find('[name=job_type]').val(),
				topic: $form.find('[name=topic]').val(),
				keyword: $form.find('[name=keyword]').val(),
				provider: $form.find('[name=provider]').val(),
				scheduled_at: $form.find('[name=scheduled_at]').val(),
				auto_publish: $form.find('[name=auto_publish]').is(':checked') ? 1 : 0
			}).done(function (res) {
				if (res.success) location.reload();
				else alert(res.data.message);
			});
		});

		$(document).on('click', '.vp-calendar-delete', function () {
			var $row = $(this).closest('tr');
			postAjax('vp_calendar_delete', { id: $row.data('entry-id') }).done(function (res) {
				if (res.success) $row.remove();
			});
		});

		// --- Keyword cannibalization detection ---
		$('#vp-cannibal-scan').on('click', function () {
			var $btn = $(this).prop('disabled', true);
			var $result = $('#vp-cannibal-result');
			$result.html('<p>در حال بررسی...</p>');

			postAjax('vp_cannibalization_scan', { days: $('#vp-cannibal-days').val() }).done(function (res) {
				if (!res.success) { $result.html('<p class="vp-error">' + res.data.message + '</p>'); return; }
				var html = '';

				html += '<div class="vp-card"><h2>کانیبالیزیشن داخلی (همین سایت)</h2>';
				if (res.data.within_site && res.data.within_site.message) {
					html += '<p class="vp-error">' + res.data.within_site.message + '</p>';
				} else if (!res.data.within_site || !res.data.within_site.length) {
					html += '<p>موردی یافت نشد.</p>';
				} else {
					res.data.within_site.forEach(function (item) {
						html += '<h4>«' + item.query + '» — ' + item.pages.length + ' صفحه‌ی رقیب</h4><table class="widefat striped"><thead><tr><th>صفحه</th><th>پوزیشن</th><th>ایمپرشن</th><th>کلیک</th></tr></thead><tbody>';
						item.pages.forEach(function (p) {
							html += '<tr><td>' + p.page + '</td><td>' + p.position + '</td><td>' + p.impressions + '</td><td>' + p.clicks + '</td></tr>';
						});
						html += '</tbody></table>';
					});
				}
				html += '</div>';

				html += '<div class="vp-card"><h2>کانیبالیزیشن بین‌برندی (شبکه‌ی هلدینگ)</h2>';
				if (!res.data.cross_site || !res.data.cross_site.length) {
					html += '<p>موردی یافت نشد.</p>';
				} else {
					res.data.cross_site.forEach(function (item) {
						html += '<h4>«' + item.keyword + '» — ' + item.entries.length + ' سایت</h4><table class="widefat striped"><thead><tr><th>سایت</th><th>عنوان</th></tr></thead><tbody>';
						item.entries.forEach(function (e) {
							html += '<tr><td>' + e.site_name + '</td><td><a href="' + e.url + '" target="_blank">' + e.title + '</a></td></tr>';
						});
						html += '</tbody></table>';
					});
				}
				html += '</div>';

				$result.html(html);
			}).fail(function () {
				$result.html('<p class="vp-error">خطای ارتباط با سرور.</p>');
			}).always(function () { $btn.prop('disabled', false); });
		});

		// --- Rank history + content decay detection ---
		$('#vp-rank-history-btn').on('click', function () {
			var $btn = $(this).prop('disabled', true);
			var $result = $('#vp-rank-history-result');
			$result.html('<p>در حال بارگذاری...</p>');

			postAjax('vp_rank_history', {
				query: $('#vp-rank-query').val(),
				page: $('#vp-rank-page').val()
			}).done(function (res) {
				if (!res.success) { $result.html('<p class="vp-error">' + res.data.message + '</p>'); return; }
				if (!res.data.length) { $result.html('<p>داده‌ای یافت نشد.</p>'); return; }
				var html = '<table class="widefat striped"><thead><tr><th>تاریخ</th><th>کوئری</th><th>صفحه</th><th>پوزیشن</th><th>ایمپرشن</th><th>کلیک</th><th>CTR</th></tr></thead><tbody>';
				res.data.forEach(function (r) {
					html += '<tr><td>' + r.snapshot_date + '</td><td>' + r.query + '</td><td>' + r.page + '</td><td>' + r.position + '</td><td>' + r.impressions + '</td><td>' + r.clicks + '</td><td>' + r.ctr + '%</td></tr>';
				});
				html += '</tbody></table>';
				$result.html(html);
			}).fail(function () {
				$result.html('<p class="vp-error">خطای ارتباط با سرور.</p>');
			}).always(function () { $btn.prop('disabled', false); });
		});

		$('#vp-decay-scan-btn').on('click', function () {
			var $btn = $(this).prop('disabled', true);
			var $result = $('#vp-decay-result');
			$result.html('<p>در حال بررسی...</p>');

			postAjax('vp_rank_decay', {
				window_days: $('#vp-decay-window').val(),
				decline_ratio: $('#vp-decay-ratio').val()
			}).done(function (res) {
				if (!res.success) { $result.html('<p class="vp-error">' + res.data.message + '</p>'); return; }
				if (!res.data.length) { $result.html('<p>هیچ صفحه‌ای افت قابل‌توجهی نداشته.</p>'); return; }
				var html = '<table class="widefat striped"><thead><tr><th>صفحه</th><th>کلیک قبلی</th><th>کلیک اخیر</th><th>درصد افت</th></tr></thead><tbody>';
				res.data.forEach(function (r) {
					html += '<tr><td>' + r.page + '</td><td>' + r.prior_clicks + '</td><td>' + r.recent_clicks + '</td><td>' + r.drop_percent + '%</td></tr>';
				});
				html += '</tbody></table>';
				$result.html(html);
			}).fail(function () {
				$result.html('<p class="vp-error">خطای ارتباط با سرور.</p>');
			}).always(function () { $btn.prop('disabled', false); });
		});

		// --- Anomaly alerts: manual check ---
		$('#vp-anomaly-check-btn').on('click', function () {
			var $btn = $(this).prop('disabled', true);
			var $result = $('#vp-anomaly-result');
			$result.html('<p>در حال بررسی...</p>');

			postAjax('vp_anomaly_check', {}).done(function (res) {
				if (!res.success) { $result.html('<p class="vp-error">' + res.data.message + '</p>'); return; }
				if (!res.data.length) { $result.html('<p>ناهنجاری‌ای یافت نشد. ✅</p>'); return; }
				var html = '<ul>';
				res.data.forEach(function (a) {
					html += '<li class="vp-error">' + a.message + '</li>';
				});
				html += '</ul><p>ایمیل هشدار ارسال شد.</p>';
				$result.html(html);
			}).fail(function () {
				$result.html('<p class="vp-error">خطای ارتباط با سرور.</p>');
			}).always(function () { $btn.prop('disabled', false); });
		});

		// --- Title A/B testing on real GSC CTR ---
		$('#vp-title-ab-btn').on('click', function () {
			var postId = $('#vp-title-ab-post').val();
			var $result = $('#vp-title-ab-result');
			if (!postId) { $result.html('<p class="vp-error">یک پست انتخاب کنید.</p>'); return; }
			var $btn = $(this).prop('disabled', true);
			$result.html('<p>در حال دریافت داده از Search Console...</p>');

			postAjax('vp_title_ab_compare', { post_id: postId }).done(function (res) {
				if (!res.success) { $result.html('<p class="vp-error">' + res.data.message + '</p>'); return; }
				if (!res.data.periods || !res.data.periods.length) {
					$result.html('<p>هنوز هیچ تغییر عنوانی برای این پست ثبت نشده. وقتی عنوان را عوض کنید، بازه‌ی جدید خودکار ثبت می‌شود.</p>');
					return;
				}
				var html = '<div class="vp-card"><h2>مقایسه‌ی عنوان‌ها — ' + res.data.page_url + '</h2>';
				html += '<table class="widefat striped"><thead><tr><th>عنوان</th><th>شروع</th><th>پایان</th><th>کلیک</th><th>ایمپرشن</th><th>CTR واقعی</th></tr></thead><tbody>';
				res.data.periods.forEach(function (p, i) {
					html += '<tr' + (i === 0 ? ' style="font-weight:bold;background:#eaffea;"' : '') + '><td>' + p.title + (i === 0 ? ' 🏆' : '') + '</td><td>' + p.started_at + '</td><td>' + (p.ended_at || 'تاکنون') + '</td><td>' + p.clicks + '</td><td>' + p.impressions + '</td><td>' + p.ctr + '%' + (p.note ? '<br><small>' + p.note + '</small>' : '') + '</td></tr>';
				});
				html += '</tbody></table></div>';
				$result.html(html);
			}).fail(function () {
				$result.html('<p class="vp-error">خطای ارتباط با سرور.</p>');
			}).always(function () { $btn.prop('disabled', false); });
		});

		// --- Google Search Console: real-data opportunity hunting ---
		function gscEsc(s) {
			return $('<div>').text(s == null ? '' : String(s)).html();
		}

		function gscRows(items, cols) {
			if (!items || !items.length) {
				return '<tr><td colspan="' + cols.length + '">موردی یافت نشد.</td></tr>';
			}
			return items.map(function (o) {
				return '<tr>' + cols.map(function (c) {
					return '<td>' + gscEsc(o[c]) + (c === 'ctr' || c === 'expected_ctr' ? '%' : '') + '</td>';
				}).join('') + '</tr>';
			}).join('');
		}

		function renderOpportunities(d) {
			var html = '<div class="vp-card"><h2>نتیجه‌ی شکار پوزیشن (بازه‌ی ' + gscEsc(d.window_days) + ' روزه — ' + gscEsc(d.fetched) + ' کوئری بررسی شد)</h2>';

			html += '<h3>🎯 فاصله‌ی نزدیک — صفحه ۲ (' + gscEsc(d.summary.striking) + ' مورد)</h3>';
			html += '<table class="widefat striped"><thead><tr><th>کوئری</th><th>پوزیشن</th><th>ایمپرشن</th><th>کلیک</th><th>CTR</th><th>صفحه</th></tr></thead><tbody>';
			html += gscRows(d.striking_distance, ['query', 'position', 'impressions', 'clicks', 'ctr', 'page']);
			html += '</tbody></table>';

			html += '<h3 style="margin-top:18px;">✍️ CTR پایین روی رتبه‌ی خوب (' + gscEsc(d.summary.low_ctr) + ' مورد)</h3>';
			html += '<table class="widefat striped"><thead><tr><th>کوئری</th><th>پوزیشن</th><th>CTR فعلی</th><th>CTR مورد انتظار</th><th>ایمپرشن</th><th>صفحه</th></tr></thead><tbody>';
			html += gscRows(d.low_ctr, ['query', 'position', 'ctr', 'expected_ctr', 'impressions', 'page']);
			html += '</tbody></table>';

			html += '<h3 style="margin-top:18px;">📄 شکاف محتوایی — رتبه دورتر از صفحه ۲ (' + gscEsc(d.summary.gap) + ' مورد)</h3>';
			html += '<table class="widefat striped"><thead><tr><th>کوئری</th><th>پوزیشن</th><th>ایمپرشن</th><th>کلیک</th><th>CTR</th><th>صفحه</th></tr></thead><tbody>';
			html += gscRows(d.content_gap, ['query', 'position', 'impressions', 'clicks', 'ctr', 'page']);
			html += '</tbody></table></div>';

			$('#vp-gsc-result').html(html);
		}

		$('#vp-gsc-load-sites').on('click', function () {
			var $btn = $(this).prop('disabled', true).text('در حال بارگذاری...');
			postAjax('vp_gsc_list_sites', {}).done(function (res) {
				if (!res.success) { alert(res.data.message); return; }
				var $sel = $('#vp-gsc-site').empty();
				(res.data.sites || []).forEach(function (s) {
					$sel.append($('<option>').val(s).text(s).prop('selected', s === res.data.current));
				});
				if (!res.data.sites || !res.data.sites.length) {
					$sel.append($('<option>').val('').text('هیچ پراپرتی‌ای در این حساب یافت نشد.'));
				}
			}).always(function () {
				$btn.prop('disabled', false).text('بارگذاری سایت‌ها');
			});
		});

		$('#vp-gsc-site').on('change', function () {
			postAjax('vp_gsc_set_site', { site_url: $(this).val() });
		});

		$('#vp-gsc-hunt').on('click', function () {
			var $btn = $(this).prop('disabled', true);
			$('#vp-gsc-result').html('<p>در حال دریافت داده‌ی واقعی از Search Console...</p>');
			postAjax('vp_gsc_hunt', { days: $('#vp-gsc-days').val() }).done(function (res) {
				if (res.success) { renderOpportunities(res.data); }
				else { $('#vp-gsc-result').html('<p class="vp-error">' + res.data.message + '</p>'); }
			}).fail(function () {
				$('#vp-gsc-result').html('<p class="vp-error">خطای ارتباط با سرور.</p>');
			}).always(function () { $btn.prop('disabled', false); });
		});

		$('#vp-gsc-strategy').on('click', function () {
			var $btn = $(this).prop('disabled', true);
			$('#vp-gsc-result').html('<p>در حال تحلیل داده‌ی واقعی توسط هوش مصنوعی...</p>');
			postAjax('vp_gsc_ai_strategy', { days: $('#vp-gsc-days').val() }).done(function (res) {
				if (res.success) {
					$('#vp-gsc-result').html('<div class="vp-card"><h2>🧠 استراتژی مبتنی بر داده‌ی واقعی</h2><pre style="white-space:pre-wrap;">' + gscEsc(res.data.raw) + '</pre></div>');
				} else {
					$('#vp-gsc-result').html('<p class="vp-error">' + res.data.message + '</p>');
				}
			}).fail(function () {
				$('#vp-gsc-result').html('<p class="vp-error">خطای ارتباط با سرور.</p>');
			}).always(function () { $btn.prop('disabled', false); });
		});

		// --- Show/hide toggle for sensitive fields (defeats browser password-manager autofill confusion) ---
		$(document).on('click', '.vp-toggle-visibility', function () {
			var $field = $('#' + $(this).data('target'));
			if (!$field.length) return;
			var isHidden = $field.attr('type') === 'password';
			$field.attr('type', isHidden ? 'text' : 'password');
			$(this).text(isHidden ? 'پنهان' : 'نمایش');
		});
	});
})(jQuery);
