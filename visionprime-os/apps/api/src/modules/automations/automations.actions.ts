import { AuditService } from "../audit/audit.service";
import { LoyaltyService } from "../loyalty/loyalty.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PointsService } from "../points/points.service";
import { RewardsService } from "../rewards/rewards.service";
import { SegmentsRepository } from "../segments/segments.repository";
import { WalletService } from "../wallet/wallet.service";
import { AutomationActionType } from "./automations.types";

export interface ActionDispatchDeps {
  notificationsService: NotificationsService;
  rewardsService: RewardsService;
  walletService: WalletService;
  pointsService: PointsService;
  loyaltyService: LoyaltyService;
  segmentsRepository: SegmentsRepository;
  auditService: AuditService;
  /** Outbound webhook POST — injected so tests can stub network I/O. */
  fetchImpl?: typeof fetch;
}

/** Generic friendly error — never leak raw upstream/internal exception text. */
function friendlyActionError(): string {
  return "This automation action could not be completed. Please review the workflow configuration.";
}

type ActionFn = (
  actionConfig: Record<string, unknown>,
  triggerPayload: Record<string, unknown>,
  deps: ActionDispatchDeps,
) => Promise<Record<string, unknown>>;

function customerIdFromPayload(triggerPayload: Record<string, unknown>): string {
  const customerId =
    (triggerPayload.customerId as string | undefined) ??
    ((triggerPayload.customer as Record<string, unknown> | undefined)?.id as string | undefined);
  if (!customerId) {
    throw new Error("This action requires a customerId in the trigger payload.");
  }
  return customerId;
}

const sendSms: ActionFn = async (actionConfig, triggerPayload, deps) => {
  const customerId = customerIdFromPayload(triggerPayload);
  const templateId = actionConfig.messageTemplateId as string | undefined;
  let renderedBody = (actionConfig.body as string | undefined) ?? "";
  if (templateId) {
    renderedBody = await deps.notificationsService.renderTemplateById(templateId, (actionConfig.context as Record<string, string>) ?? {});
  }
  const result = await deps.notificationsService.sendMessage({ customerId, channel: "sms", renderedBody });
  return { success: result.success, messageId: result.message.id };
};

const sendEmail: ActionFn = async (actionConfig, triggerPayload, deps) => {
  const customerId = customerIdFromPayload(triggerPayload);
  const templateId = actionConfig.messageTemplateId as string | undefined;
  let renderedBody = (actionConfig.body as string | undefined) ?? "";
  if (templateId) {
    renderedBody = await deps.notificationsService.renderTemplateById(templateId, (actionConfig.context as Record<string, string>) ?? {});
  }
  const result = await deps.notificationsService.sendMessage({ customerId, channel: "email", renderedBody });
  return { success: result.success, messageId: result.message.id };
};

const addReward: ActionFn = async (actionConfig, triggerPayload, deps) => {
  const customerId = customerIdFromPayload(triggerPayload);
  const rewardId = actionConfig.rewardId as string;
  if (!rewardId) throw new Error("add_reward requires a rewardId in the action config.");
  const claim = await deps.rewardsService.claimReward(rewardId, customerId, undefined, true); // skipAutomationTrigger
  return { claimId: claim.id, status: claim.status };
};

/** Financial action — always routed through WalletService.manualCredit
 * (ledger-based), never a raw balance write. referenceType is
 * "automation" so the ledger trail clearly distinguishes automation-
 * driven credits from manual admin or order-driven ones. */
const addCashback: ActionFn = async (actionConfig, triggerPayload, deps) => {
  const customerId = customerIdFromPayload(triggerPayload);
  const amount = Number(actionConfig.amount ?? 0);
  if (!amount || amount <= 0) throw new Error("add_cashback requires a positive amount in the action config.");
  const result = await deps.walletService.manualCredit(
    customerId,
    {
      amount,
      reason: (actionConfig.reason as string | undefined) ?? "Automation cashback",
      referenceType: "automation",
      referenceId: (triggerPayload.runId as string | undefined) ?? undefined,
    },
    { userId: "automation" },
    true, // skipAutomationTrigger: prevent infinite automation loops
  );
  return { ledgerEntryId: result.entry.id, balanceCents: result.balanceCents };
};

/** Financial action — always routed through PointsService.awardManualPoints
 * (ledger-based), never a raw balance write. */
const addPoints: ActionFn = async (actionConfig, triggerPayload, deps) => {
  const customerId = customerIdFromPayload(triggerPayload);
  const points = Number(actionConfig.points ?? 0);
  if (!points || points <= 0) throw new Error("add_points requires a positive points value in the action config.");
  const entry = await deps.pointsService.awardManualPoints(
    customerId,
    points,
    (actionConfig.reason as string | undefined) ?? "Automation points award",
    { userId: "automation" },
    (triggerPayload.runId as string | undefined) ?? undefined,
  );
  return { ledgerEntryId: entry?.id ?? null };
};

const changeTier: ActionFn = async (actionConfig, triggerPayload, deps) => {
  const customerId = customerIdFromPayload(triggerPayload);
  const lifetimePointsDelta = Number(actionConfig.lifetimePointsDelta ?? 0);
  await deps.loyaltyService.recomputeTierForCustomer(customerId, lifetimePointsDelta);
  const status = await deps.loyaltyService.getCustomerStatus(customerId);
  return { currentTierId: status.currentTier?.id ?? null };
};

const addToSegment: ActionFn = async (actionConfig, triggerPayload, deps) => {
  const customerId = customerIdFromPayload(triggerPayload);
  const segmentId = actionConfig.segmentId as string;
  if (!segmentId) throw new Error("add_to_segment requires a segmentId in the action config.");
  await deps.segmentsRepository.addMembers(segmentId, [customerId]);
  return { segmentId, customerId };
};

/** Minimal stub: writes an audit log entry rather than building a whole
 * tasks subsystem, per scope decision documented in phase-12 docs. */
const createAdminTask: ActionFn = async (actionConfig, triggerPayload, deps) => {
  const entry = await deps.auditService.recordAuditLog({
    actorId: null,
    action: "automation.admin_task_created",
    targetType: "automation_admin_task",
    targetId: (triggerPayload.customerId as string | undefined) ?? "unknown",
    before: null,
    after: { title: actionConfig.title ?? "Automation task", triggerPayload },
  });
  return { auditLogId: entry.id };
};

/** Real WordPress-side delivery is out of scope this phase — this stub
 * only records the intended notice as structured output on the run step. */
const showWordPressAccountNotice: ActionFn = async (actionConfig, triggerPayload) => {
  const customerId = customerIdFromPayload(triggerPayload);
  return { stub: true, customerId, message: actionConfig.message ?? null };
};

/** Outbound webhook — short timeout, sanitized error, never logs the
 * target URL credentials or the response body (which could contain
 * secrets from the receiving system). */
const triggerWebhook: ActionFn = async (actionConfig, _triggerPayload, deps) => {
  const url = actionConfig.url as string | undefined;
  if (!url) throw new Error("trigger_webhook requires a url in the action config.");
  const fetchImpl = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(actionConfig.payload ?? {}),
      signal: controller.signal,
    });
    return { statusCode: response.status, ok: response.ok };
  } catch {
    throw new Error(friendlyActionError());
  } finally {
    clearTimeout(timeout);
  }
};

export const ACTION_DISPATCH: Record<AutomationActionType, ActionFn> = {
  send_sms: sendSms,
  send_email: sendEmail,
  add_reward: addReward,
  add_cashback: addCashback,
  add_points: addPoints,
  change_tier: changeTier,
  add_to_segment: addToSegment,
  create_admin_task: createAdminTask,
  show_wordpress_account_notice: showWordPressAccountNotice,
  trigger_webhook: triggerWebhook,
};

export { friendlyActionError };
