import { z } from "@visionprime/validation";

export const newMessageTemplateSchema = z.object({
  name: z.string().min(1, "name is required"),
  channel: z.enum(["sms", "email", "in_app"]),
  subject: z.string().min(1).nullable().optional(),
  body: z.string().min(1, "body is required"),
  variables: z.array(z.string()).optional(),
});
export type NewMessageTemplateDto = z.infer<typeof newMessageTemplateSchema>;

export const updateMessageTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  channel: z.enum(["sms", "email", "in_app"]).optional(),
  subject: z.string().min(1).nullable().optional(),
  body: z.string().min(1).optional(),
  variables: z.array(z.string()).optional(),
});
export type UpdateMessageTemplateDto = z.infer<typeof updateMessageTemplateSchema>;

export const newNotificationProviderSchema = z.object({
  name: z.string().min(1, "name is required"),
  channel: z.enum(["sms", "email", "in_app"]),
  providerType: z.string().min(1, "providerType is required"),
  credentials: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});
export type NewNotificationProviderDto = z.infer<typeof newNotificationProviderSchema>;

export const updateNotificationProviderSchema = z.object({
  name: z.string().min(1).optional(),
  providerType: z.string().min(1).optional(),
  credentials: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});
export type UpdateNotificationProviderDto = z.infer<typeof updateNotificationProviderSchema>;

export const newOptOutSchema = z.object({
  customerId: z.string().min(1, "customerId is required"),
  channel: z.enum(["sms", "email", "in_app"]),
  reason: z.string().min(1).nullable().optional(),
});
export type NewOptOutDto = z.infer<typeof newOptOutSchema>;

export const newSuppressionListSchema = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().min(1).nullable().optional(),
});
export type NewSuppressionListDto = z.infer<typeof newSuppressionListSchema>;

export const updateSuppressionListSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateSuppressionListDto = z.infer<typeof updateSuppressionListSchema>;

export const suppressionListMemberSchema = z.object({
  customerId: z.string().min(1, "customerId is required"),
});
export type SuppressionListMemberDto = z.infer<typeof suppressionListMemberSchema>;
