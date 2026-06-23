export interface CustomerRow {
  id: string;
  full_name: string;
  primary_email: string | null;
  primary_mobile: string | null;
  wordpress_user_id: string | null;
  woocommerce_customer_id: string | null;
  status: string;
  purchase_count: number;
  total_spent: string;
  average_order_value: string;
  last_purchase_at: string | null;
  lifetime_value: string;
  gender: string | null;
  city: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Signed deltas applied to a customer's purchase metrics by order sync/
 * webhooks. A completed/processing order applies a positive delta; a
 * cancelled/refunded order applies the inverse to undo its earlier effect.
 * purchase_count/total_spent/lifetime_value accumulate the deltas;
 * average_order_value and last_purchase_at are recomputed, not delta'd.
 */
export interface CustomerPurchaseMetricsDelta {
  purchaseCountDelta: number;
  totalSpentDelta: number;
  lastPurchaseAt?: string | null;
}

export interface NewCustomerRecord {
  fullName: string;
  primaryEmail?: string | null;
  primaryMobile?: string | null;
  wordpressUserId?: string | null;
  woocommerceCustomerId?: string | null;
  status?: string;
}

export interface UpdateCustomerRecord {
  fullName?: string;
  primaryEmail?: string | null;
  primaryMobile?: string | null;
  wordpressUserId?: string | null;
  woocommerceCustomerId?: string | null;
  status?: string;
}

export interface ListCustomersParams {
  page: number;
  pageSize: number;
}

export interface ListCustomersResult {
  rows: CustomerRow[];
  totalItems: number;
}

export interface MatchPriorityParams {
  mobile?: string | null;
  email?: string | null;
  wordpressUserId?: string | null;
  woocommerceCustomerId?: string | null;
}

export interface CustomerIdentityRow {
  id: string;
  customer_id: string;
  identity_type: string;
  identity_value: string;
  created_at: string;
}

export interface CustomerTagRow {
  id: string;
  customer_id: string;
  tag: string;
  created_at: string;
}

export interface CustomerNoteRow {
  id: string;
  customer_id: string;
  author_id: string | null;
  note: string;
  created_at: string;
}

export interface CustomerEventRow {
  id: string;
  customer_id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CustomerMergeLogRow {
  id: string;
  survivor_customer_id: string;
  merged_customer_id: string;
  merged_customer_snapshot: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
}

export type PublicCustomer = CustomerRow;

export function toPublicCustomer(row: CustomerRow): PublicCustomer {
  return row;
}

export interface Customer360OrderRow {
  id: string;
  woocommerce_order_id: string;
  status: string;
  currency: string | null;
  total: string;
  ordered_at: string | null;
  created_at: string;
}

export interface Customer360 {
  customer: PublicCustomer;
  notes: CustomerNoteRow[];
  tags: CustomerTagRow[];
  identities: CustomerIdentityRow[];
  events: CustomerEventRow[];
  orders: Customer360OrderRow[];
}
