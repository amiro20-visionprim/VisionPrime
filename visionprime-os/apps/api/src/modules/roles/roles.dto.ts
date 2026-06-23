import { z } from "@visionprime/validation";

export const createRoleSchema = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().optional(),
  permissionKeys: z.array(z.string()).optional(),
});
export type CreateRoleDto = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  permissionKeys: z.array(z.string()).optional(),
});
export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;
