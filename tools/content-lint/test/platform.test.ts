import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emitContent } from "../src/main";
import { camel, lintGameI18n, lintRootIndex, lintVocab, registeredGameFiles, unlistedFiles, type I18nFiles } from "../src/platform";
import { REPO_CONTENT, REPO_TIMEOUT, registeredPackCount, repoLint } from "./repoContent";

const four = (m: Record<string, unknown>): I18nFiles => ({ en: { ...m }, fr: { ...m }, ar: { ...m }, es: { ...m } });
const gameFiles = (): Record<"mishana" | "bluff" | "likely" | "trivia", I18nFiles> => ({
  mishana: four({ "game.mishana.title": "Mish Ana!", "vote.title": "Who?" }),
  bluff: four({ "game.bluff.title": "Bluff!" }),
  likely: four({ "game.likely.title": "Most Likely" }),
  trivia: four({ "game.trivia.title": "Quiz Night" }),
});

describe("registry (JAMAA-PLATFORM §5.1)", () => {
  it("requires every game index and CONTENT in content/index.ts", () => {
    const ok = `import { PACKS as bluff } from "./bluff/index";\nimport { PACKS as likely } from "./likely/index";\nimport { PACKS as mishana } from "./mishana/index";\nimport { PACKS as trivia } from "./trivia/index";\nexport const CONTENT = {};`;
    expect(lintRootIndex(ok).errors).toEqual([]);
    const errs = lintRootIndex(`import { PACKS as mishana } from "./mishana/index";`).errors.join("\n");
    expect(errs).toContain("does not import ./bluff/index");
    expect(errs).toContain("must export CONTENT");
  });

  it("reads a game index relative to its folder and finds unlisted files", () => {
    const reg = registeredGameFiles(`import a from "./en/en-a-01.json";\nimport b from './ar/lb-b-01.json';`, "mishana");
    expect(reg).toEqual(["mishana/en/en-a-01.json", "mishana/ar/lb-b-01.json"]);
    expect(unlistedFiles(["mishana/en/en-a-01.json", "mishana/en/en-c-01.json"], reg)).toEqual(["mishana/en/en-c-01.json"]);
  });
});

describe("vocabulary (§5.4)", () => {
  const vocab = { domains: ["lebanon", "middle-east"], topics: ["cinema-tv"], regions: ["beirut"] };
  it("checks shape and labels in every locale (kebab-case ids → lowerCamel key segments)", () => {
    expect(camel("middle-east")).toBe("middleEast");
    const labels = four({ "content.domain.lebanon": "L", "content.domain.middleEast": "M", "content.topic.cinemaTv": "C" });
    expect(lintVocab(vocab, labels).errors).toEqual([]);
    delete labels.es["content.topic.cinemaTv"];
    expect(lintVocab(vocab, labels).errors).toEqual(['i18n es: missing label content.topic.cinemaTv for vocab topics "cinema-tv"']);
    const bad = lintVocab({ domains: ["Lebanon", "x", "x"], topics: "music", regions: [] }, null).errors.join("\n");
    expect(bad).toContain('domains "Lebanon" is not kebab-case');
    expect(bad).toContain('domains "x" is listed twice');
    expect(bad).toContain("topics must be an array of strings");
  });
});

describe("game i18n completeness (§5.5)", () => {
  it("passes a complete tree", () => {
    expect(lintGameI18n(four({ "hub.title": "Games" }), gameFiles()).errors).toEqual([]);
  });

  it("flags a game key missing in one locale, a foreign game key, a game key in the root and a missing folder", () => {
    const games: Partial<ReturnType<typeof gameFiles>> = gameFiles();
    games.bluff!.en["game.bluff.tagline"] = "Fool your friends";
    games.likely!.fr["game.trivia.title"] = "Oops";
    delete games.trivia;
    const errs = lintGameI18n(four({ "game.mishana.extra": "x" }), games).errors.join("\n");
    expect(errs).toContain('i18n games/bluff fr: missing "game.bluff.tagline"');
    expect(errs).toContain('i18n games/likely fr: "game.trivia.title" belongs to games/trivia');
    expect(errs).toContain('root file has game key "game.mishana.extra"');
    expect(errs).toContain("shared/i18n/games/trivia/ is missing");
  });
});

describe("repository content", { timeout: REPO_TIMEOUT }, () => {
  it("passes the registry, vocabulary and i18n checks", () => {
    const r = repoLint();
    expect(r.errors).toEqual([]);
    expect(r.warnings.filter((w) => /not listed|vocab|i18n/.test(w))).toEqual([]);
  });

  it("--emit writes each registered pack as minified JSON to <out>/<game>/<id>.txt (§5.6)", () => {
    const out = mkdtempSync(join(tmpdir(), "content-emit-"));
    mkdirSync(join(out, "mishana"), { recursive: true });
    writeFileSync(join(out, "mishana", "stale.txt"), "old");
    const written = emitContent(REPO_CONTENT, out);
    expect(written).toHaveLength(registeredPackCount());
    expect(existsSync(join(out, "mishana", "stale.txt"))).toBe(false);
    for (const g of ["bluff", "likely", "trivia"]) expect(existsSync(join(out, g))).toBe(true);
    const text = readFileSync(join(out, "mishana", "en-everyday-01.txt"), "utf8");
    expect(text.includes("\n")).toBe(false);
    expect((JSON.parse(text) as { id: string }).id).toBe("en-everyday-01");
  });
});
