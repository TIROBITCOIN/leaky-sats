export class OperationTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OperationTimeoutError";
  }
}

function abortReason(signal: AbortSignal, fallback: string): Error {
  return signal.reason instanceof Error ? signal.reason : new OperationTimeoutError(fallback);
}

/** Runs an operation with a linked AbortSignal and always clears its timer/listeners. */
export async function runWithAbortTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
  parentSignal?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const onParentAbort = () => controller.abort(abortReason(parentSignal!, timeoutMessage));
  if (parentSignal?.aborted) onParentAbort();
  else parentSignal?.addEventListener("abort", onParentAbort, { once: true });

  const timer = setTimeout(() => {
    controller.abort(new OperationTimeoutError(timeoutMessage));
  }, timeoutMs);

  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(abortReason(controller.signal, timeoutMessage));
    if (controller.signal.aborted) onAbort();
    else controller.signal.addEventListener("abort", onAbort, { once: true });
  });

  try {
    return await Promise.race([operation(controller.signal), aborted]);
  } finally {
    clearTimeout(timer);
    if (onAbort) controller.signal.removeEventListener("abort", onAbort);
    parentSignal?.removeEventListener("abort", onParentAbort);
  }
}

export function createWalletSyncCoordinator<TOptions, TOutcome>(options: {
  timeoutMs: number;
  timeoutMessage: string;
  execute: (syncOptions: TOptions, signal: AbortSignal) => Promise<TOutcome>;
  alreadyRunning: () => TOutcome;
  timedOut: (error: OperationTimeoutError) => TOutcome;
}) {
  let active = false;

  return {
    isRunning() {
      return active;
    },
    async sync(syncOptions: TOptions): Promise<TOutcome> {
      if (active) return options.alreadyRunning();
      active = true;
      try {
        return await runWithAbortTimeout(
          (signal) => options.execute(syncOptions, signal),
          options.timeoutMs,
          options.timeoutMessage
        );
      } catch (error) {
        if (error instanceof OperationTimeoutError) return options.timedOut(error);
        throw error;
      } finally {
        active = false;
      }
    },
  };
}
