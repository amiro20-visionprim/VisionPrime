import { SYSTEM_PERMISSIONS } from "@visionprime/permissions";
import { PermissionCatalogEntry, PermissionsRepository } from "./permissions.repository";

export class PermissionsService {
  constructor(private readonly repository: PermissionsRepository) {}

  /**
   * Returns the system permission catalog: the canonical key list from
   * `@visionprime/permissions` joined with descriptions stored in the
   * `permissions` table. Keys outside `SYSTEM_PERMISSIONS` are ignored —
   * the catalog is fixed at the code level, not creatable via API.
   */
  async listCatalog(): Promise<PermissionCatalogEntry[]> {
    const dbEntries = await this.repository.listAll();
    const descriptionsByKey = new Map(dbEntries.map((entry) => [entry.key, entry.description]));

    return SYSTEM_PERMISSIONS.map((key) => ({
      key,
      description: descriptionsByKey.get(key) ?? "",
    }));
  }
}
