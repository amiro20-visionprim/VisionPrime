import { ListRolesParams, ListRolesResult, NewRoleRecord, RoleRow, UpdateRoleRecord } from "./roles.types";

export interface RolesRepository {
  findById(id: string): Promise<RoleRow | null>;
  findByName(name: string): Promise<RoleRow | null>;
  list(params: ListRolesParams): Promise<ListRolesResult>;
  create(record: NewRoleRecord): Promise<RoleRow>;
  update(id: string, record: UpdateRoleRecord): Promise<RoleRow>;
  delete(id: string): Promise<void>;
  getPermissionKeys(roleId: string): Promise<string[]>;
  setPermissions(roleId: string, permissionKeys: string[]): Promise<void>;
  countUsersWithRole(roleId: string): Promise<number>;
}
