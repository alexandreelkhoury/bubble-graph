// GAME-BLUFF §6.3 / §6.5 worked examples (golden), split credit, help fee, likes, voided prompts.
import { describe, expect, it } from "vitest";
import type { BluffState } from "../../../src/games/bluff/engine/state";
import { G, P, TV } from "./harness";

const deltasOf = (s: BluffState): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const p of s.players) out[p.id] = p.score - p.scoreBefore;
  return out;
};

describe("§6.3 worked example (round 1 then the same outcome in round 2)", () => {
  // The doc says "6 players" but names 7 (Rami, Maya, Karim, Nour, Lina, Sami, Joe): 7 are used here.
  const ids = ["rami", "maya", "karim", "nour", "lina", "sami", "joe"];
  function play(g: G): void {
    g.submit("nour", g.truth());                           // Spot on
    expect(g.s.spotOn.nour).toBe(true);
    g.submit("rami", "A fish with umbrellas");
    g.submit("sami", "Bring a ladder");
    g.submit("sami", g.truth());                           // edit that matches → warning (me.tooCloseCount)
    expect(g.me("sami")!.tooCloseCount).toBe(1);
    g.tick();                                              // WRITING deadline → VOTING
    expect(g.s.phase).toBe("VOTING");
    const lie = g.optionOf("A fish with umbrellas");
    const truth = g.truthOption();
    g.vote("maya", lie);
    g.vote("karim", lie);
    for (const p of ["lina", "sami", "joe"]) g.vote(p, truth);
    g.do({ type: "LIKE", optionId: lie, on: true }, P("lina"));
    g.tick();
    expect(g.s.phase).toBe("REVEAL");
  }
  it("round 1: Rami 130, Nour 150, truth finders 100, Sami 0", () => {
    const g = new G({ ids });
    g.toWriting("saying");
    play(g);
    expect(deltasOf(g.s)).toEqual({ rami: 130, maya: 0, karim: 0, nour: 150, lina: 100, sami: 0, joe: 100 });
    const truthStep = g.s.reveal?.steps.at(-1);
    expect(truthStep?.kind).toBe("truth");
    expect(truthStep?.foundEarlyIds).toEqual(["sami"]);
    expect(truthStep?.spotOnIds).toEqual(["nour"]);
    expect(g.s.reveal?.spotOnDeltas).toEqual([{ playerId: "nour", points: 150 }]);
  });
  it("round 2 (×2): Rami 250, truth finders 200; no Spot on in round 2", () => {
    const g = new G({ ids });
    g.toWriting("fact");
    // In round 2 Nour's matching first entry is a too-close warning, not a Spot on.
    g.submit("nour", g.truth());
    expect(g.me("nour")).toMatchObject({ spotOn: false, foundWhileWriting: true, tooCloseCount: 1 });
    g.submit("rami", "A fish with umbrellas");
    g.submit("sami", "Bring a ladder");
    g.tick();
    const lie = g.optionOf("A fish with umbrellas");
    g.vote("maya", lie);
    g.vote("karim", lie);
    for (const p of ["lina", "joe"]) g.vote(p, g.truthOption());
    g.do({ type: "LIKE", optionId: lie, on: true }, P("lina"));
    g.tick();
    const d = deltasOf(g.s);
    expect(d.rami).toBe(250);
    expect(d.lina).toBe(200);
    expect(d.joe).toBe(200);
    expect(d.nour).toBe(0);
  });
});

describe("§6.5 worked example (final)", () => {
  it("Maya 850, Rami 300, Joe 190; ballots anonymous", () => {
    const ids = ["maya", "rami", "joe", "karim", "nour", "lina"];
    const g = new G({ ids, settings: { length: "short" } });
    g.toWriting("noTruth");
    expect(g.pub().prompt?.lengthHint).toBe("free");
    g.submit("maya", "Where is the fish");
    g.submit("rami", "Feed me now please");
    g.submit("joe", "I was here first");
    g.tick();
    expect(g.s.options.every((o) => o.kind === "lie")).toBe(true);    // 3 answers → 0 house answers, no truth
    const [m, r, j] = [g.optionOf("Where is the fish"), g.optionOf("Feed me now please"), g.optionOf("I was here first")];
    for (const p of ["karim", "nour", "lina"]) g.vote(p, m);
    g.vote("maya", r);
    g.vote("joe", r);
    g.vote("rami", j);
    g.do({ type: "LIKE", optionId: j, on: true }, P("karim"));
    g.do({ type: "LIKE", optionId: j, on: true }, P("nour"));
    g.tick();
    expect(deltasOf(g.s)).toEqual({ maya: 850, rami: 300, joe: 190, karim: 0, nour: 0, lina: 0 });
    const rv = g.s.reveal!;
    expect(rv.final).toBe(true);
    expect(rv.truth).toBeNull();
    expect(rv.steps.every((st) => st.voterIds.length === 0)).toBe(true);
    expect(rv.steps.map((st) => st.voteCount)).toEqual([1, 2, 3]);     // fewest first
    expect(rv.steps.filter((st) => st.top).map((st) => st.authorIds)).toEqual([["maya"]]);
  });
  it("every tied top answer with ≥ 1 vote gets +400; house answers never take the crown", () => {
    const ids = ["a", "b", "c", "d"];
    const g = new G({ ids, settings: { length: "short" } });
    g.toWriting("noTruth");
    g.submit("a", "Answer from alpha");
    g.tick();                                   // 1 answer → 2 house answers
    expect(g.s.options.filter((o) => o.kind === "house")).toHaveLength(2);
    const house = g.s.options.filter((o) => o.kind === "house").map((o) => o.id);
    const mine = g.optionOf("Answer from alpha");
    g.vote("b", house[0]!);
    g.vote("c", house[0]!);
    g.vote("d", mine);
    g.tick();
    expect(g.score("a") - g.s.players[0]!.scoreBefore).toBe(150 + 400);
  });
});

describe("split credit, help fee, likes", () => {
  it("merged lie: co-authors split 60 → 30 each, neither may vote it; 3 co-authors → 20 each", () => {
    const g = new G({ players: 5 });
    g.toWriting("saying");
    g.submit("p1", "Bread with honey");
    g.submit("p2", "bread with honey!");
    g.submit("p3", "Bread with hony");
    g.tick();
    const o = g.s.options.find((x) => x.kind === "lie")!;
    expect(o.authors).toEqual(["p1", "p2", "p3"]);
    expect(o.text).toBe("Bread with honey");
    expect(g.err({ type: "VOTE", optionId: o.id }, P("p2"))).toBe("CANNOT_VOTE_OWN");
    g.vote("p4", o.id);
    g.tick();
    expect(deltasOf(g.s)).toMatchObject({ p1: 20, p2: 20, p3: 20 });
  });
  it("helped lie pays a flat 40 × m once (never below 0)", () => {
    const g = new G({ players: 4 });
    g.toWriting("saying");
    g.do({ type: "REQUEST_HELP", promptId: g.promptId() }, P("p1"));
    const help = g.me("p1")!.help!;
    expect(help).toMatch(/^Zhouse /);
    expect(g.s.housePool).not.toContain(help);
    expect(g.err({ type: "REQUEST_HELP", promptId: g.promptId() }, P("p1"))).toBe("WRONG_PHASE"); // once per prompt
    g.submit("p1", help);
    g.tick();
    const o = g.s.options.find((x) => x.authors.includes("p1"))!;
    expect(o.helped).toBe(true);
    expect(g.s.options.filter((x) => x.text === help)).toHaveLength(1);       // never twice on the board
    g.vote("p2", o.id);
    g.tick();
    expect(g.score("p1") - g.s.players[0]!.scoreBefore).toBe(20);
    const st = g.s.reveal!.steps.find((x) => x.optionId === o.id)!;
    expect(st.helped).toBe(true);
  });
  it("likes on the truth or a house lie pay nothing; likes on an unpicked lie still pay +10", () => {
    const g = new G({ players: 4 });
    g.toWriting("saying");
    g.submit("p1", "Nobody picks this");
    g.tick();
    const lie = g.optionOf("Nobody picks this");
    const house = g.s.options.find((o) => o.kind === "house")!.id;
    g.do({ type: "LIKE", optionId: lie, on: true }, P("p2"));
    g.do({ type: "LIKE", optionId: house, on: true }, P("p2"));
    expect(g.err({ type: "LIKE", optionId: g.truthOption(), on: true }, P("p2"))).toBe("INVALID_TARGET"); // 3rd like
    g.do({ type: "LIKE", optionId: g.truthOption(), on: true }, P("p3"));
    expect(g.err({ type: "LIKE", optionId: lie, on: true }, P("p1"))).toBe("CANNOT_VOTE_OWN");
    g.tick();
    expect(deltasOf(g.s)).toMatchObject({ p1: 10, p2: 0, p3: 0 });
    expect(g.s.reveal!.unpicked[0]!.deltas).toEqual([{ playerId: "p1", points: 10, reason: "like" }]);
  });
});

describe("voided prompt (host hides the truth)", () => {
  it("no points at all, Spot-on kept, SCORES for 4 s", () => {
    const g = new G({ players: 4 });
    g.toWriting("saying");
    g.submit("p1", g.truth());
    g.submit("p2", "Some lie here");
    g.tick();
    g.vote("p3", g.optionOf("Some lie here"));
    const t0 = g.now;
    g.do({ type: "HIDE_OPTION", optionId: g.truthOption() }, TV);
    expect(g.s.phase).toBe("SCORES");
    expect(g.s.deadline).toBe(t0 + 4000);
    expect(g.pub().notice).toBe("voided");
    expect(g.pub().reveal).toBeNull();
    expect(g.pub().options).toEqual([]);
    expect(deltasOf(g.s)).toEqual({ p1: 150, p2: 0, p3: 0, p4: 0 });
  });
});
