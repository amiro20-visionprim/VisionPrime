import { Db } from "@visionprime/database";
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

const MERGE_TABLES = ["customer_identities", "customer_tags", "customer_notes", "customer_events"];

export function createDbCustomersRepository(db: Db): CustomersRepository {
  return {
    async findById(id: string): Promise<CustomerRow | null> {
      const result = await db.query<CustomerRow>(`select * from customers where id = $1 and deleted_at is null`, [id]);
      return result.rows[0] ?? null;
    },

    async findByMatchPriority(params: MatchPriorityParams): Promise<CustomerRow | null> {
      if (params.mobile) {
        const r = await db.query<CustomerRow>(
          `select * from customers where primary_mobile = $1 and deleted_at is null limit 1`,
          [params.mobile],
        );
        if (r.rows[0]) return r.rows[0];
      }
      if (params.email) {
        const r = await db.query<CustomerRow>(
          `select * from customers where primary_email = $1 and deleted_at is null limit 1`,
          [params.email],
        );
        if (r.rows[0]) return r.rows[0];
      }
      if (params.wordpressUserId) {
        const r = await db.query<CustomerRow>(
          `select * from customers where wordpress_user_id = $1 and deleted_at is null limit 1`,
          [params.wordpressUserId],
        );
        if (r.rows[0]) return r.rows[0];
      }
      if (params.woocommerceCustomerId) {
        const r = await db.query<CustomerRow>(
          `select * from customers where woocommerce_customer_id = $1 and deleted_at is null limit 1`,
          [params.woocommerceCustomerId],
        );
        if (r.rows[0]) return r.rows[0];
      }
      return null;
    },

    async list(params: ListCustomersParams): Promise<ListCustomersResult> {
      const offset = (params.page - 1) * params.pageSize;
      const [rowsResult, countResult] = await Promise.all([
        db.query<CustomerRow>(
          `select * from customers where deleted_at is null order by created_at desc limit $1 offset $2`,
          [params.pageSize, offset],
        ),
        db.query<{ count: string }>(`select count(*)::text as count from customers where deleted_at is null`),
      ]);
      return { rows: rowsResult.rows, totalItems: Number(countResult.rows[0]?.count ?? 0) };
    },

    async create(record: NewCustomerRecord): Promise<CustomerRow> {
      const result = await db.query<CustomerRow>(
        `insert into customers (full_name, primary_email, primary_mobile, wordpress_user_id, woocommerce_customer_id, status)
         values ($1, $2, $3, $4, $5, $6)
         returning *`,
        [
          record.fullName,
          record.primaryEmail ?? null,
          record.primaryMobile ?? null,
          record.wordpressUserId ?? null,
          record.woocommerceCustomerId ?? null,
          record.status ?? "active",
        ],
      );
      return result.rows[0];
    },

    async update(id: string, record: UpdateCustomerRecord): Promise<CustomerRow> {
      const result = await db.query<CustomerRow>(
        `update customers set
           full_name = coalesce($2, full_name),
           primary_email = coalesce($3, primary_email),
           primary_mobile = coalesce($4, primary_mobile),
           wordpress_user_id = coalesce($5, wordpress_user_id),
           woocommerce_customer_id = coalesce($6, woocommerce_customer_id),
           status = coalesce($7, status),
           updated_at = now()
         where id = $1 and deleted_at is null
         returning *`,
        [
          id,
          record.fullName ?? null,
          record.primaryEmail ?? null,
          record.primaryMobile ?? null,
          record.wordpressUserId ?? null,
          record.woocommerceCustomerId ?? null,
          record.status ?? null,
        ],
      );
      return result.rows[0];
    },

    async softDelete(id: string): Promise<void> {
      await db.query(`update customers set deleted_at = now(), updated_at = now() where id = $1`, [id]);
    },

    async addNote(customerId: string, note: string, authorId: string | null): Promise<CustomerNoteRow> {
      const result = await db.query<CustomerNoteRow>(
        `insert into customer_notes (customer_id, author_id, note) values ($1, $2, $3) returning *`,
        [customerId, authorId, note],
      );
      return result.rows[0];
    },

    async listNotes(customerId: string): Promise<CustomerNoteRow[]> {
      const result = await db.query<CustomerNoteRow>(
        `select * from customer_notes where customer_id = $1 order by created_at desc`,
        [customerId],
      );
      return result.rows;
    },

    async addTag(customerId: string, tag: string): Promise<CustomerTagRow | null> {
      const result = await db.query<CustomerTagRow>(
        `insert into customer_tags (customer_id, tag) values ($1, $2)
         on conflict (customer_id, tag) do nothing
         returning *`,
        [customerId, tag],
      );
      return result.rows[0] ?? null;
    },

    async listTags(customerId: string): Promise<CustomerTagRow[]> {
      const result = await db.query<CustomerTagRow>(
        `select * from customer_tags where customer_id = $1 order by created_at desc`,
        [customerId],
      );
      return result.rows;
    },

    async listIdentities(customerId: string): Promise<CustomerIdentityRow[]> {
      const result = await db.query<CustomerIdentityRow>(
        `select * from customer_identities where customer_id = $1 order by created_at desc`,
        [customerId],
      );
      return result.rows;
    },

    async upsertIdentity(customerId: string, identityType: string, identityValue: string): Promise<CustomerIdentityRow> {
      const result = await db.query<CustomerIdentityRow>(
        `insert into customer_identities (customer_id, identity_type, identity_value)
         values ($1, $2, $3)
         on conflict (identity_type, identity_value) do update set customer_id = excluded.customer_id
         returning *`,
        [customerId, identityType, identityValue],
      );
      return result.rows[0];
    },

    async recordEvent(customerId: string, eventType: string, metadata: Record<string, unknown>): Promise<CustomerEventRow> {
      const result = await db.query<CustomerEventRow>(
        `insert into customer_events (customer_id, event_type, metadata) values ($1, $2, $3) returning *`,
        [customerId, eventType, JSON.stringify(metadata)],
      );
      return result.rows[0];
    },

    async listEvents(customerId: string): Promise<CustomerEventRow[]> {
      const result = await db.query<CustomerEventRow>(
        `select * from customer_events where customer_id = $1 order by created_at desc`,
        [customerId],
      );
      return result.rows;
    },

    async merge(survivorCustomerId: string, mergedCustomerId: string, actorId: string): Promise<void> {
      const customerResult = await db.query<CustomerRow>(`select * from customers where id = $1`, [mergedCustomerId]);
      const mergedCustomer = customerResult.rows[0];

      const [notes, tags, identities, events] = await Promise.all([
        db.query<CustomerNoteRow>(`select * from customer_notes where customer_id = $1`, [mergedCustomerId]),
        db.query<CustomerTagRow>(`select * from customer_tags where customer_id = $1`, [mergedCustomerId]),
        db.query<CustomerIdentityRow>(`select * from customer_identities where customer_id = $1`, [mergedCustomerId]),
        db.query<CustomerEventRow>(`select * from customer_events where customer_id = $1`, [mergedCustomerId]),
      ]);

      for (const table of MERGE_TABLES) {
        await db.query(`update ${table} set customer_id = $1 where customer_id = $2`, [
          survivorCustomerId,
          mergedCustomerId,
        ]);
      }
      await db.query(
        `update wordpress_entity_mappings set local_id = $1 where local_id = $2`,
        [survivorCustomerId, mergedCustomerId],
      );

      await db.query(`update customers set deleted_at = now(), updated_at = now() where id = $1`, [mergedCustomerId]);

      await db.query(
        `insert into customer_merge_logs (survivor_customer_id, merged_customer_id, merged_customer_snapshot, actor_id)
         values ($1, $2, $3, $4)`,
        [
          survivorCustomerId,
          mergedCustomerId,
          JSON.stringify({
            customer: mergedCustomer,
            notes: notes.rows,
            tags: tags.rows,
            identities: identities.rows,
            events: events.rows,
          }),
          actorId,
        ],
      );
    },
  };
}
