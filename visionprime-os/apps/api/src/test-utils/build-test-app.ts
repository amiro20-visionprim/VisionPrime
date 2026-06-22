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
import { createWordPressWebhooksRouter } from "../modules/wordpress/wordpress-webhooks.controller";

import { createMemoryCustomersRepository } from "../modules/customers/customers.repository.memory";
import { CustomersService } from "../modules/customers/customers.service";
import { createCustomersRouter } from "../modules/customers/customers.controller";

import { createMemoryProductsRepository } from "../modules/products/products.repository.memory";
import { ProductsService } from "../modules/products/products.service";
import { createProductCategoriesRouter, createProductsRouter } from "../modules/products/products.controller";

import { createMemoryOrdersRepository } from "../modules/orders/orders.repository.memory";
import { OrdersService } from "../modules/orders/orders.service";
import { createOrdersRouter } from "../modules/orders/orders.controller";

import { createMemoryWalletRepository } from "../modules/wallet/wallet.repository.memory";
import { WalletService } from "../modules/wallet/wallet.service";
import { createWalletRouter } from "../modules/wallet/wallet.controller";

import { hashPluginApiKey } from "../common/crypto";
import { WpPluginService } from "../modules/wp-plugin/wp-plugin.service";
import { createWpPluginRouter } from "../modules/wp-plugin/wp-plugin.controller";

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
    fetchOrders: async () => [],
    ...overrides,
  };
}

export const TEST_INTEGRATION_ENCRYPTION_KEY = "test-integration-encryption-key-32chars";
export const TEST_PLUGIN_API_KEY = "test-plugin-api-key";
export const TEST_PLUGIN_SHARED_SECRET = "test-plugin-shared-secret";

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
  ordersRepository: ReturnType<typeof createMemoryOrdersRepository>;
  ordersService: OrdersService;
  wordpressWebhookEventRepository: ReturnType<typeof createMemoryWordPressWebhookEventRepository>;
  walletRepository: ReturnType<typeof createMemoryWalletRepository>;
  walletService: WalletService;
  wpPluginService: WpPluginService;
}

export function buildTestApp(options?: {
  users?: UserRow[];
  roles?: RoleRow[];
  customers?: CustomerRow[];
  products?: ProductRow[];
  wooCommerceClient?: WooCommerceApiClient;
}): TestAppHarness {
  const app = express();

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

  const wordpressConnectionRepository = createMemoryWordPressConnectionRepository({
    ...(options?.wooCommerceClient
      ? {
          site_url: "https://example.test",
          consumer_key_encrypted: encryptSecret("test-key", TEST_INTEGRATION_ENCRYPTION_KEY),
          consumer_secret_encrypted: encryptSecret("test-secret", TEST_INTEGRATION_ENCRYPTION_KEY),
        }
      : {}),
    // Seeded unconditionally so wp-plugin tests can authenticate without
    // every other test having to opt in.
    plugin_api_key_hash: hashPluginApiKey(TEST_PLUGIN_API_KEY),
    shared_secret_encrypted: encryptSecret(TEST_PLUGIN_SHARED_SECRET, TEST_INTEGRATION_ENCRYPTION_KEY),
  });
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

  const wordpressEntityMappingRepository = createMemoryWordPressEntityMappingRepository();
  const customersRepository = createMemoryCustomersRepository(options?.customers ?? []);
  const productsRepository = createMemoryProductsRepository(options?.products ?? []);
  const ordersRepository = createMemoryOrdersRepository();
  const walletRepository = createMemoryWalletRepository();
  const walletService = new WalletService({ walletRepository, auditService });

  const syncService = new WordPressSyncService({
    connectionRepository: wordpressConnectionRepository,
    syncJobRepository: wordpressSyncJobRepository,
    syncLogRepository: wordpressSyncLogRepository,
    entityMappingRepository: wordpressEntityMappingRepository,
    customersRepository,
    productsRepository,
    ordersRepository,
    wooCommerceClient: options?.wooCommerceClient ?? createFakeWooCommerceApiClient(),
    encryptionKey: TEST_INTEGRATION_ENCRYPTION_KEY,
    applyCashbackForOrder: (params) => walletService.applyCashbackForOrder(params),
    reverseCashbackForOrder: (woocommerceOrderId) => walletService.reverseCashbackForOrder(woocommerceOrderId),
  });

  app.use(
    "/api/webhooks/wordpress",
    createWordPressWebhooksRouter({
      connectionRepository: wordpressConnectionRepository,
      webhookEventRepository: wordpressWebhookEventRepository,
      syncService,
      encryptionKey: TEST_INTEGRATION_ENCRYPTION_KEY,
    }),
  );

  app.use(express.json());
  app.use(requestContextMiddleware);

  app.use("/api/admin/auth", createAuthRouter({ authService, accessSecret: TEST_JWT_CONFIG.accessSecret }));
  app.use("/api/admin/users", createUsersRouter({ usersService, accessSecret: TEST_JWT_CONFIG.accessSecret }));
  app.use("/api/admin/roles", createRolesRouter({ rolesService, accessSecret: TEST_JWT_CONFIG.accessSecret }));
  app.use(
    "/api/admin/settings",
    createBusinessSettingsRouter({ businessSettingsService, accessSecret: TEST_JWT_CONFIG.accessSecret }),
  );
  app.use("/api/admin", createAuditRouter({ auditService, accessSecret: TEST_JWT_CONFIG.accessSecret }));

  const customersService = new CustomersService({
    customersRepository,
    auditService,
    listOrdersByCustomer: (customerId: string) => ordersRepository.listByCustomer(customerId),
  });
  app.use(
    "/api/admin/customers",
    createCustomersRouter({ customersService, accessSecret: TEST_JWT_CONFIG.accessSecret }),
  );

  const productsService = new ProductsService({ productsRepository });
  app.use(
    "/api/admin/products",
    createProductsRouter({ productsService, accessSecret: TEST_JWT_CONFIG.accessSecret }),
  );
  app.use(
    "/api/admin/product-categories",
    createProductCategoriesRouter({ productsService, accessSecret: TEST_JWT_CONFIG.accessSecret }),
  );

  app.use(
    "/api/admin/integrations/wordpress",
    createWordPressRouter({ wordpressService, syncService, accessSecret: TEST_JWT_CONFIG.accessSecret }),
  );

  const ordersService = new OrdersService({ ordersRepository });
  app.use(
    "/api/admin/orders",
    createOrdersRouter({
      ordersService,
      syncOrdersFromWordPress: (actorId: string) => syncService.syncOrders(actorId),
      accessSecret: TEST_JWT_CONFIG.accessSecret,
    }),
  );

  app.use(
    "/api/admin/wallets",
    createWalletRouter({ walletService, accessSecret: TEST_JWT_CONFIG.accessSecret }),
  );

  const wpPluginService = new WpPluginService({ customersRepository, walletService });
  app.use(
    "/api/wp-plugin",
    createWpPluginRouter({
      wpPluginService,
      connectionRepository: wordpressConnectionRepository,
      customersRepository,
      encryptionKey: TEST_INTEGRATION_ENCRYPTION_KEY,
    }),
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
    ordersRepository,
    ordersService,
    wordpressWebhookEventRepository,
    walletRepository,
    walletService,
    wpPluginService,
  };
}
