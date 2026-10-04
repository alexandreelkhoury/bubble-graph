// PAYMENTS-SPEC §3.10 / §3.11 / §7.2: room access in RoomCore (entitlement, storeOpen, restrictions, pre-checks).
import { describe, expect, it } from "vitest";
import { TV_BUSY_MAX_MS } from "@mishana/shared/constants";
import { DEFAULT_SETTINGS } from "@mishana/shared/engine";
import { buildClaims, importFakeSigner, importSigner, importVerifyKeys, parseKeyring, signEntitlementToken } from "../src/billing/token";
import type { Signer } from "../src/billing/token";
import type { RoomBillingDeps } from "../src/room-core";
import { BILLING_MSGS_PER_MIN, STORE_OPEN_MSGS_PER_MIN } from "../src/room-core";
import { Harness, premiumEntitlement, seqs, strictlyIncreasing, T0 } from "./support/fakes";
import type { FakeConn } from "./support/fakes";

const SUB_A = "a".repeat(64);
const SUB_B = "b".repeat(64);
const H = 3_600_000;

async function keys(): Promise<{ signer: Signer; billing: RoomBillingDeps }> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  const ring = parseKeyring(JSON.stringify({ active: "k1", keys: [{ kid: "k1", x: jwk.x, d: jwk.d }] }))!;
  return { signer: await importSigner(ring), billing: { verifyKeys: await importVerifyKeys(ring), fakeAllowedByEnv: false } };
}

function token(signer: Signer, nowMs: number, o: { sub?: string; pu?: number | null; packs?: string[]; mode?: "google" | "fake" } = {}): Promise<string> {
  return signEntitlementToken(buildClaims(o.sub ?? SUB_A, nowMs, o.pu === undefined ? nowMs + 30 * 24 * H : o.pu, o.packs ?? [], o.mode ?? "google"), signer);
}

const sendEnt = (h: Harness, c: FakeConn, t: string) => h.send(c, { v: 1, t: "entitlement", token: t });
const view = (c: FakeConn) => c.lastView() as { premium: boolean; lockedPacks: { id: string }[]; tvBusy: boolean; availablePacks: { id: string }[]; settings: { packIds: string[]; points: unknown } };

describe("WS entitlement", () => {
  it("only the TV may send it; a player gets NOT_AUTHENTICATED (and storeOpen too)", async () => {
    const { signer, billing } = await keys();
    const h = await new Harness({ billing }).init();
    await h.tv();
    const p = await h.player(0);
    await sendEnt(h, p.conn, await token(signer, h.now));
    await h.send(p.conn, { v: 1, t: "storeOpen", open: true });
    expect(p.conn.errors()).toEqual(["NOT_AUTHENTICATED", "NOT_AUTHENTICATED"]);
  });

  it("upgrade mid-lobby broadcasts premium:true and unlocks packs without a new room", async () => {
    const { signer, billing } = await keys();
    const h = await new Harness({ billing }).init();
    const tv = await h.tv();
    const p = await h.player(0);
    expect(view(tv).premium).toBe(false);
    expect(view(p.conn).lockedPacks.map((x) => x.id)).toEqual(["test-en-prem-01"]);
    await sendEnt(h, tv, await token(signer, h.now));
    expect(tv.errors()).toEqual([]);
    expect(view(tv).premium).toBe(true);
    expect(view(p.conn).lockedPacks).toEqual([]);
    expect(view(p.conn).availablePacks.map((x) => x.id)).toContain("test-en-prem-01");
    expect(h.core.peek().meta?.entitlement?.sub).toBe(SUB_A);
  });

  it("sub mismatch or an older iat → ENTITLEMENT_INVALID; a lower but newer token is accepted", async () => {
    const { signer, billing } = await keys();
    const h = await new Harness({ billing }).init();
    const tv = await h.tv();
    const first = await token(signer, h.now);
    h.advance(10_000);
    await sendEnt(h, tv, await token(signer, h.now));
    await sendEnt(h, tv, first);
    await sendEnt(h, tv, await token(signer, h.now, { sub: SUB_B }));
    await sendEnt(h, tv, "garbage.token.x");
    expect(tv.errors()).toEqual(["ENTITLEMENT_INVALID", "ENTITLEMENT_INVALID", "ENTITLEMENT_INVALID"]);
    h.advance(2000);
    await sendEnt(h, tv, await token(signer, h.now, { pu: null }));
    expect(tv.errors()).toHaveLength(3);
    expect(view(tv).premium).toBe(false);
  });

  it("fake-kid token accepted only with billingMode fake + fake env; rejected with prod config", async () => {
    const fake = await importFakeSigner();
    const fakeToken = (now: number) => token(fake, now, { mode: "fake" });
    const ok = await new Harness({ billingMode: "fake", billing: { verifyKeys: new Map(), fakeAllowedByEnv: true } }).init();
    const tv1 = await ok.tv();
    await sendEnt(ok, tv1, await fakeToken(ok.now));
    expect(tv1.errors()).toEqual([]);
    expect(view(tv1).premium).toBe(true);
    for (const cfg of [
      { billingMode: "google" as const, billing: { verifyKeys: new Map(), fakeAllowedByEnv: true } },
      { billingMode: "fake" as const, billing: { verifyKeys: new Map(), fakeAllowedByEnv: false } },
    ]) {
      const h = await new Harness(cfg).init();
      const tv = await h.tv();
      await sendEnt(h, tv, await fakeToken(h.now));
      expect(tv.errors()).toEqual(["ENTITLEMENT_INVALID"]);
      expect(view(tv).premium).toBe(false);
    }
  });

  it("separate budgets: 6 entitlement and 12 storeOpen:true per minute; storeOpen:false is never capped", async () => {
    const { signer, billing } = await keys();
    const h = await new Harness({ billing }).init();
    const tv = await h.tv();
    for (let i = 0; i < STORE_OPEN_MSGS_PER_MIN + 1; i++) await h.send(tv, { v: 1, t: "storeOpen", open: true });
    expect(tv.errors()).toEqual(["RATE_LIMITED"]);
    for (let i = 0; i < 20; i++) await h.send(tv, { v: 1, t: "storeOpen", open: false });
    expect(tv.errors()).toEqual(["RATE_LIMITED"]);
    for (let i = 0; i < BILLING_MSGS_PER_MIN + 1; i++) {
      h.advance(1);
      await sendEnt(h, tv, await token(signer, h.now));
    }
    expect(tv.errors()).toEqual(["RATE_LIMITED", "RATE_LIMITED"]);
    h.advance(60_001);
    await h.send(tv, { v: 1, t: "storeOpen", open: true });
    expect(tv.errors()).toHaveLength(2);
  });

  it("8 Store open/close cycles then a purchase still flips premium and clears tvBusy", async () => {
    const { signer, billing } = await keys();
    const h = await new Harness({ billing }).init();
    const tv = await h.tv();
    const p = await h.player(0);
    for (let i = 0; i < 8; i++) {
      await h.send(tv, { v: 1, t: "storeOpen", open: true });
      expect(view(p.conn).tvBusy).toBe(true);
      await h.send(tv, { v: 1, t: "storeOpen", open: false });
      expect(view(p.conn).tvBusy).toBe(false);
    }
    await h.send(tv, { v: 1, t: "storeOpen", open: true });
    await sendEnt(h, tv, await token(signer, h.now));
    await h.send(tv, { v: 1, t: "storeOpen", open: false });
    expect(tv.errors()).toEqual([]);
    expect(view(tv).premium).toBe(true);
    expect(view(p.conn).premium).toBe(true);
    expect(view(p.conn).tvBusy).toBe(false);
  });
});

describe("state frame seq (SPEC §8.4: clients keep a frame only when seq > last)", () => {
  it("meta-only broadcasts (entitlement, storeOpen, tvBusy clear on close) strictly raise seq", async () => {
    const { signer, billing } = await keys();
    const h = await new Harness({ billing }).init();
    const tv = await h.tv();
    const p = await h.player(0);
    await sendEnt(h, tv, await token(signer, h.now));
    await h.send(tv, { v: 1, t: "storeOpen", open: true });
    await h.send(tv, { v: 1, t: "storeOpen", open: false });
    await h.send(tv, { v: 1, t: "storeOpen", open: true });
    await h.core.onClose(tv);
    expect(view(p.conn).premium).toBe(true);
    expect(view(p.conn).tvBusy).toBe(false);
    const ps = seqs(p.conn);
    expect(ps.length).toBeGreaterThanOrEqual(5);
    expect(strictlyIncreasing(ps)).toBe(true);
    expect(strictlyIncreasing(seqs(tv))).toBe(true);
    expect(h.core.peek().meta?.viewRev).toBe(5);
  });

  it("premium ending at changesAt in a lobby with nothing to restrict re-broadcasts with a higher seq, and survives hibernation", async () => {
    const h = await new Harness({ entitlement: premiumEntitlement(T0, 60_000) }).init();
    const tv = await h.tv();
    const p = await h.player(0);
    expect(view(p.conn).premium).toBe(true);
    const before = seqs(p.conn).at(-1) as number;
    h.advance(60_001);
    await h.core.onAlarm();
    expect(view(p.conn).premium).toBe(false);
    expect(seqs(p.conn).at(-1)).toBeGreaterThan(before);
    // A fresh RoomCore (hibernation) keeps the counter: the next frame is still higher.
    const last = seqs(tv).at(-1) as number;
    h.core = h.makeCore();
    await h.send(tv, { v: 1, t: "storeOpen", open: true });
    expect(seqs(tv).at(-1)).toBeGreaterThan(last);
  });
});

describe("§3.10 defence in depth in the Room DO", () => {
  it("initRoom drops a fake-mode entitlement unless the room is fake and the env guard holds", async () => {
    const fakeEnt = { ...premiumEntitlement(T0), mode: "fake" as const };
    const google = await new Harness({ entitlement: fakeEnt, billingMode: "google", billing: { verifyKeys: new Map(), fakeAllowedByEnv: true } }).init();
    expect(google.core.peek().meta?.entitlement).toBeNull();
    const noEnv = await new Harness({ entitlement: fakeEnt, billingMode: "fake", billing: { verifyKeys: new Map(), fakeAllowedByEnv: false } }).init();
    expect(noEnv.core.peek().meta?.entitlement).toBeNull();
    const ok = await new Harness({ entitlement: fakeEnt, billingMode: "fake", billing: { verifyKeys: new Map(), fakeAllowedByEnv: true } }).init();
    const tv = await ok.tv();
    expect(view(tv).premium).toBe(true);
  });

  it("a persisted fake entitlement stops granting once the env guard turns off", async () => {
    const fakeEnt = { ...premiumEntitlement(T0), mode: "fake" as const };
    const h = await new Harness({ entitlement: fakeEnt, billingMode: "fake", billing: { verifyKeys: new Map(), fakeAllowedByEnv: true } }).init();
    h.billing = { verifyKeys: new Map(), fakeAllowedByEnv: false };
    h.core = h.makeCore(); // new isolate with production env
    const tv = await h.tv();
    expect(view(tv).premium).toBe(false);
  });
});

describe("pre-checks and restrictions", () => {
  it("PACK_LOCKED, then PREMIUM_REQUIRED, before reduce; INVALID_SETTINGS still covers unknown ids", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    const p = await h.player(0);
    await h.act(p.conn, { type: "UPDATE_SETTINGS", patch: { packIds: ["test-en-prem-01"] } }, "a1");
    await h.act(tv, { type: "UPDATE_SETTINGS", patch: { packIds: ["test-en-prem-01"], points: { civilian: 1, undercover: 1, blank: 1 } } });
    await h.act(tv, { type: "UPDATE_SETTINGS", patch: { points: { civilian: 1, undercover: 1, blank: 1 } } });
    await h.act(tv, { type: "UPDATE_SETTINGS", patch: { points: { ...DEFAULT_SETTINGS.points }, packIds: ["test-en-01"] } });
    await h.act(tv, { type: "UPDATE_SETTINGS", patch: { packIds: ["no-such-pack"] } });
    expect(p.conn.errors()).toEqual(["PACK_LOCKED"]);
    expect(p.conn.last("error")?.ref).toBe("a1");
    expect(tv.errors()).toEqual(["PACK_LOCKED", "PREMIUM_REQUIRED", "INVALID_SETTINGS"]);
    expect(h.state.settings.packIds).toEqual(["test-en-01"]);
  });

  it("expiry mid-game: the game finishes with its pair; the restriction applies back in LOBBY", async () => {
    const { billing } = await keys();
    const h = new Harness({ billing });
    h.entitlement = { sub: SUB_A, iatMs: T0, expMs: T0 + 8 * H, premiumUntilMs: T0 + H, packs: [], mode: "google" };
    await h.init();
    const tv = await h.tv();
    const ps = [];
    for (let i = 0; i < 4; i++) ps.push(await h.player(i));
    await h.act(tv, { type: "UPDATE_SETTINGS", patch: { packIds: ["test-en-prem-01"], points: { civilian: 3, undercover: 3, blank: 3 }, clueSeconds: 0, voteSeconds: 0, revealSeconds: 0, guessSeconds: 0 } });
    expect(tv.errors()).toEqual([]);
    await h.act(tv, { type: "START" });
    const pair = h.state.pair;
    expect(pair?.packId).toBe("test-en-prem-01");
    h.now = T0 + H + 1;
    await h.core.onAlarm(); // premium ended
    expect(h.state.pair).toEqual(pair);
    expect(view(tv).premium).toBe(false);
    for (const p of ps) await h.act(p.conn, { type: "READY" });
    await h.playToResults(tv, ps);
    expect((h.state.result?.pack.id)).toBe("test-en-prem-01");
    await h.act(tv, { type: "PLAY_AGAIN" });
    expect(h.state.phase).toBe("LOBBY");
    expect(h.state.settings.packIds).toEqual([]);
    expect(h.state.settings.points).toEqual(DEFAULT_SETTINGS.points);
    expect(view(tv).lockedPacks.map((x) => x.id)).toEqual(["test-en-prem-01"]);
    await h.act(tv, { type: "START" });
    expect(h.state.pair?.packId).toBe("test-en-01");
  });

  it("the alarm is scheduled at changesAt and downgrades an idle lobby on time", async () => {
    const h = new Harness();
    h.entitlement = { sub: SUB_A, iatMs: T0, expMs: T0 + 8 * H, premiumUntilMs: T0 + 2000, packs: [], mode: "google" };
    await h.init();
    const tv = await h.tv();
    await h.act(tv, { type: "UPDATE_SETTINGS", patch: { packIds: ["test-en-prem-01"] } });
    expect(h.storage.alarm).toBe(T0 + 2000);
    h.now = T0 + 2000;
    await h.core.onAlarm();
    expect(h.state.settings.packIds).toEqual([]);
    expect(view(tv).premium).toBe(false);
    expect(h.storage.alarm).toBeGreaterThan(T0 + 2000);
  });

  it("hibernation reload keeps meta.entitlement; VIP reassignment leaves it unchanged", async () => {
    const h = new Harness();
    h.entitlement = { sub: SUB_A, iatMs: T0, expMs: T0 + 8 * H, premiumUntilMs: T0 + 4 * H, packs: [], mode: "google" };
    await h.init();
    const tv = await h.tv();
    const p0 = await h.player(0);
    await h.player(1);
    const fresh = h.makeCore();
    await fresh.start();
    expect(fresh.peek().meta?.entitlement).toEqual(h.entitlement);
    h.core = fresh;
    await h.act(p0.conn, { type: "LEAVE" });
    expect(h.state.hostPlayerId).not.toBe(p0.pid);
    expect(h.core.peek().meta?.entitlement).toEqual(h.entitlement);
    expect(view(tv).premium).toBe(true);
  });
});

describe("storeOpen / TV busy", () => {
  it("phone START while tvBusy → TV_BUSY; cleared by open:false", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    const ps = [];
    for (let i = 0; i < 3; i++) ps.push(await h.player(i));
    await h.send(tv, { v: 1, t: "storeOpen", open: true });
    expect(view(ps[0]!.conn).tvBusy).toBe(true);
    await h.act(ps[0]!.conn, { type: "START" });
    expect(ps[0]!.conn.errors()).toEqual(["TV_BUSY"]);
    expect(h.state.phase).toBe("LOBBY");
    await h.send(tv, { v: 1, t: "storeOpen", open: false });
    expect(view(ps[0]!.conn).tvBusy).toBe(false);
    await h.act(ps[0]!.conn, { type: "START" });
    expect(h.state.phase).toBe("ROLE_REVEAL");
  });

  it("cleared when the TV connection closes (not by a replacing TV), by the alarm, and when the phase leaves LOBBY", async () => {
    const h = await new Harness().init();
    const tv = await h.tv();
    const p = await h.player(0);
    await h.send(tv, { v: 1, t: "storeOpen", open: true });
    const tv2 = await h.tv(); // replaces tv (REPLACED close)
    await h.core.onClose(tv);
    expect(h.core.peek().meta?.tvBusyUntil).not.toBeNull();
    tv2.open = false;
    await h.core.onClose(tv2);
    expect(h.core.peek().meta?.tvBusyUntil).toBeNull();
    expect(view(p.conn).tvBusy).toBe(false);

    const tv3 = await h.tv();
    await h.send(tv3, { v: 1, t: "storeOpen", open: true });
    expect(h.storage.alarm).toBeLessThanOrEqual(h.now + TV_BUSY_MAX_MS);
    h.now += TV_BUSY_MAX_MS;
    await h.core.onAlarm();
    expect(h.core.peek().meta?.tvBusyUntil).toBeNull();
    expect(view(p.conn).tvBusy).toBe(false);

    await h.player(1);
    await h.player(2);
    await h.send(tv3, { v: 1, t: "storeOpen", open: true });
    await h.act(tv3, { type: "START" });
    expect(h.state.phase).toBe("ROLE_REVEAL");
    expect(h.core.peek().meta?.tvBusyUntil).toBeNull();
    await h.send(tv3, { v: 1, t: "storeOpen", open: true }); // ignored outside LOBBY
    expect(h.core.peek().meta?.tvBusyUntil).toBeNull();
  });
});
