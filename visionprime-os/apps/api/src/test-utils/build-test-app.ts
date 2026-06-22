import express, { Express } from "express";
import { createLogger } from "@visionprime/logger";
import { requestContextMiddleware } from "../common/request-context";
import { createErrorFilter, notFoundHandler } from "../common/error-filter";

import { createMemoryAuditLogRepository, createMemoryActivityLogRepository, createMemorySecurityEventRepository } from "../modules/audit/audit.repository.memory";
import { AuditService } from "../modules/audit/audit.service";
import { createAuditRouter } from "../modules/audit/audit.controller";

import { createMemoryUsersRepository } from "../modules/users/users.repository.memory";
import { UsersService } from "../modules/users/users.service";
import { createUsersRouter } from "../modules/users/users.controller";

import { createMemoryRolesRepository } from "../modules/roles/roles.repository.memory";
import { RolesService } from "../modules/roles/roles.service";
import { createRolesRouter } from "../modules/roles/roles.controller";

import { createMemoryBusinessSettingsRepository } from "../modules/business-settings/business-settings.repository.memory";
import { BusinessSettingsService } from "../modules/business-settings/business-settings.service";
import { createBusinessSettingsRouter } from "../modules/business-settings/business-settings.controller";

import { createMemorySessionsRepository } from "../modules/auth/sessions.repository.memory";
import { AuthService } from "../modules/auth/auth.service";
import { createAuthRouter } from "../modules/auth/auth.controller";

import { UserRow } from "../modules/users/users.types";
import { RoleRow } from "../modules/roles/roles.types";

export const TEST_JWT_CONFIG = {
  accessSecret: "test-access-secret-0123456789",
  refreshSecret: "test-refresh-secret-0123456789",
  accessTtlMinutes: 15,
  refreshTtlDays: 7,
};

export interface TestAppHarness {
  app: Express;
  usersRepository: ReturnType<typeof createMemoryUsersRepository>;
  rolesRepository: ReturnType<typeof createMemoryRolesRepository>;
  auditService: AuditService;
  authService: AuthService;
  usersService: UsersService;
  rolesService: RolesService;
}

export function buildTestApp(options?: { users?: UserRow[]; roles?: RoleRow[] }): TestAppHarness {
  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);

  const auditLogRepository = createMemoryAuditLogRepository();
  const activityLogRepository = createMemoryActivityLogRepository();
  const securityEventRepository = createMemorySecurityEventRepository();
  const auditService = new AuditService({ auditLogRepository, activityLogRepository, securityEventRepository });

  const usersRepository = createMemoryUsersRepository(options?.users ?? []);
  const rolesRepository = createMemoryRolesRepository(options?.roles ?? []);
  const sessionsRepository = createMemorySessionsRepository();
  const businessSettingsRepository = createMemoryBusinessSettingsRepository();

  const authService = new AuthService({
    usersRepository,
    rolesRepository,
    sessionsRepository,
    auditService,
    config: TEST_JWT_CONFIG,
  });
  const usersService = new UsersService({ usersRepository, auditService });
  const rolesService = new RolesService({ rolesRepository, usersRepository, auditService });
  const businessSettingsService = new BusinessSettingsService({ repository: businessSettingsRepository, auditService });

  app.use("/api/admin/auth", createAuthRouter({ authService, accessSecret: TEST_JWT_CONFIG.accessSecret }));
  app.use("/api/admin/users", createUsersRouter({ usersService, accessSecret: TEST_JWT_CONFIG.accessSecret }));
  app.use("/api/admin/roles", createRolesRouter({ rolesService, accessSecret: TEST_JWT_CONFIG.accessSecret }));
  app.use(
    "/api/admin/settings",
    createBusinessSettingsRouter({ businessSettingsService, accessSecret: TEST_JWT_CONFIG.accessSecret }),
  );
  app.use("/api/admin", createAuditRouter({ auditService, accessSecret: TEST_JWT_CONFIG.accessSecret }));

  app.use(notFoundHandler);
  app.use(createErrorFilter(createLogger("test", "error")));

  return { app, usersRepository, rolesRepository, auditService, authService, usersService, rolesService };
}
