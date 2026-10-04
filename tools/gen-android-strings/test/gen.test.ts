import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GenError,
  KOTLIN_PATH,
  OUTPUT_PATHS,
  argOrder,
  buildKotlin,
  buildXml,
  convert,
  escapeLiteral,
  generate,
  resourceName,
  validate,
  type MessageSet,
} from "../src/gen";
import { readMessages, run } from "../src/main";

const REPO = join(import.meta.dirname, "../../..");

function mini(): MessageSet {
  return {
    en: {
      "brand.appName": "Mish Ana!",
      "guess.guessed": "{name} guessed: {text}",
      "common.seconds": { one: "{count} second", other: "{count} seconds" },
      "round.label": "Round {count}",
    },
    fr: {
      "brand.appName": "Mish Ana !",
      "guess.guessed": "{name} a proposé : {text}",
      "common.seconds": { one: "{count} seconde", other: "{count} secondes" },
      "round.label": "Tour {count}",
    },
    ar: {
      "brand.appName": "مش أنا!",
      "guess.guessed": "جواب {name}: {text}",
      "common.seconds": { zero: "{count} ثانية", one: "ثانية وحدة", two: "ثانيتين", few: "{count} ثواني", many: "{count} ثانية", other: "{count} ثانية" },
      "round.label": "الجولة {count}",
    },
  };
}

describe("resourceName", () => {
  it("mangles camelCase segments to snake_case joined by __", () => {
    expect(resourceName("phase.mrWhiteGuess")).toBe("phase__mr_white_guess");
    expect(resourceName("settings.difficulty1")).toBe("settings__difficulty1");
    expect(resourceName("error.badMessage")).toBe("error__bad_message");
    expect(resourceName("brand.appName")).toBe("brand__app_name");
  });

  it("detects collisions", () => {
    const set = mini();
    for (const loc of ["en", "fr", "ar"] as const) {
      set[loc]["a.bC"] = "x";
      set[loc]["a.b_c"] = "y"; // invalid key, but would also collide
    }
    const errs = validate(set);
    expect(errs.some((e) => e.includes("collision"))).toBe(true);
    // A valid-key collision: "a.bC" vs "a.bC" can't repeat in JSON, so use segment boundaries.
    const set2 = mini();
    for (const loc of ["en", "fr", "ar"] as const) {
      set2[loc]["x.aB.c"] = "1";
      set2[loc]["x.a.bC"] = "2";
    }
    expect(validate(set2)).toEqual([]); // x__a_b__c vs x__a__b_c: distinct
    const set3 = mini();
    for (const loc of ["en", "fr", "ar"] as const) set3[loc]["app.name"] = "z"; // app__name, fine
    expect(validate(set3)).toEqual([]);
  });

  it("rejects a key that collides with app_name-derived names via generate", () => {
    const set = mini();
    for (const loc of ["en", "fr", "ar"] as const) {
      set[loc]["lobby.startGame"] = "a";
      set[loc]["lobby.start_game"] = "b";
    }
    expect(() => generate(set)).toThrow(GenError);
  });
});

describe("placeholders", () => {
  it("converts named placeholders to positional args in EN order", () => {
    expect(convert("{name} guessed: {text}", ["name", "text"])).toBe("%1$s guessed: %2$s");
    expect(convert("{count} seconds", ["count"])).toBe("%1$d seconds");
    expect(convert("Players {count}/{max}", argOrder("Players {count}/{max}"))).toBe("Players %1$d/%2$s");
  });

  it("keeps EN numbering when the translation reorders placeholders", () => {
    const order = argOrder("{name} guessed: {text}");
    expect(convert("جواب {name}: {text}", order)).toBe("جواب %1$s: %2$s");
    expect(convert("{text} ← {name}", order)).toBe("%2$s ← %1$s");
  });

  it("uses the EN other form for plural arg order", () => {
    expect(argOrder({ one: "{count} more for {name}", other: "{name}: {count} more" })).toEqual(["name", "count"]);
  });

  it("rejects literal percent and unknown placeholders", () => {
    expect(() => convert("100% sure", [])).toThrow(GenError);
    expect(() => convert("{who}", ["name"])).toThrow(GenError);
    expect(() => convert("{Bad}", [])).toThrow(GenError);
  });
});

describe("escaping", () => {
  it("escapes apostrophes, quotes, backslashes, XML specials and newlines", () => {
    expect(escapeLiteral("Don't")).toBe("Don\\'t");
    expect(escapeLiteral('Say "hi"')).toBe('Say \\"hi\\"');
    expect(escapeLiteral("a\\b")).toBe("a\\\\b");
    expect(escapeLiteral("Tom & Jerry <3>")).toBe("Tom &amp; Jerry &lt;3&gt;");
    expect(escapeLiteral("a\nb")).toBe("a\\nb");
  });

  it("passes localized typographic quotes and no-break spaces through unchanged (guess.quoted)", () => {
    expect(convert("“{text}”", ["text"])).toBe("“%1$s”");
    expect(convert("« {text} »", ["text"])).toBe("« %1$s »");
    expect(convert("«{text}»", ["text"])).toBe("«%1$s»");
  });

  it("prefixes a leading @ or ?", () => {
    expect(convert("@home", [])).toBe("\\@home");
    expect(convert("?why", [])).toBe("\\?why");
    expect(convert("a@b?", [])).toBe("a@b?");
  });

  it("leaves typographic characters alone", () => {
    expect(convert("C’est parti !", [])).toBe("C’est parti !");
  });
});

describe("validation", () => {
  it("accepts the mini set", () => {
    expect(validate(mini())).toEqual([]);
  });

  it("allows AR plural categories to omit {count} (union rule)", () => {
    expect(validate(mini())).toEqual([]);
  });

  it("flags missing keys, extra keys, placeholder drift and bad plural categories", () => {
    const set = mini();
    delete set.fr["round.label"];
    set.ar["extra.thing"] = "x";
    set.fr["guess.guessed"] = "{name} a proposé";
    set.fr["common.seconds"] = { one: "{count} seconde", few: "{count} secondes", other: "{count} secondes" };
    const errs = validate(set).join("\n");
    expect(errs).toContain('fr: missing key "round.label"');
    expect(errs).toContain('ar: extra key "extra.thing"');
    expect(errs).toContain('fr: "guess.guessed" placeholders');
    expect(errs).toContain('plural category "few" not allowed for fr');
  });

  it("flags plural/string shape mismatch and missing other", () => {
    const set = mini();
    set.fr["round.label"] = { one: "Tour {count}", other: "Tour {count}" };
    set.ar["common.seconds"] = { one: "ثانية" };
    const errs = validate(set).join("\n");
    expect(errs).toContain('"round.label" must be a plain string');
    expect(errs).toContain('"common.seconds" plural is missing "other"');
  });
});

describe("xml output", () => {
  it("emits the header, app_name, strings and plurals", () => {
    const xml = buildXml(mini(), "en");
    expect(xml).toContain("<!-- GENERATED by tools/gen-android-strings. Do not edit. -->");
    expect(xml).toContain('<string name="app_name">Mish Ana!</string>');
    expect(xml).toContain('<string name="guess__guessed">%1$s guessed: %2$s</string>');
    expect(xml).toContain('<string name="round__label">Round %1$d</string>');
    expect(xml).toContain('<plurals name="common__seconds">');
    expect(xml).toContain('<item quantity="one">%1$d second</item>');
  });

  it("emits all six AR plural categories", () => {
    const xml = buildXml(mini(), "ar");
    for (const q of ["zero", "one", "two", "few", "many", "other"]) expect(xml).toContain(`<item quantity="${q}">`);
    expect(xml).toContain('<item quantity="one">ثانية وحدة</item>');
    expect(xml).toContain('<item quantity="few">%1$d ثواني</item>');
  });

  it("emits a FR many item (= other) when fr.json omits it", () => {
    const set = mini();
    const xml = buildXml(set, "fr");
    const blocks = xml.split("<plurals ").slice(1);
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) expect(b).toContain('<item quantity="many">');
    expect(buildXml(set, "en")).not.toContain('quantity="many"');
  });

  it("emits I18nKeys.kt with strings and plurals maps", () => {
    const kt = buildKotlin(mini());
    expect(kt).toContain("package app.mishana.tv.i18n");
    expect(kt).toContain("import app.mishana.tv.R");
    expect(kt).toContain('"guess.guessed" to R.string.guess__guessed,');
    expect(kt).toContain('"common.seconds" to R.plurals.common__seconds,');
    expect(kt).not.toContain('"common.seconds" to R.string');
  });
});

describe("--check mode", () => {
  function tmpRepo(): string {
    const root = mkdtempSync(join(tmpdir(), "gen-strings-"));
    mkdirSync(join(root, "shared/i18n"), { recursive: true });
    const set = mini();
    for (const loc of ["en", "fr", "ar"] as const) writeFileSync(join(root, `shared/i18n/${loc}.json`), JSON.stringify(set[loc]));
    return root;
  }

  it("reports every output as changed before generation, nothing after, and writes nothing in check mode", () => {
    const root = tmpRepo();
    const before = run(root, true);
    expect(before.changed.sort()).toEqual([...Object.values(OUTPUT_PATHS), KOTLIN_PATH].sort());
    expect(run(root, true).changed.length).toBe(4); // still nothing written
    expect(run(root, false).changed.length).toBe(4);
    expect(run(root, true).changed).toEqual([]);
    expect(readFileSync(join(root, OUTPUT_PATHS.fr), "utf8")).toContain("Tour %1$d");
  });

  it("detects a stale output after an i18n edit", () => {
    const root = tmpRepo();
    run(root, false);
    const fr = mini().fr;
    fr["round.label"] = "Manche {count}";
    writeFileSync(join(root, "shared/i18n/fr.json"), JSON.stringify(fr));
    expect(run(root, true).changed).toEqual([OUTPUT_PATHS.fr]);
  });
});

describe("repository i18n files", () => {
  it("validate and the committed outputs are up to date", () => {
    const set = readMessages(REPO);
    expect(validate(set)).toEqual([]);
    expect(run(REPO, true).changed).toEqual([]);
  });

  it("FR plurals carry one, many and other (Android lint MissingQuantity)", () => {
    const fr = readMessages(REPO).fr;
    for (const [k, v] of Object.entries(fr)) if (typeof v === "object") expect(Object.keys(v).sort(), k).toEqual(["many", "one", "other"]);
  });

  it("brand.appName is identical in EN and FR (one brand name, SPEC §2)", () => {
    const set = readMessages(REPO);
    expect(set.fr["brand.appName"]).toBe(set.en["brand.appName"]);
  });
});
