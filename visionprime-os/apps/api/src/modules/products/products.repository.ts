import {
  ListProductsParams,
  ListProductsResult,
  ProductCategoryRow,
  ProductRow,
  UpsertProductCategoryRecord,
  UpsertProductRecord,
} from "./products.types";

export interface ProductsRepository {
  list(params: ListProductsParams): Promise<ListProductsResult>;
  findById(id: string): Promise<ProductRow | null>;
  findByWoocommerceProductId(woocommerceProductId: string): Promise<ProductRow | null>;
  /** Idempotent insert-or-update keyed on woocommerce_product_id. */
  upsert(record: UpsertProductRecord): Promise<{ row: ProductRow; created: boolean }>;

  listCategories(): Promise<ProductCategoryRow[]>;
  findCategoryByWoocommerceCategoryId(woocommerceCategoryId: string): Promise<ProductCategoryRow | null>;
  upsertCategory(record: UpsertProductCategoryRecord): Promise<{ row: ProductCategoryRow; created: boolean }>;
}
