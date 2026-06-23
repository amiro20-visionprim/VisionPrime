import { CampaignsRepository } from "../campaigns/campaigns.repository";
import { CustomersRepository } from "../customers/customers.repository";
import { NotificationsRepository } from "../notifications/notifications.repository";
import { OrdersRepository } from "../orders/orders.repository";
import { PointsRepository } from "../points/points.repository";
import { RewardsRepository } from "../rewards/rewards.repository";
import { WalletService } from "../wallet/wallet.service";
import { WordPressSyncJobRepository, WordPressSyncLogRepository } from "../wordpress/wordpress.repository";

export interface ReportsServiceDeps {
  customersRepository: CustomersRepository;
  ordersRepository: OrdersRepository;
  walletService: WalletService;
  pointsRepository: PointsRepository;
  rewardsRepository: RewardsRepository;
  campaignsRepository: CampaignsRepository;
  notificationsRepository: NotificationsRepository;
  wordpressSyncJobRepository: WordPressSyncJobRepository;
  wordpressSyncLogRepository: WordPressSyncLogRepository;
}

const REPORT_SCAN_PAGE_SIZE = 1000;

/**
 * Read-only aggregate reports for the 8 admin dashboards. Each method is
 * a handful of count/sum queries against existing repositories — not a
 * BI engine. None ever include secrets/credentials in their payload.
 *
 * Snapshot persistence (report_snapshots) is intentionally NOT wired
 * here to keep this phase's scope minimal — the table exists
 * (migration 0009) for a future scheduled-snapshot job, but every
 * report below is computed live on each request. This is a documented
 * scope decision (see docs/phase-12-automation-reports-ai.md).
 */
export class ReportsService {
  constructor(private readonly deps: ReportsServiceDeps) {}

  async getExecutiveReport() {
    const [customers, orders, walletLiability] = await Promise.all([
      this.deps.customersRepository.list({ page: 1, pageSize: REPORT_SCAN_PAGE_SIZE }),
      this.deps.ordersRepository.list({ page: 1, pageSize: REPORT_SCAN_PAGE_SIZE }),
      this.deps.walletService.getLiabilityReport(),
    ]);
    const totalRevenue = orders.rows.reduce((sum, o) => sum + Number(o.total), 0);
    return {
      totalCustomers: customers.totalItems,
      totalOrders: orders.totalItems,
      totalRevenue,
      walletLiabilityCents: walletLiability.totalLiabilityCents,
      walletCount: walletLiability.walletCount,
    };
  }

  async getCustomersReport() {
    const customers = await this.deps.customersRepository.list({ page: 1, pageSize: REPORT_SCAN_PAGE_SIZE });
    const byStatus: Record<string, number> = {};
    let totalLifetimeValue = 0;
    for (const c of customers.rows) {
      byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
      totalLifetimeValue += Number(c.lifetime_value);
    }
    return {
      totalCustomers: customers.totalItems,
      byStatus,
      averageLifetimeValue: customers.rows.length > 0 ? totalLifetimeValue / customers.rows.length : 0,
    };
  }

  async getWooCommerceSalesReport() {
    const orders = await this.deps.ordersRepository.list({ page: 1, pageSize: REPORT_SCAN_PAGE_SIZE });
    const byStatus: Record<string, number> = {};
    let totalRevenue = 0;
    for (const o of orders.rows) {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
      totalRevenue += Number(o.total);
    }
    return {
      totalOrders: orders.totalItems,
      byStatus,
      totalRevenue,
      averageOrderValue: orders.rows.length > 0 ? totalRevenue / orders.rows.length : 0,
    };
  }

  async getLoyaltyReport() {
    const customers = await this.deps.customersRepository.list({ page: 1, pageSize: REPORT_SCAN_PAGE_SIZE });
    let totalPointsBalance = 0;
    for (const c of customers.rows) {
      totalPointsBalance += await this.deps.pointsRepository.getBalance(c.id);
    }
    return {
      totalCustomersScanned: customers.rows.length,
      totalPointsBalanceOutstanding: totalPointsBalance,
    };
  }

  async getCampaignsReport() {
    const campaigns = await this.deps.campaignsRepository.list({ page: 1, pageSize: REPORT_SCAN_PAGE_SIZE });
    const byStatus: Record<string, number> = {};
    for (const c of campaigns.rows) {
      byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    }
    return {
      totalCampaigns: campaigns.totalItems,
      byStatus,
    };
  }

  async getFinanceReport() {
    const walletLiability = await this.deps.walletService.getLiabilityReport();
    const orders = await this.deps.ordersRepository.list({ page: 1, pageSize: REPORT_SCAN_PAGE_SIZE });
    const totalRevenue = orders.rows.reduce((sum, o) => sum + Number(o.total), 0);
    return {
      walletLiabilityCents: walletLiability.totalLiabilityCents,
      walletCount: walletLiability.walletCount,
      totalRevenue,
      currency: walletLiability.currency,
    };
  }

  async getRewardsReport() {
    const [claims, redemptions] = await Promise.all([
      this.deps.rewardsRepository.listClaims({ page: 1, pageSize: REPORT_SCAN_PAGE_SIZE }),
      this.deps.rewardsRepository.listRedemptions({ page: 1, pageSize: REPORT_SCAN_PAGE_SIZE }),
    ]);
    const byStatus: Record<string, number> = {};
    for (const c of claims.rows) {
      byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    }
    return {
      totalClaims: claims.totalItems,
      totalRedemptions: redemptions.totalItems,
      claimsByStatus: byStatus,
    };
  }

  async getWordPressSyncReport() {
    const [jobs, logs] = await Promise.all([
      this.deps.wordpressSyncJobRepository.list(1, REPORT_SCAN_PAGE_SIZE),
      this.deps.wordpressSyncLogRepository.list(1, REPORT_SCAN_PAGE_SIZE),
    ]);
    const byStatus: Record<string, number> = {};
    for (const j of jobs.rows) {
      byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;
    }
    const errorLogCount = logs.rows.filter((l) => l.level === "error").length;
    return {
      totalSyncJobs: jobs.totalItems,
      byStatus,
      errorLogCount,
    };
  }
}
