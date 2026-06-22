import { z } from "@visionprime/validation";

export const createCustomerSchema = z.object({
  fullName: z.string().min(1, "fullName is required"),
  primaryEmail: z.string().email().optional(),
  primaryMobile: z.string().min(1).optional(),
  wordpressUserId: z.string().min(1).optional(),
  woocommerceCustomerId: z.string().min(1).optional(),
});
export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  fullName: z.string().min(1).optional(),
  primaryEmail: z.string().email().optional(),
  primaryMobile: z.string().min(1).optional(),
  wordpressUserId: z.string().min(1).optional(),
  woocommerceCustomerId: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
});
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;

export const addNoteSchema = z.object({
  note: z.string().min(1, "note is required"),
});
export type AddNoteDto = z.infer<typeof addNoteSchema>;

export const addTagSchema = z.object({
  tag: z.string().min(1, "tag is required"),
});
export type AddTagDto = z.infer<typeof addTagSchema>;

export const mergeCustomersSchema = z.object({
  survivorCustomerId: z.string().uuid(),
  mergedCustomerId: z.string().uuid(),
});
export type MergeCustomersDto = z.infer<typeof mergeCustomersSchema>;
