import { describe, expect, it } from "vitest";
import { playableCatalog } from "../../src/billing/access";
import { loadCatalog } from "../../src/packs";
import { projectForPlayer, projectForTv } from "../../src/projection/project";
import type { ViewAccess } from "../../src/projection/project";
import { findLeaks, makeTokenCatalog, playGame } from "../../src/testing";

const catalog = makeTokenCatalog(40);
const BATCHES = Array.from({ length: 10 }, (_, i) => [i * 100 + 1, i * 100 + 100] as const);

describe("secret-leak property (§5.4): 1,000 seeded games with a synthetic token catalog", () => {
  it.each(BATCHES)("seeds %i..%i", { timeout: 120_000 }, (from, to) => {
    let steps = 0;
    for (let seed = from; seed <= to; seed++) {
      const n = 3 + (seed % 10);
      const out = playGame(
        catalog,
        { players: n, seed, correctGuessRate: 0.3, settings: { revealRoles: seed % 7 === 0, blankGuess: true } },
        (_prev, action, res) => {
          steps++;
          const leaks = findLeaks(res.state, catalog);
          if (leaks.length) throw new Error(`seed ${seed} after ${action.type}: ${leaks.slice(0, 3).join("; ")}`);
        },
      );
      expect(out.failure).toBeNull();
    }
    expect(steps).toBeGreaterThan(1000);
  });

  it("the checker catches leaks (self-test)", () => {
    const out = playGame(catalog, { players: 5, seed: 3 });
    // Find a mid-game state and plant a leak in a copy of it.
    let found = false;
    playGame(catalog, { players: 5, seed: 3 }, (_p, _a, res) => {
      if (found || res.state.phase !== "CLUES") return;
      found = true;
      const s = structuredClone(res.state);
      expect(findLeaks(s, catalog)).toEqual([]);
      const civ = s.players.find((p) => p.role === "CIVILIAN");
      if (civ && s.pair) civ.name = s.pair.undercover.text; // a secret word in a public field
      expect(findLeaks(s, catalog).length).toBeGreaterThan(0);
      // A guess text in state is stripped by the projection before RESULTS.
      const s2 = structuredClone(res.state);
      s2.guessLog.push({ playerId: s2.players[0]!.id, status: "WRONG", text: "zzsecretguess", overridden: false });
      s2.players[1]!.name = "zzsecretguess";
      expect(findLeaks(s2, catalog).some((e) => e.includes("secret"))).toBe(true);
    });
    expect(found).toBe(true);
    expect(out.failure).toBeNull();
  });
});

/** PAYMENTS-SPEC §7.1: two token packs, one free (`zzfree…`) and one premium (`zzprem…`), same language. */
function freeAndPremiumCatalog() {
  const n4 = (i: number): string => String(i).padStart(4, "0");
  const tokenPack = (id: string, tag: string, tier: "free" | "premium") => ({
    id, version: 1, locale: "en", script: "Latn", ageRating: "all", tier, tags: ["test"], license: "CC-BY-4.0", source: "original", status: "draft",
    title: { en: `Pack ${tier}`, fr: `Paquet ${tier}`, ar: "رزمة" },
    pairs: Array.from({ length: 30 }, (_, i) => ({
      id: `p${n4(i + 1)}`, difficulty: ((i % 3) + 1) as 1 | 2 | 3, reviewedBy: [],
      civilian: { text: `${tag}c${n4(i + 1)}`, translit: `${tag}t${n4(i + 1)}`, alt: [`${tag}a${n4(i + 1)}`] },
      undercover: { text: `${tag}u${n4(i + 1)}`, alt: [`${tag}b${n4(i + 1)}`] },
    })),
  });
  return loadCatalog([tokenPack("zz-free-01", "zzfree", "free"), tokenPack("zz-prem-01", "zzprem", "premium")]);
}

describe("premium leak property (PAYMENTS-SPEC §7.1): 1,000 seeded games in a free room", () => {
  const full = freeAndPremiumCatalog();
  const playable = playableCatalog(full, false, new Set());
  const access: ViewAccess = { premium: false, fullCatalog: full, tvBusy: false };
  const LOCKED_KEYS = ["ageRating", "id", "locale", "pairCount", "productId", "title"];

  it("the free playable catalog has only the free pack", () => {
    expect(playable.packs.map((p) => p.id)).toEqual(["zz-free-01"]);
  });

  it.each(BATCHES)("seeds %i..%i: no zzprem token in any view, lockedPacks metadata only", { timeout: 120_000 }, (from, to) => {
    let lockedSeen = 0;
    for (let seed = from; seed <= to; seed++) {
      const n = 3 + (seed % 10);
      const out = playGame(playable, { players: n, seed, correctGuessRate: 0.3, settings: { packIds: [], blankGuess: true } }, (_prev, action, res) => {
        const s = res.state;
        const views = [projectForTv(s, playable, access), projectForPlayer(s, playable, null, access), ...s.players.map((p) => projectForPlayer(s, playable, p.id, access))];
        for (const v of views) {
          if (JSON.stringify(v).includes("zzprem")) throw new Error(`seed ${seed} after ${action.type}: premium token in a view`);
          for (const lp of v.lockedPacks) {
            lockedSeen++;
            if (JSON.stringify(Object.keys(lp).sort()) !== JSON.stringify(LOCKED_KEYS)) throw new Error(`lockedPacks keys ${Object.keys(lp).join(",")}`);
          }
        }
        if (s.pair && s.pair.packId !== "zz-free-01") throw new Error(`seed ${seed}: picked ${s.pair.packId}`);
      });
      expect(out.failure).toBeNull();
    }
    expect(lockedSeen).toBeGreaterThan(0);
  });
});
