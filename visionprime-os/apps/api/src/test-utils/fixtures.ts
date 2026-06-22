import { randomUUID } from "crypto";
import { hashPassword } from "../common/auth/password";
import { UserRow } from "../modules/users/users.types";
import { RoleRow } from "../modules/roles/roles.types";

export function buildUserRow(overrides: Partial<UserRow> = {}): UserRow {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    email: "user@example.com",
    password_hash: hashPassword("correct-password"),
    full_name: "Test User",
    is_active: true,
    is_super_admin: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...overrides,
  };
}

export function buildRoleRow(overrides: Partial<RoleRow> = {}): RoleRow {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    name: "Test Role",
    description: null,
    is_system: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...overrides,
  };
}

import { CustomerRow } from "../modules/customers/customers.types";
import { ProductRow } from "../modules/products/products.types";

export function buildCustomerRow(overrides: Partial<CustomerRow> = {}): CustomerRow {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    full_name: "Test Customer",
    primary_email: "customer@example.com",
    primary_mobile: "+10000000000",
    wordpress_user_id: null,
    woocommerce_customer_id: null,
    status: "active",
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...overrides,
  };
}

export function buildProductRow(overrides: Partial<ProductRow> = {}): ProductRow {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    woocommerce_product_id: "1001",
    sku: "SKU-1001",
    name: "Test Product",
    status: "active",
    price: "9.99",
    category_woocommerce_ids: [],
    raw: {},
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}
