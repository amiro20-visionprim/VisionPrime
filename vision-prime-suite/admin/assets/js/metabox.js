(function ($) {
	'use strict';

	$(function () {
		var $box = $('.vp-seo-box');
		if (!$box.length) return;

		$('#vp-seo-run').on('click', function () {
			var $btn = $(this);
			var $out = $('#vp-seo-output');
			var postId = $box.data('post-id');

			$btn.prop('disabled', true);
			$out.html('<em>در حال تحلیل عمیق سئو...</em>');

			// post_id is enough: the server reads the saved content. For a
			// brand-new unsaved post the operator should save a draft first.
			$.post(VPSeoBox.ajaxUrl, {
				action: 'vp_seo_audit',
				nonce: VPSeoBox.nonce,
				post_id: postId
			}).done(function (res) {
				$btn.prop('disabled', false);
				if (!res.success) {
					$out.html('<span style="color:#991b1b;">' + res.data.message + '</span>');
					return;
				}
				var d = res.data;
				var html = '<ul style="margin:0;padding-inline-start:16px;">';
				if (d.seo_score != null) html += '<li>امتیاز سئو: <strong>' + d.seo_score + '</strong></li>';
				if (d.focus_keyword) html += '<li>کلمه کلیدی: ' + d.focus_keyword + '</li>';
				if (d.meta_title) html += '<li>عنوان متا: ' + d.meta_title + '</li>';
				if (d.meta_description) html += '<li>توضیحات متا: ' + d.meta_description + '</li>';
				if (d.slug) html += '<li>اسلاگ: ' + d.slug + '</li>';
				html += '</ul><p style="color:#166534;">✅ در Rank Math سینک شد (در صورت فعال بودن).</p>';
				$out.html(html);
			}).fail(function () {
				$btn.prop('disabled', false);
				$out.html('<span style="color:#991b1b;">خطای ارتباط با سرور.</span>');
			});
		});
	});
})(jQuery);
