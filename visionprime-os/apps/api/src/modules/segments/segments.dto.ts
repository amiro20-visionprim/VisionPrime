import { z } from "@visionprime/validation";

const conditionSchema = z.object({
  conditionType: z.enum([
    "purchase_count",
    "total_spent",
    "last_purchase_at",
    "average_order_value",
    "city",
    "gender",
    "tier",
    "wallet_balance",
    "points",
    "reward_status",
    "campaign_received",
    "campaign_clicked",
    "churn_risk",
    "woocommerce_product_bought",
    "woocommerce_category_bought",
    "coupon_used",
  ]),
  operator: z.enum(["gt", "gte", "lt", "lte", "eq", "in"]),
  value: z.unknown().refine((v) => v !== undefined, { message: "value is required" }),
});

export const newSegmentSchema = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().min(1).nullable().optional(),
  segmentType: z.enum(["dynamic", "static"]),
  isActive: z.boolean().optional(),
  conditions: z.array(conditionSchema).optional(),
  memberCustomerIds: z.array(z.string()).optional(),
});
export type NewSegmentDto = z.infer<typeof newSegmentSchema>;

export const updateSegmentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
  conditions: z.array(conditionSchema).optional(),
});
export type UpdateSegmentDto = z.infer<typeof updateSegmentSchema>;

export const segmentMemberIdsSchema = z.object({
  customerIds: z.array(z.string()).min(1, "customerIds is required"),
});
export type SegmentMemberIdsDto = z.infer<typeof segmentMemberIdsSchema>;
