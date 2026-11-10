// Bluff content (GAME-BLUFF §11, §14; JAMAA-PLATFORM §5.5, §6.5 lane D exit criteria). Owned by the G2 lane D.
// The engine and lint helpers are imported by path: neither is a public `@jamaa/shared` export (server/sim/tests only).
import { describe, expect, it } from "vitest";
import { content } from "../../shared/src/games/bluff/content";
import { BLOCKLIST, contentCounts, displayNormalize, hitsBlocklist, isTooClose, playableItems, scriptOk, startBlocker, type BluffCatalog, type BluffPack } from "../../shared/src/games/bluff/engine/index";
import { lintBluffRaw } from "../../tools/content-lint/src/games/bluff";
import ar from "../../shared/i18n/games/bluff/ar.json";
import en from "../../shared/i18n/games/bluff/en.json";
import es from "../../shared/i18n/games/bluff/es.json";
import fr from "../../shared/i18n/games/bluff/fr.json";
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

describe("bluff packs: review fixes (2026-11-10)", () => {
  it("no context-free fallback house lies: none for facts, sayings or finals, and never a meta answer", () => {
    for (const p of packs) {
      for (const t of ["fact_blank", "proverb_end", "no_truth"] as const) expect(p.fallbackHouseLies[t], `${p.id} ${t}`).toBeUndefined();
      for (const it of p.items)
        for (const s of Object.values(it.houseLies).flat()) expect(s, `${p.id}/${it.id}`).not.toMatch(/nobody knows|personne ne sait|nadie lo sabe|ما حدا بيعرف/i);
    }
  });

  it("round-1 sayings every native adult knows are knownIn their own locale (so never drawn there) and difficulty 1", () => {
    const famous: Record<string, string[]> = {
      "bluff-en-sayings": ["enp-002", "enp-016", "enp-042", "enp-021", "enp-047", "enp-035", "enp-030", "enp-032", "enp-031"],
      "bluff-fr-proverbes": ["frp-016", "frp-038", "frp-060", "frp-025"],
      "bluff-es-refranes": ["esp-005", "esp-003", "esp-021", "esp-049"],
    };
    for (const [id, ids] of Object.entries(famous)) {
      const p = pack(id);
      for (const iid of ids) {
        const it = p.items.find((i) => i.id === iid);
        expect(it?.knownIn, `${id}/${iid}`).toContain(p.sourceLocale);
        expect(it?.difficulty, `${id}/${iid}`).toBe(1);
      }
      // ≥ 30 half-known sayings stay playable, and the famous ones are a minority of the pack.
      const known = p.items.filter((i) => i.knownIn.includes(p.sourceLocale)).length;
      expect(p.items.length - known, id).toBeGreaterThanOrEqual(30);
    }
  });

  it("famous Lebanese proverbs are knownIn ar, and endings shared with an EN/FR/ES proverb are knownIn that locale", () => {
    const p = pack("bluff-lb-proverbs");
    const known = (iid: string): string[] => p.items.find((i) => i.id === iid)?.knownIn ?? [];
    for (const iid of ["lbp-004", "lbp-018", "lbp-022", "lbp-030", "lbp-031", "lbp-049", "lbp-050"]) expect(known(iid), iid).toContain("ar");
    for (const iid of ["lbp-033", "lbp-053"]) expect(known(iid), iid).toEqual(expect.arrayContaining(["en", "fr", "es"]));
    expect(known("lbp-020")).toEqual(expect.arrayContaining(["fr", "es"]));
    expect(known("lbp-021")).toEqual(expect.arrayContaining(["en", "fr"]));
    expect(p.items.find((i) => i.id === "lbp-024")?.prompt.original).not.toMatch(/[?؟]…$/);
  });

  it("everyday Lebanese words are knownIn ar in Teta's Words", () => {
    const p = pack("bluff-lb-teta-words");
    for (const iid of ["ltw-001", "ltw-008", "ltw-013", "ltw-015", "ltw-016", "ltw-017", "ltw-018", "ltw-020"])
      expect(p.items.find((i) => i.id === iid)?.knownIn, iid).toContain("ar");
  });

  it("finals: one note per item, never the old blanket note, and no two items share house answers", () => {
    for (const l of LOCALES) {
      const p = pack(`bluff-no-truth-${l}`);
      const notes = p.items.map((i) => i.note[l] ?? "");
      expect(new Set(notes).size, l).toBe(notes.length);
      for (const n of notes) expect(n).not.toMatch(/never was a right answer|jamais eu de bonne réponse|Nunca hubo respuesta|ما كان في جواب صح/);
      const lies = p.items.flatMap((i) => i.houseLies[l] ?? []);
      expect(new Set(lies).size, l).toBe(lies.length);
    }
  });

  it("fixed facts: bubble wrap was invented (not sold) as wallpaper; Iceland's first mosquitoes; tomato pills", () => {
    const w = pack("bluff-world-facts");
    const it = (iid: string) => w.items.find((i) => i.id === iid);
    expect(it("wf-010")?.prompt.original).toMatch(/invented/);
    expect(it("wf-035")?.prompt.original).toMatch(/Until 2025/);
    expect(it("wf-019")?.prompt.original).toMatch(/tomato pills/);
    expect(pack("bluff-fr-proverbes").items.find((i) => i.id === "frp-044")?.houseLies.fr).not.toContain("Du dire au faire");
  });
});

describe("bluff i18n: review fixes (2026-11-10)", () => {
  const dicts = { en, fr, ar, es } as Record<Loc, Record<string, unknown>>;
  it("the final's intro does not repeat the card header, and the rules promise only what the reveal keeps (ballots)", () => {
    expect(String(en["game.bluff.round.noTruth.intro"])).not.toMatch(/^Final round/);
    expect(String(fr["game.bluff.round.noTruth.intro"])).not.toMatch(/^Finale/);
    expect(String(es["game.bluff.round.noTruth.intro"])).not.toMatch(/^Ronda final/);
    expect(String(ar["game.bluff.round.noTruth.intro"])).not.toMatch(/^الجولة الأخيرة/);
    expect(String(en["game.bluff.rules.final.body"])).toMatch(/Ballots are never shown/);
    for (const l of LOCALES) expect(String(dicts[l]["game.bluff.rules.final.body"]), l).not.toMatch(/Nobody sees|Personne ne voit|Nadie ve|ما حدا بيعرف/);
  });

  it("AR copy about a player never uses a masculine verb (pins and awards land on anyone, GAME-BLUFF §10)", () => {
    expect(ar["game.bluff.reveal.knewItPin"]).toBe("بالضبط!");
    expect(ar["game.bluff.awards.hookLineSinker"]).not.toMatch(/بلعها/);
    const flat = (v: unknown): string => (typeof v === "string" ? v : Object.values(v as Record<string, string>).join(" | "));
    for (const k of ["game.bluff.reveal.fooled", "game.bluff.awards.bluffOfTheNight.body", "game.bluff.awards.lieDetector.body", "game.bluff.awards.hookLineSinker.body", "game.bluff.reveal.foundEarly"])
      expect(flat((ar as Record<string, unknown>)[k]), k).not.toMatch(/ضحك على|لقى|بلعها|لقاها/);
  });
});
