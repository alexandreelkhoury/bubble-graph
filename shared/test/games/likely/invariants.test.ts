// GAME-LIKELY §13.3: every invariant fires on a state that breaks it (and holds on real states, checked everywhere else).
import { describe, expect, it } from "vitest";
import { InvariantError } from "../../../src/games/mishana/engine/invariants";
import type { LikelyState } from "../../../src/games/likely/engine/state";
import { DEF, playCard, playTo, startGame, tick, vote } from "./helpers";

const clone = (s: LikelyState): LikelyState => JSON.parse(JSON.stringify(s)) as LikelyState;
const breaks = (s: LikelyState, mutate: (x: LikelyState) => void): void => {
  const x = clone(s);
  mutate(x);
  expect(() => DEF.assertInvariants(x)).toThrow(InvariantError);
};

describe("invariants (§13.3)", () => {
  const card = startGame(4);
  const voting = vote(tick(startGame(4)), "p1", "p2", 1_000_000 + 7_000);
  const reveal = playCard(startGame(4), { p1: "p2", p2: "p2", p3: "p2", p4: "p1" });
  const revealAnon = playCard(startGame(4, { showVoters: false }), { p1: "p2", p2: "p2", p3: "p2", p4: "p1" });
  const awards = playTo(startGame(4), { p1: "p2", p2: "p2" }, "AWARDS");

  it("hold on real states", () => {
    for (const s of [card, voting, reveal, revealAnon, awards]) expect(() => DEF.assertInvariants(s)).not.toThrow();
  });
  it("structure", () => {
    breaks(card, (x) => { (x as { schema: number }).schema = 9; });
    breaks(card, (x) => { (x as { phase: string }).phase = "INTRO"; });
    breaks(card, (x) => { x.cardCount = 99; });
    breaks(card, (x) => { (x.players[1] as { id: string }).id = "p1"; });
    breaks(card, (x) => { (x.players[1] as { n: number }).n = 0; });
    breaks(card, (x) => { (x.players[1] as { seat: number }).seat = 0; });
    breaks(card, (x) => { Object.assign(x.players[0] as object, { left: true, connected: true }); });
    breaks(card, (x) => { (x.players[0] as { waiting: boolean }).waiting = true; });
    breaks(card, (x) => { x.scores = {}; });
    breaks(card, (x) => { x.scores.zz = 0; });
    breaks(card, (x) => { x.memoryKeys.push(x.memoryKeys[0] as string); });
    breaks(card, (x) => { x.drawnCount = 99; });
    breaks(card, (x) => { x.memoryKeys = ["other-card", ...x.memoryKeys].reverse(); });
  });
  it("votes (1, 2)", () => {
    breaks(card, (x) => { x.votes = { p1: "p2" }; });
    breaks(voting, (x) => { x.votes = { ghost: "p2" }; });
    breaks(voting, (x) => { x.votes = { p1: "ghost" }; });
    breaks(voting, (x) => { (x.card as { namedPlayerId: string | null }).namedPlayerId = "p2"; x.settings.mode = "spicy"; });
  });
  it("phase shape", () => {
    breaks(card, (x) => { x.card = null; });
    breaks(card, (x) => { x.deadline = null; });
    breaks(card, (x) => { x.earlyEnd = true; });
    breaks(card, (x) => { x.cardIndex = 3; });
    breaks(awards, (x) => { x.phase = "HOLD"; x.deadline = null; x.card = null; x.cardIndex = 99; });
  });
  it("results: chaos/unanimous, percent, named, caps (4, 5, 6, 7)", () => {
    breaks(reveal, (x) => { (x.results[0] as { picks: number[] }).picks = [7, 1, 1, 0]; });
    breaks(reveal, (x) => { (x.results[0] as { named: number | null }).named = 9; });
    breaks(reveal, (x) => { (x.results[0] as { named: number | null }).named = 1; x.settings.mode = "spicy"; });
    breaks(reveal, (x) => { x.scores.p1 = (x.scores.p1 ?? 0) + 50; });
    breaks(reveal, (x) => { x.scores.p1 = -1; x.scores.p2 = (x.scores.p2 ?? 0) + 1 + (reveal.scores.p1 ?? 0); });
    breaks(revealAnon, (x) => { x.settings.showVoters = true; });
    breaks(reveal, (x) => { x.settings.showVoters = false; });
  });
  it("family stays family; named cards need a present player and 4 players; named spacing", () => {
    breaks(card, (x) => { (x.card as { spicy: boolean }).spicy = true; });
    breaks(card, (x) => { (x.card as { namedPlayerId: string | null }).namedPlayerId = "p2"; });
    breaks(card, (x) => { x.settings.mode = "spicy"; (x.card as { namedPlayerId: string | null }).namedPlayerId = "ghost"; });
    breaks(card, (x) => { x.settings.mode = "spicy"; (x.card as { namedPlayerId: string | null }).namedPlayerId = "p2"; (x.players[1] as { left: boolean; connected: boolean }).left = true; (x.players[1] as { connected: boolean }).connected = false; });
    breaks(reveal, (x) => { x.settings.mode = "spicy"; (x.results[0] as { named: number | null }).named = 3; (x.card as { namedPlayerId: string | null }).namedPlayerId = "p4"; x.phase = "CARD"; x.results = []; x.cardIndex = 0; });
    const three = startGame(3);
    breaks(three, (x) => { x.settings.mode = "spicy"; (x.card as { namedPlayerId: string | null }).namedPlayerId = "p2"; });
  });
  it("awards: one signature-or-mystery card each", () => {
    breaks(awards, (x) => { x.players.push({ ...(x.players[0] as LikelyState["players"][number]), id: "p1" }); });
  });
});
