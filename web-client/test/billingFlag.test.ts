// BILLING_ENABLED on the web client (lib/billingFlag.ts): one GET /api/config per page, fail closed.
import { afterEach, describe, expect, it, vi } from "vitest";
import { billingEnabled, loadBillingFlag, parseClientConfig, resetBillingFlag } from "../src/lib/billingFlag";

const reply = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

afterEach(() => resetBillingFlag());

describe("billing flag", () => {
  it("only an explicit billing:true turns it on", () => {
    expect(parseClientConfig({ billing: true })).toBe(true);
    for (const b of [{ billing: false }, { billing: "true" }, { billing: 1 }, {}, null, "x", []]) expect(parseClientConfig(b)).toBe(false);
  });

  it("is off until /api/config answers, then follows it", async () => {
    expect(billingEnabled.value).toBe(false);
    const f = vi.fn(reply(200, { billing: true }));
    const p = loadBillingFlag(f);
    expect(billingEnabled.value).toBe(false);
    expect(await p).toBe(true);
    expect(billingEnabled.value).toBe(true);
    expect(f).toHaveBeenCalledWith("/api/config", { cache: "no-store" });
  });

  it("billing:false, an error status (old server: 405) or a network failure keep it off", async () => {
    for (const f of [reply(200, { billing: false }), reply(405, { error: "BAD_MESSAGE" }), reply(404, {}), async () => { throw new TypeError("offline"); }]) {
      resetBillingFlag();
      await expect(loadBillingFlag(f as typeof fetch)).resolves.toBe(false);
      expect(billingEnabled.value).toBe(false);
    }
  });

  it("fetches once per page; later calls share the answer", async () => {
    const f = vi.fn(reply(200, { billing: true }));
    await Promise.all([loadBillingFlag(f), loadBillingFlag(f)]);
    await loadBillingFlag(f);
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe("production hotfix default (server has no /api/config)", () => {
  it("loadBillingFlag() with no fetchFn stays off and makes no request", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ billing: true }), { status: 200 }));
    try {
      await expect(loadBillingFlag()).resolves.toBe(false);
      expect(billingEnabled.value).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("TV mock boot with billing off", () => {
  it("bootBilling makes no request at all", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}", { status: 500 }));
    try {
      const { bootBilling } = await import("../src/tv-mock/billingEffects");
      await bootBilling(50);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
