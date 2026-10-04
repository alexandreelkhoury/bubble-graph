import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lintPacks, registeredPackFiles, type PackEntry } from "../src/lint";
import { lintDirectory } from "../src/main";

const REPO_WORD_PACKS = join(import.meta.dirname, "../../../word-packs");

type Side = { text: string; translit?: string | null; alt?: string[] };
function pack(id: string, locale: string, pairs: [Side | string, Side | string][], extra: Record<string, unknown> = {}): Record<string, unknown> {
  const side = (s: Side | string): Side => (typeof s === "string" ? { text: s } : s);
  return {
    id,
    version: 1,
    locale,
    script: locale.startsWith("ar") ? "Arab" : "Latn",
    title: { en: "T", fr: "T", ar: "T" },
    tags: [],
    ageRating: "all",
    license: "CC-BY-4.0",
    source: "original",
    status: "reviewed",
    tier: "free", // one free starter per language (PAYMENTS-SPEC §1.5); pass { tier: "premium" } for the others
    pairs: pairs.map(([c, u], i) => ({ id: `p${String(i + 1).padStart(3, "0")}`, civilian: side(c), undercover: side(u), difficulty: 1, reviewedBy: ["a", "b"] })),
    ...extra,
  };
}
const TEN: [string, string][] = Array.from({ length: 10 }, (_, i) => [`Alpha${i}`, `Beta${i}`]);
const entry = (data: Record<string, unknown>, dir = "en"): PackEntry => ({ file: `packs/${dir}/${String(data.id)}.json`, data });

describe("pack-lint rules", () => {
  it("accepts a valid pack (only the M4 count warnings)", () => {
    const r = lintPacks([entry(pack("en-ok-01", "en", TEN))]);
    expect(r.errors).toEqual([]);
    expect(r.counts.en).toBe(10);
    expect(r.warnings.every((w) => w.startsWith("M4 target not met") || w.includes("release gate"))).toBe(true);
  });

  it("schema failure", () => {
    const r = lintPacks([entry(pack("en-bad-01", "en", TEN.slice(0, 5)))]);
    expect(r.errors.join("\n")).toMatch(/schema: pairs/);
    const r2 = lintPacks([entry(pack("en-bad-02", "xx", TEN))]);
    expect(r2.errors.join("\n")).toMatch(/schema: locale/);
  });

  it("invalid JSON", () => {
    const r = lintPacks([{ file: "packs/en/x.json", data: null, parseError: "Unexpected token" }]);
    expect(r.errors[0]).toMatch(/invalid JSON/);
  });

  it("duplicate pack id", () => {
    const a = entry(pack("en-dup-01", "en", TEN));
    const b = { file: "packs/en/copy/en-dup-01.json", data: pack("en-dup-01", "en", TEN.map(([x, y]) => [`${x}x`, `${y}x`] as [string, string])) };
    const r = lintPacks([a, b]);
    expect(r.errors.join("\n")).toMatch(/duplicate pack id "en-dup-01"/);
  });

  it("duplicate pair id within a pack", () => {
    const p = pack("en-pid-01", "en", TEN);
    (p.pairs as { id: string }[])[1]!.id = "p001";
    const r = lintPacks([entry(p)]);
    expect(r.errors.join("\n")).toMatch(/en-pid-01\/p001: duplicate pair id/);
  });

  it("civilian and undercover normalising to the same string", () => {
    const r = lintPacks([entry(pack("en-same-01", "en", [["Café", "cafe"], ...TEN.slice(1)]))]);
    expect(r.errors.join("\n")).toMatch(/normalise to the same string "cafe"/);
    const r2 = lintPacks([entry(pack("ar-same-01", "ar", [["القهوة", "قهوه"], ...TEN.slice(1)]), "ar")]);
    expect(r2.errors.join("\n")).toMatch(/normalise to the same string/);
  });

  it("the same unordered pair twice across packs of one language (ar and ar-LB share a language)", () => {
    const a = entry(pack("en-a-01", "en", TEN));
    const b = entry(pack("en-b-01", "en", [["beta0", "ALPHA0"], ...TEN.slice(1).map(([x, y]) => [`${x}z`, `${y}z`] as [string, string])], { tier: "premium" }));
    expect(lintPacks([a, b]).errors.join("\n")).toMatch(/en-b-01\/p001: same pair as en-a-01\/p001/);

    const fr = entry(pack("fr-a-01", "fr", TEN), "fr"); // same words, other language: fine
    expect(lintPacks([a, fr]).errors).toEqual([]);

    const ar = entry(pack("ar-a-01", "ar", [["قهوة", "شاي"], ...TEN.slice(1)]), "ar");
    const lb = entry(pack("lb-a-01", "ar-LB", [["شاي", "قهوه"], ...TEN.slice(1).map(([x, y]) => [`${x}q`, `${y}q`] as [string, string])], { tier: "premium" }), "ar");
    expect(lintPacks([ar, lb]).errors.join("\n")).toMatch(/lb-a-01\/p001: same pair as ar-a-01\/p001/);
  });

  it("any word containing %", () => {
    const r = lintPacks([entry(pack("en-pct-01", "en", [["100%", "Half"], [{ text: "A", alt: ["B%"] }, "C"], ...TEN.slice(2)]))]);
    const errs = r.errors.join("\n");
    expect(errs).toMatch(/"100%" contains "%"/);
    expect(errs).toMatch(/"B%" contains "%"/);
  });

  it("file name and directory must match the pack", () => {
    const r = lintPacks([{ file: "packs/fr/wrong.json", data: pack("en-x-01", "en", TEN) }]);
    const errs = r.errors.join("\n");
    expect(errs).toMatch(/file name must be en-x-01.json/);
    expect(errs).toMatch(/must live in packs\/en\//);
  });

  it("civilian and undercover sharing a guess form via alt or translit is an error", () => {
    const pairs: [Side | string, Side | string][] = [[{ text: "Sofa", alt: ["Couch"] }, { text: "Settee", alt: ["couch"] }], ...TEN.slice(1)];
    expect(lintPacks([entry(pack("en-alt-01", "en", pairs))]).errors.join("\n")).toMatch(/en-alt-01\/p001: civilian and undercover share the guess form\(s\) "couch"/);
    const ar: [Side | string, Side | string][] = [[{ text: "بحر", translit: "Bahr" }, { text: "نهر", translit: "Nahr", alt: ["bahr"] }], ...TEN.slice(1)];
    expect(lintPacks([entry(pack("ar-alt-01", "ar", ar), "ar")]).errors.join("\n")).toMatch(/ar-alt-01\/p001: .*share.*"bahr"/);
  });

  it("warns about profane translit or alt (EN and FR lists for Arabic packs)", () => {
    const ar: [Side | string, Side | string][] = [[{ text: "شتي", translit: "Shite" }, { text: "مقص", translit: "Ma'ass", alt: ["merde"] }], ...TEN.slice(1)];
    const w = lintPacks([entry(pack("ar-prof-01", "ar", ar), "ar")]).warnings.join("\n");
    expect(w).toMatch(/p001: "Shite" contains a profane word \(shite\)/);
    expect(w).toMatch(/p001: "Ma'ass" contains a profane word \(ass\)/);
    expect(w).toMatch(/p001: "merde" contains a profane word/);
    const clean: [Side | string, Side | string][] = [[{ text: "شتي", translit: "Sheti" }, { text: "مقص", translit: "Ma'as" }], ...TEN.slice(1)];
    expect(lintPacks([entry(pack("ar-prof-02", "ar", clean), "ar")]).warnings.join("\n")).not.toMatch(/profane/);
  });

  it("warns about chat digits and mixed sh/ch in Arabic translit", () => {
    const ar: [Side | string, Side | string][] = [[{ text: "شاي", translit: "Shay" }, { text: "شط", translit: "Chatt" }], [{ text: "حمص", translit: "7ommos" }, { text: "متبل", translit: "Mtabbal" }], ...TEN.slice(2)];
    const w = lintPacks([entry(pack("ar-tr-01", "ar", ar), "ar")]).warnings.join("\n");
    expect(w).toMatch(/ar-tr-01: translit mixes "sh" and "ch".*Chatt/);
    expect(w).toMatch(/p002: translit "7ommos" uses chat digits/);
  });

  it("warns about plural-looking Latin words without alt", () => {
    const pairs: [Side | string, Side | string][] = [["Socks", "Bus"], [{ text: "Chaussettes", alt: ["Chaussette"] }, "Chevaux"], ...TEN.slice(2)];
    const w = lintPacks([entry(pack("en-pl-01", "en", pairs))]).warnings.join("\n");
    expect(w).toMatch(/p001: "Socks" looks plural/);
    expect(w).not.toMatch(/"Bus" looks plural/);
    expect(w).not.toMatch(/"Chaussettes" looks plural/);
    expect(w).toMatch(/p002: "Chevaux" looks plural/);
  });

  it("warns about near-duplicate pairs once alt is expanded", () => {
    const a = pack("en-nd-01", "en", [["Beach", { text: "Pool", alt: ["Swimming pool"] }], ...TEN.slice(1)]);
    const b = pack("en-nd-02", "en", [["Swimming pool", "Beach"], ...TEN.slice(1).map(([x, y]) => [`${x}z`, `${y}z`] as [string, string])], { tier: "premium" });
    const r = lintPacks([entry(a), entry(b)]);
    expect(r.errors).toEqual([]);
    expect(r.warnings.join("\n")).toMatch(/en-nd-02\/p001: near-duplicate of en-nd-01\/p001/);
  });

  it("warnings: draft status, fewer than 2 reviewers, unregistered file, M4 targets", () => {
    const p = pack("en-w-01", "en", TEN, { status: "draft" });
    (p.pairs as { reviewedBy: string[] }[])[0]!.reviewedBy = ["a"];
    const r = lintPacks([entry(p)], []);
    expect(r.errors).toEqual([]);
    const w = r.warnings.join("\n");
    expect(w).toMatch(/status is "draft"/);
    expect(w).toMatch(/1\/10 pairs have fewer than 2 reviewers/);
    expect(w).toMatch(/not listed in word-packs\/index.ts/);
    expect(w).toMatch(/M4 target not met: en has 10 pairs \(target 150\)/);
    expect(w).toMatch(/M4 target not met: ar-LB has 0 pairs/);
  });

  it("PAYMENTS-SPEC §1.5: exactly one free pack per language (ar-LB counts as ar)", () => {
    const enFree = entry(pack("en-f-01", "en", TEN));
    const enFree2 = entry(pack("en-f-02", "en", TEN.map(([x, y]) => [`${x}k`, `${y}k`] as [string, string])));
    expect(lintPacks([enFree, enFree2]).errors.join("\n")).toMatch(/language en: exactly one free .* found 2 \(en-f-01, en-f-02\)/);
    const enPrem = entry(pack("en-p-01", "en", TEN, { tier: "premium" }));
    expect(lintPacks([enPrem]).errors.join("\n")).toMatch(/language en: exactly one free .* found 0/);
    const arFree = entry(pack("ar-f-01", "ar", TEN.map(([x, y]) => [`ع${x}`, `غ${y}`] as [string, string])), "ar");
    const lbFree = entry(pack("lb-f-01", "ar-LB", TEN.map(([x, y]) => [`ف${x}`, `ق${y}`] as [string, string])), "ar");
    const errs = lintPacks([arFree, lbFree]).errors.join("\n");
    expect(errs).toMatch(/language ar: exactly one free/);
    expect(errs).toMatch(/lb-f-01: a free pack must have locale en, fr or ar/);
  });

  it("PAYMENTS-SPEC §1.5: free packs are for all ages; premium id length; product ids", () => {
    const teen = lintPacks([entry(pack("en-t-01", "en", TEN, { ageRating: "teen" }))]);
    expect(teen.errors.join("\n")).toMatch(/en-t-01: a free pack must have ageRating "all"/);
    const longId = "en-" + "a".repeat(30) + "-01"; // 36 chars > 35
    const r = lintPacks([entry(pack("en-f-01", "en", TEN)), entry(pack(longId, "en", TEN.map(([x, y]) => [`${x}m`, `${y}m`] as [string, string]), { tier: "premium" }))]);
    expect(r.errors.join("\n")).toMatch(/at most 35 characters/);
  });

  it("PAYMENTS-SPEC §1.5: starter < 40 pairs warns, errors with --release; premium < 20 pairs warns", () => {
    const entries = [entry(pack("en-f-01", "en", TEN)), entry(pack("en-p-01", "en", TEN.map(([x, y]) => [`${x}m`, `${y}m`] as [string, string]), { tier: "premium" }))];
    const dev = lintPacks(entries);
    expect(dev.errors).toEqual([]);
    expect(dev.warnings.join("\n")).toMatch(/en-f-01: free starter pack has 10 pairs \(release gate: at least 40\)/);
    expect(dev.warnings.join("\n")).toMatch(/en-p-01: premium pack has only 10 pairs/);
    const rel = lintPacks(entries, null, { release: true });
    expect(rel.errors.join("\n")).toMatch(/en-f-01: free starter pack has 10 pairs/);
  });

  it("reads registered files from index.ts", () => {
    const src = 'import a from "./packs/en/en-a-01.json";\nimport b from \'./packs/ar/lb-b-01.json\';\n';
    expect(registeredPackFiles(src)).toEqual(["packs/en/en-a-01.json", "packs/ar/lb-b-01.json"]);
  });

  it("lints a directory and reports bad JSON files", () => {
    const root = mkdtempSync(join(tmpdir(), "pack-lint-"));
    mkdirSync(join(root, "packs/en"), { recursive: true });
    writeFileSync(join(root, "packs/en/en-ok-01.json"), JSON.stringify(pack("en-ok-01", "en", TEN)));
    writeFileSync(join(root, "packs/en/en-broken-01.json"), "{ nope");
    writeFileSync(join(root, "index.ts"), 'import a from "./packs/en/en-ok-01.json";');
    const r = lintDirectory(root);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/en-broken-01.json: invalid JSON/);
  });
});

describe("repository word packs", () => {
  it("have zero lint errors and meet the M4 counts", () => {
    const r = lintDirectory(REPO_WORD_PACKS);
    expect(r.errors).toEqual([]);
    expect(r.warnings.filter((w) => w.startsWith("M4") || w.includes("not listed"))).toEqual([]);
  });

  it("have no profanity, translit-convention, plural or near-duplicate warnings", () => {
    const r = lintDirectory(REPO_WORD_PACKS);
    expect(r.warnings.filter((w) => /profane|translit|looks plural|near-duplicate/.test(w))).toEqual([]);
  });
});
