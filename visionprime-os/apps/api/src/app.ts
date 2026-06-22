import express, { Express } from "express";
import cors from "cors";
import { Logger } from "@visionprime/logger";
import { Db } from "@visionprime/database";
import { requestContextMiddleware } from "./common/request-context";
import { createErrorFilter, notFoundHandler } from "./common/error-filter";
import { healthRouter } from "./modules/health/health.controller";
import { versionRouter } from "./modules/version/version.controller";

import { createDbAuditLogRepository, createDbActivityLogRepository, createDbSecurityEventRepository } from "./modules/audit/audit.repository.db";
import { AuditService } from "./modules/audit/audit.service";
import { createAuditRouter } from "./modules/audit/audit.controller";

import { createDbUsersRepository } from "./modules/users/users.repository.db";
import { UsersService } from "./modules/users/users.service";
import { createUsersRouter } from "./modules/users/users.controller";

import { createDbRolesRepository } from "./modules/roles/roles.repository.db";
import { RolesService } from "./modules/roles/roles.service";
import { createRolesRouter } from "./modules/roles/roles.controller";

import { createDbPermissionsRepository } from "./modules/permissions/permissions.repository.db";
import { PermissionsService } from "./modules/permissions/permissions.service";
import { createPermissionsRouter } from "./modules/permissions/permissions.controller";

import { createDbBusinessSettingsRepository } from "./modules/business-settings/business-settings.repository.db";
import { BusinessSettingsService } from "./modules/business-settings/business-settings.service";
import { createBusinessSettingsRouter } from "./modules/business-settings/business-settings.controller";

import { createDbSessionsRepository } from "./modules/auth/sessions.repository.db";
import { AuthService, AuthServiceConfig } from "./modules/auth/auth.service";
import { createAuthRouter } from "./modules/auth/auth.controller";

import {
  createDbWordPressConnectionRepository,
  createDbWordPressEntityMappingRepository,
  createDbWordPressSyncJobRepository,
  createDbWordPressSyncLogRepository,
  createDbWordPressWebhookEventRepository,
} from "./modules/wordpress/wordpress.repository.db";
import { WordPressService } from "./modules/wordpress/wordpress.service";
import { WordPressSyncService } from "./modules/wordpress/wordpress-sync.service";
import { createFetchWooCommerceApiClient } from "./modules/wordpress/wordpress-sync.types";
import { createWordPressRouter } from "./modules/wordpress/wordpress.controller";

import { createDbCustomersRepository } from "./modules/customers/customers.repository.db";
import { CustomersService } from "./modules/customers/customers.service";
import { createCustomersRouter } from "./modules/customers/customers.controller";

import { createDbProductsRepository } from "./modules/products/products.repository.db";
import { ProductsService } from "./modules/products/products.service";
import { createProductCategoriesRouter, createProductsRouter } from "./modules/products/products.controller";

export interface CreateAppOptions {
  db: Db;
  jwt: AuthServiceConfig;
  integrationEncryptionKey: string;
}

/**
 * Builds the Express app without starting it listening — kept separate
 * from main.ts so tests can import and exercise the app directly.
 *
 * Phase 03 wires real, Db-backed repositories/services. Tests build their
 * own app instance with in-memory fakes wired directly into each
 * controller factory instead of calling this function.
 */
export function createApp(logger: Logger, options: CreateAppOptions): Express {
  const app = express();
  const { db, jwt, integrationEncryptionKey } = options;

  app.use(cors());
  app.use(express.json());
  app.use(requestContextMiddleware);

  app.use("/api", healthRouter);
  app.use("/api", versionRouter);

  // --- Phase 03: auth, RBAC, business settings, audit/security logging ---
  const auditLogRepository = createDbAuditLogRepository(db);
  const activityLogRepository = createDbActivityLogRepository(db);
  const securityEventRepository = createDbSecurityEventRepository(db);
  const auditService = new AuditService({ auditLogRepository, activityLogRepository, securityEventRepository });

  const usersRepository = createDbUsersRepository(db);
  const rolesRepository = createDbRolesRepository(db);
  const sessionsRepository = createDbSessionsRepository(db);
  const permissionsRepository = createDbPermissionsRepository(db);
  const businessSettingsRepository = createDbBusinessSettingsRepository(db);

  const authService = new AuthService({
    usersRepository,
    rolesRepository,
    sessionsRepository,
    auditService,
    config: jwt,
  });
  const usersService = new UsersService({ usersRepository, auditService });
  const rolesService = new RolesService({ rolesRepository, usersRepository, auditService });
  const permissionsService = new PermissionsService(permissionsRepository);
  const businessSettingsService = new BusinessSettingsService({ repository: businessSettingsRepository, auditService });

  app.use("/api/admin/auth", createAuthRouter({ authService, accessSecret: jwt.accessSecret }));
  app.use("/api/admin/users", createUsersRouter({ usersService, accessSecret: jwt.accessSecret }));
  app.use("/api/admin/roles", createRolesRouter({ rolesService, accessSecret: jwt.accessSecret }));
  app.use("/api/admin/permissions", createPermissionsRouter({ permissionsService, accessSecret: jwt.accessSecret }));
  app.use(
    "/api/admin/settings",
    createBusinessSettingsRouter({ businessSettingsService, accessSecret: jwt.accessSecret }),
  );
  app.use("/api/admin", createAuditRouter({ auditService, accessSecret: jwt.accessSecret }));

  // --- Phase 04: WordPress/WooCommerce connection management ---
  const wordpressConnectionRepository = createDbWordPressConnectionRepository(db);
  const wordpressSyncJobRepository = createDbWordPressSyncJobRepository(db);
  const wordpressSyncLogRepository = createDbWordPressSyncLogRepository(db);
  const wordpressWebhookEventRepository = createDbWordPressWebhookEventRepository(db);
  const wordpressService = new WordPressService({
    connectionRepository: wordpressConnectionRepository,
    syncJobRepository: wordpressSyncJobRepository,
    syncLogRepository: wordpressSyncLogRepository,
    webhookEventRepository: wordpressWebhookEventRepository,
    auditService,
    encryptionKey: integrationEncryptionKey,
  });
  const wordpressEntityMappingRepository = createDbWordPressEntityMappingRepository(db);

  // --- Phase 05: customer/product modules + WooCommerce customer/product sync ---
  const customersRepository = createDbCustomersRepository(db);
  const customersService = new CustomersService({ customersRepository, auditService });
  app.use("/api/admin/customers", createCustomersRouter({ customersService, accessSecret: jwt.accessSecret }));

  const productsRepository = createDbProductsRepository(db);
  const productsService = new ProductsService({ productsRepository });
  app.use("/api/admin/products", createProductsRouter({ productsService, accessSecret: jwt.accessSecret }));
  app.use(
    "/api/admin/product-categories",
    createProductCategoriesRouter({ productsService, accessSecret: jwt.accessSecret }),
  );

  const syncService = new WordPressSyncService({
    connectionRepository: wordpressConnectionRepository,
    syncJobRepository: wordpressSyncJobRepository,
    syncLogRepository: wordpressSyncLogRepository,
    entityMappingRepository: wordpressEntityMappingRepository,
    customersRepository,
    productsRepository,
    wooCommerceClient: createFetchWooCommerceApiClient(),
    encryptionKey: integrationEncryptionKey,
  });

  app.use(
    "/api/admin/integrations/wordpress",
    createWordPressRouter({ wordpressService, syncService, accessSecret: jwt.accessSecret }),
  );

  app.use(notFoundHandler);
  app.use(createErrorFilter(logger));

  return app;
}
