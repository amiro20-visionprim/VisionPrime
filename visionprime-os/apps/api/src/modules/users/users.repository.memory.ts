import { randomUUID } from "crypto";
import { UsersRepository } from "./users.repository";
import { ListUsersParams, ListUsersResult, NewUserRecord, UpdateUserRecord, UserRow } from "./users.types";

export function createMemoryUsersRepository(seed: UserRow[] = []): UsersRepository {
  const rows: UserRow[] = [...seed];
  const roleAssignments = new Map<string, Set<string>>();

  return {
    async findById(id: string): Promise<UserRow | null> {
      return rows.find((r) => r.id === id && r.deleted_at === null) ?? null;
    },

    async findByEmail(email: string): Promise<UserRow | null> {
      return rows.find((r) => r.email === email && r.deleted_at === null) ?? null;
    },

    async list(params: ListUsersParams): Promise<ListUsersResult> {
      const active = rows.filter((r) => r.deleted_at === null);
      const start = (params.page - 1) * params.pageSize;
      return { rows: active.slice(start, start + params.pageSize), totalItems: active.length };
    },

    async create(record: NewUserRecord): Promise<UserRow> {
      const now = new Date().toISOString();
      const row: UserRow = {
        id: randomUUID(),
        email: record.email,
        password_hash: record.passwordHash,
        full_name: record.fullName,
        is_active: true,
        is_super_admin: false,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      rows.push(row);
      return row;
    },

    async update(id: string, record: UpdateUserRecord): Promise<UserRow> {
      const row = rows.find((r) => r.id === id && r.deleted_at === null);
      if (!row) {
        throw new Error("User not found");
      }
      if (record.fullName !== undefined) row.full_name = record.fullName;
      if (record.isActive !== undefined) row.is_active = record.isActive;
      row.updated_at = new Date().toISOString();
      return row;
    },

    async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
      const row = rows.find((r) => r.id === id);
      if (row) {
        row.password_hash = passwordHash;
        row.updated_at = new Date().toISOString();
      }
    },

    async softDelete(id: string): Promise<void> {
      const row = rows.find((r) => r.id === id);
      if (row) {
        row.deleted_at = new Date().toISOString();
        row.updated_at = row.deleted_at;
      }
    },

    async getRoleIds(userId: string): Promise<string[]> {
      return Array.from(roleAssignments.get(userId) ?? []);
    },

    async setRoles(userId: string, roleIds: string[]): Promise<void> {
      roleAssignments.set(userId, new Set(roleIds));
    },
  };
}
