// JAMAA-PLATFORM §2.10 leak oracles + §2.8 property runs (GAME-BLUFF §8.1, §13.4 "Secrecy"):
// 1. the oracles themselves catch forged leaks (mutation tests), so a green property run means something;
// 2. seeded bot games over 3..12 players, timers on and off, EN and AR, Pass and free catalogs, with random AWAY/BACK/
//    GONE and late joins, check after EVERY reduce: invariants, whole-leaf secrets, leakCheck, forbidden keys, monotone
//    scores, untouched state on error, no typographic tell; every game terminates; same seed → same game.
import { describe, expect, it } from "vitest";
import { content as adapter } from "../../../src/games/bluff/content";
import { definition } from "../../../src/games/bluff/definition";
import type { BluffCatalog } from "../../../src/games/bluff/engine/catalog";
import { findBluffLeaks, runBluffBotGame } from "../../../src/testing/bots/bluff";
import { bluffTokenCatalog, freeOnly } from "../../../src/testing/catalogs/bluff";
import { G, P } from "./harness";

const RUNS = Number(process.env.BLUFF_PROPS_RUNS ?? 40);
const SLOW = { timeout: 900_000 };

function viewOf(g: G, viewer: string | null): { game: { public: unknown; me: unknown } } {
  return { game: { public: g.pub(), me: viewer === null ? null : g.me(viewer) } };
}
const leaf = (v: unknown, needle: string): boolean => JSON.stringify(v).includes(JSON.stringify(needle));

describe("the oracles catch forged leaks", () => {
  it("secretsFor before VOTING: the truth, its alternatives, the note, house lies and other players' lies", () => {
    const g = new G({ players: 4 });
    g.toWriting("fact");
    g.submit("p1", "Alpha lie text");
    g.do({ type: "REQUEST_HELP", promptId: g.promptId() }, P("p2"));
    const p = g.s.prompt!;
    const tv = definition.secretsFor(g.s, null);
    for (const t of [p.truthText, ...p.truthAll, p.note, ...p.houseLies, "Alpha lie text"]) expect(tv).toContain(t);
    expect(definition.secretsFor(g.s, "p1")).not.toContain("Alpha lie text");                 // own lie is fine
    expect(definition.secretsFor(g.s, "p3")).toContain(g.s.help.p2);                          // someone else's help
    expect(definition.secretsFor(g.s, "p2")).not.toContain(g.s.help.p2);
    // A forged TV view with the truth in any leaf is reported by the generic checker.
    const forged = structuredClone(g.s);
    forged.prompt!.original = p.truthText!;
    expect(findBluffLeaks(forged, g.cat).some((e) => e.startsWith("tv: secret"))).toBe(true);
  });
  it("leakCheck before REVEAL: authorship, voters, likers, kinds, counts; spotOnIds in WRITING; other players' flags", () => {
    const g = new G({ players: 4 });
    g.toWriting("saying");
    g.submit("p1", g.truth());                                                                   // Spot on
    const view = viewOf(g, "p2") as { game: { public: Record<string, unknown>; me: Record<string, unknown> } };
    expect(definition.leakCheck(g.s, "p2", view)).toEqual([]);
    expect(definition.leakCheck(g.s, "p2", { game: { public: { ...view.game.public, spotOnIds: ["p1"] }, me: view.game.me } })).toContain("spotOnIds during WRITING");
    expect(definition.leakCheck(g.s, "p2", { game: { public: view.game.public, me: { ...view.game.me, spotOn: true } } })).toContain("spotOn of someone else");
    g.allSubmit(["p1"]);
    expect(g.s.phase).toBe("VOTING");
    const pub = g.pub() as unknown as Record<string, unknown> & { options: Record<string, unknown>[] };
    const withKind = { ...pub, options: pub.options.map((o, i) => (i === 0 ? { ...o, kind: "truth" } : o)) };
    const errs = definition.leakCheck(g.s, null, { game: { public: withKind, me: null } });
    expect(errs.some((e) => e.includes('"kind"'))).toBe(true);
    expect(definition.leakCheck(g.s, null, { game: { public: { ...pub, authorIds: ["p2"] }, me: null } }).length).toBeGreaterThan(0);
    expect(definition.leakCheck(g.s, null, { game: { public: pub, me: g.me("p2") } })).toContain("me in a TV/spectator view");
  });
  it("leakCheck in the final: ballots are never exposed", () => {
    const g = new G({ players: 4, settings: { length: "short" } });
    g.toWriting("noTruth");
    g.allSubmit();
    for (const p of g.ids) g.vote(p, g.s.options.find((o) => !o.authors.includes(p))!.id);
    g.tick();
    expect(g.s.phase).toBe("REVEAL");
    const pub = structuredClone(g.pub());
    expect(definition.leakCheck(g.s, null, { game: { public: pub, me: null } })).toEqual([]);
    pub.reveal!.steps[0]!.voterIds = ["p1"];
    expect(definition.leakCheck(g.s, null, { game: { public: pub, me: null } }).some((e) => e.includes("final ballots"))).toBe(true);
  });
  it("forbidden keys: no state-only key appears in any view, in any phase of a full game", () => {
    const g = new G({ players: 5 });
    const forbidden = new Set(definition.forbiddenKeys);
    const keys = (x: unknown, out: Set<string>): Set<string> => {
      if (Array.isArray(x)) x.forEach((v) => keys(v, out));
      else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) { out.add(k); keys(v, out); }
      return out;
    };
    for (let guard = 0; guard < 200 && g.s.phase !== "RESULTS"; guard++) {
      if (g.s.phase === "WRITING") g.allSubmit();
      for (const id of [null, ...g.ids]) for (const k of keys(viewOf(g, id), new Set())) expect(forbidden.has(k), k).toBe(false);
      if ((g.s.phase as string) !== "RESULTS" && g.s.deadline !== null) g.tick();
    }
    expect(g.s.phase).toBe("RESULTS");
  });
  it("a voided prompt (truth hidden) never reveals options or the truth", () => {
    const g = new G({ players: 4 });
    g.toWriting("fact");
    g.allSubmit();
    const truth = g.truth();
    g.do({ type: "HIDE_OPTION", optionId: g.truthOption() });
    expect(g.s.phase).toBe("SCORES");
    for (const id of [null, ...g.ids]) expect(leaf(viewOf(g, id), truth)).toBe(false);
  });
});

describe("access: Pass items never reach a free room", () => {
  it("the content adapter keeps only free items for a free room and everything for Pass or an owned family", () => {
    const full = bluffTokenCatalog();
    for (const p of full.packs) {
      const free = adapter.playable(p, { premium: false, ownedFamilies: new Set() });
      expect(free === null || free.items.every((i) => i.tier === "free")).toBe(true);
      expect(adapter.playable(p, { premium: true, ownedFamilies: new Set() })).toBe(p);
      expect(adapter.playable(p, { premium: false, ownedFamilies: new Set([p.id]) })).toBe(p);
    }
  });
  it("a free room's games only ever draw free items", SLOW, () => {
    const full = bluffTokenCatalog();
    const passIds = new Set(full.packs.flatMap((p) => p.items.filter((i) => i.tier === "pass").map((i) => i.id)));
    const cat: BluffCatalog = { packs: full.packs.map((p) => adapter.playable(p, { premium: false, ownedFamilies: new Set() })).filter((p) => p !== null) };
    expect(cat).toEqual(freeOnly(full));
    for (let seed = 1; seed <= 10; seed++) {
      const r = runBluffBotGame({ players: 3 + (seed % 6), seed, catalog: cat, settings: { length: "short" } });
      expect(r.failure).toBeNull();
      for (const id of r.final.usedKeys) expect(passIds.has(id)).toBe(false);
    }
  });
});

describe("seeded bot games (JAMAA-PLATFORM §2.8, GAME-BLUFF §13.4)", () => {
  const cases: { name: string; locale: "en" | "ar"; free: boolean; timers: boolean }[] = [
    { name: "EN, Pass, timers on", locale: "en", free: false, timers: true },
    { name: "EN, free, timers off", locale: "en", free: true, timers: false },
    { name: "AR, Pass, timers on", locale: "ar", free: false, timers: true },
  ];
  it.each(cases)("$name: 3..12 players terminate with no failure", SLOW, ({ locale, free, timers }) => {
    const cat = free ? freeOnly(bluffTokenCatalog()) : bluffTokenCatalog();
    const failures: string[] = [];
    let holds = 0;
    let joins = 0;
    let voided = 0;
    for (let k = 0; k < RUNS; k++) {
      const players = 3 + (k % 10);
      const length = (["short", "normal", "long"] as const)[k % 3];
      const pace = (["relaxed", "normal", "fast"] as const)[(k >> 1) % 3];
      const r = runBluffBotGame({ players, seed: 1000 * k + players, locale, catalog: cat, timers, settings: { length, pace } });
      if (r.failure) failures.push(`seed ${1000 * k + players}: ${r.failure}`);
      holds += r.holds;
      joins += r.joins;
      voided += r.voided;
    }
    expect(failures).toEqual([]);
    // The runs really exercised the rare paths.
    expect(holds + joins + voided).toBeGreaterThan(0);
  });
  it("determinism: the same seed and the same actions give a JSON-equal game", SLOW, () => {
    for (const seed of [3, 77, 4242]) {
      const a = runBluffBotGame({ players: 3 + (seed % 9), seed });
      const b = runBluffBotGame({ players: 3 + (seed % 9), seed });
      expect(a.failure).toBeNull();
      expect(JSON.stringify(b.final)).toBe(JSON.stringify(a.final));
      expect(JSON.stringify(b.log)).toBe(JSON.stringify(a.log));
    }
  });
  it("golden: one seeded game's final scores and awards", SLOW, () => {
    const r = runBluffBotGame({ players: 6, seed: 20261109, checkLeaks: false });
    expect(r.failure).toBeNull();
    expect({
      scores: r.final.players.map((p) => [p.id, p.score]),
      awards: r.final.awards.map((a) => [a.id, a.playerIds, a.value]),
      outcome: definition.outcome(r.final),
      steps: r.steps,
    }).toMatchSnapshot();
  });
});
