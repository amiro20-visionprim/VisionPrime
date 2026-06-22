import { UsersRepository } from "../../modules/users/users.repository";
import { RolesRepository } from "../../modules/roles/roles.repository";

/**
 * Computes a user's effective permission set: the union of permissions
 * granted by all roles assigned to them. Super admins are handled
 * separately by callers (they implicitly hold every permission — see
 * `hasPermission` in @visionprime/permissions).
 */
export async function computeEffectivePermissions(
  userId: string,
  usersRepository: UsersRepository,
  rolesRepository: RolesRepository,
): Promise<string[]> {
  const roleIds = await usersRepository.getRoleIds(userId);
  const permissionSets = await Promise.all(roleIds.map((roleId) => rolesRepository.getPermissionKeys(roleId)));
  return Array.from(new Set(permissionSets.flat()));
}
