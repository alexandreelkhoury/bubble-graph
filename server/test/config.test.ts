// BILLING_ENABLED (server/src/config.ts): the production switch for everything premium/billing.
import { describe, expect, it } from "vitest";
import { ClientConfig, CreateRoomResponse } from "@mishana/shared/protocol";
import { ADMIN_PREFIX } from "../src/admin";
import { BILLING_PREFIX } from "../src/billing/routes";
import { buildClaims, importSigner, importVerifyKeys, parseKeyring, signEntitlementToken } from "../src/billing/token";
import { billingEnabled, billingGate, GATED_PREFIXES, handleConfig } from "../src/config";
import { createRoom } from "../src/http";
import type { InitRoomArgs } from "../src/room-core";
import { randomBytes } from "../src/tokens";
import { fakeEnv } from "./support/env";
import { Harness } from "./support/fakes";

const get = (path: string, method = "GET") => new Request(`https://play.test${path}`, { method });

describe("BILLING_ENABLED", () => {
  it('only "1" turns billing on; unset, "0" or anything else keeps it off', () => {
    expect(billingEnabled({ BILLING_ENABLED: "1" })).toBe(true);
    for (const v of [undefined, "", "0", "true", "yes", " 1"]) expect(billingEnabled({ BILLING_ENABLED: v })).toBe(false);
  });

  it("GET /api/config reports the flag, never cached; other methods 405", async () => {
    for (const [v, billing] of [["0", false], ["1", true]] as const) {
      const res = handleConfig(get("/api/config"), { BILLING_ENABLED: v });
      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(ClientConfig.parse(await res.json())).toEqual({ billing });
    }
    expect(handleConfig(get("/api/config", "POST"), { BILLING_ENABLED: "1" }).status).toBe(405);
  });

  it("off: every billing and admin path answers 404; on: nothing is gated", () => {
    expect(GATED_PREFIXES).toEqual([BILLING_PREFIX, ADMIN_PREFIX]);
    for (const p of ["/api/billing/catalog", "/api/billing/verify", "/api/billing/rtdn", "/api/admin/grant"]) {
      expect(billingGate(p, { BILLING_ENABLED: "0" })?.status).toBe(404);
      expect(billingGate(p, {})?.status).toBe(404);
      expect(billingGate(p, { BILLING_ENABLED: "1" })).toBeNull();
    }
    expect(billingGate("/api/rooms", { BILLING_ENABLED: "0" })).toBeNull();
    expect(billingGate("/api/config", { BILLING_ENABLED: "0" })).toBeNull();
  });

  it("off: createRoom ignores an entitlement token (NONE, no verification, a room without entitlement)", async () => {
    const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
    const json = JSON.stringify({ active: "k1", keys: [{ kid: "k1", x: jwk.x, d: jwk.d }] });
    const t = await signEntitlementToken(buildClaims("a".repeat(64), 42, 42 + 3_600_000, [], "google"), await importSigner(parseKeyring(json)!));
    const log: InitRoomArgs[] = [];
    const deps = { getStub: async () => ({ initRoom: async (a: InitRoomArgs) => (log.push(a), { ok: true as const }) }), randomBytes, now: () => 42 };
    const req = () => new Request("https://play.test/api/rooms", { method: "POST", body: JSON.stringify({ locale: "en", entitlement: t }), headers: { "Content-Type": "application/json" } });
    const off = CreateRoomResponse.parse(await (await createRoom(req(), fakeEnv({ ENTITLEMENT_KEYS: json, BILLING_ENABLED: "0" }), deps)).json());
    expect(off.entitlement).toBe("NONE");
    expect(log[0]?.entitlement).toBeNull();
    const on = CreateRoomResponse.parse(await (await createRoom(req(), fakeEnv({ ENTITLEMENT_KEYS: json, BILLING_ENABLED: "1" }), deps)).json());
    expect(on.entitlement).toBe("OK");
  });

  it("off: the room plays the whole catalog with nothing locked, and ignores entitlement / storeOpen", async () => {
    const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
    const ring = parseKeyring(JSON.stringify({ active: "k1", keys: [{ kid: "k1", x: jwk.x, d: jwk.d }] }))!;
    const h = await new Harness({ billingEnabled: false, billing: { verifyKeys: await importVerifyKeys(ring), fakeAllowedByEnv: false } }).init();
    const tv = await h.tv();
    const p = await h.player(0);
    type V = { premium: boolean; lockedPacks: unknown[]; tvBusy: boolean; availablePacks: { id: string }[]; settings: { points: unknown } };
    const view = (c: typeof tv) => c.lastView() as V;
    expect(view(tv).premium).toBe(true);
    expect(view(p.conn).lockedPacks).toEqual([]);
    expect(view(tv).availablePacks.map((x) => x.id)).toContain("test-en-prem-01");
    // A premium pack and a premium-only setting are accepted, as before payments.
    const points = { civilian: 2, undercover: 2, blank: 2 };
    await h.act(tv, { type: "UPDATE_SETTINGS", patch: { packIds: ["test-en-prem-01"], points } });
    expect(tv.errors()).toEqual([]);
    expect(view(tv).settings.points).toEqual(points);
    // entitlement / storeOpen from the TV are dropped: no error, no busy flag, no stored entitlement.
    const t = await signEntitlementToken(buildClaims("a".repeat(64), h.now, null, [], "google"), await importSigner(ring));
    await h.send(tv, { v: 1, t: "entitlement", token: t });
    await h.send(tv, { v: 1, t: "storeOpen", open: true });
    expect(tv.errors()).toEqual([]);
    expect(view(p.conn).tvBusy).toBe(false);
    expect(h.core.peek().meta?.entitlement ?? null).toBeNull();
  });

  it("on (the RoomCore default): a room without entitlement is a free room with locks", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    expect((tv.lastView() as { premium: boolean }).premium).toBe(false);
  });
});
