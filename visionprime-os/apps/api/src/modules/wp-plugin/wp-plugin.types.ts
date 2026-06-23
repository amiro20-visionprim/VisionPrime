export interface PublicCustomerProfile {
  id: string;
  fullName: string;
  email: string | null;
  status: string;
}

export interface PublicPointsSummary {
  enabled: true;
  balance: number;
  lifetimePoints: number;
}

export interface PublicRewardSummaryItem {
  claimId: string;
  rewardId: string;
  name: string;
  status: string;
  expiresAt: string;
}

export interface PublicRewardsSummary {
  enabled: true;
  claimed: PublicRewardSummaryItem[];
  available: { id: string; name: string; pointsCost: number; rewardType: string }[];
}

export interface PublicTierSummary {
  enabled: true;
  currentTierName: string | null;
  lifetimePoints: number;
  nextTierName: string | null;
  pointsToNextTier: number | null;
}
