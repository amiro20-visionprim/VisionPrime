import { z } from "@visionprime/validation";

// General/features/appearance are free-form JSON slices — validated as
// plain records here; specific shape conventions are enforced at the UI
// layer / future schema tightening, per the migration's jsonb columns.
export const updateGeneralSchema = z.record(z.unknown());
export type UpdateGeneralDto = z.infer<typeof updateGeneralSchema>;

export const updateFeaturesSchema = z.record(z.unknown());
export type UpdateFeaturesDto = z.infer<typeof updateFeaturesSchema>;

export const updateAppearanceSchema = z.record(z.unknown());
export type UpdateAppearanceDto = z.infer<typeof updateAppearanceSchema>;
