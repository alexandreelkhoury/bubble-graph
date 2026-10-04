// PAYMENTS-SPEC §3.10 / §7.2: the fake-mode guards.
import { describe, expect, it } from "vitest";
import { billingModeForRequest, billingRouteMode, fakeAllowedByEnv, isLocalHostname } from "../../src/billing/mode";

const FAKE_ENV = { BILLING_MODE: "fake", ALLOW_FAKE_BILLING: "1", PLAY_SERVICE_ACCOUNT_JSON: "" };
const req = (host: string): Request => new Request(`http://${host}/api/billing/catalog`);

describe("billing mode guards", () => {
  it("fake only when all four conditions hold", () => {
    expect(fakeAllowedByEnv(FAKE_ENV)).toBe(true);
    for (const host of ["localhost:8787", "127.0.0.1:8787", "[::1]:8787", "10.0.0.5", "172.16.1.1", "172.31.255.1", "192.168.1.20:8787"]) {
      expect(billingModeForRequest(FAKE_ENV, req(host)), host).toBe("fake");
    }
  });
  it("each single failing condition disables fake mode (google or NOT_CONFIGURED)", () => {
    expect(fakeAllowedByEnv({ ...FAKE_ENV, BILLING_MODE: "google" })).toBe(false);
    expect(fakeAllowedByEnv({ ...FAKE_ENV, ALLOW_FAKE_BILLING: "0" })).toBe(false);
    expect(fakeAllowedByEnv({ ...FAKE_ENV, ALLOW_FAKE_BILLING: "true" })).toBe(false);
    expect(fakeAllowedByEnv({ ...FAKE_ENV, PLAY_SERVICE_ACCOUNT_JSON: "{}" })).toBe(false);
    for (const host of ["example.com", "play.mishana.workers.dev", "172.32.0.1", "11.0.0.1", "192.169.0.1", "8.8.8.8", "localhost.evil.com"]) {
      expect(billingModeForRequest(FAKE_ENV, req(host)), host).toBe("google");
      expect(billingRouteMode(FAKE_ENV, req(host)), host).toBe("not_configured");
    }
    expect(billingRouteMode({ ...FAKE_ENV, ALLOW_FAKE_BILLING: "0" }, req("localhost"))).toBe("not_configured");
    expect(billingRouteMode({ ...FAKE_ENV, PLAY_SERVICE_ACCOUNT_JSON: "{}" }, req("localhost"))).toBe("not_configured");
  });
  it("google mode needs both secrets", () => {
    const g = { BILLING_MODE: "google", ALLOW_FAKE_BILLING: "0" };
    expect(billingRouteMode(g, req("example.com"))).toBe("not_configured");
    expect(billingRouteMode({ ...g, PLAY_SERVICE_ACCOUNT_JSON: "{}" }, req("example.com"))).toBe("not_configured");
    expect(billingRouteMode({ ...g, PLAY_SERVICE_ACCOUNT_JSON: "{}", ENTITLEMENT_KEYS: "{}" }, req("localhost"))).toBe("google");
    expect(billingModeForRequest({ ...g, ALLOW_FAKE_BILLING: "1" }, req("localhost"))).toBe("google");
  });
  it("isLocalHostname edges", () => {
    expect(isLocalHostname("999.1.1.1")).toBe(false);
    expect(isLocalHostname("LOCALHOST")).toBe(true);
    expect(isLocalHostname("::1")).toBe(false);
  });
});
