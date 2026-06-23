export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  is_active: boolean;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface NewUserRecord {
  email: string;
  passwordHash: string;
  fullName: string;
}

export interface UpdateUserRecord {
  fullName?: string;
  isActive?: boolean;
}

export interface ListUsersParams {
  page: number;
  pageSize: number;
}

export interface ListUsersResult {
  rows: UserRow[];
  totalItems: number;
}

export type PublicUser = Omit<UserRow, "password_hash">;

export function toPublicUser(row: UserRow): PublicUser {
  const { password_hash: _passwordHash, ...rest } = row;
  return rest;
}
