import { z } from "@visionprime/validation";

export const connectSchema = z.object({
  siteUrl: z.string().url("siteUrl must be a valid URL"),
  consumerKey: z.string().min(1, "consumerKey is required"),
  consumerSecret: z.string().min(1, "consumerSecret is required"),
  sharedSecret: z.string().min(1).optional(),
  pluginApiKey: z.string().min(1).optional(),
});
export type ConnectDto = z.infer<typeof connectSchema>;

export const updateSettingsSchema = z.object({
  siteUrl: z.string().url("siteUrl must be a valid URL").optional(),
  consumerKey: z.string().min(1).optional(),
  consumerSecret: z.string().min(1).optional(),
  sharedSecret: z.string().min(1).optional(),
  pluginApiKey: z.string().min(1).optional(),
  settings: z.record(z.unknown()).optional(),
});
export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;
