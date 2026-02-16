export interface Scheduler {
  schedule: () => void;
  requestImmediate: () => void;
  stop: () => void;
}

export interface SchedulerOptions {
  debounceMs: number;
  run: () => Promise<void>;
}

/**
 * Debounces event bursts and ensures a single in-flight run.
 * If events arrive while a run is active, exactly one rerun is queued.
 */
export function createDebouncedSingleFlightScheduler(options: SchedulerOptions): Scheduler {
  let timer: NodeJS.Timeout | null = null;
  let inFlight = false;
  let rerunRequested = false;
  let stopped = false;

  const clearTimer = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const runNow = async (): Promise<void> => {
    if (stopped) return;
    if (inFlight) {
      rerunRequested = true;
      return;
    }

    inFlight = true;
    try {
      await options.run();
    } finally {
      inFlight = false;
      if (rerunRequested && !stopped) {
        rerunRequested = false;
        void runNow();
      }
    }
  };

  return {
    schedule: () => {
      if (stopped) return;
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        void runNow();
      }, options.debounceMs);
    },
    requestImmediate: () => {
      if (stopped) return;
      clearTimer();
      void runNow();
    },
    stop: () => {
      stopped = true;
      clearTimer();
    },
  };
}

