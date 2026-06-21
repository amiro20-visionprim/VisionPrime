/**
 * Placeholder background job/queue definitions for Phase 01. A real
 * queue backend (Redis-based, matching docker-compose's redis service)
 * is wired up once the first async job (e.g. WooCommerce sync) is
 * introduced, starting Phase 03.
 */
export interface Job<TPayload = unknown> {
    name: string;
    payload: TPayload;
}
export interface JobQueue {
    enqueue<TPayload>(job: Job<TPayload>): Promise<void>;
}
export declare function createNoopJobQueue(): JobQueue;
