// GAME-LIKELY §8.1 secrecy and §13.2 views: what each phase shows, and that the leak oracles catch every forbidden shape.
import { describe, expect, it } from "vitest";
import { LikelyMeSchema, LikelyPublicSchema } from "../../../src/games/likely/protocol";
import type { LikelyPublic, LikelyState } from "../../../src/games/likely/engine/state";
import { findLikelyLeaks } from "../../../src/testing/bots/likely";
import { CATALOG, DEF, T0, playCard, playTo, startGame, tick, vote } from "./helpers";

const pub = (s: LikelyState): LikelyPublic => DEF.projectPublic(s, CATALOG);
const env = (p: unknown, me: unknown = null) => ({ game: { gameId: "likely", public: p, me } });
const clean = (s: LikelyState): void => {
  expect(LikelyPublicSchema.safeParse(pub(s)).success).toBe(true);
  for (const p of s.players) {
    const me = DEF.projectMe(s, p.id, CATALOG);
    if (me) expect(LikelyMeSchema.safeParse(me).success).toBe(true);
  }
  expect(findLikelyLeaks(s, DEF)).toEqual([]);
};

describe("public view per phase (§8.2, §13.2)", () => {
  it("CARD: the card (prompt and award in the content language), counter, no votes, no reveal", () => {
    const s = startGame(4, {}, { locale: "ar" });
    const v = pub(s);
    expect(v).toMatchObject({ phase: "CARD", cardIndex: 0, cardCount: 8, votedIds: [], reveal: null, awards: [], showVoters: true, mode: "family" });
    expect(v.card?.prompt.startsWith("ar ")).toBe(true);
    expect(v.card?.award.startsWith("ar ")).toBe(true);
    expect(v.card).toMatchObject({ spicy: false, namedPlayerId: null, rerun: false });
    expect(v.scores).toEqual(["p1", "p2", "p3", "p4"].map((playerId) => ({ playerId, score: 0, scoreBefore: 0 })));
    expect(DEF.projectStatus(s)).toEqual({ phase: "CARD", doneIds: [], awaitedIds: [] });
    clean(s);
  });
  it("VOTING: who voted (votedIds, status doneIds), never for whom; own vote only in own me", () => {
    let s = tick(startGame(4));
    s = vote(s, "p3", "p1", T0 + 7_000);
    s = vote(s, "p1", "p1", T0 + 7_000);
    expect(pub(s).votedIds).toEqual(["p1", "p3"]);
    expect(DEF.projectStatus(s)).toEqual({ phase: "VOTING", doneIds: ["p1", "p3"], awaitedIds: ["p2", "p4"] });
    expect(DEF.projectMe(s, "p3", CATALOG)).toEqual({ myVote: "p1", waitingForNext: false });
    expect(DEF.projectMe(s, "p2", CATALOG)).toEqual({ myVote: null, waitingForNext: false });
    expect(DEF.projectMe(s, "nobody", CATALOG)).toBeNull();
    expect(JSON.stringify(pub(s))).not.toContain("targetId");
    clean(s);
  });
  it("REVEAL (public): ballots in voter seat order, counts with percent, deltas, scores moving", () => {
    let s = startGame(4);
    s = playCard(s, { p4: "p2", p1: "p2", p2: "p2", p3: "p1" });
    const v = pub(s);
    expect(v.reveal).toEqual({
      votesCast: 4,
      counts: [{ playerId: "p2", count: 3, percent: 75 }, { playerId: "p1", count: 1, percent: 25 }],
      topIds: ["p2"], unanimous: false, chaos: false, none: false, againId: null,
      ballots: [{ voterId: "p1", targetId: "p2" }, { voterId: "p2", targetId: "p2" }, { voterId: "p3", targetId: "p1" }, { voterId: "p4", targetId: "p2" }],
      deltas: [
        { playerId: "p1", points: 100, reason: "agree" },
        { playerId: "p2", points: 100, reason: "agree" },
        { playerId: "p2", points: 100, reason: "selfAware" },
        { playerId: "p4", points: 100, reason: "agree" },
      ],
    });
    expect(v.scores.find((x) => x.playerId === "p2")).toEqual({ playerId: "p2", score: 200, scoreBefore: 0 });
    expect(DEF.projectMe(s, "p3", CATALOG)).toEqual({ myVote: "p1", waitingForNext: false });
    clean(s);
    // Next card: scoreBefore catches up.
    const n = tick(s);
    expect(pub(n).scores.find((x) => x.playerId === "p2")).toEqual({ playerId: "p2", score: 200, scoreBefore: 200 });
    expect(DEF.projectMe(n, "p3", CATALOG)?.myVote).toBeNull();
  });
  it("REVEAL (secret votes): percentages only; no ballots, no deltas, no score; own vote on own phone", () => {
    let s = startGame(4, { showVoters: false });
    s = playCard(s, { p1: "p2", p2: "p2", p3: "p1", p4: "p2" });
    const v = pub(s);
    expect(v.reveal).toMatchObject({ votesCast: 4, ballots: null, deltas: [], counts: [{ playerId: "p2", count: 3, percent: 75 }, { playerId: "p1", count: 1, percent: 25 }] });
    expect(v.scores.every((x) => x.score === 0 && x.scoreBefore === 0)).toBe(true);
    expect(JSON.stringify(v)).not.toMatch(/voterId|targetId/);
    expect(DEF.projectMe(s, "p3", CATALOG)?.myVote).toBe("p1");
    clean(s);
  });
  it("chaos, none and AGAIN?! flags", () => {
    let s = startGame(3);
    s = playCard(s, { p1: "p2", p2: "p3", p3: "p1" });
    expect(pub(s).reveal).toMatchObject({ chaos: true, topIds: [], none: false });
    s = playCard(tick(s), {});
    expect(pub(s).reveal).toMatchObject({ none: true, votesCast: 0, counts: [] });
    s = playCard(tick(s), { p1: "p3" });
    s = playCard(tick(s), { p1: "p3", p2: "p3" });
    expect(pub(s).reveal?.againId).toBeNull();
    s = playCard(tick(s), { p1: "p3", p2: "p3", p3: "p3" });
    expect(pub(s).reveal?.againId).toBe("p3");
  });
  it("AWARDS and RESULTS: award cards with their original prompt; no card, no votes, no reveal", () => {
    const s = playTo(startGame(3), { p1: "p2", p2: "p2", p3: "p2" }, "AWARDS");
    const v = pub(s);
    expect(v).toMatchObject({ phase: "AWARDS", card: null, reveal: null, votedIds: [] });
    const sig = v.awards.find((a) => a.kind === "signature");
    expect(sig?.playerIds).toEqual(["p2"]);
    expect(sig?.card).toMatchObject({ index: 7, id: s.results[7]?.cardId, prompt: s.results[7]?.prompt, award: s.results[7]?.award, namedPlayerId: null });
    expect(v.awards.map((a) => a.kind)).toEqual(["mystery", "signature", "mystery", "star", "selfAware", "mindReader"]);
    expect(v.awards.find((a) => a.kind === "mindReader")).toMatchObject({ playerIds: ["p2"], value: 8 * 500 });   // unanimous +400, self-aware +100
    clean(s);
    const r = tick(s);
    expect(pub(r).phase).toBe("RESULTS");
    expect(pub(r).awards).toEqual(v.awards);
    clean(r);
  });
  it("HOLD view", () => {
    let s = startGame(3);
    s = DEF.reduce(s, { type: "PLAYER_AWAY", playerId: "p1" }, { now: T0, content: CATALOG, hostPlayerId: null, isHost: () => true }).state;
    s = tick(playCard(s, {}));
    expect(pub(s)).toMatchObject({ phase: "HOLD", card: null, deadline: null, reveal: null });
    clean(s);
  });
});

describe("leakCheck catches every forbidden shape", () => {
  const voting = vote(tick(startGame(4)), "p1", "p2", T0 + 7_000);
  const revealPub = playCard(startGame(4), { p1: "p2", p2: "p2" });
  const revealAnon = playCard(startGame(4, { showVoters: false }), { p1: "p2", p2: "p2" });
  it("accepts the real views", () => {
    for (const s of [voting, revealPub, revealAnon]) expect(findLikelyLeaks(s, DEF)).toEqual([]);
  });
  it("ballots or voter→target pairs before REVEAL", () => {
    expect(DEF.leakCheck(voting, null, env({ ...pub(voting), extra: { voterId: "p1", targetId: "p2" } })).length).toBeGreaterThan(0);
    expect(DEF.leakCheck(voting, null, env({ ...pub(voting), reveal: { ballots: [] } })).length).toBeGreaterThan(0);
  });
  it("ballots, deltas, scores or ballot awards in secret mode", () => {
    const p = pub(revealAnon);
    expect(DEF.leakCheck(revealAnon, null, env({ ...p, reveal: { ...p.reveal, ballots: [{ voterId: "p1", targetId: "p2" }] } })).length).toBeGreaterThan(0);
    expect(DEF.leakCheck(revealAnon, null, env({ ...p, reveal: { ...p.reveal, deltas: [{ playerId: "p1", points: 50, reason: "agree" }] } })).length).toBeGreaterThan(0);
    expect(DEF.leakCheck(revealAnon, null, env({ ...p, scores: [{ playerId: "p1", score: 50, scoreBefore: 0 }] })).length).toBeGreaterThan(0);
    expect(DEF.leakCheck(revealAnon, null, env({ ...p, awards: [{ kind: "mindReader", playerIds: ["p1"], value: 1, card: null }] })).length).toBeGreaterThan(0);
  });
  it("me on the TV, someone else's vote in me, extra me keys, myVote in the public part", () => {
    const p = pub(voting);
    expect(DEF.leakCheck(voting, null, env(p, { myVote: "p2", waitingForNext: false }))).toContain("me in a TV, spectator or benched view");
    expect(DEF.leakCheck(voting, "p3", env(p, { myVote: "p2", waitingForNext: false })).length).toBeGreaterThan(0);
    expect(DEF.leakCheck(voting, "p1", env(p, { myVote: "p2", waitingForNext: false, votes: {} })).length).toBeGreaterThan(0);
    expect(DEF.leakCheck(voting, "p1", env(p, { myVote: "p2", waitingForNext: false }))).toEqual([]);
    expect(DEF.leakCheck(voting, null, env({ ...p, myVote: "p2" })).length).toBeGreaterThan(0);
  });
  it("reveal or votedIds outside their phase; moving scores before REVEAL; Spicy in family", () => {
    const p = pub(voting);
    expect(DEF.leakCheck(voting, null, env({ ...p, reveal: pub(revealAnon).reveal }))).toContain("reveal in VOTING");
    expect(DEF.leakCheck(revealPub, null, env({ ...pub(revealPub), votedIds: ["p1"] }))).toContain("votedIds in REVEAL");
    expect(DEF.leakCheck(voting, null, env({ ...p, scores: [{ playerId: "p1", score: 50, scoreBefore: 0 }] }))).toContain("score moving in VOTING");
    expect(DEF.leakCheck(voting, null, env({ ...p, card: { ...p.card, spicy: true } }))).toContain("spicy card in family mode");
  });
  it("ignores views without a Likely envelope", () => {
    expect(DEF.leakCheck(voting, null, null)).toEqual([]);
    expect(DEF.leakCheck(voting, null, { game: null })).toEqual([]);
    expect(DEF.leakCheck(voting, null, { game: { gameId: "bluff", public: {}, me: null } })).toEqual([]);
  });
  it("secretsFor is empty (Likely's secrets are structural); forbidden keys never appear", () => {
    expect(DEF.secretsFor(voting, null)).toEqual([]);
    const all = JSON.stringify([pub(voting), pub(revealPub), pub(revealAnon), DEF.projectMe(voting, "p1", CATALOG)]);
    for (const k of DEF.forbiddenKeys) expect(all).not.toContain(`"${k}"`);
  });
});
