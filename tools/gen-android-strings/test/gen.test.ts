import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GAME_IDS,
  GenError,
  KOTLIN_PATH,
  OUTPUT_PATHS,
  argOrder,
  buildGameKotlin,
  buildKotlin,
  buildXml,
  convert,
  escapeLiteral,
  gameKotlinPath,
  gameOutputPaths,
  generate,
  resourceName,
  validate,
  validateTree,
  type GameId,
  type I18nTree,
  type MessageSet,
  type SplitMap,
} from "../src/gen";
import { readMessages, readSplitMap, readTree, run } from "../src/main";

const REPO = join(import.meta.dirname, "../../..");

function mini(): MessageSet {
  return {
    en: {
      "brand.appName": "JAMAA",
      "guess.guessed": "{name} guessed: {text}",
      "common.seconds": { one: "{count} second", other: "{count} seconds" },
      "round.label": "Round {count}",
    },
    fr: {
      "brand.appName": "JAMAA",
      "guess.guessed": "{name} a proposé : {text}",
      "common.seconds": { one: "{count} seconde", other: "{count} secondes" },
      "round.label": "Tour {count}",
    },
    ar: {
      "brand.appName": "جماعة",
      "guess.guessed": "جواب {name}: {text}",
      "common.seconds": { zero: "{count} ثانية", one: "ثانية وحدة", two: "ثانيتين", few: "{count} ثواني", many: "{count} ثانية", other: "{count} ثانية" },
      "round.label": "الجولة {count}",
    },
    es: {
      "brand.appName": "JAMAA",
      "guess.guessed": "{name} dijo: {text}",
      "common.seconds": { one: "{count} segundo", other: "{count} segundos" },
      "round.label": "Ronda {count}",
    },
  };
}

const L4 = ["en", "fr", "ar", "es"] as const;
function same(entries: Record<string, string>): MessageSet {
  return { en: { ...entries }, fr: { ...entries }, ar: { ...entries }, es: { ...entries } };
}
function tree(): I18nTree {
  const games = {} as Record<GameId, MessageSet>;
  for (const id of GAME_IDS) games[id] = same({ [`game.${id}.title`]: id.toUpperCase() });
  return { root: mini(), games };
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
    for (const loc of ["en", "fr", "ar", "es"] as const) {
      set[loc]["a.bC"] = "x";
      set[loc]["a.b_c"] = "y"; // invalid key, but would also collide
    }
    const errs = validate(set);
    expect(errs.some((e) => e.includes("collision"))).toBe(true);
    // A valid-key collision: "a.bC" vs "a.bC" can't repeat in JSON, so use segment boundaries.
    const set2 = mini();
    for (const loc of ["en", "fr", "ar", "es"] as const) {
      set2[loc]["x.aB.c"] = "1";
      set2[loc]["x.a.bC"] = "2";
    }
    expect(validate(set2)).toEqual([]); // x__a_b__c vs x__a__b_c: distinct
    const set3 = mini();
    for (const loc of ["en", "fr", "ar", "es"] as const) set3[loc]["app.name"] = "z"; // app__name, fine
    expect(validate(set3)).toEqual([]);
  });

  it("rejects a key that collides with app_name-derived names via generate", () => {
    const set = mini();
    for (const loc of ["en", "fr", "ar", "es"] as const) {
      set[loc]["lobby.startGame"] = "a";
      set[loc]["lobby.start_game"] = "b";
    }
    expect(() => generate({ ...tree(), root: set })).toThrow(GenError);
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
    expect(xml).toContain('<string name="app_name">JAMAA</string>');
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
    expect(kt).toContain("package app.jamaa.tv.i18n");
    expect(kt).toContain("import app.jamaa.tv.R");
    expect(kt).toContain('"guess.guessed" to R.string.guess__guessed,');
    expect(kt).toContain('"common.seconds" to R.plurals.common__seconds,');
    expect(kt).not.toContain('"common.seconds" to R.string');
  });
});

describe("split layout (JAMAA-PLATFORM §5.7)", () => {
  it("accepts numeric key segments (game.<id>.howto.1)", () => {
    const t = tree();
    for (const loc of L4) t.games.mishana[loc]["game.mishana.howto.1"] = "x";
    expect(validateTree(t, null)).toEqual([]);
    expect(resourceName("game.mishana.howto.1")).toBe("game__mishana__howto__1");
  });

  it("rejects game.* keys in the root file, foreign keys in a game file, and duplicates across files", () => {
    const t = tree();
    for (const loc of L4) {
      t.root[loc]["game.bluff.extra"] = "x";
      t.games.bluff[loc]["vote.title"] = "y";
      t.games.likely[loc]["game.likely.dup"] = "z";
      t.games.trivia[loc]["game.likely.dup"] = "z";
    }
    const errs = validateTree(t, null).join("\n");
    expect(errs).toContain('root: "game.bluff.extra" is under game.*');
    expect(errs).toContain('games/bluff: "vote.title" must start with "game.bluff."');
    expect(errs).toContain('games/trivia: "game.likely.dup" must start with "game.trivia."');
    expect(errs).toContain('duplicate key "game.likely.dup" in games/likely and games/trivia');
  });

  it("lets a game file keep the legacy names the split map assigns to it, and flags them in the root file", () => {
    const map: SplitMap = { count: 2, reusedNames: [], keys: { "vote.title": { to: "games/mishana" }, "round.label": { to: "games/mishana" } } };
    const t = tree();
    for (const loc of L4) t.games.mishana[loc]["vote.title"] = "Who?";
    const errs = validateTree(t, map).join("\n");
    expect(errs).not.toContain("vote.title");
    expect(errs).toContain('root: "round.label" is mapped to games/mishana by split-map.json');
  });

  it("checks each game's locales for completeness", () => {
    const t = tree();
    t.games.bluff.es = {};
    expect(validateTree(t, null).join("\n")).toContain('games/bluff es: missing key "game.bluff.title"');
  });

  it("emits per-game XML without app_name and a per-game Kotlin object; the platform object merges them", () => {
    const t = tree();
    expect(buildXml(t.games.bluff, "en", { appName: false })).not.toContain("app_name");
    const kt = buildGameKotlin(t.games.bluff, "bluff");
    expect(kt).toContain("package app.jamaa.tv.i18n.games.bluff");
    expect(kt).toContain("object I18nKeysBluff {");
    expect(kt).toContain('"game.bluff.title" to R.string.game__bluff__title,');
    const root = buildKotlin(t.root, GAME_IDS);
    expect(root).toContain("import app.jamaa.tv.i18n.games.trivia.I18nKeysTrivia");
    expect(root).toContain('"round.label" to R.string.round__label,');
    expect(root).toContain("val strings: Map<String, Int> by lazy { platformStrings + I18nKeysMishana.strings + I18nKeysBluff.strings + I18nKeysLikely.strings + I18nKeysTrivia.strings }");
    expect(gameKotlinPath("likely")).toBe("tv-app/app/src/main/java/app/jamaa/tv/i18n/games/likely/I18nKeysLikely.kt");
    expect(gameOutputPaths("trivia").ar).toBe("tv-app/app/src/main/res/values-ar/strings_game_trivia.xml");
  });

  it("limits outputs to one game or the platform with a scope", () => {
    const t = tree();
    expect([...generate(t, null, "bluff").keys()].sort()).toEqual([...Object.values(gameOutputPaths("bluff")), gameKotlinPath("bluff")].sort());
    expect([...generate(t, null, "platform").keys()].sort()).toEqual([...Object.values(OUTPUT_PATHS), KOTLIN_PATH].sort());
    expect(generate(t).size).toBe(5 + GAME_IDS.length * 5);
  });
});

describe("--check mode", () => {
  function tmpRepo(): string {
    const root = mkdtempSync(join(tmpdir(), "gen-strings-"));
    mkdirSync(join(root, "shared/i18n"), { recursive: true });
    const t = tree();
    for (const loc of L4) writeFileSync(join(root, `shared/i18n/${loc}.json`), JSON.stringify(t.root[loc]));
    for (const id of GAME_IDS) {
      mkdirSync(join(root, "shared/i18n/games", id), { recursive: true });
      for (const loc of L4) writeFileSync(join(root, `shared/i18n/games/${id}/${loc}.json`), JSON.stringify(t.games[id][loc]));
    }
    return root;
  }
  const ALL = 5 + GAME_IDS.length * 5;

  it("reports every output as changed before generation, nothing after, and writes nothing in check mode", () => {
    const root = tmpRepo();
    const before = run(root, true);
    const expected = [...Object.values(OUTPUT_PATHS), KOTLIN_PATH, ...GAME_IDS.flatMap((g) => [...Object.values(gameOutputPaths(g)), gameKotlinPath(g)])];
    expect(before.changed.sort()).toEqual(expected.sort());
    expect(run(root, true).changed.length).toBe(ALL); // still nothing written
    expect(run(root, false).changed.length).toBe(ALL);
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

  it("a game edit only touches that game's outputs", () => {
    const root = tmpRepo();
    run(root, false);
    writeFileSync(join(root, "shared/i18n/games/bluff/es.json"), JSON.stringify({ "game.bluff.title": "¡Bluff!" }));
    expect(run(root, true).changed).toEqual([gameOutputPaths("bluff").es]);
    expect(run(root, true, "platform").changed).toEqual([]);
  });

  it("fails when a game folder is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "gen-strings-"));
    mkdirSync(join(root, "shared/i18n"), { recursive: true });
    for (const loc of L4) writeFileSync(join(root, `shared/i18n/${loc}.json`), JSON.stringify(mini()[loc]));
    expect(() => run(root, true)).toThrow(/games\/mishana/);
  });
});

describe("repository i18n files", () => {
  it("validate and the committed outputs are up to date", () => {
    expect(validate(readMessages(REPO))).toEqual([]);
    expect(validateTree(readTree(REPO), readSplitMap(REPO))).toEqual([]);
    expect(run(REPO, true).changed).toEqual([]);
  });

  it("FR plurals carry one, many and other (Android lint MissingQuantity)", () => {
    const t = readTree(REPO);
    for (const set of [t.root, ...GAME_IDS.map((g) => t.games[g])]) {
      for (const [k, v] of Object.entries(set.fr)) if (typeof v === "object") expect(Object.keys(v).sort(), k).toEqual(["many", "one", "other"]);
    }
  });

  it("FR uses U+202F, never an ordinary space, before ! ? : ; in every game file", () => {
    const t = readTree(REPO);
    for (const id of GAME_IDS) {
      for (const [k, v] of Object.entries(t.games[id].fr)) {
        for (const s of typeof v === "string" ? [v] : Object.values(v)) expect(/ [!?:;]/.test(s as string), `${id} ${k}: ${s}`).toBe(false);
      }
    }
  });

  it("brand.appName is identical in EN and FR (one brand name, SPEC §2)", () => {
    const set = readMessages(REPO);
    expect(set.fr["brand.appName"]).toBe(set.en["brand.appName"]);
  });
});
