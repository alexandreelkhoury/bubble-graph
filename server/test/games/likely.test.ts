// JAMAA-PLATFORM §2.8 "Server (A)" for G3 Most Likely: RoomCore with fakes over the real protocol v2. A full session
// hub → likely → RESULTS → REPLAY in secret mode, with per-socket secrecy of every frame (GAME-LIKELY §8.1: who voted
// for whom never before REVEAL, never in secret mode, another phone's vote never in a `me`); Likely error frames
// (non-fatal, sender only); WRONG_GAME; a benched late joiner admitted through `join`; GAMES_ENABLED and TV capability
// gates; the alarm drives Likely deadlines; a free room never draws a Pass card; Spicy is refused on the wire.
import { describe, expect, it } from "vitest";
import type { ContentCatalog } from "@jamaa/shared/content";
import { contentCatalog } from "@jamaa/shared/content";
import { GAME_META } from "@jamaa/shared/games/meta";
import { GAMES } from "@jamaa/shared/games/registry";
import { MSG_MAX_BYTES, RATE_BURST } from "@jamaa/shared/constants";
import { ServerMessageV2Schema } from "@jamaa/shared/protocol/v2";
import type { RoomIntentMsg } from "@jamaa/shared/protocol/v2";
import { TEST_CATALOG } from "@jamaa/shared/testing";
import { createRng } from "@jamaa/shared/engine";
// JAMAA-GAP (G3): shared/package.json exports no `./testing/*` or games/<id>/engine entry (P files): relative imports.
import type { LikelyCatalog } from "../../../shared/src/games/likely/engine/catalog";
import type { LikelyState } from "../../../shared/src/games/likely/engine/state";
import { likelyNextIntent } from "../../../shared/src/testing/bots/likely";
import { likelyTokenCatalog } from "../../../shared/src/testing/catalogs/likely";
import { Harness } from "../support/fakes";
import type { FakeConn } from "../support/fakes";

const LIKELY_ON = ["mishana", "likely"] as const;
const withLikely = (cat: LikelyCatalog = likelyTokenCatalog()): ContentCatalog => ({ ...contentCatalog(TEST_CATALOG), likely: cat }) as unknown as ContentCatalog;

type P = { conn: FakeConn; pid: string; token: string };
const likely = (h: Harness): LikelyState => {
  const g = h.room.game;
  if (!g || g.id !== "likely") throw new Error(`no Likely instance (room phase ${h.room.phase})`);
  return g.state as LikelyState;
};
const gameAct = (h: Harness, c: FakeConn, i: Record<string, unknown>): Promise<void> => h.act(c, { type: "GAME", gameId: "likely", i } as RoomIntentMsg);

async function likelyRoom(n: number, opts: { content?: ContentCatalog; length?: "short" | "normal" | "long"; showVoters?: boolean } = {}): Promise<{ h: Harness; tv: FakeConn; ps: P[] }> {
  const h = await new Harness({ enabledGames: [...LIKELY_ON], content: opts.content ?? withLikely() }).init();
  const tv = await h.tv();
  const ps: P[] = [];
  for (let i = 0; i < n; i++) ps.push(await h.player(i));
  await h.open(tv, "likely");
  await h.act(tv, { type: "UPDATE_GAME_SETTINGS", gameId: "likely", patch: { length: opts.length ?? "short", showVoters: opts.showVoters ?? true } } as RoomIntentMsg);
  return { h, tv, ps };
}

/** Plays the Likely instance to RESULTS over the sockets (bot votes, host moves, alarms); `onStep` after every move. */
async function playLikely(h: Harness, tv: FakeConn, ps: P[], seed = 1, onStep?: () => void): Promise<void> {
  const rng = createRng(seed);
  for (let i = 0; i < 1_000; i++) {
    const s = likely(h);
    if (s.phase === "RESULTS") return;
    const n = rng.next() < 0.85 ? likelyNextIntent(s, rng, h.room.hostPlayerId) : null;
    if (n === null || (n.intent.type !== "VOTE" && rng.next() < 0.5)) {
      h.advance(Math.max(0, (s.deadline ?? h.now) - h.now));
      await h.core.onAlarm();
    } else {
      const c = n.by.kind === "tv" ? tv : ps.find((p) => n.by.kind === "player" && p.pid === n.by.playerId)?.conn;
      if (!c) throw new Error("no socket for the bot's actor");
      await gameAct(h, c, n.intent as unknown as Record<string, unknown>);
    }
    onStep?.();
  }
  throw new Error(`Likely did not reach RESULTS (phase ${likely(h).phase})`);
}

/** GAME-LIKELY §8.1 on one raw frame for one socket (TV: viewer null). */
function frameLeaks(s: LikelyState, m: Record<string, unknown>, viewer: string | null): string[] {
  const out: string[] = [];
  const view = m.view as { game: { gameId: string; phase: string; public: Record<string, unknown>; me: { myVote: string | null } | null } | null };
  const g = view.game;
  if (!g || g.gameId !== "likely") return out;
  const pub = JSON.stringify(g.public);
  const anon = !s.settings.showVoters;
  if ((anon || g.phase !== "REVEAL") && /"(voterId|targetId)"/.test(pub)) out.push(`voter→target in ${g.phase}${anon ? " (secret mode)" : ""}`);
  if (anon && /"score":[1-9]|"reason"|"mindReader"|"selfAware"/.test(pub)) out.push("points in secret mode");
  if (viewer === null && g.me !== null) out.push("TV frame with a `me`");
  if (viewer !== null && g.me && g.me.myVote !== null) {
    const own = s.phase === "VOTING" ? s.votes[viewer] : undefined;
    if (g.phase === "VOTING" && own !== undefined && g.me.myVote !== own) out.push("me.myVote is not the viewer's own vote");
  }
  return out;
}

describe("Most Likely over protocol v2 (RoomCore + fakes)", () => {
  it("hub → likely → RESULTS → REPLAY with secret votes: every frame valid and leak-free for every socket", async () => {
    const { h, tv, ps } = await likelyRoom(5);
    await h.act(tv, { type: "START_GAME" });
    expect(likely(h).phase).toBe("CARD");
    const socks: [FakeConn, string | null][] = [[tv, null], ...ps.map((p): [FakeConn, string | null] => [p.conn, p.pid])];
    const errs: string[] = [];
    const check = (): void => {
      const s = likely(h);
      for (const [c, viewer] of socks) {
        for (const m of c.of("state")) {
          const parsed = ServerMessageV2Schema.safeParse(m);
          if (!parsed.success) errs.push(`${c.label}: invalid frame ${JSON.stringify(parsed.error.issues.slice(0, 2))}`);
          for (const e of frameLeaks(s, m, viewer)) errs.push(`${c.label} @${s.phase}: ${e}`);
        }
        c.clear();
      }
    };
    for (const [c] of socks) c.clear();
    await playLikely(h, tv, ps, 1, check);
    expect(errs).toEqual([]);
    expect(h.room.cup.last?.gameId).toBe("likely");
    expect(h.history.memory.likely?.usedKeys.length).toBeGreaterThanOrEqual(8);
    // REPLAY in secret mode: no points, so no stars from this instance.
    await h.act(tv, { type: "BACK_TO_SETUP" });
    await h.act(tv, { type: "UPDATE_GAME_SETTINGS", gameId: "likely", patch: { showVoters: false } } as RoomIntentMsg);
    const stars = JSON.stringify(h.room.cup.stars);
    await h.act(tv, { type: "START_GAME" });
    for (const [c] of socks) c.clear();
    await playLikely(h, tv, ps, 2, check);
    expect(errs).toEqual([]);
    expect(h.room.cup.last?.ranking).toEqual([]);
    expect(JSON.stringify(h.room.cup.stars)).toBe(stars);
  });

  it("Likely errors are non-fatal frames to the sender only; WRONG_GAME and BAD_MESSAGE before the engine", async () => {
    const { h, tv, ps } = await likelyRoom(3);
    await h.act(tv, { type: "START_GAME" });
    const [a, b] = ps as [P, P];
    const cardId = likely(h).card?.cardId as string;
    await gameAct(h, a.conn, { type: "VOTE", cardId, targetId: b.pid });
    expect(a.conn.errors().at(-1)).toBe("WRONG_PHASE");   // votes open after the reading time
    await gameAct(h, tv, { type: "HOST_ADVANCE" });
    expect(likely(h).phase).toBe("VOTING");
    b.conn.clear();
    tv.clear();
    await gameAct(h, a.conn, { type: "VOTE", cardId: "zz-stale-card", targetId: b.pid });
    expect(a.conn.errors().at(-1)).toBe("STALE_CARD");
    expect(a.conn.last("error")).toMatchObject({ messageKey: "error.staleCard" });
    expect(a.conn.closeCode).toBeNull();
    await gameAct(h, a.conn, { type: "VOTE", cardId, targetId: "p_nobody" });
    expect(a.conn.errors().at(-1)).toBe("INVALID_TARGET");
    expect(b.conn.errors()).toEqual([]);
    expect(tv.errors()).toEqual([]);
    await gameAct(h, b.conn, { type: "SKIP_CARD", cardId });
    expect(b.conn.errors().at(-1)).toBe("NOT_HOST");
    await h.act(a.conn, { type: "GAME", gameId: "mishana", i: { type: "READY" } } as RoomIntentMsg);
    expect(a.conn.errors().at(-1)).toBe("WRONG_GAME");
    await gameAct(h, a.conn, { type: "VOTE", cardId: "NOT A CARD", targetId: b.pid });
    expect(a.conn.errors().at(-1)).toBe("BAD_MESSAGE");
    // The VIP phone skips like the TV.
    await gameAct(h, a.conn, { type: "SKIP_CARD", cardId });
    expect(likely(h).card?.cardId).not.toBe(cardId);
  });

  it("a voter's own vote reaches only their own phone before REVEAL", async () => {
    const { h, tv, ps } = await likelyRoom(4);
    await h.act(tv, { type: "START_GAME" });
    await gameAct(h, tv, { type: "HOST_ADVANCE" });
    const [a, b, c] = ps as [P, P, P];
    for (const x of [tv, a.conn, b.conn, c.conn]) x.clear();
    await gameAct(h, a.conn, { type: "VOTE", cardId: likely(h).card?.cardId as string, targetId: c.pid });
    const mine = a.conn.lastView().game as { me: { myVote: string | null } };
    expect(mine.me.myVote).toBe(c.pid);
    for (const other of [tv, b.conn, c.conn]) {
      const raw = JSON.stringify(other.of("state"));
      expect(raw.includes(`"myVote":"${c.pid}"`)).toBe(false);
      expect(raw).not.toMatch(/"targetId"/);
      expect((other.lastView().game as { public: { votedIds: string[] } }).public.votedIds).toEqual([a.pid]);
    }
  });

  it("a player who joins mid-game is benched, enters through `join`, and waits for the next CARD", async () => {
    const { h, tv, ps } = await likelyRoom(3);
    await h.act(tv, { type: "START_GAME" });
    await gameAct(h, tv, { type: "HOST_ADVANCE" });
    const late = await h.player(7);
    expect(h.room.members.find((m) => m.id === late.pid)?.benched).toBe(false);
    expect((late.conn.lastView().game as { me: { waitingForNext: boolean } | null }).me?.waitingForNext).toBe(true);
    await gameAct(h, late.conn, { type: "VOTE", cardId: likely(h).card?.cardId as string, targetId: late.pid });
    expect(late.conn.errors().at(-1)).toBe("WRONG_PHASE");
    await playLikely(h, tv, [...ps, late], 3);
    expect(likely(h).players.find((p) => p.id === late.pid)?.waiting).toBe(false);
  });

  it("the alarm drives Likely deadlines (the first CARD includes the entrance grace)", async () => {
    const { h, tv } = await likelyRoom(3);
    await h.act(tv, { type: "START_GAME" });
    const s = likely(h);
    expect(s.deadline).toBe(h.now + 3_500 + 2_500);
    expect(h.storage.alarm).toBe(s.deadline);
    h.advance(6_000);
    await h.core.onAlarm();
    expect(likely(h).phase).toBe("VOTING");
    expect(h.storage.alarm).toBe(likely(h).deadline);
  });

  it("GAMES_ENABLED without likely → GAME_UNAVAILABLE (registry-enabled since G3); a TV without likely → GAME_UNAVAILABLE", async () => {
    expect(GAMES.likely.enabled).toBe(true);
    const off = await new Harness({ enabledGames: ["mishana"], content: withLikely() }).init();
    const tv1 = await off.tv();
    expect((tv1.lastView().room as { games: { id: string }[] }).games.map((g) => g.id)).not.toContain("likely");
    await off.open(tv1, "likely");
    expect(tv1.errors().at(-1)).toBe("GAME_UNAVAILABLE");
    const h = await new Harness({ enabledGames: [...LIKELY_ON], content: withLikely() }).init();
    const tv2 = await h.tv([{ id: "mishana", v: GAME_META.mishana.VIEW_VERSION }]);
    await h.open(tv2, "likely");
    expect(tv2.errors().at(-1)).toBe("GAME_UNAVAILABLE");
    const h3 = await new Harness({ enabledGames: [...LIKELY_ON], content: withLikely() }).init();
    const tv3 = await h3.tv([{ id: "mishana", v: GAME_META.mishana.VIEW_VERSION }, { id: "likely", v: GAME_META.likely.VIEW_VERSION + 1 }]);
    await h3.open(tv3, "likely");
    expect(tv3.errors().at(-1)).toBe("GAME_UNAVAILABLE");
  });

  it("Spicy is refused on the wire (compiled out until settings.apply gets the actor)", async () => {
    const { h, tv } = await likelyRoom(4);
    await h.act(tv, { type: "UPDATE_GAME_SETTINGS", gameId: "likely", patch: { mode: "spicy", ageConfirmed: true } } as RoomIntentMsg);
    expect(tv.errors().at(-1)).toBe("INVALID_SETTINGS");
    expect(h.room.gameSettings.likely.mode).toBe("family");
  });

  it("a free room never draws a Pass card and never sends one to a client", async () => {
    const cat = likelyTokenCatalog();
    const pass = cat.packs.flatMap((p) => p.cards.filter((c) => c.tier === "pass"));
    const { h, tv, ps } = await likelyRoom(4, { content: withLikely(cat), length: "normal" });
    await h.act(tv, { type: "START_GAME" });
    const seen: string[] = [];
    await playLikely(h, tv, ps, 4, () => {
      for (const c of [tv, ...ps.map((p) => p.conn)]) {
        for (const m of c.of("state")) seen.push(JSON.stringify(m));
        c.clear();
      }
    });
    for (const r of likely(h).results) expect(pass.some((p) => p.id === r.cardId)).toBe(false);
    const all = seen.join("\n");
    for (const c of pass) expect(all.includes(JSON.stringify(c.prompt.en))).toBe(false);
  });
  // G3 review: wire behaviours the live run checked by hand.
  it("a VOTE flood → RATE_LIMITED (sender only), 3 strikes → close 4008; the phone resumes its seat", async () => {
    const { h, tv, ps } = await likelyRoom(3);
    await h.act(tv, { type: "START_GAME" });
    await gameAct(h, tv, { type: "HOST_ADVANCE" });
    const [a, b] = ps as [P, P];
    const cardId = likely(h).card?.cardId as string;
    for (const x of [tv, a.conn, b.conn]) x.clear();
    const frame = (t: string): string => JSON.stringify({ v: 2, t: "action", a: { type: "GAME", gameId: "likely", i: { type: "VOTE", cardId, targetId: t } } });
    for (let i = 0; i < RATE_BURST + 3 && a.conn.open; i++) await h.send(a.conn, frame(i % 2 === 0 ? b.pid : a.pid), 0);
    expect(a.conn.errors()).toEqual(["RATE_LIMITED", "RATE_LIMITED", "RATE_LIMITED"]);
    expect(a.conn.closeCode).toBe(4008);
    expect(tv.errors()).toEqual([]);
    expect(b.conn.errors()).toEqual([]);
    // The vote that got through is still the phone's own, and the seat comes back with the resume token.
    expect(likely(h).votes[a.pid]).toBeDefined();
    const back = await h.resume(a.token);
    expect(back.errors()).toEqual([]);
    expect((back.lastView().game as { me: { myVote: string | null } }).me.myVote).toBe(likely(h).votes[a.pid]);
  });

  it("an oversized Likely frame → BAD_MESSAGE to the sender only, socket open, state untouched", async () => {
    const { h, tv, ps } = await likelyRoom(3);
    await h.act(tv, { type: "START_GAME" });
    await gameAct(h, tv, { type: "HOST_ADVANCE" });
    const [a, b] = ps as [P, P];
    const before = JSON.stringify(likely(h));
    for (const x of [tv, a.conn, b.conn]) x.clear();
    const big = JSON.stringify({ v: 2, t: "action", a: { type: "GAME", gameId: "likely", i: { type: "VOTE", cardId: likely(h).card?.cardId, targetId: "x".repeat(5_000) } } });
    expect(new TextEncoder().encode(big).length).toBeGreaterThan(MSG_MAX_BYTES);
    await h.send(a.conn, big);
    expect(a.conn.errors()).toEqual(["BAD_MESSAGE"]);
    expect(a.conn.open).toBe(true);
    expect(tv.errors()).toEqual([]);
    expect(b.conn.errors()).toEqual([]);
    expect(tv.of("state")).toEqual([]);
    expect(JSON.stringify(likely(h))).toBe(before);
  });

  it("every Likely error frame goes to its sender only (no other phone, no TV, no spectator)", async () => {
    const { h, tv, ps } = await likelyRoom(4);
    const spec = await h.spectator({ label: "spectator" });
    await h.act(tv, { type: "START_GAME" });
    const [a, b, c] = ps as [P, P, P];
    const cardId = likely(h).card?.cardId as string;
    const all = [tv, spec, ...ps.map((p) => p.conn)];
    for (const x of all) x.clear();
    await gameAct(h, a.conn, { type: "VOTE", cardId, targetId: b.pid });            // WRONG_PHASE (CARD)
    await gameAct(h, tv, { type: "HOST_ADVANCE" });
    await gameAct(h, a.conn, { type: "VOTE", cardId: "zz-stale", targetId: b.pid }); // STALE_CARD
    await gameAct(h, a.conn, { type: "VOTE", cardId, targetId: "p_nobody" });       // INVALID_TARGET
    await gameAct(h, b.conn, { type: "HOST_ADVANCE" });                             // NOT_HOST
    await gameAct(h, tv, { type: "VOTE", cardId, targetId: b.pid });                 // NOT_IN_GAME
    await gameAct(h, spec, { type: "VOTE", cardId, targetId: b.pid });               // NOT_AUTHENTICATED
    expect(a.conn.errors()).toEqual(["WRONG_PHASE", "STALE_CARD", "INVALID_TARGET"]);
    expect(b.conn.errors()).toEqual(["NOT_HOST"]);
    expect(tv.errors()).toEqual(["NOT_IN_GAME"]);
    expect(spec.errors()).toEqual(["NOT_AUTHENTICATED"]);
    expect(c.conn.errors()).toEqual([]);
    for (const x of all) expect(x.closeCode).toBeNull();
  });

  it("settings cannot change mid-game (WRONG_PHASE): a secret game stays secret in every later frame", async () => {
    const { h, tv, ps } = await likelyRoom(4, { showVoters: false });
    await h.act(tv, { type: "START_GAME" });
    const [a] = ps as [P];
    await h.act(tv, { type: "UPDATE_GAME_SETTINGS", gameId: "likely", patch: { showVoters: true } } as RoomIntentMsg);
    expect(tv.errors().at(-1)).toBe("WRONG_PHASE");
    await h.act(a.conn, { type: "UPDATE_GAME_SETTINGS", gameId: "likely", patch: { showVoters: true } } as RoomIntentMsg);
    expect(a.conn.errors().at(-1)).toBe("WRONG_PHASE");
    expect(likely(h).settings.showVoters).toBe(false);
    const socks: [FakeConn, string | null][] = [[tv, null], ...ps.map((p): [FakeConn, string | null] => [p.conn, p.pid])];
    const errs: string[] = [];
    for (const [c] of socks) c.clear();
    await playLikely(h, tv, ps, 5, () => {
      const s = likely(h);
      for (const [c, viewer] of socks) {
        for (const m of c.of("state")) for (const e of frameLeaks(s, m, viewer)) errs.push(`${c.label} @${s.phase}: ${e}`);
        c.clear();
      }
    });
    expect(errs).toEqual([]);
    // Defence in depth: past secret cards keep their tallies but not who voted for whom.
    for (const r of likely(h).results) {
      const picks = r.picks.filter((t) => t >= 0);
      expect(picks).toEqual([...picks].sort((x, y) => x - y));
    }
  });
});
