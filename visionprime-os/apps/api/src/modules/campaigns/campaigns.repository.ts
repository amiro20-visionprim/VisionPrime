import {
  CampaignEventRow,
  CampaignEventType,
  CampaignRecipientRow,
  CampaignRecipientStatus,
  CampaignRow,
  ListParams,
  ListResult,
  NewCampaignRecord,
  UpdateCampaignRecord,
} from "./campaigns.types";

export interface CampaignsRepository {
  list(params: ListParams): Promise<ListResult<CampaignRow>>;
  findById(id: string): Promise<CampaignRow | null>;
  create(record: NewCampaignRecord): Promise<CampaignRow>;
  update(id: string, record: UpdateCampaignRecord): Promise<CampaignRow | null>;
  softDelete(id: string): Promise<boolean>;
  updateStatus(id: string, status: CampaignRow["status"], extra?: { approvedAt?: string | null; approvedBy?: string | null; sentAt?: string | null }): Promise<CampaignRow | null>;

  createRecipients(campaignId: string, customerIds: string[]): Promise<CampaignRecipientRow[]>;
  listRecipients(campaignId: string, params: ListParams): Promise<ListResult<CampaignRecipientRow>>;
  listAllRecipients(campaignId: string): Promise<CampaignRecipientRow[]>;
  updateRecipientStatus(id: string, status: CampaignRecipientStatus, extra?: { errorMessage?: string | null; sentAt?: string | null }): Promise<CampaignRecipientRow | null>;

  createEvent(record: { campaignId: string; customerId?: string | null; eventType: CampaignEventType; metadata?: Record<string, unknown> }): Promise<CampaignEventRow>;
  listEvents(campaignId: string): Promise<CampaignEventRow[]>;
}
