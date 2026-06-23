/**
 * Minimal background-job abstraction used to decouple bulk work (e.g.
 * campaign sends) from the HTTP request/response cycle. Production uses
 * `setImmediate()` so the job body runs after the response has been
 * sent; tests use `createTestJobRunner()` which additionally tracks
 * in-flight jobs so they can be awaited deterministically via
 * `flush()` instead of relying on timing.
 */
export interface JobRunner {
  run(name: string, fn: () => Promise<void>): void;
}

export interface TestJobRunner extends JobRunner {
  /** Awaits every job started so far (including ones started by jobs
   * that are themselves still running), so callers don't need to guess
   * how many ticks it takes for everything to settle. */
  flush(): Promise<void>;
}

export function createJobRunner(): JobRunner {
  return {
    run(_name, fn) {
      setImmediate(() => {
        fn().catch(() => {
          // Job bodies are responsible for their own error handling
          // (e.g. marking a campaign as failed) — this catch only
          // prevents an unhandled rejection from crashing the process.
        });
      });
    },
  };
}

export function createTestJobRunner(): TestJobRunner {
  const inFlight = new Set<Promise<void>>();

  return {
    run(_name, fn) {
      const promise = fn().catch(() => {
        // Swallow here too — flush() should not itself reject just
        // because a job's own error handling didn't catch everything.
      });
      inFlight.add(promise);
      promise.finally(() => inFlight.delete(promise));
    },
    async flush() {
      // Drain repeatedly: a job may synchronously start another job
      // before this tick observes it.
      let pending = Array.from(inFlight);
      while (pending.length > 0) {
        await Promise.all(pending);
        pending = Array.from(inFlight);
      }
    },
  };
}
