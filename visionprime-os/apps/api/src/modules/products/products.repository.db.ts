import { Db } from "@visionprime/database";
import { ProductsRepository } from "./products.repository";
import {
  ListProductsParams,
  ListProductsResult,
  ProductCategoryRow,
  ProductRow,
  UpsertProductCategoryRecord,
  UpsertProductRecord,
} from "./products.types";

function mapProductRow(row: any): ProductRow {
  return { ...row, category_woocommerce_ids: row.category_woocommerce_ids ?? [] };
}

export function createDbProductsRepository(db: Db): ProductsRepository {
  return {
    async list(params: ListProductsParams): Promise<ListProductsResult> {
      const offset = (params.page - 1) * params.pageSize;
      const [rowsResult, countResult] = await Promise.all([
        db.query(`select * from products order by created_at desc limit $1 offset $2`, [params.pageSize, offset]),
        db.query<{ count: string }>(`select count(*)::text as count from products`),
      ]);
      return { rows: rowsResult.rows.map(mapProductRow), totalItems: Number(countResult.rows[0]?.count ?? 0) };
    },

    async findById(id: string): Promise<ProductRow | null> {
      const result = await db.query(`select * from products where id = $1`, [id]);
      return result.rows[0] ? mapProductRow(result.rows[0]) : null;
    },

    async findByWoocommerceProductId(woocommerceProductId: string): Promise<ProductRow | null> {
      const result = await db.query(`select * from products where woocommerce_product_id = $1`, [
        woocommerceProductId,
      ]);
      return result.rows[0] ? mapProductRow(result.rows[0]) : null;
    },

    async upsert(record: UpsertProductRecord): Promise<{ row: ProductRow; created: boolean }> {
      const existing = await db.query(`select id from products where woocommerce_product_id = $1`, [
        record.woocommerceProductId,
      ]);
      const created = existing.rows.length === 0;
      const result = await db.query(
        `insert into products (woocommerce_product_id, sku, name, status, price, category_woocommerce_ids, raw)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (woocommerce_product_id) do update set
           sku = excluded.sku,
           name = excluded.name,
           status = excluded.status,
           price = excluded.price,
           category_woocommerce_ids = excluded.category_woocommerce_ids,
           raw = excluded.raw,
           updated_at = now()
         returning *`,
        [
          record.woocommerceProductId,
          record.sku ?? null,
          record.name,
          record.status ?? "active",
          record.price ?? null,
          JSON.stringify(record.categoryWoocommerceIds ?? []),
          JSON.stringify(record.raw ?? {}),
        ],
      );
      return { row: mapProductRow(result.rows[0]), created };
    },

    async listCategories(): Promise<ProductCategoryRow[]> {
      const result = await db.query<ProductCategoryRow>(`select * from product_categories order by name asc`);
      return result.rows;
    },

    async findCategoryByWoocommerceCategoryId(woocommerceCategoryId: string): Promise<ProductCategoryRow | null> {
      const result = await db.query<ProductCategoryRow>(
        `select * from product_categories where woocommerce_category_id = $1`,
        [woocommerceCategoryId],
      );
      return result.rows[0] ?? null;
    },

    async upsertCategory(record: UpsertProductCategoryRecord): Promise<{ row: ProductCategoryRow; created: boolean }> {
      const existing = await db.query(`select id from product_categories where woocommerce_category_id = $1`, [
        record.woocommerceCategoryId,
      ]);
      const created = existing.rows.length === 0;
      const result = await db.query<ProductCategoryRow>(
        `insert into product_categories (name, slug, woocommerce_category_id, parent_woocommerce_category_id)
         values ($1, $2, $3, $4)
         on conflict (woocommerce_category_id) do update set
           name = excluded.name,
           slug = excluded.slug,
           parent_woocommerce_category_id = excluded.parent_woocommerce_category_id,
           updated_at = now()
         returning *`,
        [record.name, record.slug, record.woocommerceCategoryId, record.parentWoocommerceCategoryId ?? null],
      );
      return { row: result.rows[0], created };
    },
  };
}
