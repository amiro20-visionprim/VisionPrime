export interface PermissionCatalogEntry {
  key: string;
  description: string;
}

export interface PermissionsRepository {
  listAll(): Promise<PermissionCatalogEntry[]>;
}
