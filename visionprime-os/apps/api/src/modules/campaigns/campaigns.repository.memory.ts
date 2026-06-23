import { randomUUID } from "crypto";
import { CampaignsRepository } from "./campaigns.repository";
import { CampaignEventRow, CampaignRecipientRow, CampaignRow, ListParams, ListResult } from "./campaigns.types";

function paginate<T>(rows: T[], params: ListParams): ListResult<T> {
  const start = (params.page - 1) * params.pageSize;
  return { rows: rows.slice(start, start + params.pageSize), totalItems: rows.length };
}

export function createMemoryCampaignsRepository(): CampaignsRepository {
  const campaigns: CampaignRow[] = [];
  const recipients: CampaignRecipientRow[] = [];
  const events: CampaignEventRow[] = [];
  const now = () => new Date().toISOString();

  return {
    async list(params) {
      return paginate(campaigns.filter((c) => !c.deleted_at).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)), params);
    },
    async findById(id) {
      return campaigns.find((c) => c.id === id && !c.deleted_at) ?? null;
    },
    async create(record) {
      const row: CampaignRow = {
        id: randomUUID(),
        name: record.name,
        segment_id: record.segmentId,
        channel: record.channel,
        message_template_id: record.messageTemplateId ?? null,
        status: "draft",
        requires_approval: record.requiresApproval ?? false,
        approved_at: null,
        approved_by: null,
        scheduled_at: record.scheduledAt ?? null,
        sent_at: null,
        config: record.config ?? {},
        created_at: now(),
        updated_at: now(),
        deleted_at: null,
      };
      campaigns.push(row);
      return row;
    },
    async update(id, record) {
      const row = campaigns.find((c) => c.id === id && !c.deleted_at);
      if (!row) return null;
      if (record.name !== undefined) row.name = record.name;
      if (record.segmentId !== undefined) row.segment_id = record.segmentId;
      if (record.channel !== undefined) row.channel = record.channel;
      if (record.messageTemplateId !== undefined) row.message_template_id = record.messageTemplateId;
      if (record.requiresApproval !== undefined) row.requires_approval = record.requiresApproval;
      if (record.scheduledAt !== undefined) row.scheduled_at = record.scheduledAt;
      if (record.config !== undefined) row.config = record.config;
      row.updated_at = now();
      return row;
    },
    async softDelete(id) {
      const row = campaigns.find((c) => c.id === id && !c.deleted_at);
      if (!row) return false;
      row.deleted_at = now();
      return true;
    },
    async updateStatus(id, status, extra = {}) {
      const row = campaigns.find((c) => c.id === id && !c.deleted_at);
      if (!row) return null;
      row.status = status;
      if (extra.approvedAt !== undefined) row.approved_at = extra.approvedAt;
      if (extra.approvedBy !== undefined) row.approved_by = extra.approvedBy;
      if (extra.sentAt !== undefined) row.sent_at = extra.sentAt;
      row.updated_at = now();
      return row;
    },

    async createRecipients(campaignId, customerIds) {
      const rows = customerIds.map((customerId) => {
        const row: CampaignRecipientRow = {
          id: randomUUID(),
          campaign_id: campaignId,
          customer_id: customerId,
          status: "pending",
          error_message: null,
          sent_at: null,
          created_at: now(),
          updated_at: now(),
        };
        recipients.push(row);
        return row;
      });
      return rows;
    },
    async listRecipients(campaignId, params) {
      return paginate(recipients.filter((r) => r.campaign_id === campaignId), params);
    },
    async listAllRecipients(campaignId) {
      return recipients.filter((r) => r.campaign_id === campaignId);
    },
    async updateRecipientStatus(id, status, extra = {}) {
      const row = recipients.find((r) => r.id === id);
      if (!row) return null;
      row.status = status;
      if (extra.errorMessage !== undefined) row.error_message = extra.errorMessage;
      if (extra.sentAt !== undefined) row.sent_at = extra.sentAt;
      row.updated_at = now();
      return row;
    },

    async createEvent(record) {
      const row: CampaignEventRow = {
        id: randomUUID(),
        campaign_id: record.campaignId,
        customer_id: record.customerId ?? null,
        event_type: record.eventType,
        metadata: record.metadata ?? {},
        created_at: now(),
      };
      events.push(row);
      return row;
    },
    async listEvents(campaignId) {
      return events.filter((e) => e.campaign_id === campaignId);
    },
  };
}
