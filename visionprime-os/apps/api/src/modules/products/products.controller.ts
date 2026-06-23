import { Router } from "express";
import { asyncHandler } from "../../common/async-handler";
import { sendSuccess } from "../../common/response";
import { createRequireAuth, requirePermission } from "../../common/auth/auth-middleware";
import { normalizePageParams } from "../audit/audit.service";
import { ProductsService } from "./products.service";

export interface ProductsControllerDeps {
  productsService: ProductsService;
  accessSecret: string;
}

export function createProductsRouter(deps: ProductsControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  router.get(
    "/",
    requireAuth,
    requirePermission("product:view"),
    asyncHandler(async (req, res) => {
      const { page, pageSize } = normalizePageParams(req.query.page, req.query.pageSize);
      const { rows, meta } = await deps.productsService.list(page, pageSize);
      sendSuccess(res, rows, { ...meta });
    }),
  );

  router.get(
    "/:id",
    requireAuth,
    requirePermission("product:view"),
    asyncHandler(async (req, res) => {
      const product = await deps.productsService.getById(req.params.id);
      sendSuccess(res, product);
    }),
  );

  return router;
}

export function createProductCategoriesRouter(deps: ProductsControllerDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.accessSecret);

  router.get(
    "/",
    requireAuth,
    requirePermission("product:view"),
    asyncHandler(async (_req, res) => {
      const categories = await deps.productsService.listCategories();
      sendSuccess(res, categories);
    }),
  );

  return router;
}
