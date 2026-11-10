// JAMAA-PLATFORM §2.8 "Server (A)" for G4 Trivia: RoomCore with fakes over the real protocol v2. A full game hub →
// trivia → results → replay with per-socket secrecy of every frame (the right answer, per-option correctness and other
// players' picks never reach the TV or another phone before REVEAL); answer time from the server clock only; Trivia
// error frames (sender only, non-fatal); the alarm drives the deadlines; a benched late joiner admitted through `join`;
// GAMES_ENABLED; a free room never receives a Pass-only quiz. Then the wire-level §13.3 invariant 1: every frame of
// every socket (TV, phones, a spectator, a late joiner, a phone resumed mid-ANSWER) checked against the state at its
// send time, and two differential (non-interference) runs with deterministic crypto.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ContentCatalog } from "@jamaa/shared/content";
import { contentCatalog } from "@jamaa/shared/content";
import { ServerMessageV2Schema } from "@jamaa/shared/protocol/v2";
import type { RoomIntentMsg } from "@jamaa/shared/protocol/v2";
import { TEST_CATALOG } from "@jamaa/shared/testing";
// JAMAA-GAP (G4): shared/package.json exports no `./testing/*` or games/<id>/engine entry (P files): relative imports.
import { definition as TRIVIA } from "../../../shared/src/games/trivia/definition";
import type { TriviaPack, TriviaState } from "../../../shared/src/games/trivia/engine/types";
import type { TriviaMe, TriviaPublic } from "../../../shared/src/games/trivia/engine/view";
import { TRIVIA_SYNTH_CATALOG } from "../../../shared/src/testing/catalogs/trivia";
import { RoomCore } from "../../src/room-core";
import type { ConnHandle } from "../../src/room-core";
import { sha256hex } from "../../src/tokens";
import { FakeConn, Harness, premiumEntitlement, ROOM, T0 } from "../support/fakes";

type P = { conn: FakeConn; pid: string; token: string };
const ON = ["mishana", "trivia"] as const;
const withTrivia = (packs = TRIVIA_SYNTH_CATALOG.packs): ContentCatalog => ({ ...contentCatalog(TEST_CATALOG), trivia: { packs } }) as unknown as ContentCatalog;
const FREE_ONLY = TRIVIA_SYNTH_CATALOG.packs.filter((p) => p.tier === "free");

const trivia = (h: Harness): TriviaState => {
  const g = h.room.game;
  if (!g || g.id !== "trivia") throw new Error(`no Trivia instance (room phase ${h.room.phase})`);
  return g.state as TriviaState;
};
const act = (h: Harness, c: FakeConn, i: Record<string, unknown>): Promise<void> => h.act(c, { type: "GAME", gameId: "trivia", i } as RoomIntentMsg);
type Env = { gameId: string; phase: string; public: TriviaPublic; me: TriviaMe | null };
const env = (c: FakeConn): Env => (c.lastView() as { game: Env }).game;

async function triviaRoom(n: number, o: { content?: ContentCatalog; enabled?: readonly ("mishana" | "trivia")[] } = {}): Promise<{ h: Harness; tv: FakeConn; ps: P[] }> {
  const h = await new Harness({ enabledGames: [...(o.enabled ?? ON)], content: o.content ?? withTrivia(FREE_ONLY) }).init();
  const tv = await h.tv();
  const ps: P[] = [];
  for (let i = 0; i < n; i++) ps.push(await h.player(i));
  return { h, tv, ps };
}

/** Every connection's latest frame obeys the game's leak oracles for its viewer, and parses as a server frame. */
function checkFrames(h: Harness, tv: FakeConn, ps: P[]): void {
  const s = trivia(h);
  const views: [FakeConn, string | null][] = [[tv, null], ...ps.filter((p) => p.conn.open).map((p) => [p.conn, p.pid] as [FakeConn, string])];
  for (const [c, viewer] of views) {
    const last = c.last("state");
    if (!last) continue;
    expect(ServerMessageV2Schema.safeParse(last).success).toBe(true);
    const view = c.lastView();
    const inGame = viewer !== null && s.players.some((p) => p.id === viewer && !p.left);
    const errs = TRIVIA.leakCheck(s, inGame ? viewer : null, view);
    expect(errs, `${c.label}: ${errs.join("; ")}`).toEqual([]);
    const secrets = new Set(TRIVIA.secretsFor(s, viewer));
    const text = JSON.stringify(view);
    for (const x of secrets) expect(text.includes(JSON.stringify(x)), `${c.label} got a secret`).toBe(false);
    for (const k of TRIVIA.forbiddenKeys) expect(text.includes(`"${k}":`), `${c.label} got key ${k}`).toBe(false);
  }
}

/** Plays to RESULTS over the sockets: players 0.. answer (alternating right/wrong) a little after ANSWER opens; the alarm does the rest. */
async function playTrivia(h: Harness, tv: FakeConn, ps: P[]): Promise<void> {
  for (let i = 0; i < 600; i++) {
    const s = trivia(h);
    checkFrames(h, tv, ps);
    if (s.phase === "RESULTS") return;
    if (s.phase === "ANSWER") {
      const p = ps.find((x) => x.conn.open && s.players.some((q) => q.id === x.pid && !q.left && !q.waiting && q.connected) && !s.answers[x.pid]);
      if (p) {
        const k = ps.indexOf(p) + s.index;
        await act(h, p.conn, { type: "ANSWER", choice: k % 2 === 0 ? s.cur!.correctIndex : (s.cur!.correctIndex + 1) % s.cur!.options.length });
        continue;
      }
    }
    expect(h.storage.alarm).not.toBeNull();
    h.advance(Math.max(0, (h.storage.alarm as number) - h.now));
    await h.core.onAlarm();
  }
  throw new Error(`Trivia did not reach RESULTS (phase ${trivia(h).phase})`);
}

describe("Trivia over the protocol (server, G4)", () => {
  it("hub → setup → a full game → results → replay: every frame of every socket leaks nothing; stars; history memory", async () => {
    const { h, tv, ps } = await triviaRoom(4);
    await h.open(tv, "trivia");
    const setup = (tv.lastView() as { room: { setup: { gameId: string; extras: { available: number; quiz: { id: string } | null } } } }).room.setup;
    expect(setup).toMatchObject({ gameId: "trivia", extras: { available: 40, quiz: { id: "syn-quiz" } } });
    await h.act(tv, { type: "UPDATE_GAME_SETTINGS", gameId: "trivia", patch: { length: "short" } } as RoomIntentMsg);
    await h.act(tv, { type: "START_GAME" });
    expect(h.room.phase).toBe("PLAYING");
    expect(env(tv)).toMatchObject({ gameId: "trivia", phase: "QUIZ_INTRO" });
    // The first deadline carries the entrance grace; the alarm is set to it.
    expect(trivia(h).deadline!.at).toBe(h.storage.alarm);
    await playTrivia(h, tv, ps);
    expect(env(tv).phase).toBe("RESULTS");
    expect((tv.lastView() as { game: { over: boolean } }).game.over).toBe(true);
    expect(h.room.cup.last?.gameId).toBe("trivia");
    expect(h.history.memory.trivia?.usedKeys).toHaveLength(7);
    await h.act(tv, { type: "REPLAY" });
    expect(trivia(h).players.every((p) => p.score === 0)).toBe(true);
    expect(tv.errors()).toEqual([]);
  });

  it("answer time comes from the server clock; a client time field is a BAD_MESSAGE; errors go to the sender only and keep the socket", async () => {
    const { h, tv, ps } = await triviaRoom(2);
    await h.open(tv, "trivia");
    await h.act(tv, { type: "START_GAME" });
    while (trivia(h).phase !== "ANSWER") { h.advance((h.storage.alarm as number) - h.now); await h.core.onAlarm(); }
    const open = trivia(h).cur!.answerOpenAt!;
    const [a, b] = ps as [P, P];
    h.advance(2_000);
    await act(h, a.conn, { type: "ANSWER", choice: 0 }); // send() adds 250 ms
    expect(trivia(h).answers[a.pid]).toEqual({ choice: 0, timeMs: 2_250 - 300 });
    expect(trivia(h).cur!.answerOpenAt).toBe(open);
    await act(h, a.conn, { type: "ANSWER", choice: 1 });
    await act(h, b.conn, { type: "ANSWER", choice: 9 });
    await act(h, b.conn, { type: "ANSWER", choice: 1, clientTime: 5 });
    await act(h, b.conn, { type: "ANSWER", choice: 1, t: 0 });
    expect(a.conn.errors()).toEqual(["ALREADY_ANSWERED"]);
    expect(b.conn.errors()).toEqual(["ANSWER_INVALID", "BAD_MESSAGE", "BAD_MESSAGE"]);
    expect(tv.errors()).toEqual([]);
    expect(a.conn.open && b.conn.open).toBe(true);
    // The phone that answered sees its own pick; the other phone and the TV see only that it answered.
    expect(env(a.conn).me?.myChoice).toBe(0);
    expect(env(b.conn).me?.myChoice).toBeNull();
    expect(env(tv).public.answeredIds).toEqual([a.pid]);
    checkFrames(h, tv, ps);
    // VIP-only host intents; the other phone gets NOT_HOST.
    await act(h, b.conn, { type: "END_GAME" });
    expect(b.conn.errors().at(-1)).toBe("NOT_HOST");
    await act(h, tv, { type: "HOST_ADVANCE" });
    expect(tv.errors()).toEqual(["WRONG_PHASE"]); // ANSWER is never skippable
  });

  it("a member joining mid-game is dealt in by `join`, waits for the next READ, then plays", async () => {
    const { h, tv, ps } = await triviaRoom(2);
    await h.open(tv, "trivia");
    await h.act(tv, { type: "START_GAME" });
    const late = await h.player(7);
    ps.push(late);
    expect(h.room.members.find((m) => m.id === late.pid)?.benched).toBe(false);
    expect(env(late.conn).me).toEqual({ myChoice: null, myTimeMs: null, waitingForNext: true });
    checkFrames(h, tv, ps);
    while (trivia(h).phase !== "ANSWER") { h.advance((h.storage.alarm as number) - h.now); await h.core.onAlarm(); }
    expect(env(late.conn).me?.waitingForNext).toBe(false);
    await act(h, late.conn, { type: "ANSWER", choice: 0 });
    expect(late.conn.errors()).toEqual([]);
  });

  it("a socket closing mid-ANSWER is PLAYER_AWAY (not awaited); everyone gone → HOLD; the TV ends it from the pause menu", async () => {
    const { h, tv, ps } = await triviaRoom(2);
    await h.open(tv, "trivia");
    await h.act(tv, { type: "START_GAME" });
    for (const p of ps) { p.conn.close(); await h.core.onClose(p.conn); }
    for (let i = 0; i < 10 && trivia(h).phase !== "HOLD"; i++) { h.advance(Math.max(0, (h.storage.alarm ?? h.now) - h.now)); await h.core.onAlarm(); }
    expect(trivia(h).phase).toBe("HOLD");
    expect(env(tv).phase).toBe("HOLD");
    await act(h, tv, { type: "END_GAME" });
    expect(env(tv).phase).toBe("RESULTS");
  });

  it("a free room never receives a Pass-only quiz in any frame (PACK_LOCKED); a Pass room may pick it", async () => {
    const { h, tv, ps } = await triviaRoom(2, { content: withTrivia() });
    await h.open(tv, "trivia");
    await h.act(tv, { type: "UPDATE_GAME_SETTINGS", gameId: "trivia", patch: { quizId: "syn-world" } } as RoomIntentMsg);
    expect(tv.errors()).toEqual(["PACK_LOCKED"]);
    const extras = (tv.lastView() as { room: { setup: { extras: { quizzes: { id: string }[] }; lockedPacks: { family: string }[] } } }).room.setup;
    expect(extras.extras.quizzes.map((q) => q.id)).toEqual(["syn-quiz"]);
    expect(extras.lockedPacks.map((p) => p.family)).toEqual(["syn-world"]);
    await h.act(tv, { type: "START_GAME" });
    await playTrivia(h, tv, ps);
    for (const c of [tv, ...ps.map((p) => p.conn)]) {
      for (const m of c.of("state")) {
        const text = JSON.stringify((m as unknown as { view: { game: unknown } }).view.game ?? {});
        expect(text).not.toContain("syn-world-en-");
      }
    }
    const pass = await new Harness({ enabledGames: [...ON], content: withTrivia(), entitlement: premiumEntitlement(T0) }).init();
    const ptv = await pass.tv();
    await pass.player(0);
    await pass.open(ptv, "trivia");
    await pass.act(ptv, { type: "UPDATE_GAME_SETTINGS", gameId: "trivia", patch: { quizId: "syn-world" } } as RoomIntentMsg);
    expect(ptv.errors()).toEqual([]);
    await pass.act(ptv, { type: "START_GAME" });
    expect(trivia(pass).quiz.id).toBe("syn-world");
  });

  it("GAMES_ENABLED without trivia: OPEN_GAME trivia is refused (GAME_DISABLED) and the hub never lists it", async () => {
    const { h, tv } = await triviaRoom(1, { enabled: ["mishana"] });
    expect((tv.lastView() as { room: { games: { id: string }[] } }).room.games.map((g) => g.id)).toEqual(["mishana"]);
    await h.open(tv, "trivia");
    expect(tv.errors()).toEqual(["GAME_DISABLED"]);
  });
});

// ─── §13.3 invariant 1 on the wire: every frame, and non-interference ───────────────────────────────────────────────
// The leak oracles (leakCheck, secretsFor, forbidden keys) are structural: an answer ENCODED in a value (isFinal, a
// deadline, the score order, whitespace in an option) would pass them. The differential runs close that gap: with the
// room's crypto made deterministic, two games that differ only in a secret must send byte-identical frames to every
// socket that may not know it, until the first REVEAL of that question.

let detCounter = 0;
function detBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) { detCounter = (detCounter * 1103515245 + 12345) >>> 0; out[i] = detCounter >>> 24; }
  return out;
}
class DetHarness extends Harness {
  override makeCore(connections: { list(): ConnHandle[] } = this.conns): RoomCore {
    return new RoomCore({
      storage: this.storage, connections, clock: { now: () => this.now }, crypto: { randomBytes: detBytes, sha256hex },
      content: () => this.content, premiumFamilies: () => new Set<string>(), billing: async () => this.billing,
      log: (code, fields) => void this.logs.push({ code, fields }), billingEnabled: false,
      ...(this.enabledGames === undefined ? {} : { enabledGames: this.enabledGames }),
      debugInvariants: true, roomCode: ROOM,
    });
  }
}

/** One frame as sent, with a clone of the Trivia state at send time (null outside a Trivia game). */
type Rec = { label: string; raw: string; state: TriviaState | null };
let recording: { h: Harness; recs: Rec[] } | null = null;
const origSend = FakeConn.prototype.send;

interface Script { pick: (j: number, k: number, nOpts: number) => number | null }
const BASE: Script = { pick: (j, k, n) => (j === 3 && k % 3 === 0 ? null : (j + k) % n) };

/**
 * One Long game, timers by alarm: TV + 4 phones + a spectator; a late joiner (p9) from question 2; on question 1
 * duplicate and invalid answers plus a TV skip of REVEAL; p2 drops and resumes (`p2r`) mid-ANSWER on question 4.
 * Picks never look at the answer, so two runs differ only where the script or the content differs.
 */
async function recordGame(content: ContentCatalog, script: Script): Promise<{ recs: Rec[]; qids: string[] }> {
  detCounter = 42;
  const h = await new DetHarness({ enabledGames: [...ON], content }).init();
  recording = { h, recs: [] };
  const tv = await h.tv();
  const ps: P[] = [];
  for (let i = 0; i < 4; i++) ps.push(await h.player(i));
  await h.spectator({ label: "spectator" });
  await h.open(tv, "trivia");
  await h.act(tv, { type: "UPDATE_GAME_SETTINGS", gameId: "trivia", patch: { length: "long", pace: "fast" } } as RoomIntentMsg);
  await h.act(tv, { type: "START_GAME" });
  const answered = new Set<string>();
  let key = "";
  let resumed = false;
  for (let step = 0; step < 4000; step++) {
    const s = trivia(h);
    if (s.phase === "RESULTS") break;
    if (`${s.phase}:${s.index}` !== key) { answered.clear(); key = `${s.phase}:${s.index}`; }
    if (s.index === 2 && ps.length === 4) ps.push(await h.player(9));
    if (s.phase === "ANSWER") {
      const j = ps.findIndex((p) => p.conn.open && !answered.has(p.pid));
      if (j >= 0) {
        const p = ps[j] as P;
        answered.add(p.pid);
        const c = script.pick(j, s.index, s.cur!.options.length);
        if (c === null) continue;
        await h.send(p.conn, { v: 2, t: "action", a: { type: "GAME", gameId: "trivia", i: { type: "ANSWER", choice: c } } }, 300 + j * 137);
        if (j === 1 && s.index === 1) {
          await h.send(p.conn, { v: 2, t: "action", a: { type: "GAME", gameId: "trivia", i: { type: "ANSWER", choice: (c + 1) % 2 } } }, 1);
          await h.send(p.conn, { v: 2, t: "action", a: { type: "GAME", gameId: "trivia", i: { type: "ANSWER", choice: 7 } } }, 1);
        }
        if (j === 2 && s.index === 4 && !resumed) {
          resumed = true;
          p.conn.close();
          await h.core.onClose(p.conn);
          ps[j] = { ...p, conn: await h.resume(p.token, "p2r") };
        }
        continue;
      }
    }
    if (s.phase === "REVEAL" && s.index === 1) await h.send(tv, { v: 2, t: "action", a: { type: "GAME", gameId: "trivia", i: { type: "HOST_ADVANCE" } } }, 10);
    if (trivia(h).phase === "RESULTS") break;
    expect(h.storage.alarm).not.toBeNull();
    h.advance(Math.max(0, (h.storage.alarm as number) - h.now));
    await h.core.onAlarm();
  }
  expect(trivia(h).phase).toBe("RESULTS");
  const out = { recs: recording.recs, qids: [...trivia(h).questionIds] };
  recording = null;
  return out;
}

/** Per-socket frames sent strictly before the first frame (on any socket) that shows REVEAL of question k. */
function beforeReveal(recs: readonly Rec[], k: number): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const r of recs) {
    const pub = (JSON.parse(r.raw) as { view?: { game?: { public?: { phase: string; index: number } } } }).view?.game?.public;
    if (pub && pub.phase === "REVEAL" && pub.index === k) break;
    out.set(r.label, [...(out.get(r.label) ?? []), r.raw]);
  }
  return out;
}

function expectSameFrames(a: Map<string, string[]>, b: Map<string, string[]>, skip: (label: string) => boolean, tag: string): number {
  let compared = 0;
  for (const [label, fa] of a) {
    if (skip(label)) continue;
    const fb = b.get(label) ?? [];
    expect(fb.length, `${tag} ${label}: frame count`).toBe(fa.length);
    for (let i = 0; i < fa.length; i++) expect(fb[i], `${tag} ${label} frame ${i}`).toBe(fa[i]);
    compared += fa.length;
  }
  return compared;
}

describe("Trivia on the wire: every frame, and non-interference (§13.3 invariant 1)", () => {
  beforeAll(() => {
    FakeConn.prototype.send = function (this: FakeConn, msg: string): void {
      origSend.call(this, msg);
      const g = recording?.h.core.peek().state?.game;
      recording?.recs.push({ label: this.label, raw: msg, state: g && g.id === "trivia" ? structuredClone(g.state as TriviaState) : null });
    };
  });
  afterAll(() => { FakeConn.prototype.send = origSend; });

  it("every frame on every socket (TV, phones, spectator, late joiner, resumed phone) passes the oracles at its send-time state", async () => {
    const { recs } = await recordGame(withTrivia(FREE_ONLY), BASE);
    const pidOf = new Map<string, string>();
    const perSocket: Record<string, number> = {};
    for (const r of recs) {
      const m = JSON.parse(r.raw) as Record<string, unknown> & { t: string; view?: { game?: { gameId?: string; public?: Record<string, unknown> } } };
      expect(ServerMessageV2Schema.safeParse(m).success, r.raw.slice(0, 200)).toBe(true);
      if (m.t === "welcome") pidOf.set(r.label, m.playerId as string);
      if (m.t !== "state" || !r.state || m.view?.game?.gameId !== "trivia") continue;
      const viewer = pidOf.get(r.label) ?? null;
      const inGame = viewer !== null && r.state.players.some((p) => p.id === viewer && !p.left);
      const errs = TRIVIA.leakCheck(r.state, inGame ? viewer : null, m.view);
      expect(errs, `${r.label} ${r.state.phase}#${r.state.index}: ${errs.join("; ")}`).toEqual([]);
      const text = JSON.stringify(m.view);
      for (const x of TRIVIA.secretsFor(r.state, viewer)) expect(text.includes(JSON.stringify(x)), `${r.label} got a secret`).toBe(false);
      for (const k of TRIVIA.forbiddenKeys) expect(text.includes(`"${k}":`), `${r.label} got key ${k}`).toBe(false);
      // Independent oracle: before REVEAL the right option's text appears nowhere but in public.options.
      if (r.state.cur && r.state.phase !== "REVEAL") {
        const right = r.state.cur.options[r.state.cur.correctIndex] as string;
        const g = { ...m.view.game, public: { ...m.view.game.public, options: [] } };
        expect(JSON.stringify({ ...m.view, game: g }).includes(right), `${r.label} names the right option`).toBe(false);
      }
      perSocket[r.label] = (perSocket[r.label] ?? 0) + 1;
    }
    // Every kind of socket was exercised in game.
    for (const label of ["tv", "p0", "p1", "p2", "p2r", "p3", "p9", "spectator"]) expect(perSocket[label] ?? 0, label).toBeGreaterThan(5);
  }, 60_000);

  it("changing only question k's authored answer changes no byte on any socket before REVEAL(k)", async () => {
    const a = await recordGame(withTrivia(FREE_ONLY), BASE);
    const again = await recordGame(withTrivia(FREE_ONLY), BASE);
    expect(again.recs.map((r) => r.raw)).toEqual(a.recs.map((r) => r.raw)); // the harness is deterministic
    for (let k = 0; k < a.qids.length; k++) {
      const qid = a.qids[k] as string;
      const packs: TriviaPack[] = FREE_ONLY.map((p) => ({ ...p, questions: p.questions.map((q) => (q.id !== qid ? q : { ...q, answer: (q.answer + 1) % q.options.length })) }));
      const b = await recordGame(withTrivia(packs), BASE);
      expect(expectSameFrames(beforeReveal(a.recs, k), beforeReveal(b.recs, k), () => false, `q${k}`)).toBeGreaterThan(10);
      // Sanity: the change is visible at REVEAL(k), so the cut is not vacuous.
      expect(b.recs.map((r) => r.raw)).not.toEqual(a.recs.map((r) => r.raw));
    }
  }, 180_000);

  it("changing only player j's pick at question k changes no byte on the TV, the spectator or the other phones before REVEAL(k)", async () => {
    const a = await recordGame(withTrivia(FREE_ONLY), BASE);
    for (const k of [0, 3, 4, 14]) {
      for (const j of [0, 1, 2]) {
        const b = await recordGame(withTrivia(FREE_ONLY), { pick: (jj, kk, n) => (jj === j && kk === k ? ((BASE.pick(jj, kk, n) ?? 0) + 1) % n : BASE.pick(jj, kk, n)) });
        const own = (label: string): boolean => label === `p${j}` || label === `p${j}r`;
        expect(expectSameFrames(beforeReveal(a.recs, k), beforeReveal(b.recs, k), own, `q${k} j${j}`)).toBeGreaterThan(10);
      }
    }
  }, 180_000);
});
