import {
  ListParams,
  ListResult,
  MessageTemplateRow,
  NewMessageTemplateRecord,
  NewNotificationMessageRecord,
  NewNotificationProviderRecord,
  NotificationMessageRow,
  NotificationMessageStatus,
  NotificationOptOutRow,
  NotificationProviderRow,
  SuppressionListMemberRow,
  SuppressionListRow,
  UpdateMessageTemplateRecord,
  UpdateNotificationProviderRecord,
} from "./notifications.types";

export interface NotificationsRepository {
  listTemplates(params: ListParams): Promise<ListResult<MessageTemplateRow>>;
  findTemplateById(id: string): Promise<MessageTemplateRow | null>;
  createTemplate(record: NewMessageTemplateRecord): Promise<MessageTemplateRow>;
  updateTemplate(id: string, record: UpdateMessageTemplateRecord): Promise<MessageTemplateRow | null>;
  softDeleteTemplate(id: string): Promise<boolean>;

  listProviders(params: ListParams): Promise<ListResult<NotificationProviderRow>>;
  findProviderById(id: string): Promise<NotificationProviderRow | null>;
  createProvider(record: NewNotificationProviderRecord & { credentialsEncrypted: string | null }): Promise<NotificationProviderRow>;
  updateProvider(
    id: string,
    record: UpdateNotificationProviderRecord & { credentialsEncrypted?: string | null },
  ): Promise<NotificationProviderRow | null>;

  createMessage(record: NewNotificationMessageRecord): Promise<NotificationMessageRow>;
  updateMessageStatus(
    id: string,
    status: NotificationMessageStatus,
    extra: { errorMessage?: string | null; sentAt?: string | null },
  ): Promise<NotificationMessageRow | null>;
  listMessagesByCampaign(campaignId: string): Promise<NotificationMessageRow[]>;

  listOptOuts(customerId?: string): Promise<NotificationOptOutRow[]>;
  isOptedOut(customerId: string, channel: string): Promise<boolean>;
  createOptOut(record: { customerId: string; channel: string; reason?: string | null }): Promise<NotificationOptOutRow>;
  removeOptOut(customerId: string, channel: string): Promise<boolean>;

  listSuppressionLists(params: ListParams): Promise<ListResult<SuppressionListRow>>;
  findSuppressionListById(id: string): Promise<SuppressionListRow | null>;
  createSuppressionList(record: { name: string; description?: string | null }): Promise<SuppressionListRow>;
  updateSuppressionList(id: string, record: { name?: string; description?: string | null; isActive?: boolean }): Promise<SuppressionListRow | null>;
  deleteSuppressionList(id: string): Promise<boolean>;

  listSuppressionListMembers(listId: string): Promise<SuppressionListMemberRow[]>;
  addSuppressionListMember(listId: string, customerId: string): Promise<SuppressionListMemberRow>;
  removeSuppressionListMember(listId: string, customerId: string): Promise<boolean>;
  /** True if the customer is in any *active* suppression list. */
  isSuppressed(customerId: string): Promise<boolean>;
}
