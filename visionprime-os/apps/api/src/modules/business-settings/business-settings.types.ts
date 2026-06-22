export interface BusinessSettingsRow {
  id: string;
  general: Record<string, unknown>;
  features: Record<string, unknown>;
  appearance: Record<string, unknown>;
  updated_at: string;
  updated_by: string | null;
}
