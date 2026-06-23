import {
  CustomerEventRow,
  CustomerIdentityRow,
  CustomerNoteRow,
  CustomerPurchaseMetricsDelta,
  CustomerRow,
  CustomerTagRow,
  ListCustomersParams,
  ListCustomersResult,
  MatchPriorityParams,
  NewCustomerRecord,
  UpdateCustomerRecord,
} from "./customers.types";

export interface CustomersRepository {
  findById(id: string): Promise<CustomerRow | null>;
  /**
   * Checks for an existing customer in EXACT priority order:
   * primary_mobile, then primary_email, then wordpress_user_id, then
   * woocommerce_customer_id. Returns the first match. Used both by manual
   * create dedup-check and by sync upsert logic. NEVER reorder this
   * priority.
   */
  findByMatchPriority(params: MatchPriorityParams): Promise<CustomerRow | null>;
  list(params: ListCustomersParams): Promise<ListCustomersResult>;
  create(record: NewCustomerRecord): Promise<CustomerRow>;
  update(id: string, record: UpdateCustomerRecord): Promise<CustomerRow>;
  softDelete(id: string): Promise<void>;

  addNote(customerId: string, note: string, authorId: string | null): Promise<CustomerNoteRow>;
  listNotes(customerId: string): Promise<CustomerNoteRow[]>;

  addTag(customerId: string, tag: string): Promise<CustomerTagRow | null>;
  listTags(customerId: string): Promise<CustomerTagRow[]>;

  listIdentities(customerId: string): Promise<CustomerIdentityRow[]>;
  upsertIdentity(customerId: string, identityType: string, identityValue: string): Promise<CustomerIdentityRow>;

  recordEvent(customerId: string, eventType: string, metadata: Record<string, unknown>): Promise<CustomerEventRow>;
  listEvents(customerId: string): Promise<CustomerEventRow[]>;

  /**
   * Re-points all customer_identities/customer_tags/customer_notes/
   * customer_events/wordpress_entity_mappings rows from `mergedCustomerId`
   * to `survivorCustomerId`, soft-deletes the loser row, and writes a
   * customer_merge_logs row containing a full pre-merge snapshot of the
   * loser (customer row + its notes/tags/identities/events) for audit.
   */
  merge(survivorCustomerId: string, mergedCustomerId: string, actorId: string): Promise<void>;

  /**
   * Applies a signed delta to purchase_count/total_spent/lifetime_value,
   * recomputes average_order_value from the new totals, and sets
   * last_purchase_at when provided. Used by order sync/webhooks on
   * completed/processing orders (positive delta) and to undo that effect
   * on a later cancellation/refund (negative delta) — never overwrites
   * absolute values, so repeated/out-of-order calls stay consistent.
   */
  applyPurchaseMetricsDelta(customerId: string, delta: CustomerPurchaseMetricsDelta): Promise<CustomerRow>;
}
