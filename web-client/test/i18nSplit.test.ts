// JAMAA-PLATFORM §3.8: phones load only the phone part of the root catalog (lib/i18nSplit.ts). Phone code (anything
// outside src/tv-mock and the games' TV screens) must not use a TV-only key, or a phone would show the raw key.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "@jamaa/shared/i18n/en.json";
import { isTvOnlyKey, splitCatalog } from "../src/lib/i18nSplit";

const SRC = join(__dirname, "..", "src");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}
const isTvFile = (p: string): boolean => /[\\/]tv-mock[\\/]/.test(p) || /[\\/]games[\\/][a-z]+[\\/](tv[\\/]|tv\.tsx|tv[A-Z])/.test(p);

describe("root catalog split", () => {
  it("the two parts partition the catalog", () => {
    const phone = splitCatalog(en, false), tv = splitCatalog(en, true);
    expect(Object.keys(phone).length + Object.keys(tv).length).toBe(Object.keys(en).length);
    expect(Object.keys(tv).length).toBeGreaterThan(20);
    expect(phone["pass.endedPhone"]).toBeDefined();
    expect(Object.keys(phone).some(isTvOnlyKey)).toBe(false);
  });
  it("phone code uses no TV-only key", () => {
    const bad: string[] = [];
    for (const f of files(SRC).filter((p) => !isTvFile(p))) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/["'`]((?:store|pass|tv)\.[A-Za-z0-9_.]+)["'`]/g)) if (isTvOnlyKey(m[1]!)) bad.push(`${f}: ${m[1]}`);
      if (/[`]\s*(store|pass|tv)\.\$\{/.test(src)) bad.push(`${f}: dynamic TV-only key`);
    }
    expect(bad).toEqual([]);
  });
});
