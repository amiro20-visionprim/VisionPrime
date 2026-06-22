export interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface NewRoleRecord {
  name: string;
  description?: string | null;
}

export interface UpdateRoleRecord {
  name?: string;
  description?: string | null;
}

export interface ListRolesParams {
  page: number;
  pageSize: number;
}

export interface ListRolesResult {
  rows: RoleRow[];
  totalItems: number;
}
