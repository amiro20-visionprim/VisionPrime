<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * In-menu operator training catalog. Pure presentation — no table, no
 * REST surface, just a data-driven grid explaining what every other
 * module's submenu does and how an operator is expected to use it, so a
 * new hire can ramp up from inside wp-admin instead of an external doc.
 * Content is authored directly in Persian (the plugin's operating
 * language) rather than run through __(), since it's training copy, not
 * a UI label that needs to track the site locale.
 */
class VPOS_Help_Module {

	public function __construct() {
		add_action( 'vpos_admin_menu', array( $this, 'register_admin_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
	}

	public function register_admin_menu( $parent ) {
		add_submenu_page( $parent, 'آموزش و راهنما', 'آموزش و راهنما', 'read', 'vpos-help', array( $this, 'render_catalog' ) );
	}

	public function enqueue_assets( $hook ) {
		if ( false === strpos( (string) $hook, 'vpos-help' ) ) {
			return;
		}
		wp_enqueue_style( 'vpos-help', VPOS_URL . 'modules/help/assets/help.css', array(), VPOS_VERSION );
	}

	/** @return array<int,array{group:string,items:array}> catalog sections in onboarding order. */
	public function catalog() {
		return array(
			array(
				'group' => 'ساختار سازمانی',
				'items' => array(
					array(
						'icon'  => 'dashicons-admin-settings',
						'title' => 'تنظیمات برند',
						'page'  => 'vpos-brand-settings',
						'perm'  => 'brand:settings:update',
						'desc'  => 'نرخ بازگشت کیف پول (کش‌بک)، نرخ امتیاز وفاداری، و فعال/غیرفعال بودن کلوب مشتریان و کمپین‌ها از همین‌جا کنترل می‌شود.',
						'steps' => array(
							'نرخ کش‌بک و نرخ امتیاز را بر اساس سیاست برند تنظیم کنید.',
							'صفر کردن یک نرخ، آن قابلیت را به‌طور کامل غیرفعال می‌کند.',
						),
					),
				),
			),
			array(
				'group' => 'مشتری و سفارش',
				'items' => array(
					array(
						'icon'  => 'dashicons-groups',
						'title' => 'مشتریان و پروفایل ۳۶۰',
						'page'  => 'vpos-customers',
						'perm'  => 'customer:view',
						'desc'  => 'هر مشتری با شماره موبایل به‌صورت یکتا شناسایی می‌شود. پروفایل ۳۶۰ همه چیز — سفارش، کیف پول، امتیاز، اعلان — را در یک صفحه نشان می‌دهد.',
						'steps' => array(
							'مشتری جدید را با موبایل، نام و برچسب دلخواه ثبت کنید.',
							'برای دیدن کامل وضعیت یک مشتری، روی «مشاهده پروفایل ۳۶۰» کلیک کنید.',
							'یادداشت و برچسب می‌توانید مستقیماً از همین صفحه اضافه کنید.',
						),
					),
					array(
						'icon'  => 'dashicons-cart',
						'title' => 'سفارش‌ها',
						'page'  => 'vpos-orders',
						'perm'  => 'order:view',
						'desc'  => 'ثبت سفارش با تکمیل خودکار، کش‌بک کیف پول و امتیاز وفاداری مشتری را به‌روزرسانی می‌کند؛ لغو سفارش این تغییرات را برمی‌گرداند.',
						'steps' => array(
							'سفارش جدید را برای مشتری موجود ثبت و اقلام آن را وارد کنید.',
							'با «علامت‌گذاری به‌عنوان تکمیل‌شده» سفارش را ببندید تا کش‌بک/امتیاز اعمال شود.',
							'در صورت نیاز، سفارش تکمیل‌شده را لغو کنید تا اثرات مالی آن خودکار برگردد.',
						),
					),
				),
			),
			array(
				'group' => 'مالی و وفاداری',
				'items' => array(
					array(
						'icon'  => 'dashicons-money-alt',
						'title' => 'کیف پول',
						'page'  => 'vpos-wallet',
						'perm'  => 'wallet:view',
						'desc'  => 'موجودی کیف پول هرگز مستقیم تغییر نمی‌کند؛ همیشه از جمع تراکنش‌های دفتر کل محاسبه می‌شود. برداشت بیش از موجودی مجاز نیست.',
						'steps' => array(
							'شماره موبایل مشتری را برای مشاهده موجودی و تاریخچه جست‌وجو کنید.',
							'برای شارژ دستی، «بستانکار» و برای کسر، «بدهکار» را ثبت کنید.',
							'یک تراکنش اشتباه را با «برگشت» خنثی کنید — هرگز آن را ویرایش یا حذف نکنید.',
						),
					),
					array(
						'icon'  => 'dashicons-awards',
						'title' => 'سطوح وفاداری و جوایز',
						'page'  => 'vpos-loyalty-tiers',
						'perm'  => 'loyalty:view',
						'desc'  => 'سطح مشتری از «امتیاز کل کسب‌شده در طول عمر» تعیین می‌شود، نه موجودی فعلی — خرج کردن امتیاز هرگز سطح را پایین نمی‌آورد.',
						'steps' => array(
							'سطوح (مثلاً برنزی/نقره‌ای/طلایی) را با حداقل امتیاز و ضریب امتیاز تعریف کنید.',
							'جوایز قابل بازخرید را با هزینه به امتیاز و موجودی انبار ثبت کنید.',
							'بازخرید جایزه برای مشتری را از صفحه «بازخرید جایزه» انجام دهید.',
						),
					),
				),
			),
			array(
				'group' => 'ارتباط با مشتری',
				'items' => array(
					array(
						'icon'  => 'dashicons-id',
						'title' => 'کلوب مشتریان',
						'page'  => null,
						'perm'  => null,
						'desc'  => 'یک صفحه ورود/داشبورد عمومی (با شورت‌کد) که مشتری نهایی با موبایل و کد یک‌بارمصرف وارد می‌شود و موجودی و امتیاز خودش را می‌بیند.',
						'steps' => array(
							'شورت‌کدهای ورود و داشبورد را در صفحات سایت برند قرار دهید.',
							'کد یک‌بارمصرف از طریق هاب یکپارچه‌سازی (پیامک) ارسال می‌شود.',
						),
					),
					array(
						'icon'  => 'dashicons-filter',
						'title' => 'بخش‌ها (Segments)',
						'page'  => 'vpos-segments',
						'perm'  => 'segment:view',
						'desc'  => 'یک بخش، مجموعه‌ای از قوانین (حداقل خرید، برچسب، تاریخ ثبت‌نام) است که همیشه زنده روی مشتریان اجرا می‌شود — هیچ‌وقت لیست قدیمی نخواهید دید.',
						'steps' => array(
							'بخش را با قوانین دلخواه (مثلاً «حداقل خرید ۵۰۰هزار تومان») بسازید.',
							'تعداد مشتریان مطابق را قبل از استفاده در کمپین بررسی کنید.',
						),
					),
					array(
						'icon'  => 'dashicons-megaphone',
						'title' => 'کمپین‌ها',
						'page'  => 'vpos-campaigns',
						'perm'  => 'campaign:view',
						'desc'  => 'کمپین یک بخش را هدف می‌گیرد (یا همه مشتریان) و برای هر مشتری مطابق، یک اعلان در صف می‌گذارد.',
						'steps' => array(
							'کمپین را با انتخاب بخش هدف و متن پیام بسازید.',
							'با «ارسال فوری» بلافاصله یا با «زمان‌بندی» برای زمان مشخص ارسال کنید.',
							'وضعیت ارسال هر مشتری را از تب «ارسال‌ها» پیگیری کنید.',
						),
					),
				),
			),
			array(
				'group' => 'اتوماسیون و یکپارچه‌سازی',
				'items' => array(
					array(
						'icon'  => 'dashicons-randomize',
						'title' => 'اتوماسیون',
						'page'  => 'vpos-automations',
						'perm'  => 'automation:view',
						'desc'  => '«وقتی X رخ داد و شرایط Y برقرار بود، Z را انجام بده» — بدون نوشتن کد. اقدام‌ها فقط از فهرست ثابت و قابل‌حسابرسی انتخاب می‌شوند.',
						'steps' => array(
							'محرک (ثبت مشتری جدید / تکمیل سفارش / لغو سفارش) را انتخاب کنید.',
							'در صورت نیاز شرط (مثلاً حداقل خرید) و سپس اقدام (افزودن برچسب / ارسال پیام / واریز امتیاز یا کیف پول) را تعریف کنید.',
							'تاریخچه اجرای هر قانون را در «تاریخچه اجرا» برای رفع اشکال ببینید.',
						),
					),
					array(
						'icon'  => 'dashicons-rest-api',
						'title' => 'گزارش‌های یکپارچه‌سازی',
						'page'  => 'vpos-integration-logs',
						'perm'  => 'integration:manage',
						'desc'  => 'هر تلاش برای ارسال پیامک/ایمیل یا کد یک‌بارمصرف، چه موفق و چه فقط ثبت‌شده (بدون درگاه واقعی)، در این جدول قابل پیگیری است.',
						'steps' => array(
							'برای بررسی اینکه آیا پیامکی واقعاً ارسال شده یا فقط لاگ شده، وضعیت هر رکورد را ببینید.',
						),
					),
				),
			),
			array(
				'group' => 'هوش تصمیم‌ساز و گزارش',
				'items' => array(
					array(
						'icon'  => 'dashicons-chart-bar',
						'title' => 'گزارش‌ها',
						'page'  => 'vpos-reports',
						'perm'  => 'report:view',
						'desc'  => 'درآمد، رشد مشتری، تعهدات کیف پول و امتیاز، و برترین مشتریان — همه به‌صورت زنده و بدون نیاز به گزارش‌گیری جداگانه.',
						'steps' => array(
							'بازه تاریخی را برای فیلتر درآمد و رشد مشتری انتخاب کنید.',
							'تعهدات کیف پول/امتیاز را به‌عنوان بدهی عملیاتی برند در نظر بگیرید، نه سود.',
						),
					),
					array(
						'icon'  => 'dashicons-lightbulb',
						'title' => 'بینش‌های هوش مصنوعی',
						'page'  => 'vpos-ai-insights',
						'perm'  => 'ai:view',
						'desc'  => 'هوش مصنوعی فقط «پیشنهاد» می‌دهد (مثلاً مشتری در خطر ریزش) و هرگز خودش اقدام مالی (واریز کیف پول/امتیاز) انجام نمی‌دهد — هر پیشنهاد باید توسط اپراتور تأیید یا رد شود.',
						'steps' => array(
							'پیشنهادهای در انتظار را بررسی کنید.',
							'با «تأیید»، فقط اقدام غیرمالی (برچسب یا پیام) اجرا می‌شود؛ با «رد»، هیچ اقدامی انجام نمی‌شود.',
						),
					),
				),
			),
		);
	}

	public function render_catalog() {
		$catalog = $this->catalog();
		include VPOS_DIR . 'modules/help/views/catalog.php';
	}
}
