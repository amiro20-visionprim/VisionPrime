import { HttpError } from "../../common/http-error";
import { hashPassword, verifyPassword } from "../../common/auth/password";
import { generateRefreshToken, hashRefreshToken, signAccessToken } from "../../common/auth/jwt";
import { computeEffectivePermissions } from "../../common/auth/effective-permissions";
import { UsersRepository } from "../users/users.repository";
import { RolesRepository } from "../roles/roles.repository";
import { SessionsRepository } from "./sessions.repository";
import { AuditService } from "../audit/audit.service";
import { toPublicUser, PublicUser } from "../users/users.types";

export interface AuthServiceConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtlMinutes: number;
  refreshTtlDays: number;
}

export interface AuthDeps {
  usersRepository: UsersRepository;
  rolesRepository: RolesRepository;
  sessionsRepository: SessionsRepository;
  auditService: AuditService;
  config: AuthServiceConfig;
}

export interface LoginResult {
  user: PublicUser;
  permissions: string[];
  accessToken: string;
  refreshToken: string;
}

export interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuthService {
  constructor(private readonly deps: AuthDeps) {}

  async login(email: string, password: string, meta: RequestMeta = {}): Promise<LoginResult> {
    const user = await this.deps.usersRepository.findByEmail(email);

    if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
      await this.deps.auditService.recordSecurityEvent({
        type: "login_failed",
        severity: "warning",
        email,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { email },
      });
      throw new HttpError(401, "AUTH_INVALID_CREDENTIALS", "Invalid email or password");
    }

    const permissions = user.is_super_admin
      ? []
      : await computeEffectivePermissions(user.id, this.deps.usersRepository, this.deps.rolesRepository);

    const { accessToken, refreshToken } = await this.issueTokenPair(user.id, permissions, user.is_super_admin, meta);

    await this.deps.auditService.recordAuditLog({
      actorId: user.id,
      action: "auth.login",
      targetType: "user",
      targetId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { user: toPublicUser(user), permissions, accessToken, refreshToken };
  }

  async refresh(refreshToken: string, meta: RequestMeta = {}): Promise<LoginResult> {
    const tokenHash = hashRefreshToken(refreshToken);
    const session = await this.deps.sessionsRepository.findByRefreshTokenHash(tokenHash);

    if (!session || session.revoked_at || new Date(session.expires_at).getTime() < Date.now()) {
      throw new HttpError(401, "AUTH_INVALID_TOKEN", "The refresh token is invalid or expired.");
    }

    const user = await this.deps.usersRepository.findById(session.user_id);
    if (!user || !user.is_active) {
      throw new HttpError(401, "AUTH_INVALID_TOKEN", "The refresh token is invalid or expired.");
    }

    await this.deps.sessionsRepository.revoke(session.id);

    const permissions = user.is_super_admin
      ? []
      : await computeEffectivePermissions(user.id, this.deps.usersRepository, this.deps.rolesRepository);

    const { accessToken, refreshToken: newRefreshToken } = await this.issueTokenPair(
      user.id,
      permissions,
      user.is_super_admin,
      meta,
    );

    return { user: toPublicUser(user), permissions, accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string, actorId?: string, meta: RequestMeta = {}): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    const session = await this.deps.sessionsRepository.findByRefreshTokenHash(tokenHash);

    if (session && !session.revoked_at) {
      await this.deps.sessionsRepository.revoke(session.id);
      await this.deps.auditService.recordAuditLog({
        actorId: actorId ?? session.user_id,
        action: "auth.logout",
        targetType: "user",
        targetId: session.user_id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }
  }

  async getMe(userId: string): Promise<{ user: PublicUser; roleIds: string[]; permissions: string[] }> {
    const user = await this.deps.usersRepository.findById(userId);
    if (!user) {
      throw new HttpError(401, "AUTH_INVALID_TOKEN", "User account no longer exists.");
    }
    const roleIds = await this.deps.usersRepository.getRoleIds(userId);
    const permissions = user.is_super_admin
      ? []
      : await computeEffectivePermissions(userId, this.deps.usersRepository, this.deps.rolesRepository);
    return { user: toPublicUser(user), roleIds, permissions };
  }

  private async issueTokenPair(
    userId: string,
    permissions: string[],
    isSuperAdmin: boolean,
    meta: RequestMeta,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = signAccessToken(
      { userId, permissions, isSuperAdmin },
      this.deps.config.accessSecret,
      this.deps.config.accessTtlMinutes,
    );

    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + this.deps.config.refreshTtlDays * 24 * 60 * 60 * 1000);

    await this.deps.sessionsRepository.create({
      userId,
      refreshTokenHash,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  hashPasswordForUser(password: string): string {
    return hashPassword(password);
  }
}
