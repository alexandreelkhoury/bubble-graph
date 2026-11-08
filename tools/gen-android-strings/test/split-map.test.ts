// JAMAA-PLATFORM §5.7: split-map.json maps every pre-P key exactly once, and no key is lost by the split.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GAME_IDS, LOCALES, type SplitMap } from "../src/gen";
import { SPLIT_MAP_PATH, readTree } from "../src/main";

const REPO = join(import.meta.dirname, "../../..");
const RAW = readFileSync(join(REPO, SPLIT_MAP_PATH), "utf8");
const MAP = JSON.parse(RAW) as SplitMap;
const TREE = readTree(REPO);
const DESTS = new Set(["root", ...GAME_IDS.map((g) => `games/${g}`)]);

function fileOf(to: string, loc: (typeof LOCALES)[number]): Record<string, unknown> {
  return to === "root" ? TREE.root[loc] : TREE.games[to.slice("games/".length) as (typeof GAME_IDS)[number]][loc];
}

describe("split-map.json", () => {
  it("lists every pre-P key exactly once (no duplicate JSON keys, count matches)", () => {
    const body = RAW.slice(RAW.indexOf('"keys"'));
    const names = [...body.matchAll(/^ {4}"([^"]+)": \{/gm)].map((m) => m[1]);
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBe(MAP.count);
    expect(Object.keys(MAP.keys).length).toBe(MAP.count);
    expect(MAP.count).toBe(436);
  });

  it("sends every key to a known file and gives every destination name once", () => {
    const seen = new Set<string>();
    for (const [k, d] of Object.entries(MAP.keys)) {
      expect(DESTS.has(d.to), k).toBe(true);
      const name = d.as ?? k;
      expect(seen.has(name), name).toBe(false);
      seen.add(name);
    }
  });

  it("loses no key: every mapped key exists, under its new name, in its destination file in every locale", () => {
    for (const [k, d] of Object.entries(MAP.keys)) {
      for (const loc of LOCALES) expect(fileOf(d.to, loc)[d.as ?? k], `${loc} ${k} → ${d.to}:${d.as ?? k}`).toBeDefined();
    }
  });

  it("keeps a renamed-away name only where reusedNames allows it", () => {
    const reused = new Set(MAP.reusedNames);
    const all = new Set([...Object.keys(TREE.root.en), ...GAME_IDS.flatMap((g) => Object.keys(TREE.games[g].en))]);
    for (const [k, d] of Object.entries(MAP.keys)) if (d.as && !reused.has(k)) expect(all.has(k), k).toBe(false);
    for (const k of reused) expect(MAP.keys[k]?.as, k).toBeDefined();
  });

  it("applies the fixed decisions of §5.7", () => {
    for (let i = 1; i <= 4; i++) expect(MAP.keys[`howto.step${i}`]).toEqual({ to: "games/mishana", as: `game.mishana.howto.${i}` });
    expect(MAP.keys["howto.title"]).toEqual({ to: "root" });
    expect(MAP.keys["brand.slogan"]).toEqual({ to: "games/mishana", as: "game.mishana.slogan" });
    expect(MAP.keys["game.label"]).toEqual({ to: "root", as: "common.gameNumber" });
    const colors = Object.entries(MAP.keys).filter(([k]) => k.startsWith("color."));
    expect(colors.length).toBe(12);
    for (const [, d] of colors) expect(d).toEqual({ to: "root" });
    for (const [k, d] of Object.entries(MAP.keys)) if (k.startsWith("error.")) expect(d.to, k).toBe("root");
  });

  it("the new platform namespaces of §5.7 exist in the root files", () => {
    const required = [
      "hub.gameUnsupported", "hub.closeConfirm.title", "hub.closeConfirm.body", "hub.closeConfirm.stay", "hub.closeConfirm.close",
      "settings.calmMotion", "settings.showHowTo", "hint.backMenu", "rules.title", "cup.title", "react.laugh", "pass.name",
      "content.domain.lebanon", "content.topic.football", "setup.start", "error.unknownGame", "error.generic",
    ];
    for (const loc of LOCALES) for (const k of required) expect(TREE.root[loc][k], `${loc} ${k}`).toBeDefined();
  });
});

describe("review.json (drafts awaiting native review)", () => {
  const review = JSON.parse(readFileSync(join(REPO, "shared/i18n/review.json"), "utf8")) as Record<string, unknown>;
  it("names only existing keys", () => {
    const all = new Set([...Object.keys(TREE.root.en), ...GAME_IDS.flatMap((g) => Object.keys(TREE.games[g].en))]);
    for (const loc of ["ar", "es"] as const) {
      const keys = review[loc] as string[];
      expect(Array.isArray(keys)).toBe(true);
      for (const k of keys) expect(all.has(k), `${loc} ${k}`).toBe(true);
    }
  });
});
