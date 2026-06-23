import { PermissionCatalogEntry, PermissionsRepository } from "./permissions.repository";

export function createMemoryPermissionsRepository(seed: PermissionCatalogEntry[] = []): PermissionsRepository {
  return {
    async listAll(): Promise<PermissionCatalogEntry[]> {
      return seed;
    },
  };
}
