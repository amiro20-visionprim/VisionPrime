import { Db } from "@visionprime/database";
import { NotificationsRepository } from "./notifications.repository";
import {
  ListParams,
  MessageTemplateRow,
  NotificationMessageRow,
  NotificationOptOutRow,
  NotificationProviderRow,
  SuppressionListMemberRow,
  SuppressionListRow,
} from "./notifications.types";

export function createDbNotificationsRepository(db: Db): NotificationsRepository {
  async function listPaged<T>(table: string, where: string, whereParams: unknown[], orderBy: string, params: ListParams) {
    const offset = (params.page - 1) * params.pageSize;
    const [rowsResult, countResult] = await Promise.all([
      db.query<T>(
        `select * from ${table} ${where} order by ${orderBy} limit $${whereParams.length + 1} offset $${whereParams.length + 2}`,
        [...whereParams, params.pageSize, offset],
      ),
      db.query<{ count: string }>(`select count(*)::text as count from ${table} ${where}`, whereParams),
    ]);
    return { rows: rowsResult.rows, totalItems: Number(countResult.rows[0]?.count ?? 0) };
  }

  return {
    async listTemplates(params) {
      return listPaged<MessageTemplateRow>("message_templates", "where deleted_at is null", [], "created_at desc", params);
    },
    async findTemplateById(id) {
      const r = await db.query<MessageTemplateRow>(`select * from message_templates where id = $1 and deleted_at is null`, [id]);
      return r.rows[0] ?? null;
    },
    async createTemplate(record) {
      const r = await db.query<MessageTemplateRow>(
        `insert into message_templates (name, channel, subject, body, variables) values ($1, $2, $3, $4, $5) returning *`,
        [record.name, record.channel, record.subject ?? null, record.body, JSON.stringify(record.variables ?? [])],
      );
      return r.rows[0];
    },
    async updateTemplate(id, record) {
      const r = await db.query<MessageTemplateRow>(
        `update message_templates set
           name = coalesce($2, name),
           channel = coalesce($3, channel),
           subject = coalesce($4, subject),
           body = coalesce($5, body),
           variables = coalesce($6, variables),
           updated_at = now()
         where id = $1 and deleted_at is null returning *`,
        [
          id,
          record.name ?? null,
          record.channel ?? null,
          record.subject ?? null,
          record.body ?? null,
          record.variables !== undefined ? JSON.stringify(record.variables) : null,
        ],
      );
      return r.rows[0] ?? null;
    },
    async softDeleteTemplate(id) {
      const r = await db.query(`update message_templates set deleted_at = now(), updated_at = now() where id = $1 and deleted_at is null`, [id]);
      return (r.rowCount ?? 0) > 0;
    },

    async listProviders(params) {
      return listPaged<NotificationProviderRow>("notification_providers", "", [], "created_at desc", params);
    },
    async findProviderById(id) {
      const r = await db.query<NotificationProviderRow>(`select * from notification_providers where id = $1`, [id]);
      return r.rows[0] ?? null;
    },
    async createProvider(record) {
      const r = await db.query<NotificationProviderRow>(
        `insert into notification_providers (name, channel, provider_type, credentials_encrypted, is_active, config)
         values ($1, $2, $3, $4, $5, $6) returning *`,
        [record.name, record.channel, record.providerType, record.credentialsEncrypted, record.isActive ?? false, JSON.stringify(record.config ?? {})],
      );
      return r.rows[0];
    },
    async updateProvider(id, record) {
      const r = await db.query<NotificationProviderRow>(
        `update notification_providers set
           name = coalesce($2, name),
           provider_type = coalesce($3, provider_type),
           credentials_encrypted = coalesce($4, credentials_encrypted),
           is_active = coalesce($5, is_active),
           config = coalesce($6, config),
           updated_at = now()
         where id = $1 returning *`,
        [
          id,
          record.name ?? null,
          record.providerType ?? null,
          record.credentialsEncrypted ?? null,
          record.isActive ?? null,
          record.config !== undefined ? JSON.stringify(record.config) : null,
        ],
      );
      return r.rows[0] ?? null;
    },

    async createMessage(record) {
      const r = await db.query<NotificationMessageRow>(
        `insert into notification_messages (campaign_id, customer_id, channel, provider_id, rendered_body)
         values ($1, $2, $3, $4, $5) returning *`,
        [record.campaignId ?? null, record.customerId, record.channel, record.providerId ?? null, record.renderedBody ?? null],
      );
      return r.rows[0];
    },
    async updateMessageStatus(id, status, extra) {
      const r = await db.query<NotificationMessageRow>(
        `update notification_messages set status = $2, error_message = coalesce($3, error_message), sent_at = coalesce($4, sent_at)
         where id = $1 returning *`,
        [id, status, extra.errorMessage ?? null, extra.sentAt ?? null],
      );
      return r.rows[0] ?? null;
    },
    async listMessagesByCampaign(campaignId) {
      const r = await db.query<NotificationMessageRow>(`select * from notification_messages where campaign_id = $1`, [campaignId]);
      return r.rows;
    },

    async listOptOuts(customerId) {
      const r = await db.query<NotificationOptOutRow>(
        customerId ? `select * from notification_opt_outs where customer_id = $1` : `select * from notification_opt_outs`,
        customerId ? [customerId] : [],
      );
      return r.rows;
    },
    async isOptedOut(customerId, channel) {
      const r = await db.query(`select 1 from notification_opt_outs where customer_id = $1 and channel = $2`, [customerId, channel]);
      return r.rows.length > 0;
    },
    async createOptOut(record) {
      const r = await db.query<NotificationOptOutRow>(
        `insert into notification_opt_outs (customer_id, channel, reason) values ($1, $2, $3)
         on conflict (customer_id, channel) do update set reason = excluded.reason returning *`,
        [record.customerId, record.channel, record.reason ?? null],
      );
      return r.rows[0];
    },
    async removeOptOut(customerId, channel) {
      const r = await db.query(`delete from notification_opt_outs where customer_id = $1 and channel = $2`, [customerId, channel]);
      return (r.rowCount ?? 0) > 0;
    },

    async listSuppressionLists(params) {
      return listPaged<SuppressionListRow>("suppression_lists", "", [], "created_at desc", params);
    },
    async findSuppressionListById(id) {
      const r = await db.query<SuppressionListRow>(`select * from suppression_lists where id = $1`, [id]);
      return r.rows[0] ?? null;
    },
    async createSuppressionList(record) {
      const r = await db.query<SuppressionListRow>(
        `insert into suppression_lists (name, description) values ($1, $2) returning *`,
        [record.name, record.description ?? null],
      );
      return r.rows[0];
    },
    async updateSuppressionList(id, record) {
      const r = await db.query<SuppressionListRow>(
        `update suppression_lists set
           name = coalesce($2, name),
           description = coalesce($3, description),
           is_active = coalesce($4, is_active),
           updated_at = now()
         where id = $1 returning *`,
        [id, record.name ?? null, record.description ?? null, record.isActive ?? null],
      );
      return r.rows[0] ?? null;
    },
    async deleteSuppressionList(id) {
      const r = await db.query(`delete from suppression_lists where id = $1`, [id]);
      return (r.rowCount ?? 0) > 0;
    },

    async listSuppressionListMembers(listId) {
      const r = await db.query<SuppressionListMemberRow>(`select * from suppression_list_members where suppression_list_id = $1`, [listId]);
      return r.rows;
    },
    async addSuppressionListMember(listId, customerId) {
      const r = await db.query<SuppressionListMemberRow>(
        `insert into suppression_list_members (suppression_list_id, customer_id) values ($1, $2)
         on conflict (suppression_list_id, customer_id) do update set suppression_list_id = excluded.suppression_list_id returning *`,
        [listId, customerId],
      );
      return r.rows[0];
    },
    async removeSuppressionListMember(listId, customerId) {
      const r = await db.query(`delete from suppression_list_members where suppression_list_id = $1 and customer_id = $2`, [listId, customerId]);
      return (r.rowCount ?? 0) > 0;
    },
    async isSuppressed(customerId) {
      const r = await db.query(
        `select 1 from suppression_list_members m
         join suppression_lists l on l.id = m.suppression_list_id
         where m.customer_id = $1 and l.is_active = true limit 1`,
        [customerId],
      );
      return r.rows.length > 0;
    },
  };
}
