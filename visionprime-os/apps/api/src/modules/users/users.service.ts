import { HttpError, NotFoundError } from "../../common/http-error";
import { hashPassword } from "../../common/auth/password";
import { AuditService } from "../audit/audit.service";
import { UsersRepository } from "./users.repository";
import { toPaginationMeta } from "../audit/audit.service";
import { toPublicUser, PublicUser } from "./users.types";
import { CreateUserDto, UpdateUserDto } from "./users.dto";

export interface UsersServiceDeps {
  usersRepository: UsersRepository;
  auditService: AuditService;
}

export interface ActorContext {
  userId: string;
  isSuperAdmin: boolean;
}

export class UsersService {
  constructor(private readonly deps: UsersServiceDeps) {}

  async list(page: number, pageSize: number) {
    const result = await this.deps.usersRepository.list({ page, pageSize });
    return { rows: result.rows.map(toPublicUser), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async getById(id: string): Promise<PublicUser> {
    const user = await this.deps.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundError("User not found");
    }
    return toPublicUser(user);
  }

  async create(dto: CreateUserDto, actor: ActorContext): Promise<PublicUser> {
    const existing = await this.deps.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw new HttpError(409, "VALIDATION_FAILED", "A user with this email already exists.", {
        email: "Email already in use",
      });
    }

    const passwordHash = hashPassword(dto.password);
    const created = await this.deps.usersRepository.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
    });

    if (dto.roleIds && dto.roleIds.length > 0) {
      await this.deps.usersRepository.setRoles(created.id, dto.roleIds);
    }

    const publicUser = toPublicUser(created);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "user.create",
      targetType: "user",
      targetId: created.id,
      after: { ...publicUser, roleIds: dto.roleIds ?? [] },
    });

    return publicUser;
  }

  async update(id: string, dto: UpdateUserDto, actor: ActorContext): Promise<PublicUser> {
    const before = await this.deps.usersRepository.findById(id);
    if (!before) {
      throw new NotFoundError("User not found");
    }

    const beforeRoleIds = await this.deps.usersRepository.getRoleIds(id);

    const updated = await this.deps.usersRepository.update(id, {
      fullName: dto.fullName,
      isActive: dto.isActive,
    });

    if (dto.roleIds !== undefined) {
      await this.deps.usersRepository.setRoles(id, dto.roleIds);
    }

    const afterRoleIds = dto.roleIds !== undefined ? dto.roleIds : beforeRoleIds;

    const beforePublic = toPublicUser(before);
    const afterPublic = toPublicUser(updated);

    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "user.update",
      targetType: "user",
      targetId: id,
      before: { ...beforePublic, roleIds: beforeRoleIds },
      after: { ...afterPublic, roleIds: afterRoleIds },
    });

    return afterPublic;
  }

  async delete(id: string, actor: ActorContext): Promise<void> {
    if (id === actor.userId) {
      throw new HttpError(400, "CANNOT_DELETE_SELF", "You cannot delete your own account.");
    }

    const target = await this.deps.usersRepository.findById(id);
    if (!target) {
      throw new NotFoundError("User not found");
    }

    if (target.is_super_admin && !actor.isSuperAdmin) {
      throw new HttpError(403, "CANNOT_DELETE_SUPER_ADMIN", "You cannot delete a super admin account.");
    }

    await this.deps.usersRepository.softDelete(id);

    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "user.delete",
      targetType: "user",
      targetId: id,
      before: toPublicUser(target),
    });
  }
}
