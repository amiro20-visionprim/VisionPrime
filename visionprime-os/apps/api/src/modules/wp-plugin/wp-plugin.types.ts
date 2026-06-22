export interface PublicCustomerProfile {
  id: string;
  fullName: string;
  email: string | null;
  status: string;
}

/**
 * Points/rewards/tier have no backend modules yet (out of scope through
 * Phase 07) — these shapes are stable placeholders so the plugin's
 * dashboard/tab UI has something safe to render without special-casing
 * "feature not built yet." `enabled: false` signals the plugin to show
 * a "coming soon" state rather than a zero balance.
 */
export interface PublicPointsSummary {
  enabled: boolean;
  balanceCents: number;
}

export interface PublicRewardsSummary {
  enabled: boolean;
  rewards: never[];
}

export interface PublicTierSummary {
  enabled: boolean;
  tier: string | null;
}
