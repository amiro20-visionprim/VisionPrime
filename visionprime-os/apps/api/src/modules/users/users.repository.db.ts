import { Db } from "@visionprime/database";
import { UsersRepository } from "./users.repository";
import { ListUsersParams, ListUsersResult, NewUserRecord, UpdateUserRecord, UserRow } from "./users.types";

export function createDbUsersRepository(db: Db): UsersRepository {
  return {
    async findById(id: string): Promise<UserRow | null> {
      const result = await db.query<UserRow>(`select * from users where id = $1 and deleted_at is null`, [id]);
      return result.rows[0] ?? null;
    },

    async findByEmail(email: string): Promise<UserRow | null> {
      const result = await db.query<UserRow>(`select * from users where email = $1 and deleted_at is null`, [email]);
      return result.rows[0] ?? null;
    },

    async list(params: ListUsersParams): Promise<ListUsersResult> {
      const offset = (params.page - 1) * params.pageSize;
      const [rowsResult, countResult] = await Promise.all([
        db.query<UserRow>(
          `select * from users where deleted_at is null order by created_at desc limit $1 offset $2`,
          [params.pageSize, offset],
        ),
        db.query<{ count: string }>(`select count(*)::text as count from users where deleted_at is null`),
      ]);
      return { rows: rowsResult.rows, totalItems: Number(countResult.rows[0]?.count ?? 0) };
    },

    async create(record: NewUserRecord): Promise<UserRow> {
      const result = await db.query<UserRow>(
        `insert into users (email, password_hash, full_name, is_active, is_super_admin)
         values ($1, $2, $3, true, false)
         returning *`,
        [record.email, record.passwordHash, record.fullName],
      );
      return result.rows[0];
    },

    async update(id: string, record: UpdateUserRecord): Promise<UserRow> {
      const result = await db.query<UserRow>(
        `update users set
           full_name = coalesce($2, full_name),
           is_active = coalesce($3, is_active),
           updated_at = now()
         where id = $1 and deleted_at is null
         returning *`,
        [id, record.fullName ?? null, record.isActive ?? null],
      );
      return result.rows[0];
    },

    async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
      await db.query(`update users set password_hash = $2, updated_at = now() where id = $1`, [id, passwordHash]);
    },

    async softDelete(id: string): Promise<void> {
      await db.query(`update users set deleted_at = now(), updated_at = now() where id = $1`, [id]);
    },

    async getRoleIds(userId: string): Promise<string[]> {
      const result = await db.query<{ role_id: string }>(`select role_id from user_roles where user_id = $1`, [
        userId,
      ]);
      return result.rows.map((r) => r.role_id);
    },

    async setRoles(userId: string, roleIds: string[]): Promise<void> {
      await db.query(`delete from user_roles where user_id = $1`, [userId]);
      for (const roleId of roleIds) {
        await db.query(`insert into user_roles (user_id, role_id) values ($1, $2) on conflict do nothing`, [
          userId,
          roleId,
        ]);
      }
    },
  };
}
