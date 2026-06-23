import { ListUsersParams, ListUsersResult, NewUserRecord, UpdateUserRecord, UserRow } from "./users.types";

export interface UsersRepository {
  findById(id: string): Promise<UserRow | null>;
  findByEmail(email: string): Promise<UserRow | null>;
  list(params: ListUsersParams): Promise<ListUsersResult>;
  create(record: NewUserRecord): Promise<UserRow>;
  update(id: string, record: UpdateUserRecord): Promise<UserRow>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
  softDelete(id: string): Promise<void>;
  getRoleIds(userId: string): Promise<string[]>;
  setRoles(userId: string, roleIds: string[]): Promise<void>;
}
