import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWalletSyncCoordinator,
  OperationTimeoutError,
} from "./walletSyncCoordinator";

type Outcome = { ok: boolean; reason?: string; skipped?: boolean };

afterEach(() => {
  vi.useRealTimers();
});

function coordinatorFor(execute: (signal: AbortSignal) => Promise<Outcome>) {
  return createWalletSyncCoordinator<{}, Outcome>({
    timeoutMs: 1_000,
    timeoutMessage: "sync timeout",
    execute: (_options, signal) => execute(signal),
    alreadyRunning: () => ({ ok: false, skipped: true, reason: "already-running" }),
    timedOut: () => ({ ok: false, reason: "timeout" }),
  });
}

describe("wallet sync coordinator", () => {
  it("returns already-running immediately instead of joining a stuck run", async () => {
    vi.useFakeTimers();
    const coordinator = coordinatorFor(() => new Promise(() => {}));
    const first = coordinator.sync({});

    await expect(coordinator.sync({})).resolves.toEqual({
      ok: false,
      skipped: true,
      reason: "already-running",
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(first).resolves.toMatchObject({ reason: "timeout" });
  });

  it("aborts a stuck run at the deadline and releases the lock", async () => {
    vi.useFakeTimers();
    let receivedSignal: AbortSignal | undefined;
    const coordinator = coordinatorFor((signal) => {
      receivedSignal = signal;
      return new Promise(() => {});
    });

    const pending = coordinator.sync({});
    expect(coordinator.isRunning()).toBe(true);
    await vi.advanceTimersByTimeAsync(999);
    expect(coordinator.isRunning()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);

    await expect(pending).resolves.toEqual({ ok: false, reason: "timeout" });
    expect(receivedSignal?.aborted).toBe(true);
    expect(coordinator.isRunning()).toBe(false);
  });

  it("can run successfully after a timeout", async () => {
    vi.useFakeTimers();
    const execute = vi
      .fn<(signal: AbortSignal) => Promise<Outcome>>()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce({ ok: true });
    const coordinator = coordinatorFor(execute);

    const first = coordinator.sync({});
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(first).resolves.toMatchObject({ reason: "timeout" });
    await expect(coordinator.sync({})).resolves.toEqual({ ok: true });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("clears the timeout timer after natural completion", async () => {
    vi.useFakeTimers();
    const coordinator = coordinatorFor(async () => ({ ok: true }));

    await expect(coordinator.sync({})).resolves.toEqual({ ok: true });
    expect(coordinator.isRunning()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("releases the lock after an unexpected rejection", async () => {
    const coordinator = coordinatorFor(async () => {
      throw new Error("boom");
    });

    await expect(coordinator.sync({})).rejects.toThrow("boom");
    expect(coordinator.isRunning()).toBe(false);
  });

  it("uses OperationTimeoutError for timeout callbacks", async () => {
    vi.useFakeTimers();
    const timedOut = vi.fn((_error: OperationTimeoutError): Outcome => ({
      ok: false,
      reason: "timeout",
    }));
    const coordinator = createWalletSyncCoordinator<{}, Outcome>({
      timeoutMs: 1,
      timeoutMessage: "deadline",
      execute: () => new Promise(() => {}),
      alreadyRunning: () => ({ ok: false, skipped: true }),
      timedOut,
    });

    const pending = coordinator.sync({});
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(timedOut.mock.calls[0][0]).toBeInstanceOf(OperationTimeoutError);
  });
});
