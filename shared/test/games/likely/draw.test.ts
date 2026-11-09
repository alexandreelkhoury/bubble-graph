// GAME-LIKELY §11.3 draw, §7 "Who gets named" and the start blockers.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { drawCard, namedAllowed, namedPool } from "../../../src/games/likely/engine/draw";
import type { DrawInput } from "../../../src/games/likely/engine/draw";
import type { LikelyPlayer } from "../../../src/games/likely/engine/state";
import { createRng } from "../../../src/room/rng";
import { CATALOG, DEF, likelyFamilyPack, playCard, roster, settings, startGame, step, tick } from "./helpers";

const base = (p: Partial<DrawInput> = {}): DrawInput => ({
  content: CATALOG, settings: settings(), locale: "en", position: 1, recency: [], drawnIds: [], usedKeys: [], prevTags: null,
  namedHistory: [], playersInGame: 6, namedCandidates: 5, excludeIds: [], ...p,
});
const FAM = (CATALOG.packs[0] as { cards: { id: string }[] }).cards.map((c) => c.id);

describe("draw (§11.3)", () => {
  it("family mode never serves spice > 0 or a named card (10 000 draws, any pack selection)", () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), fc.integer({ min: 0, max: 15 }), fc.constantFrom<string[]>([], ["syn-spicy"], ["syn-family", "syn-spicy"]), (seed, position, packIds) => {
      const d = drawCard(base({ position, settings: settings({ packIds }) }), createRng(seed));
      if (packIds.length === 1) return d === null;   // only the adult pack selected: nothing playable in family mode
      return d !== null && d.candidate.card.spice === 0 && !d.candidate.card.namesPlayer;
    }), { numRuns: 10_000 });
  });
  it("the first card of a family game is an opener (party or habits)", () => {
    for (let seed = 0; seed < 200; seed++) {
      expect((drawCard(base({ position: 0 }), createRng(seed))?.candidate.card.tags ?? []).some((t) => t === "party" || t === "habits")).toBe(true);
    }
  });
  it("avoids the previous card's tag when it can", () => {
    for (let seed = 0; seed < 200; seed++) expect(drawCard(base({ prevTags: ["food"] }), createRng(seed))?.candidate.card.tags).not.toContain("food");
  });
  it("prefers cards not in memory; then the least recently used, tagged Rerun", () => {
    const used = FAM.slice(0, 39);
    for (let seed = 0; seed < 50; seed++) expect(drawCard(base({ usedKeys: used, recency: used }), createRng(seed))).toMatchObject({ candidate: { card: { id: FAM[39] } }, rerun: false });
    const all = [...FAM].reverse();   // FAM[39] is the oldest key
    expect(drawCard(base({ usedKeys: all, recency: all }), createRng(1))).toMatchObject({ candidate: { card: { id: FAM[39] } }, rerun: true });
  });
  it("never redraws a card drawn this game while others remain; the excluded card only as a last resort", () => {
    expect(drawCard(base({ drawnIds: FAM.slice(1), recency: FAM.slice(1) }), createRng(3))?.candidate.card.id).toBe(FAM[0]);
    const one = { packs: [{ ...likelyFamilyPack(), cards: likelyFamilyPack().cards.slice(0, 1) }] };
    const only = one.packs[0]?.cards[0]?.id as string;
    expect(drawCard(base({ content: one, excludeIds: [only], drawnIds: [only], recency: [only] }), createRng(1))).toMatchObject({ candidate: { card: { id: only } }, rerun: true });
    expect(drawCard(base({ content: { packs: [] } }), createRng(1))).toBeNull();
  });
  it("spicy mode: an unnamed Spicy opener, Family breathers at positions 3, 6, 9", () => {
    const sp = settings({ mode: "spicy" });
    for (let seed = 0; seed < 100; seed++) {
      const first = drawCard(base({ settings: sp, position: 0 }), createRng(seed))?.candidate.card;
      expect(first && first.spice > 0 && !first.namesPlayer).toBe(true);
      expect(drawCard(base({ settings: sp, position: 2 }), createRng(seed))?.candidate.card.spice).toBe(0);
      expect(drawCard(base({ settings: sp, position: 4 }), createRng(seed))?.candidate.card.spice).toBeGreaterThan(0);
    }
  });
  it("named cards: ≥ 4 players, never the opener, never two in a row, ≤ 1 in any 3", () => {
    const sp = settings({ mode: "spicy" });
    const ok = (p: Partial<DrawInput>): boolean => namedAllowed({ ...base({ settings: sp }), ...p });
    expect(ok({})).toBe(true);
    expect(ok({ playersInGame: 3 })).toBe(false);
    expect(ok({ position: 0 })).toBe(false);
    expect(ok({ namedHistory: [false, true] })).toBe(false);
    expect(ok({ namedHistory: [true, false] })).toBe(false);
    expect(ok({ namedHistory: [true, false, false] })).toBe(true);
    expect(ok({ namedCandidates: 0 })).toBe(false);
    expect(namedAllowed(base())).toBe(false);   // family
  });
  it("named pool: the fewest-named connected players, never the last one named", () => {
    const P = (id: string, namedCount: number, connected = true): LikelyPlayer => ({ id, n: 0, seat: 0, connected, left: false, waiting: false, firstCard: 0, namedCount });
    expect(namedPool([P("a", 1), P("b", 0), P("c", 0), P("d", 0, false)], "c")).toEqual(["b"]);
    expect(namedPool([P("a", 0, false)], null)).toEqual([]);
  });
  it("named fairness over a seeded Spicy game: counts differ by ≤ 1; never two named cards in a row", () => {
    for (const seed of [3, 7, 11]) {
      let s = startGame(6, { mode: "spicy", length: "long", showVoters: false }, { seed });
      while (s.phase !== "AWARDS") s = s.phase === "CARD" ? playCard(s, {}) : tick(s);
      const counts = s.players.map((p) => p.namedCount);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      const named = s.results.map((r) => r.named !== null);
      expect(named.some(Boolean)).toBe(true);
      for (let k = 1; k < named.length; k++) if (named[k]) expect(named[k - 1] || named[k - 2]).toBeFalsy();
      const seq = s.results.map((r) => r.named).filter((x) => x !== null);
      for (let k = 1; k < seq.length; k++) expect(seq[k]).not.toBe(seq[k - 1]);   // never the same player twice running
    }
  });
  it("Spicy with 3 players never draws a named card", () => {
    let s = startGame(3, { mode: "spicy", length: "long", showVoters: false }, { seed: 5 });
    while (s.phase !== "AWARDS") s = s.phase === "CARD" ? playCard(s, {}) : tick(s);
    expect(s.results.every((r) => r.named === null)).toBe(true);
  });
  it("a whole Spicy game alternates about 2 Spicy for 1 Family card", () => {
    let s = startGame(5, { mode: "spicy", length: "long", showVoters: false }, { seed: 9 });
    const spicy: boolean[] = [];
    while (s.phase !== "AWARDS") {
      if (s.phase === "CARD") spicy.push(s.card?.spicy ?? false);
      s = s.phase === "CARD" ? playCard(s, {}) : tick(s);
    }
    expect(spicy).toEqual(spicy.map((_, i) => (i + 1) % 3 !== 0));
  });
  it("startBlocker: < 3 connected; fewer playable cards than the length; no card in the language", () => {
    expect(DEF.startBlocker(roster(2), settings(), CATALOG, "en")).toBe("NOT_ENOUGH_PLAYERS");
    const r = roster(3);
    (r[0] as { connected: boolean }).connected = false;
    expect(DEF.startBlocker(r, settings(), CATALOG, "en")).toBe("NOT_ENOUGH_PLAYERS");
    const small = { packs: [{ ...likelyFamilyPack(), cards: likelyFamilyPack().cards.slice(0, 10) }] };
    expect(DEF.startBlocker(roster(3), settings({ length: "normal" }), small, "en")).toBe("NO_CONTENT_AVAILABLE");
    expect(DEF.startBlocker(roster(3), settings({ length: "short" }), small, "en")).toBeNull();
    const noEs = { packs: [{ ...likelyFamilyPack(), locales: ["en", "fr", "ar"] as ("en" | "fr" | "ar" | "es")[] }] };
    expect(DEF.startBlocker(roster(3), settings(), noEs, "es")).toBe("NO_CONTENT_AVAILABLE");
    expect(DEF.start({ roster: roster(3), settings: settings({ length: "normal" }), locale: "en", memory: { usedKeys: [] }, seed: 1, now: 0, graceMs: 0, content: small })).toMatchObject({ ok: false, error: "NO_CONTENT_AVAILABLE" });
  });
  it("a skipped card goes to memory and does not come back this game", () => {
    let s = startGame(4);
    const first = s.card?.cardId as string;
    s = step(s, { type: "INTENT", intent: { type: "SKIP_CARD", cardId: first }, by: { kind: "tv" } }, 1_000_100);
    expect(DEF.memory(s).usedKeys).toContain(first);
    const seen: string[] = [];
    while (s.phase !== "AWARDS") {
      if (s.phase === "CARD") seen.push(s.card?.cardId as string);
      s = s.phase === "CARD" ? playCard(s, {}) : tick(s);
    }
    expect(seen).not.toContain(first);
  });
});
