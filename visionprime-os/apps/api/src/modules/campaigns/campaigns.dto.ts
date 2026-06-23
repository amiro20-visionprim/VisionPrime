import { z } from "@visionprime/validation";

export const newCampaignSchema = z.object({
  name: z.string().min(1, "name is required"),
  segmentId: z.string().min(1, "segmentId is required"),
  channel: z.enum(["sms", "email", "in_app"]),
  messageTemplateId: z.string().min(1).nullable().optional(),
  requiresApproval: z.boolean().optional(),
  scheduledAt: z.string().min(1).nullable().optional(),
  config: z.record(z.unknown()).optional(),
});
export type NewCampaignDto = z.infer<typeof newCampaignSchema>;

export const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  segmentId: z.string().min(1).optional(),
  channel: z.enum(["sms", "email", "in_app"]).optional(),
  messageTemplateId: z.string().min(1).nullable().optional(),
  requiresApproval: z.boolean().optional(),
  scheduledAt: z.string().min(1).nullable().optional(),
  config: z.record(z.unknown()).optional(),
});
export type UpdateCampaignDto = z.infer<typeof updateCampaignSchema>;

export const campaignPreviewSchema = z.object({
  context: z.record(z.string()).optional(),
});
export type CampaignPreviewDto = z.infer<typeof campaignPreviewSchema>;
