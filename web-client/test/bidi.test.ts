import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCatalog, translate } from "../src/i18n/t";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

describe("bidi", () => {
  // `.num` forces direction:ltr; on a translated sentence it scrambles Arabic ("من 4 صوّتوا 1").
  it("never puts .num on an element holding a translated sentence", () => {
    const bad: string[] = [];
    for (const f of files(join(__dirname, "../src"))) {
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        if (/class=\{?["`][^"`]*\bnum\b[^"`]*["`]\}?[^>]*>\s*(\(|\{)?\s*(\{|\()?\s*t\(/.test(line)) bad.push(`${f}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });

  // Bidi isolates go through isolate()/isolateLtr() (i18n/t.ts), never inline: an inline one is easy to forget.
  it("never inlines a raw U+2068 / U+2066 isolate in a component", () => {
    const bad: string[] = [];
    for (const f of files(join(__dirname, "../src"))) {
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        if (/[\u2066\u2068]|\\u206[68]/.test(line)) bad.push(`${f}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it("AR vote progress reads cast-of-expected in logical (RTL) order", async () => {
    await loadCatalog("ar");
    const s = translate("ar", "vote.progress", { cast: 1, expected: 4 });
    expect(s.indexOf("1")).toBeLessThan(s.indexOf("4"));
    expect(s.indexOf("1")).toBeLessThan(s.indexOf("من"));
  });
});
