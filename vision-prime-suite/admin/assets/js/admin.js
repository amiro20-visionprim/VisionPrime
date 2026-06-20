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
	});
})(jQuery);
