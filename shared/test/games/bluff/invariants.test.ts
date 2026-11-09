// GAME-BLUFF §13.3: every engine invariant fires on a state that breaks it (so a green property run means something),
// plus the draw's last-resort paths (§11.4, §7 "pool exhausted").
import { describe, expect, it } from "vitest";
import { definition } from "../../../src/games/bluff/definition";
import { drawPrompt, playableItems } from "../../../src/games/bluff/engine/catalog";
import { InvariantError } from "../../../src/games/bluff/engine/invariants";
import { createRng } from "../../../src/games/bluff/engine/rng";
import type { BluffState } from "../../../src/games/bluff/engine/state";
import { G, synthCatalog } from "./harness";

const breaks = (s: BluffState, mut: (x: BluffState) => void, msg: RegExp): void => {
  const x = structuredClone(s);
  mut(x);
  expect(() => definition.assertInvariants(x)).toThrow(InvariantError);
  expect(() => definition.assertInvariants(x)).toThrow(msg);
};

function at(phase: BluffState["phase"], kind: "saying" | "fact" | "noTruth" = "saying"): G {
  const g = new G({ players: 4, settings: { length: "short" } });
  g.toWriting(kind);
  if (phase === "WRITING") return g;
  g.allSubmit();
  if (phase === "VOTING") return g;
  for (const p of g.ids) g.vote(p, g.s.options.find((o) => !o.authors.includes(p))!.id);
  g.untilPhase(phase);
  return g;
}

describe("invariants fire", () => {
  it("structural", () => {
    const s = at("WRITING").s;
    breaks(s, (x) => { (x as { phase: string }).phase = "LOBBY"; }, /phase/);
    breaks(s, (x) => { x.players[1]!.id = x.players[0]!.id; }, /duplicate/);
    breaks(s, (x) => { x.players[0]!.score = -10; }, /score/);
    breaks(s, (x) => { x.deadline = null; }, /deadline/);
    breaks(s, (x) => { x.usedKeys = Array.from({ length: 301 }, (_, i) => `k${i}`); }, /memory/);
    breaks(s, (x) => { x.skipsUsed = 3; }, /limits/);
    breaks(s, (x) => { x.promptIndex = 99; }, /promptIndex/);
    breaks(s, (x) => { x.prompt = null; }, /prompt/);
    breaks(s, (x) => { x.options = [{ id: "0000000a", text: "X", kind: "lie", authors: [], helped: false }]; }, /invariant 1/);
    breaks(s, (x) => { x.prompt!.knownIn = [x.locale]; }, /invariant 7/);
    breaks(s, (x) => { x.prompt!.type = "no_truth"; }, /invariant 8/);
    breaks(s, (x) => { x.prompt!.type = "fact_blank"; x.prompt!.crossRound = false; }, /invariant 8/);
    breaks(s, (x) => { x.spotOn = { p1: true }; }, /invariant 9/);
    breaks(s, (x) => { x.spotOn = { p1: true }; x.firstSubmitDone = { p1: true }; x.lies = { p1: { text: "a", seq: 0, helped: false } }; }, /invariant 9/);
    breaks(s, (x) => { x.players[0]!.score += 10; }, /invariant 3/);
    const hold = structuredClone(s);
    hold.phase = "HOLD";
    hold.prompt = null;
    breaks(hold, (x) => { x.deadline = 5; }, /HOLD with a clock/);
  });
  it("VOTING (§13.3 2, 4)", () => {
    const s = at("VOTING").s;
    breaks(s, (x) => { x.options = x.options.slice(0, 1); }, /invariant 2/);
    breaks(s, (x) => { x.options = x.options.filter((o) => o.kind !== "truth"); }, /invariant 2/);
    breaks(s, (x) => { x.options[0]!.id = x.options[1]!.id; }, /invariant 4/);
    breaks(s, (x) => { x.options[0]!.id = "XYZ"; }, /invariant 4/);
    const own = s.options.find((o) => o.authors.length > 0)!;
    breaks(s, (x) => { x.votes = { [own.authors[0]!]: own.id }; }, /voted own/);
    breaks(s, (x) => { x.votes = { p1: "ffffffff" }; }, /missing option/);
    breaks(s, (x) => { x.likes = { p1: ["a", "b", "c"] }; }, /likes/);
    breaks(s, (x) => { x.likes = { p1: ["ffffffff"] }; }, /missing option/);
    breaks(s, (x) => { x.likes = { [own.authors[0]!]: [own.id] }; }, /liked own/);
    breaks(s, (x) => { x.spotOn = { [own.authors[0]!]: true }; x.firstSubmitDone[own.authors[0]!] = true; delete x.lies[own.authors[0]!]; }, /authored an option|invariant 3/);
    const fin = at("VOTING", "noTruth").s;
    breaks(fin, (x) => { x.options[0]!.kind = "truth"; }, /invariant 2/);
  });
  it("REVEAL (§13.3 3, 6, 10)", () => {
    const s = at("REVEAL", "fact").s;
    breaks(s, (x) => { x.reveal = null; }, /no reveal/);
    breaks(s, (x) => { x.reveal!.steps.at(-1)!.deltas.push({ playerId: "p1", points: 10, reason: "like" }); }, /reveal sums/);
    breaks(s, (x) => { x.reveal!.final = true; for (const st of x.reveal!.steps) st.voterIds = []; }, /final flag/);
    const t = s.reveal!.steps.find((st) => st.kind === "truth" && st.deltas.length > 0);
    if (t) breaks(s, (x) => { x.foundWhileWriting[t.deltas[0]!.playerId] = true; }, /invariant 6/);
    const fin = at("REVEAL", "noTruth").s;
    breaks(fin, (x) => { const st = x.reveal!.steps[0]!; st.voterIds = ["p1"]; }, /invariant 10/);
    breaks(s, (x) => { x.voided = true; }, /invariant 6/);
  });
});

describe("draw last resorts (§11.4, §7)", () => {
  it("a one-item final skipped by the host draws the same item again (rerun)", () => {
    const cat = synthCatalog({ sayings: 2, facts: 2, finals: 1 });
    const cands = playableItems(cat, [], "en");
    const r = drawPrompt(createRng(1), { candidates: cands, slotKind: "noTruth", usedKeys: [], drawn: ["n01"], currentId: "n01", prevType: null, factRich: false });
    expect(r?.cand.item.id).toBe("n01");
    expect(r?.rerun).toBe(true);
    expect(drawPrompt(createRng(1), { candidates: [], slotKind: "noTruth", usedKeys: [], drawn: [], currentId: null, prevType: null, factRich: false })).toBeNull();
  });
  it("exhausted pools rerun the least recently used item", () => {
    const cat = synthCatalog({ sayings: 3, facts: 0, finals: 1 });
    const cands = playableItems(cat, [], "en");
    const r = drawPrompt(createRng(5), { candidates: cands, slotKind: "saying", usedKeys: ["s02", "s01", "s03"], drawn: [], currentId: null, prevType: null, factRich: false });
    expect(r).toMatchObject({ rerun: true });
    expect(r?.cand.item.id).toBe("s02");
    // Cross-round when the own pool is empty (round 2 borrows sayings).
    const r2 = drawPrompt(createRng(5), { candidates: cands, slotKind: "fact", usedKeys: [], drawn: [], currentId: null, prevType: "proverb_end", factRich: false });
    expect(r2).toMatchObject({ crossRound: true });
  });
});
