import { randomUUID } from "crypto";
import { BusinessSettingsRepository } from "./business-settings.repository";
import { BusinessSettingsRow } from "./business-settings.types";

export function createMemoryBusinessSettingsRepository(
  seed?: Partial<BusinessSettingsRow>,
): BusinessSettingsRepository {
  const row: BusinessSettingsRow = {
    id: seed?.id ?? randomUUID(),
    general: seed?.general ?? {},
    features: seed?.features ?? {},
    appearance: seed?.appearance ?? {},
    updated_at: seed?.updated_at ?? new Date().toISOString(),
    updated_by: seed?.updated_by ?? null,
  };

  return {
    async get(): Promise<BusinessSettingsRow> {
      return row;
    },

    async updateGeneral(general: Record<string, unknown>, updatedBy: string): Promise<BusinessSettingsRow> {
      row.general = general;
      row.updated_at = new Date().toISOString();
      row.updated_by = updatedBy;
      return row;
    },

    async updateFeatures(features: Record<string, unknown>, updatedBy: string): Promise<BusinessSettingsRow> {
      row.features = features;
      row.updated_at = new Date().toISOString();
      row.updated_by = updatedBy;
      return row;
    },

    async updateAppearance(appearance: Record<string, unknown>, updatedBy: string): Promise<BusinessSettingsRow> {
      row.appearance = appearance;
      row.updated_at = new Date().toISOString();
      row.updated_by = updatedBy;
      return row;
    },
  };
}
