import { z } from "@visionprime/validation";

export const newLoyaltyProgramSchema = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
  pointsPerCurrencyUnit: z.number().nonnegative().optional(),
  config: z.record(z.unknown()).optional(),
});
export type NewLoyaltyProgramDto = z.infer<typeof newLoyaltyProgramSchema>;

export const updateLoyaltyProgramSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
  pointsPerCurrencyUnit: z.number().nonnegative().optional(),
  config: z.record(z.unknown()).optional(),
});
export type UpdateLoyaltyProgramDto = z.infer<typeof updateLoyaltyProgramSchema>;

export const newLoyaltyTierSchema = z.object({
  programId: z.string().uuid(),
  name: z.string().min(1, "name is required"),
  minLifetimePoints: z.number().int().nonnegative(),
  sortOrder: z.number().int().optional(),
  benefits: z.record(z.unknown()).optional(),
});
export type NewLoyaltyTierDto = z.infer<typeof newLoyaltyTierSchema>;

export const updateLoyaltyTierSchema = z.object({
  name: z.string().min(1).optional(),
  minLifetimePoints: z.number().int().nonnegative().optional(),
  sortOrder: z.number().int().optional(),
  benefits: z.record(z.unknown()).optional(),
});
export type UpdateLoyaltyTierDto = z.infer<typeof updateLoyaltyTierSchema>;

export const newLoyaltyRuleSchema = z.object({
  programId: z.string().uuid(),
  name: z.string().min(1, "name is required"),
  ruleType: z.string().min(1, "ruleType is required"),
  config: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});
export type NewLoyaltyRuleDto = z.infer<typeof newLoyaltyRuleSchema>;

export const updateLoyaltyRuleSchema = z.object({
  name: z.string().min(1).optional(),
  ruleType: z.string().min(1).optional(),
  config: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateLoyaltyRuleDto = z.infer<typeof updateLoyaltyRuleSchema>;
