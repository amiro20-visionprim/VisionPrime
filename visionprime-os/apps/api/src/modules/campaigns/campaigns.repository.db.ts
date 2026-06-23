import { Db } from "@visionprime/database";
import { CampaignsRepository } from "./campaigns.repository";
import { CampaignEventRow, CampaignRecipientRow, CampaignRow, ListParams } from "./campaigns.types";

export function createDbCampaignsRepository(db: Db): CampaignsRepository {
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
    async list(params) {
      return listPaged<CampaignRow>("campaigns", "where deleted_at is null", [], "created_at desc", params);
    },
    async findById(id) {
      const r = await db.query<CampaignRow>(`select * from campaigns where id = $1 and deleted_at is null`, [id]);
      return r.rows[0] ?? null;
    },
    async create(record) {
      const r = await db.query<CampaignRow>(
        `insert into campaigns (name, segment_id, channel, message_template_id, requires_approval, scheduled_at, config)
         values ($1, $2, $3, $4, $5, $6, $7) returning *`,
        [
          record.name,
          record.segmentId,
          record.channel,
          record.messageTemplateId ?? null,
          record.requiresApproval ?? false,
          record.scheduledAt ?? null,
          JSON.stringify(record.config ?? {}),
        ],
      );
      return r.rows[0];
    },
    async update(id, record) {
      const r = await db.query<CampaignRow>(
        `update campaigns set
           name = coalesce($2, name),
           segment_id = coalesce($3, segment_id),
           channel = coalesce($4, channel),
           message_template_id = coalesce($5, message_template_id),
           requires_approval = coalesce($6, requires_approval),
           scheduled_at = coalesce($7, scheduled_at),
           config = coalesce($8, config),
           updated_at = now()
         where id = $1 and deleted_at is null returning *`,
        [
          id,
          record.name ?? null,
          record.segmentId ?? null,
          record.channel ?? null,
          record.messageTemplateId ?? null,
          record.requiresApproval ?? null,
          record.scheduledAt ?? null,
          record.config !== undefined ? JSON.stringify(record.config) : null,
        ],
      );
      return r.rows[0] ?? null;
    },
    async softDelete(id) {
      const r = await db.query(`update campaigns set deleted_at = now(), updated_at = now() where id = $1 and deleted_at is null`, [id]);
      return (r.rowCount ?? 0) > 0;
    },
    async updateStatus(id, status, extra = {}) {
      const r = await db.query<CampaignRow>(
        `update campaigns set
           status = $2,
           approved_at = coalesce($3, approved_at),
           approved_by = coalesce($4, approved_by),
           sent_at = coalesce($5, sent_at),
           updated_at = now()
         where id = $1 and deleted_at is null returning *`,
        [id, status, extra.approvedAt ?? null, extra.approvedBy ?? null, extra.sentAt ?? null],
      );
      return r.rows[0] ?? null;
    },

    async createRecipients(campaignId, customerIds) {
      if (customerIds.length === 0) return [];
      const values: string[] = [];
      const params: unknown[] = [];
      customerIds.forEach((customerId, i) => {
        values.push(`($${i * 2 + 1}, $${i * 2 + 2})`);
        params.push(campaignId, customerId);
      });
      const r = await db.query<CampaignRecipientRow>(
        `insert into campaign_recipients (campaign_id, customer_id) values ${values.join(", ")} returning *`,
        params,
      );
      return r.rows;
    },
    async listRecipients(campaignId, params) {
      return listPaged<CampaignRecipientRow>("campaign_recipients", "where campaign_id = $1", [campaignId], "created_at asc", params);
    },
    async listAllRecipients(campaignId) {
      const r = await db.query<CampaignRecipientRow>(`select * from campaign_recipients where campaign_id = $1`, [campaignId]);
      return r.rows;
    },
    async updateRecipientStatus(id, status, extra = {}) {
      const r = await db.query<CampaignRecipientRow>(
        `update campaign_recipients set status = $2, error_message = coalesce($3, error_message), sent_at = coalesce($4, sent_at), updated_at = now()
         where id = $1 returning *`,
        [id, status, extra.errorMessage ?? null, extra.sentAt ?? null],
      );
      return r.rows[0] ?? null;
    },

    async createEvent(record) {
      const r = await db.query<CampaignEventRow>(
        `insert into campaign_events (campaign_id, customer_id, event_type, metadata) values ($1, $2, $3, $4) returning *`,
        [record.campaignId, record.customerId ?? null, record.eventType, JSON.stringify(record.metadata ?? {})],
      );
      return r.rows[0];
    },
    async listEvents(campaignId) {
      const r = await db.query<CampaignEventRow>(`select * from campaign_events where campaign_id = $1`, [campaignId]);
      return r.rows;
    },
  };
}
