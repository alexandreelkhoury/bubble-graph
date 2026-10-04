import { describe, expect, it } from "vitest";
import { CreateRoomResponse, Healthz } from "@mishana/shared/protocol";
import { createRoom, healthz } from "../src/http";
import type { CreateRoomDeps } from "../src/http";
import type { InitRoomArgs } from "../src/room-core";
import { buildClaims, importFakeSigner, importSigner, parseKeyring, signEntitlementToken } from "../src/billing/token";
import type { Signer } from "../src/billing/token";
import { randomBytes, sha256hex } from "../src/tokens";
import { fakeEnv } from "./support/env";

function deps(log: InitRoomArgs[] = []): CreateRoomDeps {
  return { getStub: async () => ({ initRoom: async (a: InitRoomArgs) => (log.push(a), { ok: true as const }) }), randomBytes, now: () => 42 };
}
const post = (body?: string, headers: Record<string, string> = {}): Request =>
  new Request("https://mish-ana.test/api/rooms", { method: "POST", body, headers });

describe("POST /api/rooms", () => {
  it("201 with no-store, a hashed token passed to the DO and the joinUrl", async () => {
    const log: InitRoomArgs[] = [];
    const res = await createRoom(post(JSON.stringify({ locale: "ar" }), { "Content-Type": "application/json; charset=utf-8" }), fakeEnv(), deps(log));
    expect(res.status).toBe(201);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = CreateRoomResponse.parse(await res.json());
    expect(body.joinUrl).toBe(`https://mish-ana.test/${body.code}`);
    expect(body.wsPath).toBe(`/parties/room/${body.code}`);
    expect(log[0]?.tvTokenHash).toBe(await sha256hex(body.tvToken));
    expect(log[0]?.locale).toBe("ar");
    expect(log[0]?.now).toBe(42);
  });
  it("empty body is OK (locale en); JOIN_BASE_URL overrides the origin", async () => {
    const log: InitRoomArgs[] = [];
    const res = await createRoom(post(), fakeEnv({ JOIN_BASE_URL: "https://mishana.app/" }), deps(log));
    expect(res.status).toBe(201);
    const body = CreateRoomResponse.parse(await res.json());
    expect(body.joinUrl).toBe(`https://mishana.app/${body.code}`);
    expect(log[0]?.locale).toBe("en");
  });
  it("body ≤ 4096 bytes (PAYMENTS-SPEC §3.3): a 3000-char token fits; 4097 bytes → 400", async () => {
    const fits = JSON.stringify({ locale: "en", entitlement: "x".repeat(3000) });
    expect((await createRoom(post(fits, { "Content-Type": "application/json" }), fakeEnv(), deps())).status).toBe(201);
    const big = JSON.stringify({ locale: "en", entitlement: "x".repeat(4097) });
    const res = await createRoom(post(big, { "Content-Type": "application/json" }), fakeEnv(), deps());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "BAD_MESSAGE" });
    const tooLong = JSON.stringify({ entitlement: "x".repeat(3001) });
    expect((await createRoom(post(tooLong, { "Content-Type": "application/json" }), fakeEnv(), deps())).status).toBe(400);
  });
  it("wrong content type → 400; bad JSON or unknown keys → 400", async () => {
    expect((await createRoom(post('{"locale":"en"}', { "Content-Type": "text/plain" }), fakeEnv(), deps())).status).toBe(400);
    expect((await createRoom(post("{nope", { "Content-Type": "application/json" }), fakeEnv(), deps())).status).toBe(400);
    expect((await createRoom(post('{"locale":"de"}', { "Content-Type": "application/json" }), fakeEnv(), deps())).status).toBe(400);
    expect((await createRoom(post('{"x":1}', { "Content-Type": "application/json" }), fakeEnv(), deps())).status).toBe(400);
  });
  it("foreign Origin → 403; same origin and allowlisted are fine", async () => {
    const res = await createRoom(post(undefined, { Origin: "https://evil.example" }), fakeEnv(), deps());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "BAD_MESSAGE" });
    expect((await createRoom(post(undefined, { Origin: "https://mish-ana.test" }), fakeEnv(), deps())).status).toBe(201);
    expect((await createRoom(post(undefined, { Origin: "http://localhost:5173" }), fakeEnv({ ALLOWED_ORIGINS: "http://localhost:5173" }), deps())).status).toBe(201);
  });
  it("rate limited → 429", async () => {
    const env = fakeEnv({ CREATE_ROOM_LIMITER: { limit: async () => ({ success: false }) } });
    const res = await createRoom(post(), env, deps());
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "RATE_LIMITED" });
  });
  it("DO failure → 503 INTERNAL", async () => {
    const res = await createRoom(post(), fakeEnv(), { getStub: async () => { throw new Error("boom"); }, randomBytes, now: () => 1 });
    expect(res.status).toBe(503);
  });
});

describe("GET /healthz", () => {
  it("returns the app slug and protocol version", async () => {
    const body = Healthz.parse(await healthz().json());
    expect(body).toEqual({ ok: true, app: "mish-ana", protocol: 1 });
  });
});

describe("POST /api/rooms entitlement (PAYMENTS-SPEC §3.10/§3.11)", () => {
  async function keyring(): Promise<{ json: string; signer: Signer }> {
    const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
    const json = JSON.stringify({ active: "k1", keys: [{ kid: "k1", x: jwk.x, d: jwk.d }] });
    return { json, signer: await importSigner(parseKeyring(json)!) };
  }
  const body = (t?: string) => JSON.stringify(t === undefined ? { locale: "en" } : { locale: "en", entitlement: t });
  const ct = { "Content-Type": "application/json" };

  it("valid → OK and the verified entitlement reaches initRoom; invalid → INVALID and a free room; none → NONE", async () => {
    const { json, signer } = await keyring();
    const env = fakeEnv({ ENTITLEMENT_KEYS: json });
    const t = await signEntitlementToken(buildClaims("a".repeat(64), 42, 42 + 3_600_000, ["en-food-01", "zz-unknown-01"], "google"), signer);
    const log: InitRoomArgs[] = [];
    const ok = CreateRoomResponse.parse(await (await createRoom(post(body(t), ct), env, deps(log))).json());
    expect(ok.entitlement).toBe("OK");
    expect(log[0]?.entitlement).toMatchObject({ sub: "a".repeat(64), packs: ["en-food-01"], mode: "google" });
    expect(log[0]?.billingMode).toBe("google");
    const bad = CreateRoomResponse.parse(await (await createRoom(post(body(t.slice(0, -2) + "AA"), ct), env, deps(log))).json());
    expect(bad.entitlement).toBe("INVALID");
    expect(log[1]?.entitlement).toBeNull();
    const none = CreateRoomResponse.parse(await (await createRoom(post(body(), ct), env, deps(log))).json());
    expect(none.entitlement).toBe("NONE");
    // An expired token is INVALID too.
    const late = await createRoom(post(body(t), ct), env, { ...deps(log), now: () => 42 + 9 * 3_600_000 });
    expect(CreateRoomResponse.parse(await late.json()).entitlement).toBe("INVALID");
  });

  it("billingMode comes from the request host; a fake token works only in fake mode", async () => {
    const fakeVars = { BILLING_MODE: "fake", ALLOW_FAKE_BILLING: "1" };
    const t = await signEntitlementToken(buildClaims("a".repeat(64), 42, null, [], "fake"), await importFakeSigner());
    const log: InitRoomArgs[] = [];
    const local = new Request("http://127.0.0.1:8787/api/rooms", { method: "POST", body: body(t), headers: ct });
    expect(CreateRoomResponse.parse(await (await createRoom(local, fakeEnv(fakeVars), deps(log))).json()).entitlement).toBe("OK");
    expect(log[0]?.billingMode).toBe("fake");
    expect(CreateRoomResponse.parse(await (await createRoom(post(body(t), ct), fakeEnv(fakeVars), deps(log))).json()).entitlement).toBe("INVALID");
    expect(log[1]?.billingMode).toBe("google");
    const local2 = new Request("http://127.0.0.1:8787/api/rooms", { method: "POST", body: body(t), headers: ct });
    expect(CreateRoomResponse.parse(await (await createRoom(local2, fakeEnv(), deps(log))).json()).entitlement).toBe("INVALID");
    expect(log[2]?.billingMode).toBe("google");
  });
});
