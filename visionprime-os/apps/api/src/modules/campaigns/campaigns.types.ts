import { NotificationChannel } from "../notifications/notifications.types";

export type CampaignStatus = "draft" | "pending_approval" | "approved" | "sending" | "sent" | "failed";
export type CampaignRecipientStatus = "pending" | "sent" | "failed" | "skipped";
export type CampaignEventType = "sent" | "failed" | "opened" | "clicked";

export interface CampaignRow {
  id: string;
  name: string;
  segment_id: string;
  channel: NotificationChannel;
  message_template_id: string | null;
  status: CampaignStatus;
  requires_approval: boolean;
  approved_at: string | null;
  approved_by: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface NewCampaignRecord {
  name: string;
  segmentId: string;
  channel: NotificationChannel;
  messageTemplateId?: string | null;
  requiresApproval?: boolean;
  scheduledAt?: string | null;
  config?: Record<string, unknown>;
}

export interface UpdateCampaignRecord {
  name?: string;
  segmentId?: string;
  channel?: NotificationChannel;
  messageTemplateId?: string | null;
  requiresApproval?: boolean;
  scheduledAt?: string | null;
  config?: Record<string, unknown>;
}

export interface CampaignRecipientRow {
  id: string;
  campaign_id: string;
  customer_id: string;
  status: CampaignRecipientStatus;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignEventRow {
  id: string;
  campaign_id: string;
  customer_id: string | null;
  event_type: CampaignEventType;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ListParams {
  page: number;
  pageSize: number;
}

export interface ListResult<T> {
  rows: T[];
  totalItems: number;
}

export interface PublicCampaign {
  id: string;
  name: string;
  segmentId: string;
  channel: NotificationChannel;
  messageTemplateId: string | null;
  status: CampaignStatus;
  requiresApproval: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export function toPublicCampaign(row: CampaignRow): PublicCampaign {
  return {
    id: row.id,
    name: row.name,
    segmentId: row.segment_id,
    channel: row.channel,
    messageTemplateId: row.message_template_id,
    status: row.status,
    requiresApproval: row.requires_approval,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at,
    config: row.config,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface PublicCampaignRecipient {
  id: string;
  customerId: string;
  status: CampaignRecipientStatus;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

export function toPublicCampaignRecipient(row: CampaignRecipientRow): PublicCampaignRecipient {
  return {
    id: row.id,
    customerId: row.customer_id,
    status: row.status,
    errorMessage: row.error_message,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

export interface CampaignReport {
  campaignId: string;
  status: CampaignStatus;
  totalRecipients: number;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
  opened: number;
  clicked: number;
}
