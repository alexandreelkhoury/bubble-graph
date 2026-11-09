// Bluff content (GAME-BLUFF §11, §14; JAMAA-PLATFORM §5.5, §6.5 lane D exit criteria). Owned by the G2 lane D.
// The engine and lint helpers are imported by path: neither is a public `@jamaa/shared` export (server/sim/tests only).
import { describe, expect, it } from "vitest";
import { content } from "../../shared/src/games/bluff/content";
import { BLOCKLIST, contentCounts, displayNormalize, hitsBlocklist, isTooClose, playableItems, scriptOk, startBlocker, type BluffCatalog, type BluffPack } from "../../shared/src/games/bluff/engine/index";
import { lintBluffRaw } from "../../tools/content-lint/src/games/bluff";
import { PACKS } from "./index";

const LOCALES = ["en", "fr", "ar", "es"] as const;
type Loc = (typeof LOCALES)[number];
const packs: BluffPack[] = PACKS.map((p) => content.parse(p));
const byId = new Map(packs.map((p) => [p.id, p]));
const pack = (id: string): BluffPack => {
  const p = byId.get(id);
  if (!p) throw new Error(`missing pack ${id}`);
  return p;
};
const freeCatalog: BluffCatalog = { packs: packs.map((p) => content.playable(p, { premium: false, ownedFamilies: new Set() })).filter((p): p is BluffPack => p !== null) };
const fullCatalog: BluffCatalog = { packs };
const roster = [0, 1, 2].map((i) => ({ id: `p${i}`, seat: i, locale: "en" as const, connected: true, carryScore: 0 }));

describe("bluff packs: schema and lint", () => {
  it("every listed pack parses with the §11.3 schema and derives its PackMeta", () => {
    expect(packs.length).toBe(11);
    for (const p of packs) {
      const m = content.meta(p);
      expect(m.gameId).toBe("bluff");
      expect(m.family).toBe(p.id);
      expect(m.languages).toEqual(p.playableIn);
      expect(m.freeItemCount).toBeGreaterThan(0);
    }
  });

  it("content-lint's Bluff rules report no error (drafts are warnings until --release)", () => {
    const r = lintBluffRaw(PACKS.map((raw) => ({ file: `bluff/${(raw as { id: string }).id}.json`, raw })));
    expect(r.errors).toEqual([]);
    const rel = lintBluffRaw(PACKS.map((raw) => ({ file: "x", raw })), { release: true });
    // Nothing is reviewed yet (owner + native review pending), so the release gate must still refuse the free drafts.
    expect(rel.errors.some((e) => e.includes("must be reviewed before release"))).toBe(true);
  });

  it("pack ids and item ids are unique across Bluff", () => {
    const ids = packs.flatMap((p) => p.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(packs.map((p) => p.id)).size).toBe(packs.length);
  });
});

describe("bluff packs: what players see", () => {
  const playerTexts = (p: BluffPack, l: Loc): string[] =>
    p.items.flatMap((i) => [...(i.truth[l] ? [i.truth[l] as string] : []), ...(i.houseLies[l] ?? [])]);

  it("truths and house lies are already display-normalised, in the room's script and pass the blocklist", () => {
    for (const p of packs)
      for (const l of p.playableIn) {
        const list = [...playerTexts(p, l), ...Object.values(p.fallbackHouseLies).flatMap((v) => v?.[l] ?? [])];
        for (const s of list) {
          expect(displayNormalize(s), `${p.id} ${l} "${s}"`).toBe(s);
          expect(scriptOk(s, l), `${p.id} ${l} "${s}"`).toBe(true);
          expect(hitsBlocklist(s, BLOCKLIST[l]), `${p.id} ${l} blocked "${s}"`).toBe(false);
        }
      }
  });

  it("no house lie would be refused as 'too close' by the engine (§5.2), in the room locale or the source locale", () => {
    for (const p of packs)
      for (const it of p.items) {
        if (it.type === "no_truth") continue;
        for (const l of p.playableIn) {
          const truths = [it.truth[l], ...(it.truthAlt[l] ?? []), it.truth[p.sourceLocale], ...(it.truthAlt[p.sourceLocale] ?? [])].filter((x): x is string => !!x);
          for (const h of it.houseLies[l] ?? []) expect(isTooClose(h, truths), `${p.id}/${it.id} ${l} "${h}"`).toBe(false);
        }
      }
  });

  it("no reviewer remark leaks into a prompt, truth, house lie or note", () => {
    for (const p of packs)
      for (const it of p.items) {
        const texts = [it.prompt.original, it.prompt.translit ?? "", ...Object.values(it.prompt.display), ...Object.values(it.truth), ...Object.values(it.note), ...Object.values(it.houseLies).flat()];
        for (const s of texts) expect(s, `${p.id}/${it.id}`).not.toMatch(/\[|VERIFY|native review/i);
      }
  });

  it("every saying and fact keeps a [VERIFY] source note while it is a draft (§11.2 rules 8–9)", () => {
    for (const p of packs)
      for (const it of p.items)
        if (it.type === "proverb_end" || it.type === "fact_blank" || it.type === "word_meaning") {
          expect(it.review.source, `${p.id}/${it.id}`).toMatch(/\[VERIFY\]/);
          expect(it.review.status).toBe("draft");
        }
  });

  it("finals are open questions with no truth, ending in a question mark", () => {
    for (const l of LOCALES) {
      const p = pack(`bluff-no-truth-${l}`);
      expect(p.playableIn).toEqual([l]);
      for (const it of p.items) {
        expect(it.type).toBe("no_truth");
        expect(it.truth).toEqual({});
        expect(it.prompt.original, it.id).toMatch(/[?؟]$/);
        expect((it.houseLies[l] ?? []).length, it.id).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("bluff packs: G2 exit criteria (JAMAA-PLATFORM §6.5, GAME-BLUFF §11.5, §15)", () => {
  it("a free room can play a Long game in every language from free items only", () => {
    for (const l of LOCALES)
      for (const length of ["short", "normal", "long"] as const)
        expect(startBlocker(roster, { packIds: [], length, pace: "normal" }, freeCatalog, l), `${l} ${length}`).toBeNull();
  });

  it("each round has its own free pool in every language (no cross-round filling in a Normal game)", () => {
    for (const l of LOCALES) {
      const c = contentCounts(freeCatalog, [], l);
      expect(c.r1, `${l} round 1`).toBeGreaterThanOrEqual(7);
      expect(c.r2, `${l} round 2`).toBeGreaterThanOrEqual(7);
      expect(c.final, `${l} final`).toBeGreaterThanOrEqual(12);
    }
  });

  it("bluff-lb-proverbs has ≥ 3 EN/FR/ES house lies per item, so it can play in EN/FR/ES rooms", () => {
    const p = pack("bluff-lb-proverbs");
    expect(p.playableIn).toEqual(["ar", "en", "fr", "es"]);
    for (const it of p.items) for (const l of ["en", "fr", "es"] as const) expect((it.houseLies[l] ?? []).length, `${it.id} ${l}`).toBeGreaterThanOrEqual(3);
    for (const it of p.items) expect(it.prompt.translit, it.id).toBeTruthy();
  });

  it("a free AR room has ≥ 20 free round-2 prompts not knownIn ar, and ≥ 40 rare Lebanese proverbs", () => {
    const r2 = playableItems(freeCatalog, [], "ar").filter((c) => c.item.type !== "proverb_end" && c.item.type !== "no_truth");
    expect(r2.length).toBeGreaterThanOrEqual(20);
    const teta = playableItems(freeCatalog, ["bluff-lb-teta-words"], "ar");
    expect(teta.length).toBeGreaterThanOrEqual(20);
    expect(pack("bluff-lb-teta-words").items.length).toBeGreaterThanOrEqual(40);
    const rare = pack("bluff-lb-proverbs").items.filter((i) => !i.knownIn.includes("ar"));
    expect(rare.length).toBeGreaterThanOrEqual(40);
  });

  it("round-1 sayings packs reach 30+ playable items, facts reach 30+ with ES, finals reach 24+ per language", () => {
    for (const [id, l] of [["bluff-fr-proverbes", "fr"], ["bluff-en-sayings", "en"], ["bluff-es-refranes", "es"]] as const)
      expect(playableItems(fullCatalog, [id], l).length, id).toBeGreaterThanOrEqual(30);
    for (const id of ["bluff-world-facts", "bluff-me-facts"]) {
      const p = pack(id);
      expect(p.playableIn).toEqual(["en", "fr", "ar", "es"]);
      expect(p.items.filter((i) => (i.houseLies.es ?? []).length >= 3).length, id).toBeGreaterThanOrEqual(30);
    }
    for (const l of LOCALES) expect(pack(`bluff-no-truth-${l}`).items.length).toBeGreaterThanOrEqual(24);
  });

  it("every launch pack is family-friendly (ageRating all) and ≥ 30 % free", () => {
    for (const p of packs) {
      expect(p.ageRating).toBe("all");
      expect(p.items.filter((i) => i.tier === "free").length / p.items.length, p.id).toBeGreaterThanOrEqual(0.3);
    }
  });
});
