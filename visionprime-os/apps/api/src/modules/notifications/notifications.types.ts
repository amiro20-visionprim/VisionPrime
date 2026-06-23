export type NotificationChannel = "sms" | "email" | "in_app";
export type NotificationMessageStatus = "pending" | "sent" | "failed";

export interface MessageTemplateRow {
  id: string;
  name: string;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  variables: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface NewMessageTemplateRecord {
  name: string;
  channel: NotificationChannel;
  subject?: string | null;
  body: string;
  variables?: string[];
}

export interface UpdateMessageTemplateRecord {
  name?: string;
  channel?: NotificationChannel;
  subject?: string | null;
  body?: string;
  variables?: string[];
}

export interface NotificationProviderRow {
  id: string;
  name: string;
  channel: NotificationChannel;
  provider_type: string;
  credentials_encrypted: string | null;
  is_active: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface NewNotificationProviderRecord {
  name: string;
  channel: NotificationChannel;
  providerType: string;
  credentials?: string | null;
  isActive?: boolean;
  config?: Record<string, unknown>;
}

export interface UpdateNotificationProviderRecord {
  name?: string;
  providerType?: string;
  credentials?: string | null;
  isActive?: boolean;
  config?: Record<string, unknown>;
}

export interface NotificationMessageRow {
  id: string;
  campaign_id: string | null;
  customer_id: string;
  channel: NotificationChannel;
  provider_id: string | null;
  status: NotificationMessageStatus;
  rendered_body: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface NewNotificationMessageRecord {
  campaignId?: string | null;
  customerId: string;
  channel: NotificationChannel;
  providerId?: string | null;
  renderedBody?: string | null;
}

export interface NotificationOptOutRow {
  id: string;
  customer_id: string;
  channel: NotificationChannel;
  reason: string | null;
  created_at: string;
}

export interface SuppressionListRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SuppressionListMemberRow {
  id: string;
  suppression_list_id: string;
  customer_id: string;
  added_at: string;
}

export interface ListParams {
  page: number;
  pageSize: number;
}

export interface ListResult<T> {
  rows: T[];
  totalItems: number;
}

// ---------------------------------------------------------------------- //
// Public DTOs
// ---------------------------------------------------------------------- //

export interface PublicMessageTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export function toPublicMessageTemplate(row: MessageTemplateRow): PublicMessageTemplate {
  return {
    id: row.id,
    name: row.name,
    channel: row.channel,
    subject: row.subject,
    body: row.body,
    variables: row.variables,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface PublicNotificationProvider {
  id: string;
  name: string;
  channel: NotificationChannel;
  providerType: string;
  /** Never the decrypted secret — only `****<last4>`, or null if no
   * credentials have been set. */
  credentialsPreview: string | null;
  isActive: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PublicNotificationOptOut {
  id: string;
  customerId: string;
  channel: NotificationChannel;
  reason: string | null;
  createdAt: string;
}

export function toPublicNotificationOptOut(row: NotificationOptOutRow): PublicNotificationOptOut {
  return { id: row.id, customerId: row.customer_id, channel: row.channel, reason: row.reason, createdAt: row.created_at };
}

export interface PublicSuppressionList {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toPublicSuppressionList(row: SuppressionListRow): PublicSuppressionList {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface PublicSuppressionListMember {
  customerId: string;
  addedAt: string;
}

export function toPublicSuppressionListMember(row: SuppressionListMemberRow): PublicSuppressionListMember {
  return { customerId: row.customer_id, addedAt: row.added_at };
}

export interface PublicNotificationMessage {
  id: string;
  campaignId: string | null;
  customerId: string;
  channel: NotificationChannel;
  status: NotificationMessageStatus;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

export function toPublicNotificationMessage(row: NotificationMessageRow): PublicNotificationMessage {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    customerId: row.customer_id,
    channel: row.channel,
    status: row.status,
    errorMessage: row.error_message,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

/**
 * Renders `{{variable}}` placeholders in `body`. Every variable declared
 * on the template must be present in `context` — missing variables fail
 * the render rather than silently rendering blank, per the Phase 11 rule
 * that template variables must be validated.
 */
export function renderTemplate(
  body: string,
  declaredVariables: string[],
  context: Record<string, string>,
): { rendered: string; missing: string[] } {
  const missing = declaredVariables.filter((name) => context[name] === undefined);
  if (missing.length > 0) {
    return { rendered: "", missing };
  }
  const rendered = body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, name) => {
    return context[name] !== undefined ? context[name] : match;
  });
  return { rendered, missing: [] };
}

/** A friendly, never-raw message safe to persist/show for any failed
 * provider call — the underlying error is logged server-side only. */
export function sanitizeProviderError(_error: unknown): string {
  return "The notification could not be delivered. Please try again later.";
}
