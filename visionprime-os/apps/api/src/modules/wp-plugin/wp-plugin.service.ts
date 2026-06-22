import { CustomersRepository } from "../customers/customers.repository";
import { WalletService } from "../wallet/wallet.service";
import { NotFoundError } from "../../common/http-error";
import { PublicCustomerProfile, PublicPointsSummary, PublicRewardsSummary, PublicTierSummary } from "./wp-plugin.types";

export interface WpPluginServiceDeps {
  customersRepository: CustomersRepository;
  walletService: WalletService;
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

  // Points has no backend module yet — stable, explicitly-disabled
  // placeholder so the plugin's Points tab can render a "coming soon"
  // state instead of erroring.
  async getPoints(_customerId: string): Promise<PublicPointsSummary> {
    return { enabled: false, balanceCents: 0 };
  }

  async getRewards(_customerId: string): Promise<PublicRewardsSummary> {
    return { enabled: false, rewards: [] };
  }

  async getTier(_customerId: string): Promise<PublicTierSummary> {
    return { enabled: false, tier: null };
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
