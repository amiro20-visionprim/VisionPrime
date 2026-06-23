import { Db } from "@visionprime/database";
import { LoyaltyRepository } from "./loyalty.repository";
import {
  CustomerLoyaltyStatusRow,
  ListParams,
  LoyaltyProgramRow,
  LoyaltyRuleRow,
  LoyaltyTierRow,
} from "./loyalty.types";

export function createDbLoyaltyRepository(db: Db): LoyaltyRepository {
  async function listPaged<T>(
    table: string,
    where: string,
    whereParams: unknown[],
    orderBy: string,
    params: ListParams,
  ) {
    const offset = (params.page - 1) * params.pageSize;
    const [rowsResult, countResult] = await Promise.all([
      db.query<T>(
        `select * from ${table} ${where} order by ${orderBy} limit $${whereParams.length + 1} offset $${whereParams.length + 2}`,
        [...whereParams, params.pageSize, offset],
      ),
      db.query<{ count: string }>(`select count(*)::text as count from ${table} ${where}`, whereParams),
    ]);
    return { rows: rowsResult.rows, totalItems: Number(countResult.rows[0]?.count ?? 0) };
  }

  return {
    async listPrograms(params) {
      return listPaged<LoyaltyProgramRow>("loyalty_programs", "", [], "created_at desc", params);
    },
    async findProgramById(id) {
      const r = await db.query<LoyaltyProgramRow>(`select * from loyalty_programs where id = $1`, [id]);
      return r.rows[0] ?? null;
    },
    async findActiveProgram() {
      const r = await db.query<LoyaltyProgramRow>(
        `select * from loyalty_programs where is_active = true order by created_at limit 1`,
      );
      return r.rows[0] ?? null;
    },
    async createProgram(record) {
      const r = await db.query<LoyaltyProgramRow>(
        `insert into loyalty_programs (name, description, is_active, points_per_currency_unit, config)
         values ($1, $2, $3, $4, $5) returning *`,
        [
          record.name,
          record.description ?? null,
          record.isActive ?? false,
          record.pointsPerCurrencyUnit ?? 0,
          JSON.stringify(record.config ?? {}),
        ],
      );
      return r.rows[0];
    },
    async updateProgram(id, record) {
      const r = await db.query<LoyaltyProgramRow>(
        `update loyalty_programs set
           name = coalesce($2, name),
           description = coalesce($3, description),
           is_active = coalesce($4, is_active),
           points_per_currency_unit = coalesce($5, points_per_currency_unit),
           config = coalesce($6, config),
           updated_at = now()
         where id = $1 returning *`,
        [
          id,
          record.name ?? null,
          record.description ?? null,
          record.isActive ?? null,
          record.pointsPerCurrencyUnit ?? null,
          record.config !== undefined ? JSON.stringify(record.config) : null,
        ],
      );
      return r.rows[0] ?? null;
    },

    async listTiers(params, programId) {
      return listPaged<LoyaltyTierRow>(
        "loyalty_tiers",
        programId ? "where program_id = $1" : "",
        programId ? [programId] : [],
        "min_lifetime_points asc",
        params,
      );
    },
    async listTiersByProgram(programId) {
      const r = await db.query<LoyaltyTierRow>(
        `select * from loyalty_tiers where program_id = $1 order by min_lifetime_points asc`,
        [programId],
      );
      return r.rows;
    },
    async findTierById(id) {
      const r = await db.query<LoyaltyTierRow>(`select * from loyalty_tiers where id = $1`, [id]);
      return r.rows[0] ?? null;
    },
    async createTier(record) {
      const r = await db.query<LoyaltyTierRow>(
        `insert into loyalty_tiers (program_id, name, min_lifetime_points, sort_order, benefits)
         values ($1, $2, $3, $4, $5) returning *`,
        [record.programId, record.name, record.minLifetimePoints, record.sortOrder ?? 0, JSON.stringify(record.benefits ?? {})],
      );
      return r.rows[0];
    },
    async updateTier(id, record) {
      const r = await db.query<LoyaltyTierRow>(
        `update loyalty_tiers set
           name = coalesce($2, name),
           min_lifetime_points = coalesce($3, min_lifetime_points),
           sort_order = coalesce($4, sort_order),
           benefits = coalesce($5, benefits),
           updated_at = now()
         where id = $1 returning *`,
        [
          id,
          record.name ?? null,
          record.minLifetimePoints ?? null,
          record.sortOrder ?? null,
          record.benefits !== undefined ? JSON.stringify(record.benefits) : null,
        ],
      );
      return r.rows[0] ?? null;
    },
    async deleteTier(id) {
      const r = await db.query(`delete from loyalty_tiers where id = $1`, [id]);
      return (r.rowCount ?? 0) > 0;
    },

    async listRules(params, programId) {
      return listPaged<LoyaltyRuleRow>(
        "loyalty_rules",
        programId ? "where program_id = $1" : "",
        programId ? [programId] : [],
        "created_at desc",
        params,
      );
    },
    async findRuleById(id) {
      const r = await db.query<LoyaltyRuleRow>(`select * from loyalty_rules where id = $1`, [id]);
      return r.rows[0] ?? null;
    },
    async createRule(record) {
      const r = await db.query<LoyaltyRuleRow>(
        `insert into loyalty_rules (program_id, name, rule_type, config, is_active)
         values ($1, $2, $3, $4, $5) returning *`,
        [record.programId, record.name, record.ruleType, JSON.stringify(record.config ?? {}), record.isActive ?? false],
      );
      return r.rows[0];
    },
    async updateRule(id, record) {
      const r = await db.query<LoyaltyRuleRow>(
        `update loyalty_rules set
           name = coalesce($2, name),
           rule_type = coalesce($3, rule_type),
           config = coalesce($4, config),
           is_active = coalesce($5, is_active),
           updated_at = now()
         where id = $1 returning *`,
        [
          id,
          record.name ?? null,
          record.ruleType ?? null,
          record.config !== undefined ? JSON.stringify(record.config) : null,
          record.isActive ?? null,
        ],
      );
      return r.rows[0] ?? null;
    },
    async deleteRule(id) {
      const r = await db.query(`delete from loyalty_rules where id = $1`, [id]);
      return (r.rowCount ?? 0) > 0;
    },

    async getStatus(customerId) {
      const r = await db.query<CustomerLoyaltyStatusRow>(
        `select * from customer_loyalty_status where customer_id = $1`,
        [customerId],
      );
      return r.rows[0] ?? null;
    },
    async upsertStatus(customerId, record) {
      const r = await db.query<CustomerLoyaltyStatusRow>(
        `insert into customer_loyalty_status (customer_id, program_id, current_tier_id, lifetime_points)
         values ($1, $2, $3, greatest($4, 0))
         on conflict (customer_id) do update set
           program_id = excluded.program_id,
           current_tier_id = excluded.current_tier_id,
           lifetime_points = greatest(customer_loyalty_status.lifetime_points + $4, 0),
           updated_at = now()
         returning *`,
        [customerId, record.programId, record.currentTierId, record.lifetimePointsDelta],
      );
      return r.rows[0];
    },
    async setCurrentTier(customerId, tierId) {
      const r = await db.query<CustomerLoyaltyStatusRow>(
        `update customer_loyalty_status set current_tier_id = $2, updated_at = now()
         where customer_id = $1 returning *`,
        [customerId, tierId],
      );
      return r.rows[0];
    },
  };
}
