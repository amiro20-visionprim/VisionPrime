import { randomUUID } from "crypto";
import { ProductsRepository } from "./products.repository";
import {
  ListProductsParams,
  ListProductsResult,
  ProductCategoryRow,
  ProductRow,
  UpsertProductCategoryRecord,
  UpsertProductRecord,
} from "./products.types";

export function createMemoryProductsRepository(seed: ProductRow[] = []): ProductsRepository {
  const rows: ProductRow[] = [...seed];
  const categories: ProductCategoryRow[] = [];

  return {
    async list(params: ListProductsParams): Promise<ListProductsResult> {
      const start = (params.page - 1) * params.pageSize;
      return { rows: rows.slice(start, start + params.pageSize), totalItems: rows.length };
    },

    async findById(id: string): Promise<ProductRow | null> {
      return rows.find((r) => r.id === id) ?? null;
    },

    async findByWoocommerceProductId(woocommerceProductId: string): Promise<ProductRow | null> {
      return rows.find((r) => r.woocommerce_product_id === woocommerceProductId) ?? null;
    },

    async upsert(record: UpsertProductRecord): Promise<{ row: ProductRow; created: boolean }> {
      const existing = rows.find((r) => r.woocommerce_product_id === record.woocommerceProductId);
      const now = new Date().toISOString();
      if (existing) {
        existing.sku = record.sku ?? existing.sku;
        existing.name = record.name;
        existing.status = record.status ?? existing.status;
        existing.price = record.price ?? existing.price;
        existing.category_woocommerce_ids = record.categoryWoocommerceIds ?? existing.category_woocommerce_ids;
        existing.raw = record.raw ?? existing.raw;
        existing.updated_at = now;
        return { row: existing, created: false };
      }
      const row: ProductRow = {
        id: randomUUID(),
        woocommerce_product_id: record.woocommerceProductId,
        sku: record.sku ?? null,
        name: record.name,
        status: record.status ?? "active",
        price: record.price ?? null,
        category_woocommerce_ids: record.categoryWoocommerceIds ?? [],
        raw: record.raw ?? {},
        created_at: now,
        updated_at: now,
      };
      rows.push(row);
      return { row, created: true };
    },

    async listCategories(): Promise<ProductCategoryRow[]> {
      return categories;
    },

    async findCategoryByWoocommerceCategoryId(woocommerceCategoryId: string): Promise<ProductCategoryRow | null> {
      return categories.find((c) => c.woocommerce_category_id === woocommerceCategoryId) ?? null;
    },

    async upsertCategory(record: UpsertProductCategoryRecord): Promise<{ row: ProductCategoryRow; created: boolean }> {
      const existing = categories.find((c) => c.woocommerce_category_id === record.woocommerceCategoryId);
      const now = new Date().toISOString();
      if (existing) {
        existing.name = record.name;
        existing.slug = record.slug;
        existing.parent_woocommerce_category_id = record.parentWoocommerceCategoryId ?? null;
        existing.updated_at = now;
        return { row: existing, created: false };
      }
      const row: ProductCategoryRow = {
        id: randomUUID(),
        name: record.name,
        slug: record.slug,
        woocommerce_category_id: record.woocommerceCategoryId,
        parent_woocommerce_category_id: record.parentWoocommerceCategoryId ?? null,
        created_at: now,
        updated_at: now,
      };
      categories.push(row);
      return { row, created: true };
    },
  };
}
