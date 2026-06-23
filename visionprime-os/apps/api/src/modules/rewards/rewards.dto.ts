import { z } from "@visionprime/validation";

export const newRewardSchema = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().min(1).nullable().optional(),
  rewardType: z.enum(["coupon", "free_item", "other"]),
  pointsCost: z.number().int().nonnegative().optional(),
  couponConfig: z.record(z.unknown()).optional(),
  claimValidityDays: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  maxClaims: z.number().int().positive().nullable().optional(),
});
export type NewRewardDto = z.infer<typeof newRewardSchema>;

export const updateRewardSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).nullable().optional(),
  rewardType: z.enum(["coupon", "free_item", "other"]).optional(),
  pointsCost: z.number().int().nonnegative().optional(),
  couponConfig: z.record(z.unknown()).optional(),
  claimValidityDays: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  maxClaims: z.number().int().positive().nullable().optional(),
});
export type UpdateRewardDto = z.infer<typeof updateRewardSchema>;
