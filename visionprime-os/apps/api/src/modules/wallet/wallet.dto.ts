import { z } from "@visionprime/validation";

export const manualCreditSchema = z.object({
  amount: z.number().positive("amount must be a positive number"),
  reason: z.string().min(1, "reason is required"),
  internalNote: z.string().min(1).optional(),
  referenceType: z.string().min(1).optional(),
  referenceId: z.string().min(1).optional(),
});
export type ManualCreditDto = z.infer<typeof manualCreditSchema>;

export const manualDebitSchema = manualCreditSchema;
export type ManualDebitDto = z.infer<typeof manualDebitSchema>;

export const reverseEntrySchema = z.object({
  reason: z.string().min(1, "reason is required"),
});
export type ReverseEntryDto = z.infer<typeof reverseEntrySchema>;
