import { decryptSecret, encryptSecret, hashPluginApiKey } from "../../common/crypto";
import { HttpError } from "../../common/http-error";
import { AuditService } from "../audit/audit.service";
import { normalizePageParams, toPaginationMeta } from "../audit/audit.service";
import {
  WordPressConnectionRepository,
  WordPressSyncJobRepository,
  WordPressSyncLogRepository,
  WordPressWebhookEventRepository,
} from "./wordpress.repository";
import { ConnectDto, UpdateSettingsDto } from "./wordpress.dto";
import { PublicWordPressConnection, toPublicConnection } from "./wordpress.types";

export interface WordPressServiceDeps {
  connectionRepository: WordPressConnectionRepository;
  syncJobRepository: WordPressSyncJobRepository;
  syncLogRepository: WordPressSyncLogRepository;
  webhookEventRepository: WordPressWebhookEventRepository;
  auditService: AuditService;
  encryptionKey: string;
}

function changeSummary(fields: { siteUrl?: boolean; consumerKey?: boolean; consumerSecret?: boolean; sharedSecret?: boolean; pluginApiKey?: boolean }) {
  // Audit logs must never contain secret values — only whether each
  // field changed, per "secrets must never be returned by API".
  return fields;
}

export class WordPressService {
  constructor(private readonly deps: WordPressServiceDeps) {}

  async getStatus(): Promise<PublicWordPressConnection> {
    const row = await this.deps.connectionRepository.get();
    return toPublicConnection(row);
  }

  async connect(dto: ConnectDto, actorId: string): Promise<PublicWordPressConnection> {
    const updated = await this.deps.connectionRepository.update(
      {
        site_url: dto.siteUrl,
        consumer_key_encrypted: encryptSecret(dto.consumerKey, this.deps.encryptionKey),
        consumer_secret_encrypted: encryptSecret(dto.consumerSecret, this.deps.encryptionKey),
        shared_secret_encrypted: dto.sharedSecret ? encryptSecret(dto.sharedSecret, this.deps.encryptionKey) : undefined,
        plugin_api_key_hash: dto.pluginApiKey ? hashPluginApiKey(dto.pluginApiKey) : undefined,
        status: "disconnected",
      },
      actorId,
    );

    await this.deps.auditService.recordAuditLog({
      actorId,
      action: "wordpress_connection.connect",
      targetType: "wordpress_connection",
      targetId: updated.id,
      before: null,
      after: changeSummary({
        siteUrl: true,
        consumerKey: true,
        consumerSecret: true,
        sharedSecret: Boolean(dto.sharedSecret),
        pluginApiKey: Boolean(dto.pluginApiKey),
      }),
    });

    return toPublicConnection(updated);
  }

  async updateSettings(dto: UpdateSettingsDto, actorId: string): Promise<PublicWordPressConnection> {
    const before = await this.deps.connectionRepository.get();

    const fields: Parameters<WordPressConnectionRepository["update"]>[0] = {};
    if (dto.siteUrl !== undefined) fields.site_url = dto.siteUrl;
    if (dto.consumerKey !== undefined) fields.consumer_key_encrypted = encryptSecret(dto.consumerKey, this.deps.encryptionKey);
    if (dto.consumerSecret !== undefined) fields.consumer_secret_encrypted = encryptSecret(dto.consumerSecret, this.deps.encryptionKey);
    if (dto.sharedSecret !== undefined) fields.shared_secret_encrypted = encryptSecret(dto.sharedSecret, this.deps.encryptionKey);
    if (dto.pluginApiKey !== undefined) fields.plugin_api_key_hash = hashPluginApiKey(dto.pluginApiKey);
    if (dto.settings !== undefined) fields.settings = dto.settings;

    const updated = await this.deps.connectionRepository.update(fields, actorId);

    await this.deps.auditService.recordAuditLog({
      actorId,
      action: "wordpress_connection.update",
      targetType: "wordpress_connection",
      targetId: updated.id,
      before: { siteUrl: before.site_url, settings: before.settings },
      after: changeSummary({
        siteUrl: dto.siteUrl !== undefined,
        consumerKey: dto.consumerKey !== undefined,
        consumerSecret: dto.consumerSecret !== undefined,
        sharedSecret: dto.sharedSecret !== undefined,
        pluginApiKey: dto.pluginApiKey !== undefined,
      }),
    });

    return toPublicConnection(updated);
  }

  async testConnection(actorId: string): Promise<PublicWordPressConnection> {
    const row = await this.deps.connectionRepository.get();
    if (!row.site_url || !row.consumer_key_encrypted || !row.consumer_secret_encrypted) {
      throw new HttpError(400, "WORDPRESS_NOT_CONNECTED", "A WooCommerce site URL and credentials must be saved before testing the connection.");
    }

    let success = false;
    let message: string;
    try {
      const consumerKey = decryptSecret(row.consumer_key_encrypted, this.deps.encryptionKey);
      const consumerSecret = decryptSecret(row.consumer_secret_encrypted, this.deps.encryptionKey);
      const url = new URL("/wp-json/wc/v3/system_status", row.site_url);
      url.searchParams.set("consumer_key", consumerKey);
      url.searchParams.set("consumer_secret", consumerSecret);

      const response = await fetch(url.toString(), { method: "GET" });
      if (!response.ok) {
        // Never surface the raw upstream status/body — masked per
        // "Test connection must mask raw WooCommerce errors".
        throw new Error(`upstream responded with status ${response.status}`);
      }
      success = true;
      message = "Connection succeeded.";
    } catch {
      success = false;
      message = "Unable to connect to the WooCommerce site. Check the site URL and credentials.";
    }

    const updated = await this.deps.connectionRepository.recordTestResult({
      last_tested_at: new Date().toISOString(),
      last_test_success: success,
      last_test_message: message,
      status: success ? "connected" : "error",
    });

    await this.deps.auditService.recordActivityLog({
      actorId,
      action: "wordpress_connection.test",
      metadata: { success },
    });

    return toPublicConnection(updated);
  }

  async registerWebhook(actorId: string): Promise<PublicWordPressConnection> {
    const row = await this.deps.connectionRepository.get();
    if (!row.site_url || !row.shared_secret_encrypted) {
      throw new HttpError(400, "WORDPRESS_NOT_CONNECTED", "A WooCommerce site URL and shared secret must be saved before registering webhooks.");
    }

    let status: "registered" | "failed" = "failed";
    let detail: string | null = null;
    try {
      const url = new URL("/wp-json/visionprime/v1/webhooks/register", row.site_url);
      const response = await fetch(url.toString(), { method: "POST" });
      if (!response.ok) {
        throw new Error(`upstream responded with status ${response.status}`);
      }
      status = "registered";
    } catch {
      status = "failed";
      detail = "Unable to reach the WooCommerce site to register webhooks.";
    }

    const updated = await this.deps.connectionRepository.recordWebhookRegistration({
      webhook_registration_status: status,
      webhook_registered_at: status === "registered" ? new Date().toISOString() : row.webhook_registered_at,
    });

    await this.deps.webhookEventRepository.insert({
      event_type: "webhook.register",
      status,
      detail,
      metadata: {},
    });

    await this.deps.auditService.recordAuditLog({
      actorId,
      action: "wordpress_connection.webhook_register",
      targetType: "wordpress_connection",
      targetId: updated.id,
      before: null,
      after: { status },
    });

    return toPublicConnection(updated);
  }

  async listSyncJobs(page?: unknown, pageSize?: unknown) {
    const params = normalizePageParams(page, pageSize);
    const result = await this.deps.syncJobRepository.list(params.page, params.pageSize);
    return { rows: result.rows, meta: toPaginationMeta(params.page, params.pageSize, result.totalItems) };
  }

  async listSyncLogs(page?: unknown, pageSize?: unknown) {
    const params = normalizePageParams(page, pageSize);
    const result = await this.deps.syncLogRepository.list(params.page, params.pageSize);
    return { rows: result.rows, meta: toPaginationMeta(params.page, params.pageSize, result.totalItems) };
  }
}
