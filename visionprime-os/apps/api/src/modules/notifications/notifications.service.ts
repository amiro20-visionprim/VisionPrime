import { decryptSecret, encryptSecret, maskSecretPreview } from "../../common/crypto";
import { HttpError, NotFoundError } from "../../common/http-error";
import { AuditService, toPaginationMeta } from "../audit/audit.service";
import { NotificationsRepository } from "./notifications.repository";
import {
  NewMessageTemplateRecord,
  NewNotificationProviderRecord,
  NotificationProviderRow,
  PublicNotificationProvider,
  renderTemplate,
  sanitizeProviderError,
  toPublicMessageTemplate,
  toPublicNotificationMessage,
  toPublicNotificationOptOut,
  toPublicSuppressionList,
  toPublicSuppressionListMember,
  UpdateMessageTemplateRecord,
  UpdateNotificationProviderRecord,
} from "./notifications.types";

export interface NotificationsActor {
  userId: string;
}

export interface NotificationsServiceDeps {
  notificationsRepository: NotificationsRepository;
  auditService: AuditService;
  encryptionKey: string;
}

function toPublicProvider(deps: NotificationsServiceDeps, row: NotificationProviderRow): PublicNotificationProvider {
  let credentialsPreview: string | null = null;
  if (row.credentials_encrypted) {
    const plaintext = decryptSecret(row.credentials_encrypted, deps.encryptionKey);
    credentialsPreview = maskSecretPreview(plaintext);
  }
  return {
    id: row.id,
    name: row.name,
    channel: row.channel,
    providerType: row.provider_type,
    credentialsPreview,
    isActive: row.is_active,
    config: row.config,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class NotificationsService {
  constructor(private readonly deps: NotificationsServiceDeps) {}

  // ---------------------------------------------------------------- //
  // Message templates
  // ---------------------------------------------------------------- //

  async listTemplates(page: number, pageSize: number) {
    const result = await this.deps.notificationsRepository.listTemplates({ page, pageSize });
    return { rows: result.rows.map(toPublicMessageTemplate), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async getTemplate(id: string) {
    const row = await this.deps.notificationsRepository.findTemplateById(id);
    if (!row) throw new NotFoundError("Message template not found");
    return toPublicMessageTemplate(row);
  }

  async createTemplate(record: NewMessageTemplateRecord, actor: NotificationsActor) {
    const row = await this.deps.notificationsRepository.createTemplate(record);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "message_template.create",
      targetType: "message_template",
      targetId: row.id,
      before: null,
      after: { template: row },
    });
    return toPublicMessageTemplate(row);
  }

  async updateTemplate(id: string, record: UpdateMessageTemplateRecord, actor: NotificationsActor) {
    const before = await this.deps.notificationsRepository.findTemplateById(id);
    if (!before) throw new NotFoundError("Message template not found");
    const after = await this.deps.notificationsRepository.updateTemplate(id, record);
    if (!after) throw new NotFoundError("Message template not found");
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "message_template.update",
      targetType: "message_template",
      targetId: id,
      before: { template: before },
      after: { template: after },
    });
    return toPublicMessageTemplate(after);
  }

  async deleteTemplate(id: string, actor: NotificationsActor) {
    const before = await this.deps.notificationsRepository.findTemplateById(id);
    if (!before) throw new NotFoundError("Message template not found");
    await this.deps.notificationsRepository.softDeleteTemplate(id);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "message_template.delete",
      targetType: "message_template",
      targetId: id,
      before: { template: before },
      after: null,
    });
  }

  /** Renders a template, enforcing the "variables must be validated"
   * rule — a render with missing variables is a 422, never a
   * partial/blank render. */
  async renderTemplateById(id: string, context: Record<string, string>) {
    const template = await this.deps.notificationsRepository.findTemplateById(id);
    if (!template) throw new NotFoundError("Message template not found");
    const { rendered, missing } = renderTemplate(template.body, template.variables, context);
    if (missing.length > 0) {
      throw new HttpError(422, "TEMPLATE_VARIABLES_MISSING", "One or more required template variables are missing.", { missing });
    }
    return rendered;
  }

  // ---------------------------------------------------------------- //
  // Providers — credentials are never returned in plaintext.
  // ---------------------------------------------------------------- //

  async listProviders(page: number, pageSize: number) {
    const result = await this.deps.notificationsRepository.listProviders({ page, pageSize });
    return { rows: result.rows.map((row) => toPublicProvider(this.deps, row)), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async getProvider(id: string) {
    const row = await this.deps.notificationsRepository.findProviderById(id);
    if (!row) throw new NotFoundError("Notification provider not found");
    return toPublicProvider(this.deps, row);
  }

  async createProvider(record: NewNotificationProviderRecord, actor: NotificationsActor) {
    const credentialsEncrypted = record.credentials ? encryptSecret(record.credentials, this.deps.encryptionKey) : null;
    const row = await this.deps.notificationsRepository.createProvider({ ...record, credentialsEncrypted });
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "notification_provider.create",
      targetType: "notification_provider",
      targetId: row.id,
      before: null,
      after: { provider: { ...row, credentials_encrypted: undefined } },
    });
    return toPublicProvider(this.deps, row);
  }

  async updateProvider(id: string, record: UpdateNotificationProviderRecord, actor: NotificationsActor) {
    const before = await this.deps.notificationsRepository.findProviderById(id);
    if (!before) throw new NotFoundError("Notification provider not found");
    const credentialsEncrypted = record.credentials !== undefined
      ? (record.credentials ? encryptSecret(record.credentials, this.deps.encryptionKey) : null)
      : undefined;
    const after = await this.deps.notificationsRepository.updateProvider(id, { ...record, credentialsEncrypted });
    if (!after) throw new NotFoundError("Notification provider not found");
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "notification_provider.update",
      targetType: "notification_provider",
      targetId: id,
      before: { provider: { ...before, credentials_encrypted: undefined } },
      after: { provider: { ...after, credentials_encrypted: undefined } },
    });
    return toPublicProvider(this.deps, after);
  }

  // ---------------------------------------------------------------- //
  // Opt-outs
  // ---------------------------------------------------------------- //

  async listOptOuts(customerId?: string) {
    const rows = await this.deps.notificationsRepository.listOptOuts(customerId);
    return rows.map(toPublicNotificationOptOut);
  }

  async isOptedOut(customerId: string, channel: string) {
    return this.deps.notificationsRepository.isOptedOut(customerId, channel);
  }

  async createOptOut(record: { customerId: string; channel: string; reason?: string | null }, actor: NotificationsActor) {
    const row = await this.deps.notificationsRepository.createOptOut(record);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "notification_opt_out.create",
      targetType: "notification_opt_out",
      targetId: row.id,
      before: null,
      after: { optOut: row },
    });
    return toPublicNotificationOptOut(row);
  }

  async removeOptOut(customerId: string, channel: string, actor: NotificationsActor) {
    const removed = await this.deps.notificationsRepository.removeOptOut(customerId, channel);
    if (!removed) throw new NotFoundError("Opt-out not found");
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "notification_opt_out.remove",
      targetType: "notification_opt_out",
      targetId: `${customerId}:${channel}`,
      before: { customerId, channel },
      after: null,
    });
  }

  // ---------------------------------------------------------------- //
  // Suppression lists
  // ---------------------------------------------------------------- //

  async listSuppressionLists(page: number, pageSize: number) {
    const result = await this.deps.notificationsRepository.listSuppressionLists({ page, pageSize });
    return { rows: result.rows.map(toPublicSuppressionList), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async getSuppressionList(id: string) {
    const row = await this.deps.notificationsRepository.findSuppressionListById(id);
    if (!row) throw new NotFoundError("Suppression list not found");
    return toPublicSuppressionList(row);
  }

  async createSuppressionList(record: { name: string; description?: string | null }, actor: NotificationsActor) {
    const row = await this.deps.notificationsRepository.createSuppressionList(record);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "suppression_list.create",
      targetType: "suppression_list",
      targetId: row.id,
      before: null,
      after: { list: row },
    });
    return toPublicSuppressionList(row);
  }

  async updateSuppressionList(id: string, record: { name?: string; description?: string | null; isActive?: boolean }, actor: NotificationsActor) {
    const before = await this.deps.notificationsRepository.findSuppressionListById(id);
    if (!before) throw new NotFoundError("Suppression list not found");
    const after = await this.deps.notificationsRepository.updateSuppressionList(id, record);
    if (!after) throw new NotFoundError("Suppression list not found");
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "suppression_list.update",
      targetType: "suppression_list",
      targetId: id,
      before: { list: before },
      after: { list: after },
    });
    return toPublicSuppressionList(after);
  }

  async deleteSuppressionList(id: string, actor: NotificationsActor) {
    const before = await this.deps.notificationsRepository.findSuppressionListById(id);
    if (!before) throw new NotFoundError("Suppression list not found");
    await this.deps.notificationsRepository.deleteSuppressionList(id);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "suppression_list.delete",
      targetType: "suppression_list",
      targetId: id,
      before: { list: before },
      after: null,
    });
  }

  async listSuppressionListMembers(listId: string) {
    const rows = await this.deps.notificationsRepository.listSuppressionListMembers(listId);
    return rows.map(toPublicSuppressionListMember);
  }

  async addSuppressionListMember(listId: string, customerId: string, actor: NotificationsActor) {
    const list = await this.deps.notificationsRepository.findSuppressionListById(listId);
    if (!list) throw new NotFoundError("Suppression list not found");
    const row = await this.deps.notificationsRepository.addSuppressionListMember(listId, customerId);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "suppression_list_member.add",
      targetType: "suppression_list_member",
      targetId: row.id,
      before: null,
      after: { member: row },
    });
    return toPublicSuppressionListMember(row);
  }

  async removeSuppressionListMember(listId: string, customerId: string, actor: NotificationsActor) {
    const removed = await this.deps.notificationsRepository.removeSuppressionListMember(listId, customerId);
    if (!removed) throw new NotFoundError("Suppression list member not found");
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "suppression_list_member.remove",
      targetType: "suppression_list_member",
      targetId: `${listId}:${customerId}`,
      before: { listId, customerId },
      after: null,
    });
  }

  async isSuppressed(customerId: string) {
    return this.deps.notificationsRepository.isSuppressed(customerId);
  }

  // ---------------------------------------------------------------- //
  // Sending — used by the campaigns module per-recipient. Never throws
  // on provider failure: the failure is recorded on the message row and
  // the sanitized error is returned to the caller instead.
  // ---------------------------------------------------------------- //

  async sendMessage(record: {
    campaignId?: string | null;
    customerId: string;
    channel: "sms" | "email" | "in_app";
    providerId?: string | null;
    renderedBody: string;
  }): Promise<{ message: ReturnType<typeof toPublicNotificationMessage>; success: boolean }> {
    const message = await this.deps.notificationsRepository.createMessage(record);
    try {
      // Base notification provider integration: the actual SMS/email/
      // in-app dispatch is provider-specific and out of scope for this
      // phase — this is the seam future provider adapters plug into.
      const sentAt = new Date().toISOString();
      const updated = await this.deps.notificationsRepository.updateMessageStatus(message.id, "sent", { sentAt });
      return { message: toPublicNotificationMessage(updated ?? message), success: true };
    } catch (error) {
      const errorMessage = sanitizeProviderError(error);
      const updated = await this.deps.notificationsRepository.updateMessageStatus(message.id, "failed", { errorMessage });
      return { message: toPublicNotificationMessage(updated ?? message), success: false };
    }
  }

  async listMessagesByCampaign(campaignId: string) {
    const rows = await this.deps.notificationsRepository.listMessagesByCampaign(campaignId);
    return rows.map(toPublicNotificationMessage);
  }
}
