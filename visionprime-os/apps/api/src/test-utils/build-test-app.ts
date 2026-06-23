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

import {
  createMemoryWalletReservationRepository,
  createMemoryRewardReservationRepository,
} from "../modules/checkout/checkout.repository.memory";
import { CheckoutService } from "../modules/checkout/checkout.service";
import { createRewardReservationsRouter, createWalletReservationsRouter } from "../modules/checkout/checkout.controller";

import { createMemoryLoyaltyRepository } from "../modules/loyalty/loyalty.repository.memory";
import { LoyaltyService } from "../modules/loyalty/loyalty.service";
import { createLoyaltyRouter } from "../modules/loyalty/loyalty.controller";

import { createMemoryPointsRepository } from "../modules/points/points.repository.memory";
import { PointsService } from "../modules/points/points.service";
import { createPointsRouter } from "../modules/points/points.controller";

import { createMemoryRewardsRepository } from "../modules/rewards/rewards.repository.memory";
import { RewardsService } from "../modules/rewards/rewards.service";
import {
  createRewardsRouter,
  createRewardClaimsRouter,
  createRewardRedemptionsRouter,
} from "../modules/rewards/rewards.controller";

import { createMemorySegmentsRepository } from "../modules/segments/segments.repository.memory";
import { SegmentsService } from "../modules/segments/segments.service";
import { createSegmentsRouter } from "../modules/segments/segments.controller";

import { createMemoryNotificationsRepository } from "../modules/notifications/notifications.repository.memory";
import { NotificationsService } from "../modules/notifications/notifications.service";
import {
  createMessageTemplatesRouter,
  createNotificationProvidersRouter,
  createOptOutsRouter,
  createSuppressionListsRouter,
} from "../modules/notifications/notifications.controller";

import { createMemoryCampaignsRepository } from "../modules/campaigns/campaigns.repository.memory";
import { CampaignsService } from "../modules/campaigns/campaigns.service";
import { createCampaignsRouter } from "../modules/campaigns/campaigns.controller";
import { createTestJobRunner, TestJobRunner } from "../common/jobs";

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
  walletReservationRepository: ReturnType<typeof createMemoryWalletReservationRepository>;
  rewardReservationRepository: ReturnType<typeof createMemoryRewardReservationRepository>;
  checkoutService: CheckoutService;
  loyaltyRepository: ReturnType<typeof createMemoryLoyaltyRepository>;
  loyaltyService: LoyaltyService;
  pointsRepository: ReturnType<typeof createMemoryPointsRepository>;
  pointsService: PointsService;
  rewardsRepository: ReturnType<typeof createMemoryRewardsRepository>;
  rewardsService: RewardsService;
  segmentsRepository: ReturnType<typeof createMemorySegmentsRepository>;
  segmentsService: SegmentsService;
  notificationsRepository: ReturnType<typeof createMemoryNotificationsRepository>;
  notificationsService: NotificationsService;
  campaignsRepository: ReturnType<typeof createMemoryCampaignsRepository>;
  campaignsService: CampaignsService;
  jobRunner: TestJobRunner;
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
  const walletReservationRepository = createMemoryWalletReservationRepository();
  const rewardReservationRepository = createMemoryRewardReservationRepository();
  const checkoutService = new CheckoutService({
    walletRepository,
    walletReservationRepository,
    rewardReservationRepository,
    auditService,
  });

  const loyaltyRepository = createMemoryLoyaltyRepository();
  const loyaltyService = new LoyaltyService({ loyaltyRepository, auditService });

  const pointsRepository = createMemoryPointsRepository();
  const pointsService = new PointsService({ pointsRepository, auditService, loyaltyService });

  const rewardsRepository = createMemoryRewardsRepository();
  const rewardsService = new RewardsService({
    rewardsRepository,
    rewardReservationRepository,
    pointsService,
    auditService,
  });

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
    applyPointsForOrder: async (params) => {
      const pointsPerCurrencyUnit = await loyaltyService.getActivePointsPerCurrencyUnit();
      if (pointsPerCurrencyUnit <= 0) return null;
      return pointsService.awardPointsForOrder({ ...params, pointsPerCurrencyUnit });
    },
    reversePointsForOrder: (woocommerceOrderId) => pointsService.reversePointsForOrder(woocommerceOrderId),
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

  const wpPluginService = new WpPluginService({
    customersRepository,
    walletService,
    pointsService,
    rewardsService,
    loyaltyService,
  });
  app.use(
    "/api/wp-plugin",
    createWpPluginRouter({
      wpPluginService,
      checkoutService,
      rewardsService,
      connectionRepository: wordpressConnectionRepository,
      customersRepository,
      encryptionKey: TEST_INTEGRATION_ENCRYPTION_KEY,
    }),
  );

  app.use(
    "/api/admin/wallet-reservations",
    createWalletReservationsRouter({ checkoutService, accessSecret: TEST_JWT_CONFIG.accessSecret }),
  );
  app.use(
    "/api/admin/reward-reservations",
    createRewardReservationsRouter({ checkoutService, accessSecret: TEST_JWT_CONFIG.accessSecret }),
  );

  app.use("/api/admin/loyalty", createLoyaltyRouter({ loyaltyService, accessSecret: TEST_JWT_CONFIG.accessSecret }));
  app.use("/api/admin/points", createPointsRouter({ pointsService, accessSecret: TEST_JWT_CONFIG.accessSecret }));
  app.use("/api/admin/rewards", createRewardsRouter({ rewardsService, accessSecret: TEST_JWT_CONFIG.accessSecret }));
  app.use(
    "/api/admin/reward-claims",
    createRewardClaimsRouter({ rewardsService, accessSecret: TEST_JWT_CONFIG.accessSecret }),
  );
  app.use(
    "/api/admin/reward-redemptions",
    createRewardRedemptionsRouter({ rewardsService, accessSecret: TEST_JWT_CONFIG.accessSecret }),
  );

  // --- Phase 11: segments, campaigns, notifications ---
  const segmentsRepository = createMemorySegmentsRepository();
  const campaignsRepository = createMemoryCampaignsRepository();
  const segmentsService = new SegmentsService({
    segmentsRepository,
    auditService,
    evaluationDeps: {
      customersRepository,
      ordersRepository,
      productsRepository,
      rewardsRepository,
      walletService,
      pointsService,
      loyaltyService,
      campaignEventLookup: async (campaignId, eventType) => {
        const events = await campaignsRepository.listEvents(campaignId);
        return new Set(events.filter((e) => e.event_type === eventType && e.customer_id).map((e) => e.customer_id as string));
      },
    },
  });
  app.use("/api/admin/segments", createSegmentsRouter({ segmentsService, accessSecret: TEST_JWT_CONFIG.accessSecret }));

  const notificationsRepository = createMemoryNotificationsRepository();
  const notificationsService = new NotificationsService({
    notificationsRepository,
    auditService,
    encryptionKey: TEST_INTEGRATION_ENCRYPTION_KEY,
  });
  app.use(
    "/api/admin/message-templates",
    createMessageTemplatesRouter({ notificationsService, accessSecret: TEST_JWT_CONFIG.accessSecret }),
  );
  app.use(
    "/api/admin/notification-providers",
    createNotificationProvidersRouter({ notificationsService, accessSecret: TEST_JWT_CONFIG.accessSecret }),
  );
  app.use(
    "/api/admin/notification-opt-outs",
    createOptOutsRouter({ notificationsService, accessSecret: TEST_JWT_CONFIG.accessSecret }),
  );
  app.use(
    "/api/admin/suppression-lists",
    createSuppressionListsRouter({ notificationsService, accessSecret: TEST_JWT_CONFIG.accessSecret }),
  );

  const jobRunner = createTestJobRunner();
  const campaignsService = new CampaignsService({
    campaignsRepository,
    segmentsService,
    notificationsService,
    auditService,
    jobRunner,
    highCostApprovalThreshold: null,
  });
  app.use("/api/admin/campaigns", createCampaignsRouter({ campaignsService, accessSecret: TEST_JWT_CONFIG.accessSecret }));

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
    walletReservationRepository,
    rewardReservationRepository,
    checkoutService,
    loyaltyRepository,
    loyaltyService,
    pointsRepository,
    pointsService,
    rewardsRepository,
    rewardsService,
    segmentsRepository,
    segmentsService,
    notificationsRepository,
    notificationsService,
    campaignsRepository,
    campaignsService,
    jobRunner,
  };
}
