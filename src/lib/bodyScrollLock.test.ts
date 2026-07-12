import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function mockDocument() {
  const classes = new Set<string>();
  return {
    body: {
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
        contains: (c: string) => classes.has(c),
      },
    },
  };
}

describe("body scroll lock ref-counting", () => {
  let doc: ReturnType<typeof mockDocument>;
  let mod: typeof import("./bodyScrollLock");

  beforeEach(async () => {
    doc = mockDocument();
    vi.stubGlobal("document", doc);
    vi.resetModules();
    mod = await import("./bodyScrollLock");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds the lock class on first acquire", () => {
    mod.acquireBodyScrollLock();
    expect(doc.body.classList.contains("ldg-modal-open")).toBe(true);
  });

  it("keeps the lock class while any acquire is outstanding (nested modals)", () => {
    mod.acquireBodyScrollLock();
    mod.acquireBodyScrollLock();
    mod.releaseBodyScrollLock();
    expect(doc.body.classList.contains("ldg-modal-open")).toBe(true);
    mod.releaseBodyScrollLock();
    expect(doc.body.classList.contains("ldg-modal-open")).toBe(false);
  });

  it("never goes negative on extra releases", () => {
    mod.releaseBodyScrollLock();
    mod.releaseBodyScrollLock();
    mod.acquireBodyScrollLock();
    expect(doc.body.classList.contains("ldg-modal-open")).toBe(true);
    mod.releaseBodyScrollLock();
    expect(doc.body.classList.contains("ldg-modal-open")).toBe(false);
  });
});
