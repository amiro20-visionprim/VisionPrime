import express, { Express } from "express";
import { createLogger } from "@visionprime/logger";
import { requestContextMiddleware } from "../common/request-context";
import { createErrorFilter, notFoundHandler } from "../common/error-filter";

import { createMemoryAuditLogRepository, createMemoryActivityLogRepository, createMemorySecurityEventRepository } from "../modules/audit/audit.repository.memory";
import { AuditService } from "../modules/audit/audit.service";
import { createAuditRouter } from "../modules/audit/audit.controller";

import { encryptSecret } from "../common/crypto";
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

import {
  createMemoryWordPressConnectionRepository,
  createMemoryWordPressEntityMappingRepository,
  createMemoryWordPressSyncJobRepository,
  createMemoryWordPressSyncLogRepository,
  createMemoryWordPressWebhookEventRepository,
} from "../modules/wordpress/wordpress.repository.memory";
import { WordPressService } from "../modules/wordpress/wordpress.service";
import { WordPressSyncService } from "../modules/wordpress/wordpress-sync.service";
import { WooCommerceApiClient } from "../modules/wordpress/wordpress-sync.types";
import { createWordPressRouter } from "../modules/wordpress/wordpress.controller";

import { createMemoryCustomersRepository } from "../modules/customers/customers.repository.memory";
import { CustomersService } from "../modules/customers/customers.service";
import { createCustomersRouter } from "../modules/customers/customers.controller";

import { createMemoryProductsRepository } from "../modules/products/products.repository.memory";
import { ProductsService } from "../modules/products/products.service";
import { createProductCategoriesRouter, createProductsRouter } from "../modules/products/products.controller";

import { UserRow } from "../modules/users/users.types";
import { RoleRow } from "../modules/roles/roles.types";
import { CustomerRow } from "../modules/customers/customers.types";
import { ProductRow } from "../modules/products/products.types";

/** Default fake WooCommerce client for tests — returns empty data unless overridden. */
export function createFakeWooCommerceApiClient(overrides?: Partial<WooCommerceApiClient>): WooCommerceApiClient {
  return {
    fetchCustomers: async () => [],
    fetchProducts: async () => [],
    fetchCategories: async () => [],
    ...overrides,
  };
}

export const TEST_INTEGRATION_ENCRYPTION_KEY = "test-integration-encryption-key-32chars";

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
  wordpressService: WordPressService;
  syncService: WordPressSyncService;
  customersRepository: ReturnType<typeof createMemoryCustomersRepository>;
  productsRepository: ReturnType<typeof createMemoryProductsRepository>;
  customersService: CustomersService;
  productsService: ProductsService;
}

export function buildTestApp(options?: {
  users?: UserRow[];
  roles?: RoleRow[];
  customers?: CustomerRow[];
  products?: ProductRow[];
  wooCommerceClient?: WooCommerceApiClient;
}): TestAppHarness {
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

  const wordpressConnectionRepository = createMemoryWordPressConnectionRepository(
    options?.wooCommerceClient
      ? {
          site_url: "https://example.test",
          consumer_key_encrypted: encryptSecret("test-key", TEST_INTEGRATION_ENCRYPTION_KEY),
          consumer_secret_encrypted: encryptSecret("test-secret", TEST_INTEGRATION_ENCRYPTION_KEY),
        }
      : undefined,
  );
  const wordpressSyncJobRepository = createMemoryWordPressSyncJobRepository();
  const wordpressSyncLogRepository = createMemoryWordPressSyncLogRepository();
  const wordpressWebhookEventRepository = createMemoryWordPressWebhookEventRepository();
  const wordpressService = new WordPressService({
    connectionRepository: wordpressConnectionRepository,
    syncJobRepository: wordpressSyncJobRepository,
    syncLogRepository: wordpressSyncLogRepository,
    webhookEventRepository: wordpressWebhookEventRepository,
    auditService,
    encryptionKey: TEST_INTEGRATION_ENCRYPTION_KEY,
  });

  app.use("/api/admin/auth", createAuthRouter({ authService, accessSecret: TEST_JWT_CONFIG.accessSecret }));
  app.use("/api/admin/users", createUsersRouter({ usersService, accessSecret: TEST_JWT_CONFIG.accessSecret }));
  app.use("/api/admin/roles", createRolesRouter({ rolesService, accessSecret: TEST_JWT_CONFIG.accessSecret }));
  app.use(
    "/api/admin/settings",
    createBusinessSettingsRouter({ businessSettingsService, accessSecret: TEST_JWT_CONFIG.accessSecret }),
  );
  app.use("/api/admin", createAuditRouter({ auditService, accessSecret: TEST_JWT_CONFIG.accessSecret }));

  const wordpressEntityMappingRepository = createMemoryWordPressEntityMappingRepository();
  const customersRepository = createMemoryCustomersRepository(options?.customers ?? []);
  const customersService = new CustomersService({ customersRepository, auditService });
  app.use(
    "/api/admin/customers",
    createCustomersRouter({ customersService, accessSecret: TEST_JWT_CONFIG.accessSecret }),
  );

  const productsRepository = createMemoryProductsRepository(options?.products ?? []);
  const productsService = new ProductsService({ productsRepository });
  app.use(
    "/api/admin/products",
    createProductsRouter({ productsService, accessSecret: TEST_JWT_CONFIG.accessSecret }),
  );
  app.use(
    "/api/admin/product-categories",
    createProductCategoriesRouter({ productsService, accessSecret: TEST_JWT_CONFIG.accessSecret }),
  );

  const syncService = new WordPressSyncService({
    connectionRepository: wordpressConnectionRepository,
    syncJobRepository: wordpressSyncJobRepository,
    syncLogRepository: wordpressSyncLogRepository,
    entityMappingRepository: wordpressEntityMappingRepository,
    customersRepository,
    productsRepository,
    wooCommerceClient: options?.wooCommerceClient ?? createFakeWooCommerceApiClient(),
    encryptionKey: TEST_INTEGRATION_ENCRYPTION_KEY,
  });

  app.use(
    "/api/admin/integrations/wordpress",
    createWordPressRouter({ wordpressService, syncService, accessSecret: TEST_JWT_CONFIG.accessSecret }),
  );

  app.use(notFoundHandler);
  app.use(createErrorFilter(createLogger("test", "error")));

  return {
    app,
    usersRepository,
    rolesRepository,
    auditService,
    authService,
    usersService,
    rolesService,
    wordpressService,
    syncService,
    customersRepository,
    productsRepository,
    customersService,
    productsService,
  };
}
