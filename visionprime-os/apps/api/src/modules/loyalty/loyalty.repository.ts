import {
  CustomerLoyaltyStatusRow,
  ListParams,
  ListResult,
  LoyaltyProgramRow,
  LoyaltyRuleRow,
  LoyaltyTierRow,
  NewLoyaltyProgramRecord,
  NewLoyaltyRuleRecord,
  NewLoyaltyTierRecord,
  UpdateLoyaltyProgramRecord,
  UpdateLoyaltyRuleRecord,
  UpdateLoyaltyTierRecord,
} from "./loyalty.types";

export interface LoyaltyRepository {
  // Programs
  listPrograms(params: ListParams): Promise<ListResult<LoyaltyProgramRow>>;
  findProgramById(id: string): Promise<LoyaltyProgramRow | null>;
  findActiveProgram(): Promise<LoyaltyProgramRow | null>;
  createProgram(record: NewLoyaltyProgramRecord): Promise<LoyaltyProgramRow>;
  updateProgram(id: string, record: UpdateLoyaltyProgramRecord): Promise<LoyaltyProgramRow | null>;

  // Tiers
  listTiers(params: ListParams, programId?: string): Promise<ListResult<LoyaltyTierRow>>;
  listTiersByProgram(programId: string): Promise<LoyaltyTierRow[]>;
  findTierById(id: string): Promise<LoyaltyTierRow | null>;
  createTier(record: NewLoyaltyTierRecord): Promise<LoyaltyTierRow>;
  updateTier(id: string, record: UpdateLoyaltyTierRecord): Promise<LoyaltyTierRow | null>;
  deleteTier(id: string): Promise<boolean>;

  // Rules
  listRules(params: ListParams, programId?: string): Promise<ListResult<LoyaltyRuleRow>>;
  findRuleById(id: string): Promise<LoyaltyRuleRow | null>;
  createRule(record: NewLoyaltyRuleRecord): Promise<LoyaltyRuleRow>;
  updateRule(id: string, record: UpdateLoyaltyRuleRecord): Promise<LoyaltyRuleRow | null>;
  deleteRule(id: string): Promise<boolean>;

  // Customer loyalty status
  getStatus(customerId: string): Promise<CustomerLoyaltyStatusRow | null>;
  /** Adds `lifetimePointsDelta` (which may be 0) to lifetime_points and sets
   * program/tier. lifetime_points only ever increases. */
  upsertStatus(
    customerId: string,
    record: { programId: string | null; currentTierId: string | null; lifetimePointsDelta: number },
  ): Promise<CustomerLoyaltyStatusRow>;
  setCurrentTier(customerId: string, tierId: string | null): Promise<CustomerLoyaltyStatusRow>;
}
