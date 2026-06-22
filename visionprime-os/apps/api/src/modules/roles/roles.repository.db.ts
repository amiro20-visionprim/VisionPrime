import { Db } from "@visionprime/database";
import { RolesRepository } from "./roles.repository";
import { ListRolesParams, ListRolesResult, NewRoleRecord, RoleRow, UpdateRoleRecord } from "./roles.types";

export function createDbRolesRepository(db: Db): RolesRepository {
  return {
    async findById(id: string): Promise<RoleRow | null> {
      const result = await db.query<RoleRow>(`select * from roles where id = $1 and deleted_at is null`, [id]);
      return result.rows[0] ?? null;
    },

    async findByName(name: string): Promise<RoleRow | null> {
      const result = await db.query<RoleRow>(`select * from roles where name = $1 and deleted_at is null`, [name]);
      return result.rows[0] ?? null;
    },

    async list(params: ListRolesParams): Promise<ListRolesResult> {
      const offset = (params.page - 1) * params.pageSize;
      const [rowsResult, countResult] = await Promise.all([
        db.query<RoleRow>(
          `select * from roles where deleted_at is null order by created_at desc limit $1 offset $2`,
          [params.pageSize, offset],
        ),
        db.query<{ count: string }>(`select count(*)::text as count from roles where deleted_at is null`),
      ]);
      return { rows: rowsResult.rows, totalItems: Number(countResult.rows[0]?.count ?? 0) };
    },

    async create(record: NewRoleRecord): Promise<RoleRow> {
      const result = await db.query<RoleRow>(
        `insert into roles (name, description, is_system) values ($1, $2, false) returning *`,
        [record.name, record.description ?? null],
      );
      return result.rows[0];
    },

    async update(id: string, record: UpdateRoleRecord): Promise<RoleRow> {
      const result = await db.query<RoleRow>(
        `update roles set
           name = coalesce($2, name),
           description = coalesce($3, description),
           updated_at = now()
         where id = $1 and deleted_at is null
         returning *`,
        [id, record.name ?? null, record.description ?? null],
      );
      return result.rows[0];
    },

    async delete(id: string): Promise<void> {
      await db.query(`delete from roles where id = $1`, [id]);
    },

    async getPermissionKeys(roleId: string): Promise<string[]> {
      const result = await db.query<{ key: string }>(
        `select p.key from role_permissions rp
         join permissions p on p.id = rp.permission_id
         where rp.role_id = $1`,
        [roleId],
      );
      return result.rows.map((r) => r.key);
    },

    async setPermissions(roleId: string, permissionKeys: string[]): Promise<void> {
      await db.query(`delete from role_permissions where role_id = $1`, [roleId]);
      if (permissionKeys.length === 0) {
        return;
      }
      const result = await db.query<{ id: string; key: string }>(
        `select id, key from permissions where key = any($1::text[])`,
        [permissionKeys],
      );
      for (const permission of result.rows) {
        await db.query(
          `insert into role_permissions (role_id, permission_id) values ($1, $2) on conflict do nothing`,
          [roleId, permission.id],
        );
      }
    },

    async countUsersWithRole(roleId: string): Promise<number> {
      const result = await db.query<{ count: string }>(
        `select count(*)::text as count from user_roles where role_id = $1`,
        [roleId],
      );
      return Number(result.rows[0]?.count ?? 0);
    },
  };
}
