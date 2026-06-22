export interface ProductRow {
  id: string;
  woocommerce_product_id: string;
  sku: string | null;
  name: string;
  status: string;
  price: string | null;
  category_woocommerce_ids: string[];
  raw: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UpsertProductRecord {
  woocommerceProductId: string;
  sku?: string | null;
  name: string;
  status?: string;
  price?: string | null;
  categoryWoocommerceIds?: string[];
  raw?: Record<string, unknown>;
}

export interface ListProductsParams {
  page: number;
  pageSize: number;
}

export interface ListProductsResult {
  rows: ProductRow[];
  totalItems: number;
}

export interface ProductCategoryRow {
  id: string;
  name: string;
  slug: string;
  woocommerce_category_id: string;
  parent_woocommerce_category_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertProductCategoryRecord {
  name: string;
  slug: string;
  woocommerceCategoryId: string;
  parentWoocommerceCategoryId?: string | null;
}

export type PublicProduct = ProductRow;
export type PublicProductCategory = ProductCategoryRow;

export function toPublicProduct(row: ProductRow): PublicProduct {
  return row;
}

export function toPublicProductCategory(row: ProductCategoryRow): PublicProductCategory {
  return row;
}
