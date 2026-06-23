import { AuditService } from "../audit/audit.service";
import { BusinessSettingsRepository } from "./business-settings.repository";
import { BusinessSettingsRow } from "./business-settings.types";

export interface BusinessSettingsServiceDeps {
  repository: BusinessSettingsRepository;
  auditService: AuditService;
}

export class BusinessSettingsService {
  constructor(private readonly deps: BusinessSettingsServiceDeps) {}

  get(): Promise<BusinessSettingsRow> {
    return this.deps.repository.get();
  }

  async updateGeneral(general: Record<string, unknown>, actorId: string): Promise<BusinessSettingsRow> {
    const before = await this.deps.repository.get();
    const updated = await this.deps.repository.updateGeneral(general, actorId);
    await this.deps.auditService.recordAuditLog({
      actorId,
      action: "business_settings.update",
      targetType: "business_settings",
      targetId: updated.id,
      before: { general: before.general },
      after: { general: updated.general },
    });
    return updated;
  }

  async updateFeatures(features: Record<string, unknown>, actorId: string): Promise<BusinessSettingsRow> {
    const before = await this.deps.repository.get();
    const updated = await this.deps.repository.updateFeatures(features, actorId);
    await this.deps.auditService.recordAuditLog({
      actorId,
      action: "business_settings.update",
      targetType: "business_settings",
      targetId: updated.id,
      before: { features: before.features },
      after: { features: updated.features },
    });
    return updated;
  }

  async updateAppearance(appearance: Record<string, unknown>, actorId: string): Promise<BusinessSettingsRow> {
    const before = await this.deps.repository.get();
    const updated = await this.deps.repository.updateAppearance(appearance, actorId);
    await this.deps.auditService.recordAuditLog({
      actorId,
      action: "business_settings.update",
      targetType: "business_settings",
      targetId: updated.id,
      before: { appearance: before.appearance },
      after: { appearance: updated.appearance },
    });
    return updated;
  }
}
