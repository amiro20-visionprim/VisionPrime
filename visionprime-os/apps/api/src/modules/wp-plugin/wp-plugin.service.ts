import { CustomersRepository } from "../customers/customers.repository";
import { WalletService } from "../wallet/wallet.service";
import { PointsService } from "../points/points.service";
import { RewardsService } from "../rewards/rewards.service";
import { LoyaltyService } from "../loyalty/loyalty.service";
import { NotFoundError } from "../../common/http-error";
import { PublicCustomerProfile, PublicPointsSummary, PublicRewardsSummary, PublicTierSummary } from "./wp-plugin.types";

export interface WpPluginServiceDeps {
  customersRepository: CustomersRepository;
  walletService: WalletService;
  pointsService: PointsService;
  rewardsService: RewardsService;
  loyaltyService: LoyaltyService;
}

export class WpPluginService {
  constructor(private readonly deps: WpPluginServiceDeps) {}

  async getMe(customerId: string): Promise<PublicCustomerProfile> {
    const customer = await this.deps.customersRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundError("Customer not found.");
    }
    return { id: customer.id, fullName: customer.full_name, email: customer.primary_email, status: customer.status };
  }

  async getWallet(customerId: string) {
    return this.deps.walletService.getWalletSummary(customerId);
  }

  async getPoints(customerId: string): Promise<PublicPointsSummary> {
    const balance = await this.deps.pointsService.getBalance(customerId);
    return { enabled: true, balance: balance.balance, lifetimePoints: balance.lifetimePoints };
  }

  async getRewards(customerId: string): Promise<PublicRewardsSummary> {
    const { rows: claims } = await this.deps.rewardsService.listClaims(1, 50, customerId);
    const { rows: rewards } = await this.deps.rewardsService.listRewards(1, 50);

    const claimed = await Promise.all(
      claims.map(async (claim) => {
        const reward = rewards.find((r) => r.id === claim.rewardId);
        return {
          claimId: claim.id,
          rewardId: claim.rewardId,
          name: reward?.name ?? "Reward",
          status: claim.status,
          expiresAt: claim.expiresAt,
        };
      }),
    );

    const available = rewards
      .filter((r) => r.isActive)
      .map((r) => ({ id: r.id, name: r.name, pointsCost: r.pointsCost, rewardType: r.rewardType }));

    return { enabled: true, claimed, available };
  }

  async getTier(customerId: string): Promise<PublicTierSummary> {
    const status = await this.deps.loyaltyService.getCustomerStatus(customerId);
    return {
      enabled: true,
      currentTierName: status.currentTier?.name ?? null,
      lifetimePoints: status.lifetimePoints,
      nextTierName: status.nextTier?.name ?? null,
      pointsToNextTier: status.pointsToNextTier,
    };
  }

  async getDashboard(customerId: string) {
    const [me, wallet, points, rewards, tier] = await Promise.all([
      this.getMe(customerId),
      this.getWallet(customerId),
      this.getPoints(customerId),
      this.getRewards(customerId),
      this.getTier(customerId),
    ]);
    return { me, wallet, points, rewards, tier };
  }
}
