/**
 * Placeholder reusable CRUD scaffolding (list/detail/form patterns) for
 * Admin OS modules. The first real consumer is the Customer 360 list
 * view in Phase 02 — this package only reserves the shape for now.
 */
export interface CrudResourceConfig<T> {
  resourceName: string;
  listPath: string;
  columns: { key: keyof T & string; header: string }[];
}

export function defineCrudResource<T>(config: CrudResourceConfig<T>): CrudResourceConfig<T> {
  return config;
}
