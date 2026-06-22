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
import { createWordPressWebhooksRouter } from "./modules/wordpress/wordpress-webhooks.controller";

import { createDbCustomersRepository } from "./modules/customers/customers.repository.db";
import { CustomersService } from "./modules/customers/customers.service";
import { createCustomersRouter } from "./modules/customers/customers.controller";

import { createDbProductsRepository } from "./modules/products/products.repository.db";
import { ProductsService } from "./modules/products/products.service";
import { createProductCategoriesRouter, createProductsRouter } from "./modules/products/products.controller";

import { createDbOrdersRepository } from "./modules/orders/orders.repository.db";
import { OrdersService } from "./modules/orders/orders.service";
import { createOrdersRouter } from "./modules/orders/orders.controller";

import { createDbWalletRepository } from "./modules/wallet/wallet.repository.db";
import { WalletService } from "./modules/wallet/wallet.service";
import { createWalletRouter } from "./modules/wallet/wallet.controller";

import { WpPluginService } from "./modules/wp-plugin/wp-plugin.service";
import { createWpPluginRouter } from "./modules/wp-plugin/wp-plugin.controller";

import {
  createDbRewardReservationRepository,
  createDbWalletReservationRepository,
} from "./modules/checkout/checkout.repository.db";
import { CheckoutService } from "./modules/checkout/checkout.service";
import { createRewardReservationsRouter, createWalletReservationsRouter } from "./modules/checkout/checkout.controller";

import { createDbLoyaltyRepository } from "./modules/loyalty/loyalty.repository.db";
import { LoyaltyService } from "./modules/loyalty/loyalty.service";
import { createLoyaltyRouter } from "./modules/loyalty/loyalty.controller";

import { createDbPointsRepository } from "./modules/points/points.repository.db";
import { PointsService } from "./modules/points/points.service";
import { createPointsRouter } from "./modules/points/points.controller";

import { createDbRewardsRepository } from "./modules/rewards/rewards.repository.db";
import { RewardsService } from "./modules/rewards/rewards.service";
import {
  createRewardsRouter,
  createRewardClaimsRouter,
  createRewardRedemptionsRouter,
} from "./modules/rewards/rewards.controller";

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

  // --- Phase 03: auth, RBAC, business settings, audit/security logging ---
  const auditLogRepository = createDbAuditLogRepository(db);
  const activityLogRepository = createDbActivityLogRepository(db);
  const securityEventRepository = createDbSecurityEventRepository(db);
  const auditService = new AuditService({ auditLogRepository, activityLogRepository, securityEventRepository });

  // --- Phase 04: WordPress/WooCommerce connection management ---
  const wordpressConnectionRepository = createDbWordPressConnectionRepository(db);
  const wordpressSyncJobRepository = createDbWordPressSyncJobRepository(db);
  const wordpressSyncLogRepository = createDbWordPressSyncLogRepository(db);
  const wordpressWebhookEventRepository = createDbWordPressWebhookEventRepository(db);
  const wordpressEntityMappingRepository = createDbWordPressEntityMappingRepository(db);

  // --- Phase 05: customer/product modules ---
  const customersRepository = createDbCustomersRepository(db);
  const productsRepository = createDbProductsRepository(db);

  // --- Phase 06: orders ---
  const ordersRepository = createDbOrdersRepository(db);

  // --- Phase 07: wallet ledger ---
  const walletRepository = createDbWalletRepository(db);
  const walletService = new WalletService({ walletRepository, auditService });

  // --- Phase 09: checkout wallet/reward reservations ---
  const walletReservationRepository = createDbWalletReservationRepository(db);
  const rewardReservationRepository = createDbRewardReservationRepository(db);
  const checkoutService = new CheckoutService({
    walletRepository,
    walletReservationRepository,
    rewardReservationRepository,
    auditService,
  });

  // --- Phase 10: loyalty/points/rewards ---
  const loyaltyRepository = createDbLoyaltyRepository(db);
  const loyaltyService = new LoyaltyService({ loyaltyRepository, auditService });

  const pointsRepository = createDbPointsRepository(db);
  const pointsService = new PointsService({ pointsRepository, auditService, loyaltyService });

  const rewardsRepository = createDbRewardsRepository(db);
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
    wooCommerceClient: createFetchWooCommerceApiClient(),
    encryptionKey: integrationEncryptionKey,
    applyCashbackForOrder: (params) => walletService.applyCashbackForOrder(params),
    reverseCashbackForOrder: (woocommerceOrderId) => walletService.reverseCashbackForOrder(woocommerceOrderId),
    applyPointsForOrder: async (params) => {
      const pointsPerCurrencyUnit = await loyaltyService.getActivePointsPerCurrencyUnit();
      if (pointsPerCurrencyUnit <= 0) return null;
      return pointsService.awardPointsForOrder({ ...params, pointsPerCurrencyUnit });
    },
    reversePointsForOrder: (woocommerceOrderId) => pointsService.reversePointsForOrder(woocommerceOrderId),
  });

  // Mounted BEFORE the global JSON body parser: this router owns its own
  // raw-body-capturing JSON parser (needed for HMAC signature
  // verification) and is never gated by requireAuth/JWT — only by webhook
  // signature verification. Must stay outside /api/admin.
  app.use(
    "/api/webhooks/wordpress",
    createWordPressWebhooksRouter({
      connectionRepository: wordpressConnectionRepository,
      webhookEventRepository: wordpressWebhookEventRepository,
      syncService,
      encryptionKey: integrationEncryptionKey,
    }),
  );

  app.use(express.json());
  app.use(requestContextMiddleware);

  app.use("/api", healthRouter);
  app.use("/api", versionRouter);

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
  const listOrdersByCustomer = (customerId: string) => ordersRepository.listByCustomer(customerId);

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

  const wordpressService = new WordPressService({
    connectionRepository: wordpressConnectionRepository,
    syncJobRepository: wordpressSyncJobRepository,
    syncLogRepository: wordpressSyncLogRepository,
    webhookEventRepository: wordpressWebhookEventRepository,
    auditService,
    encryptionKey: integrationEncryptionKey,
  });

  // --- Phase 05: customer/product modules + WooCommerce customer/product sync ---
  const customersService = new CustomersService({ customersRepository, auditService, listOrdersByCustomer });
  app.use("/api/admin/customers", createCustomersRouter({ customersService, accessSecret: jwt.accessSecret }));

  const productsService = new ProductsService({ productsRepository });
  app.use("/api/admin/products", createProductsRouter({ productsService, accessSecret: jwt.accessSecret }));
  app.use(
    "/api/admin/product-categories",
    createProductCategoriesRouter({ productsService, accessSecret: jwt.accessSecret }),
  );

  app.use(
    "/api/admin/integrations/wordpress",
    createWordPressRouter({ wordpressService, syncService, accessSecret: jwt.accessSecret }),
  );

  // --- Phase 06: orders + customer purchase metrics ---
  const ordersService = new OrdersService({ ordersRepository });
  app.use(
    "/api/admin/orders",
    createOrdersRouter({
      ordersService,
      syncOrdersFromWordPress: (actorId) => syncService.syncOrders(actorId),
      accessSecret: jwt.accessSecret,
    }),
  );

  app.use(
    "/api/admin/wallets",
    createWalletRouter({ walletService, accessSecret: jwt.accessSecret }),
  );

  // --- Phase 08: WordPress plugin customer-facing API ---
  // Authenticated by plugin API key + HMAC signature (see
  // wp-plugin.middleware.ts), never by the admin JWT — this is the only
  // surface the WordPress plugin's PHP layer calls.
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
      encryptionKey: integrationEncryptionKey,
    }),
  );

  // --- Phase 09: admin-side reservation visibility ---
  app.use(
    "/api/admin/wallet-reservations",
    createWalletReservationsRouter({ checkoutService, accessSecret: jwt.accessSecret }),
  );
  app.use(
    "/api/admin/reward-reservations",
    createRewardReservationsRouter({ checkoutService, accessSecret: jwt.accessSecret }),
  );

  // --- Phase 10: loyalty, points, rewards admin APIs ---
  app.use("/api/admin/loyalty", createLoyaltyRouter({ loyaltyService, accessSecret: jwt.accessSecret }));
  app.use("/api/admin/points", createPointsRouter({ pointsService, accessSecret: jwt.accessSecret }));
  app.use("/api/admin/rewards", createRewardsRouter({ rewardsService, accessSecret: jwt.accessSecret }));
  app.use(
    "/api/admin/reward-claims",
    createRewardClaimsRouter({ rewardsService, accessSecret: jwt.accessSecret }),
  );
  app.use(
    "/api/admin/reward-redemptions",
    createRewardRedemptionsRouter({ rewardsService, accessSecret: jwt.accessSecret }),
  );

  app.use(notFoundHandler);
  app.use(createErrorFilter(logger));

  return app;
}
