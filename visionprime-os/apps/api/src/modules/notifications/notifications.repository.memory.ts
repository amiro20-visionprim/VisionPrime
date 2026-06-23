import { randomUUID } from "crypto";
import { NotificationsRepository } from "./notifications.repository";
import {
  ListParams,
  ListResult,
  MessageTemplateRow,
  NotificationMessageRow,
  NotificationOptOutRow,
  NotificationProviderRow,
  SuppressionListMemberRow,
  SuppressionListRow,
} from "./notifications.types";

function paginate<T>(rows: T[], params: ListParams): ListResult<T> {
  const start = (params.page - 1) * params.pageSize;
  return { rows: rows.slice(start, start + params.pageSize), totalItems: rows.length };
}

export function createMemoryNotificationsRepository(): NotificationsRepository {
  const templates: MessageTemplateRow[] = [];
  const providers: NotificationProviderRow[] = [];
  const messages: NotificationMessageRow[] = [];
  const optOuts: NotificationOptOutRow[] = [];
  const suppressionLists: SuppressionListRow[] = [];
  const suppressionMembers: SuppressionListMemberRow[] = [];
  const now = () => new Date().toISOString();

  return {
    async listTemplates(params) {
      return paginate(templates.filter((t) => !t.deleted_at).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)), params);
    },
    async findTemplateById(id) {
      return templates.find((t) => t.id === id && !t.deleted_at) ?? null;
    },
    async createTemplate(record) {
      const row: MessageTemplateRow = {
        id: randomUUID(),
        name: record.name,
        channel: record.channel,
        subject: record.subject ?? null,
        body: record.body,
        variables: record.variables ?? [],
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      };
      templates.push(row);
      return row;
    },
    async updateTemplate(id, record) {
      const row = templates.find((t) => t.id === id && !t.deleted_at);
      if (!row) return null;
      if (record.name !== undefined) row.name = record.name;
      if (record.channel !== undefined) row.channel = record.channel;
      if (record.subject !== undefined) row.subject = record.subject;
      if (record.body !== undefined) row.body = record.body;
      if (record.variables !== undefined) row.variables = record.variables;
      row.updated_at = now();
      return row;
    },
    async softDeleteTemplate(id) {
      const row = templates.find((t) => t.id === id && !t.deleted_at);
      if (!row) return false;
      row.deleted_at = now();
      return true;
    },

    async listProviders(params) {
      return paginate(providers.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)), params);
    },
    async findProviderById(id) {
      return providers.find((p) => p.id === id) ?? null;
    },
    async createProvider(record) {
      const row: NotificationProviderRow = {
        id: randomUUID(),
        name: record.name,
        channel: record.channel,
        provider_type: record.providerType,
        credentials_encrypted: record.credentialsEncrypted,
        is_active: record.isActive ?? false,
        config: record.config ?? {},
        created_at: now(),
        updated_at: now(),
      };
      providers.push(row);
      return row;
    },
    async updateProvider(id, record) {
      const row = providers.find((p) => p.id === id);
      if (!row) return null;
      if (record.name !== undefined) row.name = record.name;
      if (record.providerType !== undefined) row.provider_type = record.providerType;
      if (record.credentialsEncrypted !== undefined) row.credentials_encrypted = record.credentialsEncrypted;
      if (record.isActive !== undefined) row.is_active = record.isActive;
      if (record.config !== undefined) row.config = record.config;
      row.updated_at = now();
      return row;
    },

    async createMessage(record) {
      const row: NotificationMessageRow = {
        id: randomUUID(),
        campaign_id: record.campaignId ?? null,
        customer_id: record.customerId,
        channel: record.channel,
        provider_id: record.providerId ?? null,
        status: "pending",
        rendered_body: record.renderedBody ?? null,
        error_message: null,
        sent_at: null,
        created_at: now(),
      };
      messages.push(row);
      return row;
    },
    async updateMessageStatus(id, status, extra) {
      const row = messages.find((m) => m.id === id);
      if (!row) return null;
      row.status = status;
      if (extra.errorMessage !== undefined) row.error_message = extra.errorMessage;
      if (extra.sentAt !== undefined) row.sent_at = extra.sentAt;
      return row;
    },
    async listMessagesByCampaign(campaignId) {
      return messages.filter((m) => m.campaign_id === campaignId);
    },

    async listOptOuts(customerId) {
      return optOuts.filter((o) => !customerId || o.customer_id === customerId);
    },
    async isOptedOut(customerId, channel) {
      return optOuts.some((o) => o.customer_id === customerId && o.channel === channel);
    },
    async createOptOut(record) {
      const existing = optOuts.find((o) => o.customer_id === record.customerId && o.channel === record.channel);
      if (existing) return existing;
      const row: NotificationOptOutRow = {
        id: randomUUID(),
        customer_id: record.customerId,
        channel: record.channel as NotificationOptOutRow["channel"],
        reason: record.reason ?? null,
        created_at: now(),
      };
      optOuts.push(row);
      return row;
    },
    async removeOptOut(customerId, channel) {
      const idx = optOuts.findIndex((o) => o.customer_id === customerId && o.channel === channel);
      if (idx === -1) return false;
      optOuts.splice(idx, 1);
      return true;
    },

    async listSuppressionLists(params) {
      return paginate(suppressionLists.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)), params);
    },
    async findSuppressionListById(id) {
      return suppressionLists.find((l) => l.id === id) ?? null;
    },
    async createSuppressionList(record) {
      const row: SuppressionListRow = {
        id: randomUUID(),
        name: record.name,
        description: record.description ?? null,
        is_active: true,
        created_at: now(),
        updated_at: now(),
      };
      suppressionLists.push(row);
      return row;
    },
    async updateSuppressionList(id, record) {
      const row = suppressionLists.find((l) => l.id === id);
      if (!row) return null;
      if (record.name !== undefined) row.name = record.name;
      if (record.description !== undefined) row.description = record.description;
      if (record.isActive !== undefined) row.is_active = record.isActive;
      row.updated_at = now();
      return row;
    },
    async deleteSuppressionList(id) {
      const idx = suppressionLists.findIndex((l) => l.id === id);
      if (idx === -1) return false;
      suppressionLists.splice(idx, 1);
      return true;
    },

    async listSuppressionListMembers(listId) {
      return suppressionMembers.filter((m) => m.suppression_list_id === listId);
    },
    async addSuppressionListMember(listId, customerId) {
      const existing = suppressionMembers.find((m) => m.suppression_list_id === listId && m.customer_id === customerId);
      if (existing) return existing;
      const row: SuppressionListMemberRow = { id: randomUUID(), suppression_list_id: listId, customer_id: customerId, added_at: now() };
      suppressionMembers.push(row);
      return row;
    },
    async removeSuppressionListMember(listId, customerId) {
      const idx = suppressionMembers.findIndex((m) => m.suppression_list_id === listId && m.customer_id === customerId);
      if (idx === -1) return false;
      suppressionMembers.splice(idx, 1);
      return true;
    },
    async isSuppressed(customerId) {
      const activeListIds = new Set(suppressionLists.filter((l) => l.is_active).map((l) => l.id));
      return suppressionMembers.some((m) => m.customer_id === customerId && activeListIds.has(m.suppression_list_id));
    },
  };
}
