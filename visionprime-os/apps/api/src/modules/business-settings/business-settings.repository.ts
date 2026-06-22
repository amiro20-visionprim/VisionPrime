import { BusinessSettingsRow } from "./business-settings.types";

export interface BusinessSettingsRepository {
  get(): Promise<BusinessSettingsRow>;
  updateGeneral(general: Record<string, unknown>, updatedBy: string): Promise<BusinessSettingsRow>;
  updateFeatures(features: Record<string, unknown>, updatedBy: string): Promise<BusinessSettingsRow>;
  updateAppearance(appearance: Record<string, unknown>, updatedBy: string): Promise<BusinessSettingsRow>;
}
