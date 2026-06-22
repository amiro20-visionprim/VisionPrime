import { Router } from "express";
import { asyncHandler } from "../../common/async-handler";
import { sendSuccess } from "../../common/response";
import { CustomersRepository } from "../customers/customers.repository";
import { WordPressConnectionRepository } from "../wordpress/wordpress.repository";
import { createPluginAuthMiddleware, PluginAuthedRequest } from "./wp-plugin.middleware";
import { WpPluginService } from "./wp-plugin.service";

export interface WpPluginControllerDeps {
  wpPluginService: WpPluginService;
  connectionRepository: WordPressConnectionRepository;
  customersRepository: CustomersRepository;
  encryptionKey: string;
}

/**
 * Read-only customer-facing API consumed by the WordPress plugin's
 * AJAX handlers (never called directly from a browser — the plugin's
 * PHP layer is the only client, holding the plugin API key/shared
 * secret server-side). See wp-plugin.middleware.ts for the auth chain.
 */
export function createWpPluginRouter(deps: WpPluginControllerDeps): Router {
  const router = Router();
  const requirePluginAuth = createPluginAuthMiddleware({
    connectionRepository: deps.connectionRepository,
    customersRepository: deps.customersRepository,
    encryptionKey: deps.encryptionKey,
  });

  router.use(requirePluginAuth);

  router.get(
    "/customer/me",
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const result = await deps.wpPluginService.getMe(req.vpCustomerId!);
      sendSuccess(res, result);
    }),
  );

  router.get(
    "/customer/dashboard",
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const result = await deps.wpPluginService.getDashboard(req.vpCustomerId!);
      sendSuccess(res, result);
    }),
  );

  router.get(
    "/customer/wallet",
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const result = await deps.wpPluginService.getWallet(req.vpCustomerId!);
      sendSuccess(res, result);
    }),
  );

  router.get(
    "/customer/points",
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const result = await deps.wpPluginService.getPoints(req.vpCustomerId!);
      sendSuccess(res, result);
    }),
  );

  router.get(
    "/customer/rewards",
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const result = await deps.wpPluginService.getRewards(req.vpCustomerId!);
      sendSuccess(res, result);
    }),
  );

  router.get(
    "/customer/tier",
    asyncHandler(async (req: PluginAuthedRequest, res) => {
      const result = await deps.wpPluginService.getTier(req.vpCustomerId!);
      sendSuccess(res, result);
    }),
  );

  return router;
}
