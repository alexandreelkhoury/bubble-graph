// JAMAA-PLATFORM §2.8 "Server (A)" for G2 Bluff: RoomCore with fakes over the real protocol v2. One full session
// hub → mishana → replay → hub → bluff; per-socket secrecy of every frame (the truth, house lies and other players'
// lies never reach the TV or another phone before their phase); Bluff error frames (non-fatal, sender only);
// WRONG_GAME; a benched late joiner admitted through `join`; GAMES_ENABLED and TV capability gates; the alarm drives
// Bluff deadlines; a free room never draws a Pass item.
import { describe, expect, it } from "vitest";
import type { ContentCatalog } from "@jamaa/shared/content";
import { contentCatalog } from "@jamaa/shared/content";
import { GAME_META } from "@jamaa/shared/games/meta";
import { ServerMessageV2Schema } from "@jamaa/shared/protocol/v2";
import type { RoomIntentMsg } from "@jamaa/shared/protocol/v2";
import { TEST_CATALOG } from "@jamaa/shared/testing";
// JAMAA-GAP (G2): shared/package.json exports no `./testing/*` or games/<id>/engine entry (P files): relative imports.
import type { BluffState } from "../../../shared/src/games/bluff/engine/state";
import { bluffProgressIntent } from "../../../shared/src/testing/bots/bluff";
import { bluffTokenCatalog } from "../../../shared/src/testing/catalogs/bluff";
import { Harness } from "../support/fakes";
import type { FakeConn } from "../support/fakes";

const BLUFF_ON = ["mishana", "bluff"] as const;
const withBluff = (cat = bluffTokenCatalog()): ContentCatalog => ({ ...contentCatalog(TEST_CATALOG), bluff: cat }) as unknown as ContentCatalog;

type P = { conn: FakeConn; pid: string; token: string };
const bluff = (h: Harness): BluffState => {
  const g = h.room.game;
  if (!g || g.id !== "bluff") throw new Error(`no Bluff instance (room phase ${h.room.phase})`);
  return g.state as BluffState;
};
const gameAct = (h: Harness, c: FakeConn, i: Record<string, unknown>): Promise<void> => h.act(c, { type: "GAME", gameId: "bluff", i } as RoomIntentMsg);

async function bluffRoom(n: number, opts: { content?: ContentCatalog; length?: "short" | "normal" | "long" } = {}): Promise<{ h: Harness; tv: FakeConn; ps: P[] }> {
  const h = await new Harness({ enabledGames: [...BLUFF_ON], content: opts.content ?? withBluff() }).init();
  const tv = await h.tv();
  const ps: P[] = [];
  for (let i = 0; i < n; i++) ps.push(await h.player(i));
  await h.open(tv, "bluff");
  await h.act(tv, { type: "UPDATE_GAME_SETTINGS", gameId: "bluff", patch: { length: opts.length ?? "short" } } as RoomIntentMsg);
  return { h, tv, ps };
}

/** Plays the Bluff instance to RESULTS over the sockets; checks every new frame of every socket on the way. */
async function playBluff(h: Harness, tv: FakeConn, ps: P[], onStep?: () => void): Promise<void> {
  for (let i = 0; i < 400; i++) {
    const s = bluff(h);
    if (s.phase === "RESULTS") return;
    const n = bluffProgressIntent(s);
    if (n === null) {
      h.advance(Math.max(0, (s.deadline ?? h.now) - h.now));
      await h.core.onAlarm();
    } else {
      const c = n.by === null ? tv : ps.find((p) => p.pid === n.by)?.conn;
      if (!c) throw new Error(`no socket for ${n.by}`);
      await gameAct(h, c, n.i);
    }
    onStep?.();
  }
  throw new Error(`Bluff did not reach RESULTS (phase ${bluff(h).phase})`);
}

/** Every Bluff secret that must not be in `frame` right now for that socket (TV: viewer null). */
function frameLeaks(s: BluffState, frame: string, viewer: string | null): string[] {
  const out: string[] = [];
  const p = s.prompt;
  if (!p) return out;
  const revealed = s.phase === "REVEAL" || s.phase === "SCORES";
  const voting = s.phase === "VOTING" || revealed;
  const shown = new Set(voting ? s.options.map((o) => o.text) : []);
  const own = viewer && s.lies[viewer] ? new Set([s.lies[viewer]!.text]) : new Set<string>();
  const check = (t: string | null, what: string): void => {
    if (t && !shown.has(t) && !own.has(t) && frame.includes(JSON.stringify(t))) out.push(`${what} ${JSON.stringify(t)}`);
  };
  if (!revealed) {
    for (const t of p.truthAll) check(t, "truth");
    check(p.note, "note");
  }
  for (const t of p.houseLies) check(t, "house lie");
  for (const [id, l] of Object.entries(s.lies)) if (id !== viewer) check(l.text, `lie of ${id}`);
  if (!revealed && /"(authorIds|voterIds|likerIds)"/.test(frame)) out.push("authorship before REVEAL");
  return out;
}

type Envelope = { gameId: string; phase: string; doneIds: string[]; awaitedIds: string[]; public: { promptIndex: number; votedIds: string[] } };
const envOf = (m: unknown): Envelope | null => ((m as { view?: { game?: Envelope | null } }).view?.game ?? null);

/** Ballot secrecy across frames (§8.1): within one VOTING prompt, votedIds/doneIds only grow and awaitedIds only
 *  shrink (a hide that drops a voter would expose who had picked the hidden card). `last` is per socket. */
function ballotMonotonic(last: Map<string, Envelope>, label: string, env: Envelope | null, errs: string[]): void {
  if (!env || env.gameId !== "bluff") return;
  const prev = last.get(label);
  if (env.phase === "VOTING" && prev?.phase === "VOTING" && prev.public.promptIndex === env.public.promptIndex) {
    for (const id of prev.public.votedIds) if (!env.public.votedIds.includes(id)) errs.push(`${label}: votedIds dropped ${id}`);
    for (const id of prev.doneIds) if (!env.doneIds.includes(id)) errs.push(`${label}: doneIds dropped ${id}`);
    for (const id of env.awaitedIds) if (!prev.awaitedIds.includes(id)) errs.push(`${label}: awaitedIds re-added ${id}`);
  }
  last.set(label, env);
}

describe("Bluff over protocol v2 (RoomCore + fakes)", () => {
  it("one full session: hub → mishana → replay → hub → bluff → RESULTS, frames valid and leak-free", async () => {
    const h = await new Harness({ enabledGames: [...BLUFF_ON], content: withBluff() }).init();
    const { tv, ps } = await h.startedGame({ n: 4, ready: true });
    await h.playToResults(tv, ps);
    await h.act(tv, { type: "REPLAY" });
    for (const p of h.state.players) {
      const c = ps.find((x) => x.pid === p.id);
      if (c && h.state.phase === "ROLE_REVEAL") await h.game(c.conn, { type: "READY" });
    }
    await h.playToResults(tv, ps);
    await h.act(tv, { type: "BACK_TO_HUB" });
    expect(h.room.phase).toBe("HUB");
    await h.open(tv, "bluff");
    expect(h.room.setupGameId).toBe("bluff");
    await h.act(tv, { type: "UPDATE_GAME_SETTINGS", gameId: "bluff", patch: { length: "short" } } as RoomIntentMsg);
    await h.act(tv, { type: "START_GAME" });
    expect(bluff(h).phase).toBe("ROUND_INTRO");
    const socks: [FakeConn, string | null][] = [[tv, null], ...ps.map((p): [FakeConn, string | null] => [p.conn, p.pid])];
    for (const [c] of socks) c.clear();
    const errs: string[] = [];
    const last = new Map<string, Envelope>();
    await playBluff(h, tv, ps, () => {
      const s = bluff(h);
      for (const [c, viewer] of socks) {
        for (const m of c.of("state")) {
          ballotMonotonic(last, c.label, envOf(m), errs);
          const raw = JSON.stringify(m);
          const parsed = ServerMessageV2Schema.safeParse(m);
          if (!parsed.success) errs.push(`${c.label}: invalid frame ${JSON.stringify(parsed.error.issues.slice(0, 2))}`);
          for (const e of frameLeaks(s, raw, viewer)) errs.push(`${c.label} @${s.phase}: ${e}`);
          const game = (m.view as { game: { gameId: string; me: unknown } | null }).game;
          if (viewer === null && game?.me != null) errs.push("TV frame with a `me`");
        }
        c.clear();
      }
    });
    expect(errs).toEqual([]);
    expect(h.room.cup.last?.gameId).toBe("bluff");
    expect(Object.keys(h.room.cup.stars).length).toBeGreaterThan(0);
    expect(h.history.memory.bluff?.usedKeys.length).toBe(5);
    expect(h.history.games.map((g) => g.gameId)).toEqual(["mishana", "mishana", "bluff"]);
  });

  it("a host hide in the final never changes votedIds/doneIds/awaitedIds on any socket (5 phones, review blocker)", async () => {
    const { h, tv, ps } = await bluffRoom(5);
    await h.act(tv, { type: "START_GAME" });
    for (let i = 0; i < 200; i++) {
      const s = bluff(h);
      if (s.phase === "WRITING" && s.plan[s.promptIndex] === "noTruth") break;
      h.advance(Math.max(0, (s.deadline ?? h.now) - h.now));
      await h.core.onAlarm();
    }
    expect(bluff(h).phase).toBe("WRITING");
    for (const [k, p] of ps.entries()) await gameAct(h, p.conn, { type: "SUBMIT_LIE", text: ["Purple goats sing", "Grandma bakes clouds", "Uncle jazz forever", "Tiny pickles sideways", "Moon under quietly"][k]!, promptId: bluff(h).prompt!.id });
    expect(bluff(h).phase).toBe("VOTING");
    const target = bluff(h).options.find((o) => o.authors.includes(ps[0]!.pid))!.id;
    const other = (pid: string) => bluff(h).options.find((o) => o.id !== target && !o.authors.includes(pid))!.id;
    await gameAct(h, ps[1]!.conn, { type: "VOTE", optionId: target });
    await gameAct(h, ps[2]!.conn, { type: "VOTE", optionId: target });
    await gameAct(h, ps[3]!.conn, { type: "VOTE", optionId: other(ps[3]!.pid) });
    const socks = [tv, ...ps.map((p) => p.conn)];
    const before = socks.map((c) => envOf(c.last("state"))!);
    for (const e of before) expect(e.public.votedIds).toHaveLength(3);
    for (const c of socks) c.clear();
    await gameAct(h, tv, { type: "HIDE_OPTION", optionId: target });            // the TV remote holder
    expect(bluff(h).phase).toBe("VOTING");
    expect(bluff(h).options.some((o) => o.id === target)).toBe(false);
    socks.forEach((c, i) => {
      const e = envOf(c.last("state"))!;
      expect(e.public.votedIds, c.label).toEqual(before[i]!.public.votedIds);
      expect(e.doneIds, c.label).toEqual(before[i]!.doneIds);
      expect(e.awaitedIds, c.label).toEqual(before[i]!.awaitedIds);
    });
    // Only the displaced voters' own phones learn it (me.myVote back to null).
    const meOf = (c: FakeConn) => (c.last("state") as unknown as { view: { game: { me: { myVote: string | null } } } }).view.game.me;
    expect(meOf(ps[1]!.conn).myVote).toBeNull();
    expect(meOf(ps[2]!.conn).myVote).toBeNull();
    expect(meOf(ps[3]!.conn).myVote).not.toBeNull();
  });

  it("Bluff errors are non-fatal frames to the sender only; WRONG_GAME for another game's intent", async () => {
    const { h, tv, ps } = await bluffRoom(3);
    await h.act(tv, { type: "START_GAME" });
    await gameAct(h, tv, { type: "HOST_ADVANCE" });
    expect(bluff(h).phase).toBe("WRITING");
    const [a, b] = ps as [P, P];
    b.conn.clear();
    tv.clear();
    await gameAct(h, a.conn, { type: "SUBMIT_LIE", text: "   ", promptId: bluff(h).prompt!.id });
    expect(a.conn.errors()).toEqual(["LIE_EMPTY"]);
    expect(a.conn.last("error")).toMatchObject({ messageKey: "error.lieEmpty" });
    expect(a.conn.closeCode).toBeNull();
    expect(b.conn.errors()).toEqual([]);
    expect(tv.errors()).toEqual([]);
    await gameAct(h, a.conn, { type: "SUBMIT_LIE", text: "a perfectly fine lie", promptId: "ffffffff" });
    expect(a.conn.errors().at(-1)).toBe("STALE_PROMPT");
    await gameAct(h, b.conn, { type: "SKIP_PROMPT", promptId: bluff(h).prompt!.id });
    expect(b.conn.errors().at(-1)).toBe("NOT_HOST");
    await h.act(a.conn, { type: "GAME", gameId: "mishana", i: { type: "READY" } } as RoomIntentMsg);
    expect(a.conn.errors().at(-1)).toBe("WRONG_GAME");
    // A schema-invalid Bluff intent is refused before the engine.
    await gameAct(h, a.conn, { type: "VOTE", optionId: "NOT-HEX" });
    expect(a.conn.errors().at(-1)).toBe("BAD_MESSAGE");
  });

  it("a player who joins mid-game is benched, enters through `join`, and waits for the next WRITING", async () => {
    const { h, tv, ps } = await bluffRoom(3);
    await h.act(tv, { type: "START_GAME" });
    await gameAct(h, tv, { type: "HOST_ADVANCE" });
    const late = await h.player(7);
    const me = late.conn.lastView().game as { me: { waitingForNext: boolean } | null };
    expect(h.room.members.find((m) => m.id === late.pid)?.benched).toBe(false);
    expect(me.me?.waitingForNext).toBe(true);
    await gameAct(h, late.conn, { type: "SUBMIT_LIE", text: "let me in please", promptId: bluff(h).prompt!.id });
    expect(late.conn.errors().at(-1)).toBe("WRONG_PHASE");
    await playBluff(h, tv, [...ps, late]);
    expect(bluff(h).players.find((p) => p.id === late.pid)?.waiting).toBe(false);
  });

  it("the alarm drives Bluff deadlines (first ROUND_INTRO includes the entrance grace)", async () => {
    const { h, tv } = await bluffRoom(3);
    await h.act(tv, { type: "START_GAME" });
    const s = bluff(h);
    expect(s.deadline).toBe(h.now + 4000 + 2500);
    expect(h.storage.alarm).toBe(s.deadline);
    h.advance(6500);
    await h.core.onAlarm();
    expect(bluff(h).phase).toBe("WRITING");
  });

  it("GAMES_ENABLED without bluff → GAME_UNAVAILABLE (registry-enabled, not deployed); a TV without bluff → GAME_UNAVAILABLE", async () => {
    const off = await new Harness({ enabledGames: ["mishana"], content: withBluff() }).init();
    const tv1 = await off.tv();
    await off.open(tv1, "bluff");
    // JAMAA-PLATFORM §2.5: a registry-enabled game left out of GAMES_ENABLED is GAME_UNAVAILABLE (GAME_DISABLED is for stubs).
    expect(tv1.errors().at(-1)).toBe("GAME_UNAVAILABLE");
    const h = await new Harness({ enabledGames: [...BLUFF_ON], content: withBluff() }).init();
    const tv2 = await h.tv([{ id: "mishana", v: GAME_META.mishana.VIEW_VERSION }]);
    await h.open(tv2, "bluff");
    expect(tv2.errors().at(-1)).toBe("GAME_UNAVAILABLE");
    const tv3 = await new Harness({ enabledGames: [...BLUFF_ON], content: withBluff() }).init().then((x) => x.tv([{ id: "mishana", v: GAME_META.mishana.VIEW_VERSION }, { id: "bluff", v: GAME_META.bluff.VIEW_VERSION + 1 }]));
    expect(tv3.errors()).toEqual([]);
  });

  it("a free room never draws a Pass item and never sends one to a client", async () => {
    const cat = bluffTokenCatalog();
    const pass = cat.packs.flatMap((p) => p.items.filter((i) => i.tier === "pass"));
    const { h, tv, ps } = await bluffRoom(4, { content: withBluff(cat), length: "normal" });
    await h.act(tv, { type: "START_GAME" });
    const seen: string[] = [];
    await playBluff(h, tv, ps, () => {
      for (const c of [tv, ...ps.map((p) => p.conn)]) {
        for (const m of c.of("state")) seen.push(JSON.stringify(m));
        c.clear();
      }
    });
    for (const item of bluff(h).drawn) expect(pass.some((p) => p.id === item)).toBe(false);
    const all = seen.join("\n");
    for (const it of pass) expect(all.includes(JSON.stringify(it.prompt.original))).toBe(false);
  });
});
