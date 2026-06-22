import { CRITICAL_PERMISSIONS, Permission } from "@visionprime/permissions";
import { HttpError, NotFoundError } from "../../common/http-error";
import { AuditService, toPaginationMeta } from "../audit/audit.service";
import { UsersRepository } from "../users/users.repository";
import { RolesRepository } from "./roles.repository";
import { RoleRow } from "./roles.types";
import { CreateRoleDto, UpdateRoleDto } from "./roles.dto";

export interface RolesServiceDeps {
  rolesRepository: RolesRepository;
  usersRepository: UsersRepository;
  auditService: AuditService;
}

export interface ActorContext {
  userId: string;
  isSuperAdmin: boolean;
}

export interface RoleWithPermissions extends RoleRow {
  permissionKeys: string[];
}

export class RolesService {
  constructor(private readonly deps: RolesServiceDeps) {}

  async list(page: number, pageSize: number) {
    const result = await this.deps.rolesRepository.list({ page, pageSize });
    const rows = await Promise.all(
      result.rows.map(async (role) => ({
        ...role,
        permissionKeys: await this.deps.rolesRepository.getPermissionKeys(role.id),
      })),
    );
    return { rows, meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async getById(id: string): Promise<RoleWithPermissions> {
    const role = await this.deps.rolesRepository.findById(id);
    if (!role) {
      throw new NotFoundError("Role not found");
    }
    const permissionKeys = await this.deps.rolesRepository.getPermissionKeys(id);
    return { ...role, permissionKeys };
  }

  async create(dto: CreateRoleDto, actor: ActorContext): Promise<RoleWithPermissions> {
    const existing = await this.deps.rolesRepository.findByName(dto.name);
    if (existing) {
      throw new HttpError(409, "VALIDATION_FAILED", "A role with this name already exists.", {
        name: "Name already in use",
      });
    }

    const created = await this.deps.rolesRepository.create({ name: dto.name, description: dto.description });
    const permissionKeys = dto.permissionKeys ?? [];
    if (permissionKeys.length > 0) {
      await this.deps.rolesRepository.setPermissions(created.id, permissionKeys);
    }

    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "role.create",
      targetType: "role",
      targetId: created.id,
      after: { ...created, permissionKeys },
    });

    return { ...created, permissionKeys };
  }

  async update(id: string, dto: UpdateRoleDto, actor: ActorContext): Promise<RoleWithPermissions> {
    const role = await this.deps.rolesRepository.findById(id);
    if (!role) {
      throw new NotFoundError("Role not found");
    }

    const isNameOrDescriptionChange = dto.name !== undefined || dto.description !== undefined;
    const isPermissionChange = dto.permissionKeys !== undefined;

    if (role.is_system && (isNameOrDescriptionChange || isPermissionChange)) {
      throw new HttpError(400, "CANNOT_MODIFY_SYSTEM_ROLE", "System roles cannot be modified.");
    }

    const beforePermissionKeys = await this.deps.rolesRepository.getPermissionKeys(id);

    if (isPermissionChange && !actor.isSuperAdmin) {
      await this.assertCriticalPermissionsPreserved(id, dto.permissionKeys as string[], actor, beforePermissionKeys);
    }

    let updatedRole = role;
    if (isNameOrDescriptionChange) {
      updatedRole = await this.deps.rolesRepository.update(id, {
        name: dto.name,
        description: dto.description,
      });

      await this.deps.auditService.recordAuditLog({
        actorId: actor.userId,
        action: "role.update",
        targetType: "role",
        targetId: id,
        before: { name: role.name, description: role.description },
        after: { name: updatedRole.name, description: updatedRole.description },
      });
    }

    let afterPermissionKeys = beforePermissionKeys;
    if (isPermissionChange) {
      afterPermissionKeys = dto.permissionKeys as string[];
      await this.deps.rolesRepository.setPermissions(id, afterPermissionKeys);

      await this.deps.auditService.recordAuditLog({
        actorId: actor.userId,
        action: "role.permissions_updated",
        targetType: "role",
        targetId: id,
        before: { permissionKeys: beforePermissionKeys },
        after: { permissionKeys: afterPermissionKeys },
      });
    }

    return { ...updatedRole, permissionKeys: afterPermissionKeys };
  }

  async delete(id: string, actor: ActorContext): Promise<void> {
    const role = await this.deps.rolesRepository.findById(id);
    if (!role) {
      throw new NotFoundError("Role not found");
    }

    if (role.is_system) {
      throw new HttpError(400, "CANNOT_MODIFY_SYSTEM_ROLE", "System roles cannot be deleted.");
    }

    const userCount = await this.deps.rolesRepository.countUsersWithRole(id);
    if (userCount > 0) {
      throw new HttpError(409, "ROLE_IN_USE", "This role is currently assigned to one or more users.");
    }

    await this.deps.rolesRepository.delete(id);

    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "role.delete",
      targetType: "role",
      targetId: id,
      before: role,
    });
  }

  /**
   * Recomputes the acting user's effective permissions as they would be
   * AFTER the proposed change to this role's permission set, and rejects
   * the change if it would strip a critical permission the actor has no
   * other source for.
   */
  private async assertCriticalPermissionsPreserved(
    roleId: string,
    newPermissionKeys: string[],
    actor: ActorContext,
    beforePermissionKeys: string[],
  ): Promise<void> {
    const actorRoleIds = await this.deps.usersRepository.getRoleIds(actor.userId);
    if (!actorRoleIds.includes(roleId)) {
      // The acting user does not hold this role — the change cannot strip
      // anything from them via this role.
      return;
    }

    const removedPermissions = beforePermissionKeys.filter((key) => !newPermissionKeys.includes(key));
    const removedCritical = removedPermissions.filter((key) =>
      (CRITICAL_PERMISSIONS as string[]).includes(key),
    ) as Permission[];

    if (removedCritical.length === 0) {
      return;
    }

    const otherRoleIds = actorRoleIds.filter((id) => id !== roleId);
    const otherPermissionSets = await Promise.all(
      otherRoleIds.map((id) => this.deps.rolesRepository.getPermissionKeys(id)),
    );
    const otherPermissions = new Set(otherPermissionSets.flat());

    const stillMissing = removedCritical.filter((key) => !otherPermissions.has(key));
    if (stillMissing.length > 0) {
      throw new HttpError(
        400,
        "CANNOT_REMOVE_CRITICAL_PERMISSION",
        "This change would remove a critical permission you depend on, with no other role granting it to you.",
        { permissions: stillMissing },
      );
    }
  }
}
