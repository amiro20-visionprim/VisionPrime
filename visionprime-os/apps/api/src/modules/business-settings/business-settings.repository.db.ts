import { Db } from "@visionprime/database";
import { BusinessSettingsRepository } from "./business-settings.repository";
import { BusinessSettingsRow } from "./business-settings.types";

/**
 * `business_settings` is a singleton table (always exactly one row,
 * seeded by the migration). All operations act on that single row.
 */
export function createDbBusinessSettingsRepository(db: Db): BusinessSettingsRepository {
  return {
    async get(): Promise<BusinessSettingsRow> {
      const result = await db.query<BusinessSettingsRow>(`select * from business_settings limit 1`);
      return result.rows[0];
    },

    async updateGeneral(general: Record<string, unknown>, updatedBy: string): Promise<BusinessSettingsRow> {
      const result = await db.query<BusinessSettingsRow>(
        `update business_settings set general = $1, updated_at = now(), updated_by = $2
         where id = (select id from business_settings limit 1)
         returning *`,
        [JSON.stringify(general), updatedBy],
      );
      return result.rows[0];
    },

    async updateFeatures(features: Record<string, unknown>, updatedBy: string): Promise<BusinessSettingsRow> {
      const result = await db.query<BusinessSettingsRow>(
        `update business_settings set features = $1, updated_at = now(), updated_by = $2
         where id = (select id from business_settings limit 1)
         returning *`,
        [JSON.stringify(features), updatedBy],
      );
      return result.rows[0];
    },

    async updateAppearance(appearance: Record<string, unknown>, updatedBy: string): Promise<BusinessSettingsRow> {
      const result = await db.query<BusinessSettingsRow>(
        `update business_settings set appearance = $1, updated_at = now(), updated_by = $2
         where id = (select id from business_settings limit 1)
         returning *`,
        [JSON.stringify(appearance), updatedBy],
      );
      return result.rows[0];
    },
  };
}
