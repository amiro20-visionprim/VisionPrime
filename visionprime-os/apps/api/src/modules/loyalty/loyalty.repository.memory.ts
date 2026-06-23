import { randomUUID } from "crypto";
import { LoyaltyRepository } from "./loyalty.repository";
import {
  CustomerLoyaltyStatusRow,
  ListParams,
  ListResult,
  LoyaltyProgramRow,
  LoyaltyRuleRow,
  LoyaltyTierRow,
} from "./loyalty.types";

function paginate<T>(rows: T[], params: ListParams): ListResult<T> {
  const start = (params.page - 1) * params.pageSize;
  return { rows: rows.slice(start, start + params.pageSize), totalItems: rows.length };
}

export function createMemoryLoyaltyRepository(): LoyaltyRepository {
  const programs: LoyaltyProgramRow[] = [];
  const tiers: LoyaltyTierRow[] = [];
  const rules: LoyaltyRuleRow[] = [];
  const statuses: CustomerLoyaltyStatusRow[] = [];

  const now = () => new Date().toISOString();

  return {
    async listPrograms(params) {
      return paginate([...programs].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)), params);
    },
    async findProgramById(id) {
      return programs.find((p) => p.id === id) ?? null;
    },
    async findActiveProgram() {
      return programs.find((p) => p.is_active) ?? null;
    },
    async createProgram(record) {
      const row: LoyaltyProgramRow = {
        id: randomUUID(),
        name: record.name,
        description: record.description ?? null,
        is_active: record.isActive ?? false,
        points_per_currency_unit: String(record.pointsPerCurrencyUnit ?? 0),
        config: record.config ?? {},
        created_at: now(),
        updated_at: now(),
      };
      programs.push(row);
      return row;
    },
    async updateProgram(id, record) {
      const row = programs.find((p) => p.id === id);
      if (!row) return null;
      if (record.name !== undefined) row.name = record.name;
      if (record.description !== undefined) row.description = record.description;
      if (record.isActive !== undefined) row.is_active = record.isActive;
      if (record.pointsPerCurrencyUnit !== undefined) row.points_per_currency_unit = String(record.pointsPerCurrencyUnit);
      if (record.config !== undefined) row.config = record.config;
      row.updated_at = now();
      return row;
    },

    async listTiers(params, programId) {
      const filtered = tiers
        .filter((t) => !programId || t.program_id === programId)
        .sort((a, b) => a.min_lifetime_points - b.min_lifetime_points);
      return paginate(filtered, params);
    },
    async listTiersByProgram(programId) {
      return tiers
        .filter((t) => t.program_id === programId)
        .sort((a, b) => a.min_lifetime_points - b.min_lifetime_points);
    },
    async findTierById(id) {
      return tiers.find((t) => t.id === id) ?? null;
    },
    async createTier(record) {
      const row: LoyaltyTierRow = {
        id: randomUUID(),
        program_id: record.programId,
        name: record.name,
        min_lifetime_points: record.minLifetimePoints,
        sort_order: record.sortOrder ?? 0,
        benefits: record.benefits ?? {},
        created_at: now(),
        updated_at: now(),
      };
      tiers.push(row);
      return row;
    },
    async updateTier(id, record) {
      const row = tiers.find((t) => t.id === id);
      if (!row) return null;
      if (record.name !== undefined) row.name = record.name;
      if (record.minLifetimePoints !== undefined) row.min_lifetime_points = record.minLifetimePoints;
      if (record.sortOrder !== undefined) row.sort_order = record.sortOrder;
      if (record.benefits !== undefined) row.benefits = record.benefits;
      row.updated_at = now();
      return row;
    },
    async deleteTier(id) {
      const i = tiers.findIndex((t) => t.id === id);
      if (i < 0) return false;
      tiers.splice(i, 1);
      return true;
    },

    async listRules(params, programId) {
      const filtered = rules
        .filter((r) => !programId || r.program_id === programId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return paginate(filtered, params);
    },
    async findRuleById(id) {
      return rules.find((r) => r.id === id) ?? null;
    },
    async createRule(record) {
      const row: LoyaltyRuleRow = {
        id: randomUUID(),
        program_id: record.programId,
        name: record.name,
        rule_type: record.ruleType,
        config: record.config ?? {},
        is_active: record.isActive ?? false,
        created_at: now(),
        updated_at: now(),
      };
      rules.push(row);
      return row;
    },
    async updateRule(id, record) {
      const row = rules.find((r) => r.id === id);
      if (!row) return null;
      if (record.name !== undefined) row.name = record.name;
      if (record.ruleType !== undefined) row.rule_type = record.ruleType;
      if (record.config !== undefined) row.config = record.config;
      if (record.isActive !== undefined) row.is_active = record.isActive;
      row.updated_at = now();
      return row;
    },
    async deleteRule(id) {
      const i = rules.findIndex((r) => r.id === id);
      if (i < 0) return false;
      rules.splice(i, 1);
      return true;
    },

    async getStatus(customerId) {
      return statuses.find((s) => s.customer_id === customerId) ?? null;
    },
    async upsertStatus(customerId, record) {
      let row = statuses.find((s) => s.customer_id === customerId);
      if (!row) {
        row = {
          customer_id: customerId,
          program_id: record.programId,
          current_tier_id: record.currentTierId,
          lifetime_points: Math.max(0, record.lifetimePointsDelta),
          created_at: now(),
          updated_at: now(),
        };
        statuses.push(row);
        return row;
      }
      row.lifetime_points = row.lifetime_points + record.lifetimePointsDelta;
      if (row.lifetime_points < 0) row.lifetime_points = 0;
      row.program_id = record.programId;
      row.current_tier_id = record.currentTierId;
      row.updated_at = now();
      return row;
    },
    async setCurrentTier(customerId, tierId) {
      const row = statuses.find((s) => s.customer_id === customerId);
      if (!row) throw new Error("Loyalty status not found");
      row.current_tier_id = tierId;
      row.updated_at = now();
      return row;
    },
  };
}
