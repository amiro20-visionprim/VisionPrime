import { NotFoundError } from "../../common/http-error";
import { AuditService, toPaginationMeta } from "../audit/audit.service";
import { LoyaltyRepository } from "./loyalty.repository";
import {
  NewLoyaltyProgramRecord,
  NewLoyaltyRuleRecord,
  NewLoyaltyTierRecord,
  PublicCustomerLoyaltyStatus,
  toPublicLoyaltyProgram,
  toPublicLoyaltyRule,
  toPublicLoyaltyTier,
  UpdateLoyaltyProgramRecord,
  UpdateLoyaltyRuleRecord,
  UpdateLoyaltyTierRecord,
} from "./loyalty.types";

export interface LoyaltyActor {
  userId: string;
}

export interface LoyaltyServiceDeps {
  loyaltyRepository: LoyaltyRepository;
  auditService: AuditService;
}

export class LoyaltyService {
  constructor(private readonly deps: LoyaltyServiceDeps) {}

  async listPrograms(page: number, pageSize: number) {
    const result = await this.deps.loyaltyRepository.listPrograms({ page, pageSize });
    return { rows: result.rows.map(toPublicLoyaltyProgram), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async createProgram(record: NewLoyaltyProgramRecord, actor: LoyaltyActor) {
    const row = await this.deps.loyaltyRepository.createProgram(record);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "loyalty.program_create",
      targetType: "loyalty_program",
      targetId: row.id,
      before: null,
      after: { program: row },
    });
    return toPublicLoyaltyProgram(row);
  }

  async updateProgram(id: string, record: UpdateLoyaltyProgramRecord, actor: LoyaltyActor) {
    const before = await this.deps.loyaltyRepository.findProgramById(id);
    if (!before) throw new NotFoundError("Loyalty program not found");
    const after = await this.deps.loyaltyRepository.updateProgram(id, record);
    if (!after) throw new NotFoundError("Loyalty program not found");
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "loyalty.program_update",
      targetType: "loyalty_program",
      targetId: id,
      before: { program: before },
      after: { program: after },
    });
    return toPublicLoyaltyProgram(after);
  }

  async listTiers(page: number, pageSize: number, programId?: string) {
    const result = await this.deps.loyaltyRepository.listTiers({ page, pageSize }, programId);
    return { rows: result.rows.map(toPublicLoyaltyTier), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async createTier(record: NewLoyaltyTierRecord, actor: LoyaltyActor) {
    const row = await this.deps.loyaltyRepository.createTier(record);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "loyalty.tier_create",
      targetType: "loyalty_tier",
      targetId: row.id,
      before: null,
      after: { tier: row },
    });
    return toPublicLoyaltyTier(row);
  }

  async updateTier(id: string, record: UpdateLoyaltyTierRecord, actor: LoyaltyActor) {
    const before = await this.deps.loyaltyRepository.findTierById(id);
    if (!before) throw new NotFoundError("Loyalty tier not found");
    const after = await this.deps.loyaltyRepository.updateTier(id, record);
    if (!after) throw new NotFoundError("Loyalty tier not found");
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "loyalty.tier_update",
      targetType: "loyalty_tier",
      targetId: id,
      before: { tier: before },
      after: { tier: after },
    });
    return toPublicLoyaltyTier(after);
  }

  async deleteTier(id: string, actor: LoyaltyActor) {
    const before = await this.deps.loyaltyRepository.findTierById(id);
    if (!before) throw new NotFoundError("Loyalty tier not found");
    await this.deps.loyaltyRepository.deleteTier(id);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "loyalty.tier_delete",
      targetType: "loyalty_tier",
      targetId: id,
      before: { tier: before },
      after: null,
    });
  }

  /**
   * Looks up the active loyalty program's configured points-per-currency-
   * unit rate. Falls back to 0 (no points awarded) if there is no active
   * program — mirrors WalletService.applyCashbackForOrder's "no active
   * rule, no-op" behavior rather than assuming a default rate.
   */
  async getActivePointsPerCurrencyUnit(): Promise<number> {
    const program = await this.deps.loyaltyRepository.findActiveProgram();
    if (!program) return 0;
    return Number(program.points_per_currency_unit);
  }

  async listRules(page: number, pageSize: number, programId?: string) {
    const result = await this.deps.loyaltyRepository.listRules({ page, pageSize }, programId);
    return { rows: result.rows.map(toPublicLoyaltyRule), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async createRule(record: NewLoyaltyRuleRecord, actor: LoyaltyActor) {
    const row = await this.deps.loyaltyRepository.createRule(record);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "loyalty.rule_create",
      targetType: "loyalty_rule",
      targetId: row.id,
      before: null,
      after: { rule: row },
    });
    return toPublicLoyaltyRule(row);
  }

  async updateRule(id: string, record: UpdateLoyaltyRuleRecord, actor: LoyaltyActor) {
    const before = await this.deps.loyaltyRepository.findRuleById(id);
    if (!before) throw new NotFoundError("Loyalty rule not found");
    const after = await this.deps.loyaltyRepository.updateRule(id, record);
    if (!after) throw new NotFoundError("Loyalty rule not found");
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "loyalty.rule_update",
      targetType: "loyalty_rule",
      targetId: id,
      before: { rule: before },
      after: { rule: after },
    });
    return toPublicLoyaltyRule(after);
  }

  async deleteRule(id: string, actor: LoyaltyActor) {
    const before = await this.deps.loyaltyRepository.findRuleById(id);
    if (!before) throw new NotFoundError("Loyalty rule not found");
    await this.deps.loyaltyRepository.deleteRule(id);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "loyalty.rule_delete",
      targetType: "loyalty_rule",
      targetId: id,
      before: { rule: before },
      after: null,
    });
  }

  /**
   * Recomputes a customer's tier from `lifetimePoints` against the active
   * program's tiers and persists the change. Logs `loyalty.tier_change`
   * only when the tier actually changes — this is the only history record
   * of a tier change (no separate history table).
   */
  async recomputeTierForCustomer(customerId: string, lifetimePointsDelta: number): Promise<void> {
    const program = await this.deps.loyaltyRepository.findActiveProgram();
    const previousStatus = await this.deps.loyaltyRepository.getStatus(customerId);
    const status = await this.deps.loyaltyRepository.upsertStatus(customerId, {
      programId: program?.id ?? null,
      currentTierId: previousStatus?.current_tier_id ?? null,
      lifetimePointsDelta,
    });

    if (!program) return;

    const tiers = await this.deps.loyaltyRepository.listTiersByProgram(program.id);
    const eligible = tiers
      .filter((t) => t.min_lifetime_points <= status.lifetime_points)
      .sort((a, b) => b.min_lifetime_points - a.min_lifetime_points)[0];
    const newTierId = eligible?.id ?? null;

    if (newTierId !== status.current_tier_id) {
      const updated = await this.deps.loyaltyRepository.setCurrentTier(customerId, newTierId);
      await this.deps.auditService.recordAuditLog({
        actorId: null,
        action: "loyalty.tier_change",
        targetType: "customer_loyalty_status",
        targetId: customerId,
        before: { currentTierId: status.current_tier_id, lifetimePoints: status.lifetime_points },
        after: { currentTierId: updated.current_tier_id, lifetimePoints: updated.lifetime_points },
      });
    }
  }

  async getCustomerStatus(customerId: string): Promise<PublicCustomerLoyaltyStatus> {
    const status = await this.deps.loyaltyRepository.getStatus(customerId);
    if (!status) {
      return {
        customerId,
        programId: null,
        currentTier: null,
        nextTier: null,
        lifetimePoints: 0,
        pointsToNextTier: null,
      };
    }

    let currentTier = null;
    let nextTier = null;
    let pointsToNextTier: number | null = null;
    if (status.program_id) {
      const tiers = await this.deps.loyaltyRepository.listTiersByProgram(status.program_id);
      const sorted = [...tiers].sort((a, b) => a.min_lifetime_points - b.min_lifetime_points);
      currentTier = sorted.find((t) => t.id === status.current_tier_id) ?? null;
      nextTier = sorted.find((t) => t.min_lifetime_points > status.lifetime_points) ?? null;
      pointsToNextTier = nextTier ? nextTier.min_lifetime_points - status.lifetime_points : null;
    }

    return {
      customerId,
      programId: status.program_id,
      currentTier: currentTier ? toPublicLoyaltyTier(currentTier) : null,
      nextTier: nextTier ? toPublicLoyaltyTier(nextTier) : null,
      lifetimePoints: status.lifetime_points,
      pointsToNextTier,
    };
  }
}
