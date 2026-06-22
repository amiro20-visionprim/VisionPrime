import { randomUUID } from "crypto";
import { hashPassword } from "../common/auth/password";
import { UserRow } from "../modules/users/users.types";
import { RoleRow } from "../modules/roles/roles.types";

export function buildUserRow(overrides: Partial<UserRow> = {}): UserRow {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    email: "user@example.com",
    password_hash: hashPassword("correct-password"),
    full_name: "Test User",
    is_active: true,
    is_super_admin: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...overrides,
  };
}

export function buildRoleRow(overrides: Partial<RoleRow> = {}): RoleRow {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    name: "Test Role",
    description: null,
    is_system: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...overrides,
  };
}
