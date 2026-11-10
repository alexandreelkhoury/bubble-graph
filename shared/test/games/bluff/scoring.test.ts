// GAME-BLUFF §6.3 / §6.5 worked examples (golden), split credit, help fee, likes, voided prompts.
import { describe, expect, it } from "vitest";
import type { BluffState } from "../../../src/games/bluff/engine/state";
import { computeAwards } from "../../../src/games/bluff/engine/reduce";
import { G, P, TV, item, lieFor, pack } from "./harness";

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

// Final values rebalanced (owner-approved review finding): FINAL_VOTE 100, FINAL_TOP 250 split among tied top answers.
describe("§6.5 worked example (final)", () => {
  it("Maya 550, Rami 200, Joe 140; ballots anonymous", () => {
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
    expect(deltasOf(g.s)).toEqual({ maya: 550, rami: 200, joe: 140, karim: 0, nour: 0, lina: 0 });
    const rv = g.s.reveal!;
    expect(rv.final).toBe(true);
    expect(rv.truth).toBeNull();
    expect(rv.steps.every((st) => st.voterIds.length === 0)).toBe(true);
    expect(rv.steps.map((st) => st.voteCount)).toEqual([1, 2, 3]);     // fewest first
    expect(rv.steps.filter((st) => st.top).map((st) => st.authorIds)).toEqual([["maya"]]);
  });
  it("the top answer with ≥ 1 vote gets +250; house answers never take the crown", () => {
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
    expect(g.score("a") - g.s.players[0]!.scoreBefore).toBe(100 + 250);
  });
  it("tied top answers split the +250 (125 → 120 each after rounding down to 10)", () => {
    const ids = ["a", "b", "c", "d"];
    const g = new G({ ids, settings: { length: "short" } });
    g.toWriting("noTruth");
    g.submit("a", "Answer from alpha");
    g.submit("b", "Answer from bravo");
    g.submit("c", "Answer from charlie");
    g.tick();
    g.vote("c", g.optionOf("Answer from alpha"));
    g.vote("d", g.optionOf("Answer from bravo"));
    g.vote("a", g.optionOf("Answer from charlie"));
    g.vote("b", g.optionOf("Answer from charlie"));
    g.tick();
    expect(deltasOf(g.s)).toMatchObject({ a: 100, b: 100, c: 200 + 250 });
    const g2 = new G({ ids, settings: { length: "short" } });
    g2.toWriting("noTruth");
    g2.submit("a", "Answer from alpha");
    g2.submit("b", "Answer from bravo");
    g2.submit("c", "Answer from charlie");
    g2.tick();
    g2.vote("c", g2.optionOf("Answer from alpha"));
    g2.vote("d", g2.optionOf("Answer from bravo"));
    g2.tick();
    expect(deltasOf(g2.s)).toMatchObject({ a: 100 + 120, b: 100 + 120, c: 0 });
    expect(g2.s.reveal!.steps.filter((st) => st.top)).toHaveLength(2);
  });
  it("a \"Help me\" answer submitted as-is never takes the crown; the best typed answer does", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const g = new G({ ids, settings: { length: "short" } });
    g.toWriting("noTruth");
    g.do({ type: "REQUEST_HELP", promptId: g.promptId() }, P("a"));
    const help = g.me("a")!.help!;
    g.submit("a", help);
    g.submit("b", "Answer from bravo");
    g.submit("c", "Answer from charlie");
    g.tick();
    const helped = g.s.options.find((o) => o.authors.includes("a"))!;
    expect(helped.helped).toBe(true);
    for (const p of ["b", "c", "d"]) g.vote(p, helped.id);
    g.vote("e", g.optionOf("Answer from bravo"));
    g.vote("a", g.optionOf("Answer from bravo"));
    g.tick();
    const d = deltasOf(g.s);
    expect(d.a).toBe(300 - 60);                 // per-vote points minus the flat help fee, no crown
    expect(d.b).toBe(200 + 250);                // the best answer a player wrote takes the crown
    expect(g.s.reveal!.steps.find((st) => st.optionId === helped.id)!.top).toBe(false);
  });
});

describe("§6.6 Bluff of the Night skips helped answers", () => {
  it("a helped answer with the most votes is passed over for the best typed one", () => {
    const g = new G({ ids: ["a", "b", "c"] });
    const s = structuredClone(g.s);
    s.records = [
      { promptIndex: 1, options: [{ text: "Borrowed joke", authorIds: ["a"], votes: 5, likes: 3, helped: true }] },
      { promptIndex: 2, options: [{ text: "Own words", authorIds: ["b"], votes: 2, likes: 0, helped: false }] },
    ];
    const b = computeAwards(s).find((x) => x.id === "bluffOfTheNight")!;
    expect(b.playerIds).toEqual(["b"]);
    expect(b.text).toBe("Own words");
    s.records = [{ promptIndex: 1, options: [{ text: "Borrowed joke", authorIds: ["a"], votes: 5, likes: 3, helped: true }] }];
    expect(computeAwards(s).find((x) => x.id === "bluffOfTheNight")).toBeUndefined();
  });
});

describe("house lies: the item's own first, pack fallbacks only once those run out (§4.2 / §5.5)", () => {
  it("an item with 3 house lies never shows a fallback in a 4-player game (fill and Help me)", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const items = [
        item("s1", "proverb_end", 1), item("s2", "proverb_end", 2), item("s3", "proverb_end", 3),
        item("f1", "fact_blank", 1), item("f2", "fact_blank", 2), item("f3", "fact_blank", 3), item("f4", "fact_blank", 4),
        item("n1", "no_truth", 1), item("n2", "no_truth", 2),
      ].map((i) => ({ ...i, tier: "free" as const }));
      const fb = { en: ["Zfallback one", "Zfallback two", "Zfallback three", "Zfallback four", "Zfallback five"] };
      const cat = { packs: [pack("own-first", items, { fallbackHouseLies: { proverb_end: fb, fact_blank: fb, no_truth: fb } })] };
      const g = new G({ players: 4, seed, cat, settings: { length: "short" } });
      for (let k = 0; k < 40 && g.s.phase !== "RESULTS"; k++) {
        if (g.s.phase === "WRITING") {
          const before = g.s.prompt!;
          expect(before.ownHouseCount).toBe(3);
          // Odd seeds: p1 asks for help and everyone writes (fill 1). Even seeds: nobody writes (fill 3 = all own).
          if (seed % 2) {
            g.do({ type: "REQUEST_HELP", promptId: g.promptId() }, P("p1"));
            const h = g.me("p1")!.help;
            expect(h).not.toBeNull();
            expect(h).not.toMatch(/Zfallback/);
            g.submit("p1", h!);
            for (const q of ["p2", "p3", "p4"]) if (g.s.phase === "WRITING") g.submit(q, lieFor(q, g.s));
          }
          if (g.s.phase === "WRITING") g.tick();
          if ((g.s.phase as string) === "VOTING") for (const o of g.s.options) expect(o.text).not.toMatch(/Zfallback/);
          continue;
        }
        g.tick();
      }
    }
  });
  it("fallbacks fill in once the item's own house lies are used up", () => {
    const items = [item("n1", "no_truth", 1, { houseLies: { en: ["Zown only"] } }), item("n2", "no_truth", 2)].map((i) => ({ ...i, tier: "free" as const }));
    const sayings = [1, 2, 3].map((i) => ({ ...item(`s${i}`, "proverb_end", i), tier: "free" as const }));
    const facts = [1, 2, 3, 4].map((i) => ({ ...item(`f${i}`, "fact_blank", i), tier: "free" as const }));
    const cat = { packs: [pack("fb", [...sayings, ...facts, ...items], { fallbackHouseLies: { no_truth: { en: ["Zfallback one", "Zfallback two"] } } })] };
    const g = new G({ players: 4, seed: 3, cat, settings: { length: "short" } });
    g.toWriting("noTruth");
    if (g.s.prompt!.itemId !== "n1") return;     // the other final item has 3 own house lies
    g.tick();                                     // nobody wrote: 3 house answers needed, 1 own + 2 fallbacks
    expect(g.s.options.map((o) => o.text).sort()).toEqual(["Zfallback one", "Zfallback two", "Zown only"]);
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
