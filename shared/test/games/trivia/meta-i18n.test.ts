// Every i18n key TRIVIA_META names (rules, rule sections, pause items, settings rows and options) exists in all four
// game locale files: the setup panes and the pause menus resolve labels through these keys on every surface.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TRIVIA_META } from "../../../src/games/trivia/meta";

const LOCALES = ["en", "fr", "ar", "es"] as const;
const dict = (l: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(__dirname, "../../../i18n/games/trivia", `${l}.json`), "utf8")) as Record<string, unknown>;

function metaKeys(): string[] {
  const r = TRIVIA_META.rules;
  const keys = [r.titleKey, r.taglineKey, ...r.howToKeys];
  for (const s of r.ruleSections) keys.push(s.titleKey, s.bodyKey);
  for (const p of r.pauseItems) keys.push(p.labelKey);
  for (const row of [...TRIVIA_META.settings.basic, ...TRIVIA_META.settings.advanced]) {
    keys.push(row.labelKey);
    if (row.kind === "choice") for (const o of row.options) keys.push(o.labelKey);
    if (row.kind === "stepper" && row.unitKey) keys.push(row.unitKey);
  }
  return keys;
}

describe("TRIVIA_META i18n keys", () => {
  const keys = metaKeys();
  it("names the settings options and the Void pause item by their real keys", () => {
    expect(keys).toEqual(expect.arrayContaining([
      "game.trivia.settings.lengthShort", "game.trivia.settings.lengthNormal", "game.trivia.settings.lengthLong",
      "game.trivia.settings.paceRelaxed", "game.trivia.settings.paceNormal", "game.trivia.settings.paceFast", "game.trivia.pause.void",
    ]));
  });
  for (const l of LOCALES) {
    it(`every key exists in ${l}.json`, () => {
      const d = dict(l);
      expect(keys.filter((k) => !(k in d))).toEqual([]);
    });
  }
});
