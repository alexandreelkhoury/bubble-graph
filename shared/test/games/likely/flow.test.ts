// GAME-LIKELY §4 state machine, §5 voting rules and §7 edge cases: every transition and every intent error.
import { describe, expect, it } from "vitest";
import { LIKELY_TIMING, likelyAwardsMs, likelyRevealMs, likelyVotingMs } from "../../../src/games/likely/meta";
import { awardsOf, drawnIds, resultTally } from "../../../src/games/likely/engine/reduce";
import type { LikelyState } from "../../../src/games/likely/engine/state";
import { CATALOG, DEF, GRACE, likelyFamilyPack, P, T0, ctx, fail, host, intent, playCard, playTo, roster, settings, startGame, step, tick, tv, vote } from "./helpers";

const CARD_MS = LIKELY_TIMING.CARD_MS;
const cardOf = (s: LikelyState): string => (s.card as { cardId: string }).cardId;
const join = (s: LikelyState, id: string, seat: number, connected = true): LikelyState => {
  const r = DEF.join?.(s, { id, seat, locale: "en", connected, carryScore: 0 });
  if (!r?.ok) throw new Error("join failed");
  DEF.assertInvariants(r.state);
  return r.state;
};
const voteIntent = (s: LikelyState, targetId: string, by = P("p1"), cardId = cardOf(s)) => intent({ type: "VOTE", cardId, targetId }, by);

describe("phases and deadlines (§4.1)", () => {
  it("the first phase is CARD; its deadline is 3 500 + ENTRANCE_GRACE_MS; later cards 3 500", () => {
    const s = startGame(4);
    expect(s.phase).toBe("CARD");
    expect(s.deadline).toBe(T0 + CARD_MS + GRACE);
    expect(DEF.nextWakeAt(s)).toBe(s.deadline);
    const r = playCard(s, {});
    const next = tick(r);
    expect(next.phase).toBe("CARD");
    expect(next.cardIndex).toBe(1);
    expect(next.deadline).toBe((r.deadline as number) + CARD_MS);
  });
  it("VOTING lasts clamp(14 000 + 1 000 n, 18 000, 26 000)", () => {
    expect([3, 4, 5, 8, 12, 20].map(likelyVotingMs)).toEqual([18_000, 18_000, 19_000, 22_000, 26_000, 26_000]);
    const v = tick(startGame(5));
    expect(v.phase).toBe("VOTING");
    expect((v.deadline as number) - (T0 + CARD_MS + GRACE)).toBe(19_000);
  });
  it("REVEAL lasts 7 000 + 150 × votes (+1 200 unanimous, +600 ties), clamped to 8 000–12 000 (owner change, G3 review)", () => {
    expect(likelyRevealMs(0, false, 0)).toBe(8_000);
    expect(likelyRevealMs(3, true, 1)).toBe(8_650);
    expect(likelyRevealMs(8, false, 1)).toBe(8_200);
    expect(likelyRevealMs(12, true, 1)).toBe(10_000);
    expect(likelyRevealMs(12, false, 3)).toBe(9_400);
    expect(likelyRevealMs(50, true, 2)).toBe(12_000);
    // The 12-voter public reveal (run 800 + 1 100, count 600, spot 800, stamp 600, points 800 = 4 700 ms of steps) keeps
    // ≥ 2 s of "defend yourself" hold at every size.
    for (let v = 0; v <= 12; v++) expect(likelyRevealMs(v, false, 1) - (800 + Math.min(2_500, 100 * v) + 600 + 800 + 600 + 800)).toBeGreaterThanOrEqual(2_000);
    const s = tick(startGame(3));
    const now = (s.deadline as number) - 15_000;
    const r = tick(vote(vote(vote(s, "p1", "p2", now), "p2", "p2", now), "p3", "p2", now));
    expect(r.phase).toBe("REVEAL");
    expect(r.deadline).toBe(now + 1_000 + 7_000 + 450 + 1_200);
  });
  it("AWARDS lasts 3 000 + 4 000 × ceil(players / 3) (+4 000 Mind Reader in public mode)", () => {
    expect(likelyAwardsMs(3, true)).toBe(11_000);
    expect(likelyAwardsMs(7, false)).toBe(15_000);
    const a = playTo(startGame(7, { showVoters: false }), {}, "AWARDS");
    expect(a.results).toHaveLength(8);
    const revealEnd = a.deadline as number - likelyAwardsMs(7, false);
    expect(revealEnd).toBeGreaterThan(T0);
    const b = playTo(startGame(4), {}, "AWARDS");
    expect(awardsOf(b)).toHaveLength(4);
  });
  it("TICK before the deadline, unknown AWAY/BACK, and BACK of a connected player return the same object", () => {
    const s = startGame(3);
    expect(step(s, { type: "TICK" }, T0 + 1)).toBe(s);
    expect(step(s, { type: "PLAYER_AWAY", playerId: "zz" }, T0 + 1)).toBe(s);
    expect(step(s, { type: "PLAYER_BACK", playerId: "p1" }, T0 + 1)).toBe(s);
    expect(step(s, { type: "PLAYER_GONE", playerId: "zz", cause: "LEAVE" }, T0 + 1)).toBe(s);
    expect(step(s, { type: "NOPE" } as never, T0 + 1)).toBe(s);
  });
});

describe("voting (§5)", () => {
  it("all connected voters voted → VOTING ends 1 s later; votes change in the window; HOST_ADVANCE is ignored", () => {
    let s = tick(startGame(3));
    const now = (s.deadline as number) - 15_000;
    s = vote(s, "p1", "p2", now);
    s = vote(s, "p2", "p2", now);
    expect(host(s, { type: "HOST_ADVANCE" }, now)).toBe(s);
    s = vote(s, "p3", "p1", now);
    expect(s.deadline).toBe(now + 1_000);
    expect(s.earlyEnd).toBe(true);
    s = vote(s, "p3", "p2", now + 500);   // change inside the window; the deadline stays
    expect(s.deadline).toBe(now + 1_000);
    s = step(s, { type: "TICK" }, now + 1_000);
    expect(s.phase).toBe("REVEAL");
    expect(resultTally(s, s.results[0] as never)).toMatchObject({ unanimous: true, topIds: ["p2"] });
  });
  it("a voter who disconnects abstains, and can complete the quorum; a reconnecting one can still vote", () => {
    let s = tick(startGame(4));
    const now = (s.deadline as number) - 15_000;
    for (const v of ["p1", "p2", "p3"]) s = vote(s, v, "p1", now);
    expect(s.earlyEnd).toBe(false);
    s = step(s, { type: "PLAYER_AWAY", playerId: "p4" }, now + 10);
    expect(s.deadline).toBe(now + 1_010);
    s = step(s, { type: "PLAYER_BACK", playerId: "p4" }, now + 20);
    s = vote(s, "p4", "p4", now + 30);
    s = step(s, { type: "TICK" }, now + 1_010);
    expect(resultTally(s, s.results[0] as never).votesCast).toBe(4);
  });
  it("voting for yourself is allowed; the same vote again returns the same object", () => {
    let s = tick(startGame(3));
    s = vote(s, "p1", "p1", T0 + 7_000);
    expect(DEF.reduce(s, voteIntent(s, "p1"), ctx(T0 + 7_100)).state).toBe(s);
  });
  it("a disconnected player can still be voted for (being away doesn't save you)", () => {
    let s = tick(startGame(4));
    s = step(s, { type: "PLAYER_AWAY", playerId: "p4" }, T0 + 6_100);
    s = vote(s, "p1", "p4", T0 + 6_200);
    expect(s.votes.p1).toBe("p4");
  });
  it("intent errors (each returns the input state)", () => {
    const c = startGame(4);
    const id = cardOf(c);
    expect(fail(c, voteIntent(c, "p2"))).toBe("WRONG_PHASE");
    const v = tick(c);
    expect(fail(v, voteIntent(v, "p2", P("p1"), "zzz-stale"))).toBe("STALE_CARD");
    expect(fail(v, voteIntent(v, "nobody"))).toBe("INVALID_TARGET");
    expect(fail(v, voteIntent(v, "p2", tv))).toBe("NOT_IN_GAME");
    expect(fail(v, voteIntent(v, "p2", P("ghost")))).toBe("NOT_IN_GAME");
    expect(fail(v, intent({ type: "SKIP_CARD", cardId: id }, P("p2")))).toBe("NOT_HOST");
    expect(fail(v, intent({ type: "SKIP_CARD", cardId: "zzz-stale" }, tv))).toBe("STALE_CARD");
    expect(fail(v, intent({ type: "END_GAME" }, tv))).toBe("WRONG_PHASE");
    expect(fail(v, intent({ type: "END_GAME" }, P("p3")))).toBe("NOT_HOST");
    expect(fail(v, intent({ type: "HOST_ADVANCE" }, P("p3")))).toBe("NOT_HOST");
    expect(fail(v, intent({ type: "NOPE" } as never, tv))).toBe("WRONG_PHASE");
    const r = playCard(c, {});
    expect(fail(r, intent({ type: "SKIP_CARD", cardId: id }, tv))).toBe("WRONG_PHASE");
    expect(fail(r, voteIntent(r, "p2", P("p1"), id))).toBe("WRONG_PHASE");
    const res = playTo(c, {}, "RESULTS");
    expect(fail(res, intent({ type: "HOST_ADVANCE" }, tv))).toBe("WRONG_PHASE");
  });
  it("the VIP phone is a host (ctx.isHost); HOST_ADVANCE expires CARD, REVEAL and AWARDS inline", () => {
    const c = startGame(3);
    const v = step(c, intent({ type: "HOST_ADVANCE" }, P("p1")), T0 + 100);
    expect(v.phase).toBe("VOTING");
    expect(v.deadline).toBe(T0 + 100 + likelyVotingMs(3));
    const r = playCard(c, {});
    const next = host(r, { type: "HOST_ADVANCE" }, (r.deadline as number) - 5_000);
    expect(next.phase).toBe("CARD");
    const aw = playTo(c, {}, "AWARDS");
    expect(host(aw, { type: "HOST_ADVANCE" }, (aw.deadline as number) - 9_000).phase).toBe("RESULTS");
  });
});

describe("skips, HOLD, joins, leaves (§7)", () => {
  it("SKIP_CARD: a new card, votes discarded, counter unchanged, the skipped card in memory", () => {
    let s = tick(startGame(4));
    const first = cardOf(s);
    s = vote(s, "p1", "p2", T0 + 7_000);
    s = host(s, { type: "SKIP_CARD", cardId: first }, T0 + 7_100);
    expect(s.phase).toBe("CARD");
    expect(cardOf(s)).not.toBe(first);
    expect(s.votes).toEqual({});
    expect(s.cardIndex).toBe(0);
    expect(s.deadline).toBe(T0 + 7_100 + CARD_MS);
    expect(DEF.memory(s).usedKeys).toContain(first);
    // Skips are unlimited, from CARD too.
    for (let i = 0; i < 50; i++) s = host(s, { type: "SKIP_CARD", cardId: cardOf(s) }, T0 + 8_000 + i);
    expect(s.cardIndex).toBe(0);
    expect(new Set(s.memoryKeys).size).toBe(s.memoryKeys.length);
    expect(s.drawnCount).toBe(drawnIds(s).length);
  });
  it("plays a whole public game to RESULTS: points, Mind Reader, Tonight's Star, outcome", () => {
    let s = startGame(3);
    const before = playTo(s, { p1: "p2", p2: "p2", p3: "p1" }, "AWARDS");
    expect(DEF.outcome(before)).toBeNull();
    s = tick(before);
    expect(s.phase).toBe("RESULTS");
    expect(s.deadline).toBeNull();
    expect(DEF.nextWakeAt(s)).toBeNull();
    // p1 and p2 agree on every card: +50 × 8; p3 never agrees.
    expect(DEF.outcome(s)).toEqual({ points: { p1: 400, p2: 400, p3: 0 }, ranking: [["p1", "p2"]] });
    expect(awardsOf(s).find((a) => a.kind === "mindReader")?.playerIds).toEqual(["p1", "p2"]);
    expect(awardsOf(s).find((a) => a.kind === "star")?.playerIds).toEqual(["p2"]);
    expect(tick(s)).toBe(s);
  });
  it("secret votes: no points at all, outcome all 0 and no ranking, no Self-aware or Mind Reader", () => {
    const s = playTo(startGame(3, { showVoters: false }), { p1: "p1", p2: "p1", p3: "p1" }, "RESULTS");
    expect(DEF.outcome(s)).toEqual({ points: { p1: 0, p2: 0, p3: 0 }, ranking: [] });
    expect(awardsOf(s).some((a) => a.kind === "mindReader" || a.kind === "selfAware")).toBe(false);
    expect(awardsOf(s).find((a) => a.kind === "signature")?.playerIds).toEqual(["p1"]);
  });
  it("nobody votes: no award, no points; everyone gets the Mystery Award", () => {
    const s = playTo(startGame(3), {}, "AWARDS");
    expect(awardsOf(s).map((a) => a.kind)).toEqual(["mystery", "mystery", "mystery"]);
  });
  it("HOLD when < 3 connected at card start; resumes at 3; END_GAME → AWARDS", () => {
    let s = startGame(3);
    s = step(s, { type: "PLAYER_AWAY", playerId: "p3" }, T0 + 10);
    s = playCard(s, { p1: "p2", p2: "p1" });
    s = tick(s);
    expect(s.phase).toBe("HOLD");
    expect(s.card).toBeNull();
    expect(DEF.nextWakeAt(s)).toBeNull();
    expect(step(s, { type: "TICK" }, T0 + 80_000)).toBe(s);
    expect(fail(s, intent({ type: "HOST_ADVANCE" }, tv))).toBe("WRONG_PHASE");
    const back = step(s, { type: "PLAYER_BACK", playerId: "p3" }, T0 + 90_000);
    expect(back.phase).toBe("CARD");
    expect(back.cardIndex).toBe(1);
    expect(back.deadline).toBe(T0 + 90_000 + CARD_MS);
    const ended = host(s, { type: "END_GAME" }, T0 + 90_000);
    expect(ended.phase).toBe("AWARDS");
    expect(awardsOf(ended).filter((a) => a.kind === "signature" || a.kind === "mystery")).toHaveLength(3);
    expect(ended.deadline).toBe(T0 + 90_000 + likelyAwardsMs(3, true));
  });
  it("start with a disconnected roster entry: it is dealt in, abstains, and counts for the HOLD quorum", () => {
    const r = roster(4);
    (r[3] as { connected: boolean }).connected = false;
    const st = DEF.start({ roster: r, settings: settings(), locale: "en", memory: { usedKeys: [] }, seed: 4, now: T0, graceMs: GRACE, content: CATALOG });
    if (!st.ok) throw new Error(st.error);
    expect(st.state.players.map((p) => p.connected)).toEqual([true, true, true, false]);
    let s = tick(st.state);
    expect(DEF.projectStatus(s).awaitedIds).toEqual(["p1", "p2", "p3"]);
    s = vote(s, "p1", "p4", T0 + 7_000);   // an absent player can be picked
    s = step(s, { type: "PLAYER_AWAY", playerId: "p3" }, T0 + 7_100);
    s = tick(tick(s));
    expect(s.phase).toBe("HOLD");
  });
  it("late joiner: waits until the next CARD, then votes and can be voted for; 'New' ribbon on their first card", () => {
    let s = tick(startGame(3));
    s = join(s, "p9", 9);
    expect(DEF.projectMe(s, "p9", undefined as never)).toEqual({ myVote: null, waitingForNext: true });
    expect(DEF.reduce(s, voteIntent(s, "p1", P("p9")), ctx(T0 + 7_000))).toMatchObject({ ok: false, error: "WRONG_PHASE" });
    expect(DEF.reduce(s, voteIntent(s, "p9"), ctx(T0 + 7_000))).toMatchObject({ ok: false, error: "INVALID_TARGET" });
    expect(DEF.projectStatus(s).awaitedIds).toEqual(["p1", "p2", "p3"]);
    const now = (s.deadline as number) - 15_000;
    for (const v of ["p1", "p2", "p3"]) s = vote(s, v, "p1", now);
    expect(s.earlyEnd).toBe(true);   // the quorum does not wait for the newcomer
    s = tick(tick(s));
    expect(s.phase).toBe("CARD");
    expect(DEF.projectMe(s, "p9", undefined as never)?.waitingForNext).toBe(false);
    expect(DEF.projectPublic(s, undefined as never).newIds).toEqual(["p9"]);
    s = playCard(s, { p9: "p9", p1: "p9" });
    expect(resultTally(s, s.results[1] as never).topIds).toEqual(["p9"]);
    expect(DEF.projectPublic(s, undefined as never).newIds).toEqual(["p9"]);   // the ribbon lasts through their first card
    expect(DEF.projectPublic(tick(s), undefined as never).newIds).toEqual([]);
    expect(DEF.join?.(s, { id: "p9", seat: 9, locale: "en", connected: true, carryScore: 0 }).state).toBe(s);
  });
  it("a join that completes a HOLD quorum wakes the game at once (nextWakeAt 0)", () => {
    let s = startGame(3);
    s = step(s, { type: "PLAYER_GONE", playerId: "p3", cause: "LEAVE" }, T0 + 10);
    s = tick(playCard(s, {}));
    expect(s.phase).toBe("HOLD");
    s = join(s, "p4", 4);
    expect(DEF.nextWakeAt(s)).toBe(0);
    s = step(s, { type: "TICK" }, T0 + 99_000);
    expect(s.phase).toBe("CARD");
    expect(DEF.projectMe(s, "p4", undefined as never)?.waitingForNext).toBe(false);
  });
  it("GAME_FULL beyond 12 non-left players; a left player cannot come back", () => {
    let s = startGame(12, {}, {});
    expect(DEF.join?.(s, { id: "p13", seat: 13, locale: "en", connected: true, carryScore: 0 })).toMatchObject({ ok: false, error: "GAME_FULL" });
    s = step(s, { type: "PLAYER_GONE", playerId: "p12", cause: "KICK" }, T0 + 1);
    expect(DEF.join?.(s, { id: "p12", seat: 11, locale: "en", connected: true, carryScore: 0 })).toMatchObject({ ok: false, error: "NOT_IN_GAME" });
    expect(DEF.join?.(s, { id: "p13", seat: 13, locale: "en", connected: true, carryScore: 0 }).ok).toBe(true);
  });
  it("a left player: no longer a target; votes already on them stay; their own vote stays", () => {
    let s = tick(startGame(4));
    const now = (s.deadline as number) - 15_000;
    s = vote(s, "p1", "p4", now);
    s = vote(s, "p4", "p2", now);
    s = step(s, { type: "PLAYER_GONE", playerId: "p4", cause: "KICK" }, now + 1);
    expect(s.votes).toEqual({ p1: "p4", p4: "p2" });   // dropping p1's vote would show who had picked p4
    expect(DEF.reduce(s, voteIntent(s, "p4", P("p2")), ctx(now + 2))).toMatchObject({ ok: false, error: "INVALID_TARGET" });
    expect(DEF.reduce(s, voteIntent(s, "p1", P("p4")), ctx(now + 2))).toMatchObject({ ok: false, error: "NOT_IN_GAME" });
    s = vote(s, "p2", "p2", now + 3);
    s = vote(s, "p3", "p2", now + 3);
    s = tick(s);
    expect(resultTally(s, s.results[0] as never)).toMatchObject({ votesCast: 4, topIds: ["p2"] });
    expect(step(s, { type: "PLAYER_GONE", playerId: "p4", cause: "LEAVE" }, now + 5)).toBe(s);
    // From the next card on, p4 is not a target.
    s = tick(tick(s));
    expect(DEF.reduce(s, voteIntent(s, "p4"), ctx((s.deadline as number) - 1))).toMatchObject({ ok: false, error: "INVALID_TARGET" });
    const end = playTo(s, { p1: "p2", p2: "p2" }, "RESULTS");
    expect(DEF.outcome(end)?.points.p4).toBe(0);
    expect(awardsOf(end).some((a) => a.playerIds.includes("p4") && a.kind === "signature")).toBe(false);
    expect(awardsOf(end).find((a) => a.playerIds[0] === "p4")?.kind).toBe("mystery");
  });
  it("Spicy named card: the named player is not a target but votes; away keeps the card; leaving voids it", () => {
    let s = startGame(5, { mode: "spicy", showVoters: false }, { seed: 3 });
    for (let guard = 0; !(s.phase === "CARD" && s.card?.namedPlayerId); guard++) {
      if (guard > 200 || s.phase === "AWARDS") throw new Error("no named card drawn");
      s = s.phase === "CARD" ? playCard(s, {}) : tick(s);
    }
    const named = s.card?.namedPlayerId as string;
    const voter = (s.players.find((p) => p.id !== named) as { id: string }).id;
    const away = step(s, { type: "PLAYER_AWAY", playerId: named }, (s.deadline as number) - 100);
    expect(away.card).toEqual(s.card);
    const v = tick(s);
    expect(DEF.reduce(v, voteIntent(v, named, P(voter)), ctx((v.deadline as number) - 9_000))).toMatchObject({ ok: false, error: "INVALID_TARGET" });
    const v2 = vote(v, named, voter, (v.deadline as number) - 9_000);
    const gone = step(v2, { type: "PLAYER_GONE", playerId: named, cause: "LEAVE" }, (v.deadline as number) - 8_000);
    expect(gone.phase).toBe("CARD");
    expect(cardOf(gone)).not.toBe(cardOf(v));
    expect(gone.votes).toEqual({});
    expect(gone.cardIndex).toBe(v.cardIndex);
    expect(gone.card?.namedPlayerId).toBeNull();   // the next card cannot be named right after (spacing counts revealed cards)
  });
  it("start fails cleanly", () => {
    expect(DEF.start({ roster: roster(2), settings: settings(), locale: "en", memory: { usedKeys: [] }, seed: 1, now: T0, graceMs: GRACE, content: { packs: [] } })).toMatchObject({ ok: false, error: "NOT_ENOUGH_PLAYERS" });
    expect(DEF.start({ roster: roster(3), settings: settings(), locale: "en", memory: { usedKeys: [] }, seed: 1, now: T0, graceMs: GRACE, content: { packs: [] } })).toMatchObject({ ok: false, error: "NO_CONTENT_AVAILABLE" });
  });
  it("memory: the playable history keys + every drawn card, oldest dropped beyond 300; readable in any phase", () => {
    const big = { packs: [likelyFamilyPack({ n: 320 })] };
    const ids = (big.packs[0] as { cards: { id: string }[] }).cards.map((c) => c.id);
    const old = [...ids.slice(0, 300), "gone-pack-key"];
    const s = startGame(3, {}, { usedKeys: old, content: big });
    expect(s.memoryKeys).not.toContain("gone-pack-key");   // a key this room cannot draw is not carried
    const m = DEF.memory(s).usedKeys;
    expect(m).toHaveLength(300);
    expect(m[m.length - 1]).toBe(cardOf(s));
    expect(m[0]).toBe(ids[1]);
    expect(ids.slice(0, 300)).not.toContain(cardOf(s));   // fresh cards first
    const end = playTo(startGame(3), {}, "RESULTS");
    expect(DEF.memory(end).usedKeys.slice(-8)).toEqual(end.results.map((r) => r.cardId));
  });
  it("is deterministic: same seed and actions → equal states", () => {
    const run = (): string => JSON.stringify(playTo(startGame(5, {}, { seed: 99 }), { p1: "p3", p2: "p3" }, "RESULTS"));
    expect(run()).toBe(run());
  });
  it("the TV actor is always host; another player is not", () => {
    const s = startGame(3);
    expect(fail(s, intent({ type: "SKIP_CARD", cardId: cardOf(s) }, P("p2")), T0, "p1")).toBe("NOT_HOST");
    expect(DEF.reduce(s, intent({ type: "SKIP_CARD", cardId: cardOf(s) }, P("p2")), ctx(T0, undefined, "p2")).ok).toBe(true);
  });
});

describe("secret votes: the voter→target mapping never outlives REVEAL (G3 review, defence in depth)", () => {
  it("after REVEAL the card keeps its tally, but its picks are re-dealt in entry order; public mode keeps real ballots", () => {
    const ballots = { p1: "p3", p2: "p1", p3: "p3", p4: "p2" };
    const secret = playCard(startGame(5, { showVoters: false }), ballots);
    expect(secret.phase).toBe("REVEAL");
    const live = secret.results[0]?.picks;
    expect(live).toEqual([2, 0, 2, 1, -1]);
    const next = tick(secret);
    expect(next.phase).toBe("CARD");
    expect(next.results[0]?.picks).toEqual([0, 1, 2, 2, -1]);
    expect(resultTally(next, next.results[0] as never)).toEqual(resultTally(secret, secret.results[0] as never));
    // Host Next out of REVEAL seals too, and the last card's seal happens on the way to AWARDS.
    const viaNext = host(secret, { type: "HOST_ADVANCE" }, (secret.deadline as number) - 1);
    expect(viaNext.results[0]?.picks).toEqual([0, 1, 2, 2, -1]);
    const end = playTo(startGame(4, { showVoters: false }), { p1: "p4", p2: "p1", p3: "p4", p4: "p3" }, "AWARDS");
    for (const r of end.results) expect(r.picks).toEqual([0, 2, 3, 3]);
    const pub = tick(playCard(startGame(5), ballots));
    expect(pub.results[0]?.picks).toEqual([2, 0, 2, 1, -1]);
  });
  it("anonymity is frozen per instance: no game action ever changes the instance's showVoters", () => {
    let s = startGame(4, { showVoters: false });
    s = playTo(s, { p1: "p2", p2: "p2", p3: "p1", p4: "p2" }, "RESULTS");
    expect(s.settings.showVoters).toBe(false);
    expect(s.results.every((r) => r.picks.join() === [...r.picks].sort((a, b) => a - b).join())).toBe(true);
  });
});
