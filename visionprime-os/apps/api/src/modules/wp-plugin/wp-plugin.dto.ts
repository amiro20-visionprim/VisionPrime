import { z } from "@visionprime/validation";

export const cartKeySchema = z.object({
  cartKey: z.string().min(1, "cartKey is required"),
});

export const walletAmountSchema = z.object({
  cartKey: z.string().min(1, "cartKey is required"),
  amount: z.number().positive("amount must be a positive number"),
});

export const walletConfirmSchema = z.object({
  cartKey: z.string().min(1, "cartKey is required"),
  woocommerceOrderId: z.string().min(1, "woocommerceOrderId is required"),
});

export const rewardCartKeySchema = z.object({
  cartKey: z.string().min(1, "cartKey is required"),
  rewardId: z.string().min(1).optional(),
});

export const rewardConfirmSchema = z.object({
  cartKey: z.string().min(1, "cartKey is required"),
  woocommerceOrderId: z.string().min(1, "woocommerceOrderId is required"),
});
