import { describe, it, expect, vi } from "vitest";
import { createDebouncedSingleFlightScheduler } from "../src/watch/scheduler.js";

describe("createDebouncedSingleFlightScheduler", () => {
  it("debounces bursts into one run", async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => {});
    const scheduler = createDebouncedSingleFlightScheduler({ debounceMs: 100, run });

    scheduler.schedule();
    scheduler.schedule();
    scheduler.schedule();

    await vi.advanceTimersByTimeAsync(100);
    expect(run).toHaveBeenCalledTimes(1);
    scheduler.stop();
    vi.useRealTimers();
  });

  it("queues one rerun while in flight", async () => {
    vi.useFakeTimers();

    let resolveRun: (() => void) | null = null;
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRun = resolve;
        })
    );
    const scheduler = createDebouncedSingleFlightScheduler({ debounceMs: 10, run });

    scheduler.requestImmediate();
    scheduler.schedule();
    scheduler.schedule();
    expect(run).toHaveBeenCalledTimes(1);

    resolveRun?.();
    await vi.runAllTimersAsync();
    expect(run).toHaveBeenCalledTimes(2);

    scheduler.stop();
    vi.useRealTimers();
  });
});

