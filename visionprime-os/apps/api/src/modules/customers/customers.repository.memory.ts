import { randomUUID } from "crypto";
import { CustomersRepository } from "./customers.repository";
import {
  CustomerEventRow,
  CustomerIdentityRow,
  CustomerNoteRow,
  CustomerRow,
  CustomerTagRow,
  ListCustomersParams,
  ListCustomersResult,
  MatchPriorityParams,
  NewCustomerRecord,
  UpdateCustomerRecord,
} from "./customers.types";

export function createMemoryCustomersRepository(seed: CustomerRow[] = []) {
  const rows: CustomerRow[] = [...seed];
  const notes: CustomerNoteRow[] = [];
  const tags: CustomerTagRow[] = [];
  const identities: CustomerIdentityRow[] = [];
  const events: CustomerEventRow[] = [];
  const mergeLogs: Array<{
    id: string;
    survivor_customer_id: string;
    merged_customer_id: string;
    merged_customer_snapshot: Record<string, unknown>;
    actor_id: string;
    created_at: string;
  }> = [];

  // Exposed for cross-module merge re-pointing in tests (wordpress_entity_mappings).
  const entityMappingLocalIdRepointer: Array<(survivorId: string, mergedId: string) => void> = [];

  const repository: CustomersRepository & {
    __notes: CustomerNoteRow[];
    __tags: CustomerTagRow[];
    __identities: CustomerIdentityRow[];
    __events: CustomerEventRow[];
    __mergeLogs: typeof mergeLogs;
    __registerEntityMappingRepointer: (fn: (survivorId: string, mergedId: string) => void) => void;
  } = {
    __notes: notes,
    __tags: tags,
    __identities: identities,
    __events: events,
    __mergeLogs: mergeLogs,
    __registerEntityMappingRepointer(fn) {
      entityMappingLocalIdRepointer.push(fn);
    },

    async findById(id: string): Promise<CustomerRow | null> {
      return rows.find((r) => r.id === id && r.deleted_at === null) ?? null;
    },

    async findByMatchPriority(params: MatchPriorityParams): Promise<CustomerRow | null> {
      if (params.mobile) {
        const match = rows.find((r) => r.primary_mobile === params.mobile && r.deleted_at === null);
        if (match) return match;
      }
      if (params.email) {
        const match = rows.find((r) => r.primary_email === params.email && r.deleted_at === null);
        if (match) return match;
      }
      if (params.wordpressUserId) {
        const match = rows.find((r) => r.wordpress_user_id === params.wordpressUserId && r.deleted_at === null);
        if (match) return match;
      }
      if (params.woocommerceCustomerId) {
        const match = rows.find(
          (r) => r.woocommerce_customer_id === params.woocommerceCustomerId && r.deleted_at === null,
        );
        if (match) return match;
      }
      return null;
    },

    async list(params: ListCustomersParams): Promise<ListCustomersResult> {
      const active = rows.filter((r) => r.deleted_at === null);
      const start = (params.page - 1) * params.pageSize;
      return { rows: active.slice(start, start + params.pageSize), totalItems: active.length };
    },

    async create(record: NewCustomerRecord): Promise<CustomerRow> {
      const now = new Date().toISOString();
      const row: CustomerRow = {
        id: randomUUID(),
        full_name: record.fullName,
        primary_email: record.primaryEmail ?? null,
        primary_mobile: record.primaryMobile ?? null,
        wordpress_user_id: record.wordpressUserId ?? null,
        woocommerce_customer_id: record.woocommerceCustomerId ?? null,
        status: record.status ?? "active",
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      rows.push(row);
      return row;
    },

    async update(id: string, record: UpdateCustomerRecord): Promise<CustomerRow> {
      const row = rows.find((r) => r.id === id && r.deleted_at === null);
      if (!row) {
        throw new Error("Customer not found");
      }
      if (record.fullName !== undefined) row.full_name = record.fullName;
      if (record.primaryEmail !== undefined) row.primary_email = record.primaryEmail;
      if (record.primaryMobile !== undefined) row.primary_mobile = record.primaryMobile;
      if (record.wordpressUserId !== undefined) row.wordpress_user_id = record.wordpressUserId;
      if (record.woocommerceCustomerId !== undefined) row.woocommerce_customer_id = record.woocommerceCustomerId;
      if (record.status !== undefined) row.status = record.status;
      row.updated_at = new Date().toISOString();
      return row;
    },

    async softDelete(id: string): Promise<void> {
      const row = rows.find((r) => r.id === id);
      if (row) {
        row.deleted_at = new Date().toISOString();
        row.updated_at = row.deleted_at;
      }
    },

    async addNote(customerId: string, note: string, authorId: string | null): Promise<CustomerNoteRow> {
      const row: CustomerNoteRow = {
        id: randomUUID(),
        customer_id: customerId,
        author_id: authorId,
        note,
        created_at: new Date().toISOString(),
      };
      notes.push(row);
      return row;
    },

    async listNotes(customerId: string): Promise<CustomerNoteRow[]> {
      return notes.filter((n) => n.customer_id === customerId).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async addTag(customerId: string, tag: string): Promise<CustomerTagRow | null> {
      const existing = tags.find((t) => t.customer_id === customerId && t.tag === tag);
      if (existing) return null;
      const row: CustomerTagRow = { id: randomUUID(), customer_id: customerId, tag, created_at: new Date().toISOString() };
      tags.push(row);
      return row;
    },

    async listTags(customerId: string): Promise<CustomerTagRow[]> {
      return tags.filter((t) => t.customer_id === customerId).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async listIdentities(customerId: string): Promise<CustomerIdentityRow[]> {
      return identities
        .filter((i) => i.customer_id === customerId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async upsertIdentity(customerId: string, identityType: string, identityValue: string): Promise<CustomerIdentityRow> {
      const existing = identities.find((i) => i.identity_type === identityType && i.identity_value === identityValue);
      if (existing) {
        existing.customer_id = customerId;
        return existing;
      }
      const row: CustomerIdentityRow = {
        id: randomUUID(),
        customer_id: customerId,
        identity_type: identityType,
        identity_value: identityValue,
        created_at: new Date().toISOString(),
      };
      identities.push(row);
      return row;
    },

    async recordEvent(customerId: string, eventType: string, metadata: Record<string, unknown>): Promise<CustomerEventRow> {
      const row: CustomerEventRow = {
        id: randomUUID(),
        customer_id: customerId,
        event_type: eventType,
        metadata,
        created_at: new Date().toISOString(),
      };
      events.push(row);
      return row;
    },

    async listEvents(customerId: string): Promise<CustomerEventRow[]> {
      return events.filter((e) => e.customer_id === customerId).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async merge(survivorCustomerId: string, mergedCustomerId: string, actorId: string): Promise<void> {
      const mergedCustomer = rows.find((r) => r.id === mergedCustomerId) ?? null;

      const mergedNotes = notes.filter((n) => n.customer_id === mergedCustomerId).map((n) => ({ ...n }));
      const mergedTags = tags.filter((t) => t.customer_id === mergedCustomerId).map((t) => ({ ...t }));
      const mergedIdentities = identities.filter((i) => i.customer_id === mergedCustomerId).map((i) => ({ ...i }));
      const mergedEvents = events.filter((e) => e.customer_id === mergedCustomerId).map((e) => ({ ...e }));

      for (const n of notes) if (n.customer_id === mergedCustomerId) n.customer_id = survivorCustomerId;
      for (const t of tags) if (t.customer_id === mergedCustomerId) t.customer_id = survivorCustomerId;
      for (const i of identities) if (i.customer_id === mergedCustomerId) i.customer_id = survivorCustomerId;
      for (const e of events) if (e.customer_id === mergedCustomerId) e.customer_id = survivorCustomerId;

      for (const repoint of entityMappingLocalIdRepointer) {
        repoint(survivorCustomerId, mergedCustomerId);
      }

      const row = rows.find((r) => r.id === mergedCustomerId);
      if (row) {
        row.deleted_at = new Date().toISOString();
        row.updated_at = row.deleted_at;
      }

      mergeLogs.push({
        id: randomUUID(),
        survivor_customer_id: survivorCustomerId,
        merged_customer_id: mergedCustomerId,
        merged_customer_snapshot: {
          customer: mergedCustomer,
          notes: mergedNotes,
          tags: mergedTags,
          identities: mergedIdentities,
          events: mergedEvents,
        },
        actor_id: actorId,
        created_at: new Date().toISOString(),
      });
    },
  };

  return repository;
}
