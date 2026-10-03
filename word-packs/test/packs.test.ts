import { describe, expect, it } from "vitest";
import { normalizeGuess } from "@mishana/shared/engine";
import { WordPackSchema, type WordPack } from "@mishana/shared/packs";
import { PACKS } from "../index";

// Mirrors the §12.5 error rules; tools/pack-lint is the authoritative CLI (pnpm lint:packs).
const parsed: WordPack[] = PACKS.map((p) => WordPackSchema.parse(p));
const language = (p: WordPack): string => p.locale.split("-")[0] ?? p.locale;
const words = (p: WordPack): string[] =>
  p.pairs.flatMap((pair) => [pair.civilian, pair.undercover]).flatMap((s) => [s.text, ...(s.alt ?? []), ...(s.translit ? [s.translit] : [])]);

describe("word packs", () => {
  it("every pack parses with WordPackSchema", () => {
    for (const p of PACKS) expect(WordPackSchema.safeParse(p).success).toBe(true);
  });

  it("pack ids are unique and pair ids are unique within a pack", () => {
    const ids = parsed.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of parsed) {
      const pairIds = p.pairs.map((x) => x.id);
      expect(new Set(pairIds).size, p.id).toBe(pairIds.length);
    }
  });

  it("the two words of a pair never normalise to the same string", () => {
    for (const p of parsed)
      for (const pair of p.pairs)
        expect(normalizeGuess(pair.civilian.text), `${p.id}/${pair.id}`).not.toBe(normalizeGuess(pair.undercover.text));
  });

  it("no unordered pair repeats across the packs of a language", () => {
    const seen = new Map<string, string>();
    for (const p of parsed)
      for (const pair of p.pairs) {
        const k = [normalizeGuess(pair.civilian.text), normalizeGuess(pair.undercover.text)].sort().join("|");
        const key = `${language(p)}:${k}`;
        expect(seen.get(key), `${p.id}/${pair.id} repeats ${seen.get(key) ?? ""}`).toBeUndefined();
        seen.set(key, `${p.id}/${pair.id}`);
      }
  });

  it("the two sides of a pair share no guess form (text, alt or translit)", () => {
    const keys = (s: WordPack["pairs"][number]["civilian"]): Set<string> =>
      new Set([s.text, ...(s.alt ?? []), ...(s.translit ? [s.translit] : [])].map((w) => normalizeGuess(w)));
    for (const p of parsed)
      for (const pair of p.pairs) {
        const civ = keys(pair.civilian);
        expect([...keys(pair.undercover)].filter((k) => civ.has(k)), `${p.id}/${pair.id}`).toEqual([]);
      }
  });

  it("Arabic translit is readable (no chat digits) and uses sh, not ch", () => {
    for (const p of parsed.filter((x) => x.script === "Arab"))
      for (const pair of p.pairs)
        for (const s of [pair.civilian, pair.undercover]) {
          expect(s.translit ?? "", `${p.id}/${pair.id}`).not.toMatch(/[0-9]|ch/i);
        }
  });

  it("no word contains a percent sign", () => {
    for (const p of parsed) for (const w of words(p)) expect(w.includes("%"), `${p.id}: ${w}`).toBe(false);
  });

  it("scripts match the locale and seeded packs carry the MIT source", () => {
    for (const p of parsed) {
      expect(p.script, p.id).toBe(language(p) === "ar" ? "Arab" : "Latn");
      if (p.source === "antebrl/undercover-word-game") expect(p.license, p.id).toBe("MIT");
      if (p.source === "original") expect(p.license, p.id).toBe("CC-BY-4.0");
    }
  });

  it("meets the M1 minimum (>=20 pairs in at least one pack per language)", () => {
    for (const lang of ["en", "fr", "ar"]) {
      expect(parsed.some((p) => language(p) === lang && p.pairs.length >= 20), lang).toBe(true);
    }
  });

  it("meets the M4 targets (EN>=150, FR>=150, AR>=100 with Lebanese>=40)", () => {
    const count = (f: (p: WordPack) => boolean): number => parsed.filter(f).reduce((n, p) => n + p.pairs.length, 0);
    expect(count((p) => language(p) === "en")).toBeGreaterThanOrEqual(150);
    expect(count((p) => language(p) === "fr")).toBeGreaterThanOrEqual(150);
    expect(count((p) => language(p) === "ar")).toBeGreaterThanOrEqual(100);
    expect(count((p) => p.locale === "ar-LB")).toBeGreaterThanOrEqual(40);
  });
});
