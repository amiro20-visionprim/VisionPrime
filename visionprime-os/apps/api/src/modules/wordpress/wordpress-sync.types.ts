export interface RemoteWooCommerceCustomer {
  id: string;
  email?: string | null;
  billing?: { phone?: string | null };
  first_name?: string;
  last_name?: string;
}

export interface RemoteWooCommerceProduct {
  id: string;
  sku?: string | null;
  name: string;
  status?: string;
  price?: string | null;
  categories?: Array<{ id: string }>;
}

export interface RemoteWooCommerceCategory {
  id: string;
  name: string;
  slug: string;
  parent?: string | number | null;
}

/**
 * Abstraction over the WooCommerce REST API, injectable so sync logic can
 * be unit tested without real network calls (mirrors the masked-error
 * discipline of WordPressService.testConnection).
 */
export interface WooCommerceApiClient {
  fetchCustomers(siteUrl: string, consumerKey: string, consumerSecret: string): Promise<RemoteWooCommerceCustomer[]>;
  fetchProducts(siteUrl: string, consumerKey: string, consumerSecret: string): Promise<RemoteWooCommerceProduct[]>;
  fetchCategories(siteUrl: string, consumerKey: string, consumerSecret: string): Promise<RemoteWooCommerceCategory[]>;
}

export function createFetchWooCommerceApiClient(): WooCommerceApiClient {
  async function getJson(path: string, siteUrl: string, consumerKey: string, consumerSecret: string): Promise<any[]> {
    const url = new URL(path, siteUrl);
    url.searchParams.set("consumer_key", consumerKey);
    url.searchParams.set("consumer_secret", consumerSecret);
    const response = await fetch(url.toString(), { method: "GET" });
    if (!response.ok) {
      throw new Error(`upstream responded with status ${response.status}`);
    }
    return response.json();
  }

  return {
    fetchCustomers: (siteUrl, consumerKey, consumerSecret) =>
      getJson("/wp-json/wc/v3/customers", siteUrl, consumerKey, consumerSecret),
    fetchProducts: (siteUrl, consumerKey, consumerSecret) =>
      getJson("/wp-json/wc/v3/products", siteUrl, consumerKey, consumerSecret),
    fetchCategories: (siteUrl, consumerKey, consumerSecret) =>
      getJson("/wp-json/wc/v3/products/categories", siteUrl, consumerKey, consumerSecret),
  };
}
