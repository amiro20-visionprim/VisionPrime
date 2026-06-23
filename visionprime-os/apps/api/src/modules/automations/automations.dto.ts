import { z } from "@visionprime/validation";

const triggerTypeSchema = z.enum([
  "customer_created",
  "order_completed",
  "order_cancelled",
  "order_refunded",
  "wallet_credited",
  "reward_claimed",
  "first_purchase",
  "reward_expiring",
  "birthday_coming",
  "tier_upgraded",
  "customer_at_risk",
  "no_purchase_for_x_days",
  "woocommerce_order_status_changed",
]);

const actionTypeSchema = z.enum([
  "send_sms",
  "send_email",
  "add_reward",
  "add_cashback",
  "add_points",
  "change_tier",
  "add_to_segment",
  "create_admin_task",
  "show_wordpress_account_notice",
  "trigger_webhook",
]);

const actionSchema = z.object({
  actionType: actionTypeSchema,
  actionConfig: z.record(z.unknown()).optional(),
  position: z.number().int().min(0),
});

export const newAutomationWorkflowSchema = z.object({
  name: z.string().min(1, "name is required"),
  triggerType: triggerTypeSchema,
  isActive: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
  actions: z.array(actionSchema).min(1, "at least one action is required"),
});
export type NewAutomationWorkflowDto = z.infer<typeof newAutomationWorkflowSchema>;

export const updateAutomationWorkflowSchema = z.object({
  name: z.string().min(1).optional(),
  triggerType: triggerTypeSchema.optional(),
  requiresApproval: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
  actions: z.array(actionSchema).optional(),
});
export type UpdateAutomationWorkflowDto = z.infer<typeof updateAutomationWorkflowSchema>;
