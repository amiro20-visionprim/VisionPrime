import { randomUUID } from "crypto";
import { RolesRepository } from "./roles.repository";
import { ListRolesParams, ListRolesResult, NewRoleRecord, RoleRow, UpdateRoleRecord } from "./roles.types";

export function createMemoryRolesRepository(seed: RoleRow[] = []): RolesRepository {
  const rows: RoleRow[] = [...seed];
  const permissionAssignments = new Map<string, Set<string>>();
  const userRoleCounts = new Map<string, number>();

  return {
    async findById(id: string): Promise<RoleRow | null> {
      return rows.find((r) => r.id === id && r.deleted_at === null) ?? null;
    },

    async findByName(name: string): Promise<RoleRow | null> {
      return rows.find((r) => r.name === name && r.deleted_at === null) ?? null;
    },

    async list(params: ListRolesParams): Promise<ListRolesResult> {
      const active = rows.filter((r) => r.deleted_at === null);
      const start = (params.page - 1) * params.pageSize;
      return { rows: active.slice(start, start + params.pageSize), totalItems: active.length };
    },

    async create(record: NewRoleRecord): Promise<RoleRow> {
      const now = new Date().toISOString();
      const row: RoleRow = {
        id: randomUUID(),
        name: record.name,
        description: record.description ?? null,
        is_system: false,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      rows.push(row);
      return row;
    },

    async update(id: string, record: UpdateRoleRecord): Promise<RoleRow> {
      const row = rows.find((r) => r.id === id && r.deleted_at === null);
      if (!row) {
        throw new Error("Role not found");
      }
      if (record.name !== undefined) row.name = record.name;
      if (record.description !== undefined) row.description = record.description;
      row.updated_at = new Date().toISOString();
      return row;
    },

    async delete(id: string): Promise<void> {
      const index = rows.findIndex((r) => r.id === id);
      if (index >= 0) {
        rows.splice(index, 1);
      }
    },

    async getPermissionKeys(roleId: string): Promise<string[]> {
      return Array.from(permissionAssignments.get(roleId) ?? []);
    },

    async setPermissions(roleId: string, permissionKeys: string[]): Promise<void> {
      permissionAssignments.set(roleId, new Set(permissionKeys));
    },

    async countUsersWithRole(roleId: string): Promise<number> {
      return userRoleCounts.get(roleId) ?? 0;
    },

    // Test helper (not part of the interface) — allows specs to simulate a
    // role being currently assigned to a user for the ROLE_IN_USE guard.
    __setUserCount(roleId: string, count: number): void {
      userRoleCounts.set(roleId, count);
    },
  } as RolesRepository & { __setUserCount(roleId: string, count: number): void };
}
