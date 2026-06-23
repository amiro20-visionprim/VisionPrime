import { Db } from "@visionprime/database";
import { PermissionCatalogEntry, PermissionsRepository } from "./permissions.repository";

export function createDbPermissionsRepository(db: Db): PermissionsRepository {
  return {
    async listAll(): Promise<PermissionCatalogEntry[]> {
      const result = await db.query<PermissionCatalogEntry>(`select key, description from permissions order by key`);
      return result.rows;
    },
  };
}
