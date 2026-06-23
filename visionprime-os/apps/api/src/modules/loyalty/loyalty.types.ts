export interface LoyaltyProgramRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  points_per_currency_unit: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyTierRow {
  id: string;
  program_id: string;
  name: string;
  min_lifetime_points: number;
  sort_order: number;
  benefits: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyRuleRow {
  id: string;
  program_id: string;
  name: string;
  rule_type: string;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerLoyaltyStatusRow {
  customer_id: string;
  program_id: string | null;
  current_tier_id: string | null;
  lifetime_points: number;
  created_at: string;
  updated_at: string;
}

export interface NewLoyaltyProgramRecord {
  name: string;
  description?: string | null;
  isActive?: boolean;
  pointsPerCurrencyUnit?: number;
  config?: Record<string, unknown>;
}

export interface UpdateLoyaltyProgramRecord {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  pointsPerCurrencyUnit?: number;
  config?: Record<string, unknown>;
}

export interface NewLoyaltyTierRecord {
  programId: string;
  name: string;
  minLifetimePoints: number;
  sortOrder?: number;
  benefits?: Record<string, unknown>;
}

export interface UpdateLoyaltyTierRecord {
  name?: string;
  minLifetimePoints?: number;
  sortOrder?: number;
  benefits?: Record<string, unknown>;
}

export interface NewLoyaltyRuleRecord {
  programId: string;
  name: string;
  ruleType: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
}

export interface UpdateLoyaltyRuleRecord {
  name?: string;
  ruleType?: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
}

export interface PublicLoyaltyProgram {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  pointsPerCurrencyUnit: number;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PublicLoyaltyTier {
  id: string;
  programId: string;
  name: string;
  minLifetimePoints: number;
  sortOrder: number;
  benefits: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PublicLoyaltyRule {
  id: string;
  programId: string;
  name: string;
  ruleType: string;
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicCustomerLoyaltyStatus {
  customerId: string;
  programId: string | null;
  currentTier: PublicLoyaltyTier | null;
  nextTier: PublicLoyaltyTier | null;
  lifetimePoints: number;
  pointsToNextTier: number | null;
}

export function toPublicLoyaltyProgram(row: LoyaltyProgramRow): PublicLoyaltyProgram {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    pointsPerCurrencyUnit: Number(row.points_per_currency_unit),
    config: row.config,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicLoyaltyTier(row: LoyaltyTierRow): PublicLoyaltyTier {
  return {
    id: row.id,
    programId: row.program_id,
    name: row.name,
    minLifetimePoints: row.min_lifetime_points,
    sortOrder: row.sort_order,
    benefits: row.benefits,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicLoyaltyRule(row: LoyaltyRuleRow): PublicLoyaltyRule {
  return {
    id: row.id,
    programId: row.program_id,
    name: row.name,
    ruleType: row.rule_type,
    config: row.config,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ListParams {
  page: number;
  pageSize: number;
}

export interface ListResult<T> {
  rows: T[];
  totalItems: number;
}
