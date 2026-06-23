import { JobRunner } from "../../common/jobs";
import { HttpError, NotFoundError } from "../../common/http-error";
import { AuditService, toPaginationMeta } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { SegmentsService } from "../segments/segments.service";
import { CampaignsRepository } from "./campaigns.repository";
import { CampaignReport, NewCampaignRecord, toPublicCampaign, toPublicCampaignRecipient, UpdateCampaignRecord } from "./campaigns.types";

export interface CampaignsActor {
  userId: string;
}

export interface CampaignsServiceDeps {
  campaignsRepository: CampaignsRepository;
  segmentsService: SegmentsService;
  notificationsService: NotificationsService;
  auditService: AuditService;
  jobRunner: JobRunner;
  /** High-cost campaigns (recipient count at or above this threshold)
   * require approval before they can be sent, when enabled. */
  highCostApprovalThreshold: number | null;
}

export class CampaignsService {
  constructor(private readonly deps: CampaignsServiceDeps) {}

  async listCampaigns(page: number, pageSize: number) {
    const result = await this.deps.campaignsRepository.list({ page, pageSize });
    return { rows: result.rows.map(toPublicCampaign), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async getCampaign(id: string) {
    const row = await this.deps.campaignsRepository.findById(id);
    if (!row) throw new NotFoundError("Campaign not found");
    return toPublicCampaign(row);
  }

  async createCampaign(record: NewCampaignRecord, actor: CampaignsActor) {
    // Campaign must target a segment — enforced by segmentId being
    // required in the DTO, but also verify the segment actually exists.
    await this.deps.segmentsService.getSegmentForSend(record.segmentId);
    const row = await this.deps.campaignsRepository.create(record);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "campaign.create",
      targetType: "campaign",
      targetId: row.id,
      before: null,
      after: { campaign: row },
    });
    return toPublicCampaign(row);
  }

  async updateCampaign(id: string, record: UpdateCampaignRecord, actor: CampaignsActor) {
    const before = await this.deps.campaignsRepository.findById(id);
    if (!before) throw new NotFoundError("Campaign not found");
    if (record.segmentId !== undefined) {
      await this.deps.segmentsService.getSegmentForSend(record.segmentId);
    }
    const after = await this.deps.campaignsRepository.update(id, record);
    if (!after) throw new NotFoundError("Campaign not found");
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "campaign.update",
      targetType: "campaign",
      targetId: id,
      before: { campaign: before },
      after: { campaign: after },
    });
    return toPublicCampaign(after);
  }

  async deleteCampaign(id: string, actor: CampaignsActor) {
    const before = await this.deps.campaignsRepository.findById(id);
    if (!before) throw new NotFoundError("Campaign not found");
    await this.deps.campaignsRepository.softDelete(id);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "campaign.delete",
      targetType: "campaign",
      targetId: id,
      before: { campaign: before },
      after: null,
    });
  }

  async approveCampaign(id: string, actor: CampaignsActor) {
    const before = await this.deps.campaignsRepository.findById(id);
    if (!before) throw new NotFoundError("Campaign not found");
    const after = await this.deps.campaignsRepository.updateStatus(id, "approved", {
      approvedAt: new Date().toISOString(),
      approvedBy: actor.userId,
    });
    if (!after) throw new NotFoundError("Campaign not found");
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "campaign.approve",
      targetType: "campaign",
      targetId: id,
      before: { campaign: before },
      after: { campaign: after },
    });
    return toPublicCampaign(after);
  }

  /** Resolves the eligible recipient list for a campaign: segment
   * members minus opted-out customers minus suppressed customers. Used
   * by both preview and send, so the two never disagree. */
  private async resolveEligibleRecipients(segmentId: string, channel: string): Promise<string[]> {
    const memberIds = await this.deps.segmentsService.listMemberCustomerIds(segmentId);
    const eligible: string[] = [];
    for (const customerId of memberIds) {
      const [optedOut, suppressed] = await Promise.all([
        this.deps.notificationsService.isOptedOut(customerId, channel),
        this.deps.notificationsService.isSuppressed(customerId),
      ]);
      if (!optedOut && !suppressed) {
        eligible.push(customerId);
      }
    }
    return eligible;
  }

  async previewCampaign(id: string, context: Record<string, string> = {}) {
    const campaign = await this.deps.campaignsRepository.findById(id);
    if (!campaign) throw new NotFoundError("Campaign not found");
    const eligible = await this.resolveEligibleRecipients(campaign.segment_id, campaign.channel);
    let renderedBody: string | null = null;
    if (campaign.message_template_id) {
      renderedBody = await this.deps.notificationsService.renderTemplateById(campaign.message_template_id, context);
    }
    return {
      campaignId: campaign.id,
      eligibleRecipientCount: eligible.length,
      sampleRecipientIds: eligible.slice(0, 10),
      renderedBody,
    };
  }

  /**
   * Creates pending recipient records (after opt-out/suppression
   * filtering) synchronously, then dispatches the actual per-recipient
   * sending as a background job — bulk sends must never block the HTTP
   * request. A failed recipient never stops the campaign: each is
   * processed in its own try/catch.
   */
  async sendCampaign(id: string, actor: CampaignsActor) {
    const campaign = await this.deps.campaignsRepository.findById(id);
    if (!campaign) throw new NotFoundError("Campaign not found");
    if (campaign.status === "sending" || campaign.status === "sent") {
      throw new HttpError(409, "CAMPAIGN_ALREADY_SENT", "This campaign has already been sent or is currently sending.");
    }

    const eligible = await this.resolveEligibleRecipients(campaign.segment_id, campaign.channel);

    const needsApproval = campaign.requires_approval
      || (this.deps.highCostApprovalThreshold !== null && eligible.length >= this.deps.highCostApprovalThreshold);
    if (needsApproval && !campaign.approved_at) {
      throw new HttpError(409, "CAMPAIGN_APPROVAL_REQUIRED", "This campaign requires approval before it can be sent.");
    }

    const recipients = await this.deps.campaignsRepository.createRecipients(id, eligible);
    await this.deps.campaignsRepository.updateStatus(id, "sending");

    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "campaign.send",
      targetType: "campaign",
      targetId: id,
      before: null,
      after: { segmentId: campaign.segment_id, recipientCount: recipients.length },
    });

    this.deps.jobRunner.run(`campaign.send:${id}`, async () => {
      for (const recipient of recipients) {
        try {
          let renderedBody = "";
          if (campaign.message_template_id) {
            renderedBody = await this.deps.notificationsService.renderTemplateById(campaign.message_template_id, {});
          }
          const { success, message } = await this.deps.notificationsService.sendMessage({
            campaignId: campaign.id,
            customerId: recipient.customer_id,
            channel: campaign.channel,
            renderedBody,
          });
          if (success) {
            await this.deps.campaignsRepository.updateRecipientStatus(recipient.id, "sent", { sentAt: message.sentAt ?? new Date().toISOString() });
            await this.deps.campaignsRepository.createEvent({ campaignId: id, customerId: recipient.customer_id, eventType: "sent" });
          } else {
            await this.deps.campaignsRepository.updateRecipientStatus(recipient.id, "failed", { errorMessage: message.errorMessage });
            await this.deps.campaignsRepository.createEvent({ campaignId: id, customerId: recipient.customer_id, eventType: "failed" });
          }
        } catch {
          // A single recipient's failure (e.g. template render error)
          // must never stop the rest of the campaign from processing.
          await this.deps.campaignsRepository.updateRecipientStatus(recipient.id, "failed", {
            errorMessage: "The notification could not be delivered. Please try again later.",
          });
          await this.deps.campaignsRepository.createEvent({ campaignId: id, customerId: recipient.customer_id, eventType: "failed" });
        }
      }
      await this.deps.campaignsRepository.updateStatus(id, "sent", { sentAt: new Date().toISOString() });
    });

    return toPublicCampaign((await this.deps.campaignsRepository.findById(id))!);
  }

  async listRecipients(id: string, page: number, pageSize: number) {
    const campaign = await this.deps.campaignsRepository.findById(id);
    if (!campaign) throw new NotFoundError("Campaign not found");
    const result = await this.deps.campaignsRepository.listRecipients(id, { page, pageSize });
    return { rows: result.rows.map(toPublicCampaignRecipient), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async getReport(id: string): Promise<CampaignReport> {
    const campaign = await this.deps.campaignsRepository.findById(id);
    if (!campaign) throw new NotFoundError("Campaign not found");
    const [recipients, events] = await Promise.all([
      this.deps.campaignsRepository.listAllRecipients(id),
      this.deps.campaignsRepository.listEvents(id),
    ]);
    return {
      campaignId: id,
      status: campaign.status,
      totalRecipients: recipients.length,
      sent: recipients.filter((r) => r.status === "sent").length,
      failed: recipients.filter((r) => r.status === "failed").length,
      skipped: recipients.filter((r) => r.status === "skipped").length,
      pending: recipients.filter((r) => r.status === "pending").length,
      opened: events.filter((e) => e.event_type === "opened").length,
      clicked: events.filter((e) => e.event_type === "clicked").length,
    };
  }
}
