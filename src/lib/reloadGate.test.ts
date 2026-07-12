import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestReload, setReloadBlocked } from "./reloadGate";

function mockWindow() {
  return { location: { reload: vi.fn() } };
}

describe("reloadGate", () => {
  let win: ReturnType<typeof mockWindow>;

  beforeEach(() => {
    win = mockWindow();
    vi.stubGlobal("window", win);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reloads immediately when nothing blocks it", () => {
    requestReload();
    expect(win.location.reload).toHaveBeenCalledTimes(1);
  });

  it("defers the reload while a blocker is active (e.g. app-lock screen showing)", () => {
    setReloadBlocked("app-lock", true);
    requestReload();
    expect(win.location.reload).not.toHaveBeenCalled();
  });

  it("fires the deferred reload once the blocker clears", () => {
    setReloadBlocked("app-lock", true);
    requestReload();
    setReloadBlocked("app-lock", false);
    expect(win.location.reload).toHaveBeenCalledTimes(1);
  });

  it("keeps deferring until every blocker clears", () => {
    setReloadBlocked("app-lock", true);
    setReloadBlocked("sell-save", true);
    requestReload();
    setReloadBlocked("app-lock", false);
    expect(win.location.reload).not.toHaveBeenCalled();
    setReloadBlocked("sell-save", false);
    expect(win.location.reload).toHaveBeenCalledTimes(1);
  });

  it("clearing a blocker that was never requested does not trigger a reload", () => {
    setReloadBlocked("app-lock", false);
    expect(win.location.reload).not.toHaveBeenCalled();
  });
});
