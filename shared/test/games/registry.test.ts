// JAMAA-PLATFORM §2.1 / §2.2 / §6.1: the registry has the four games (mishana live, three stubs) and agrees with meta.
import { describe, expect, it } from "vitest";
import { MAX_PLAYERS } from "../../src/constants";
import { GAME_IDS, isGameId } from "../../src/games/ids";
import { GAME_META } from "../../src/games/meta";
import { GameEnvelopeSchema, GameIntentSchema, GameSettingsPatchSchema, GameSettingsSchema, SetupExtrasSchema } from "../../src/games/protocol";
import { GAMES, REGISTRY_ENABLED } from "../../src/games/registry";
import { competitionRanking } from "../../src/games/ranking";
import { WORLD_IDS } from "../../src/worlds/ids";
import { contentCatalog } from "../../src/content/catalog";
import { TEST_FREE_CATALOG } from "../../src/testing";

describe("game registry", () => {
  it("lists the four games in hub order, and only Mish Ana! is enabled", () => {
    expect(GAME_IDS).toEqual(["mishana", "bluff", "likely", "trivia"]);
    expect(Object.keys(GAMES)).toEqual([...GAME_IDS]);
    expect(Object.keys(GAME_META)).toEqual([...GAME_IDS]);
    expect(REGISTRY_ENABLED).toEqual(["mishana"]);
    expect(isGameId("bluff")).toBe(true);
    expect(isGameId("chess")).toBe(false);
    expect(isGameId(3)).toBe(false);
  });
  it.each(GAME_IDS)("%s: meta is the registry's meta and obeys the platform bounds", (id) => {
    const m = GAME_META[id];
    expect(GAMES[id].meta).toBe(m);
    expect(m.id).toBe(id);
    expect(m.minPlayers).toBeGreaterThanOrEqual(1);
    expect(m.maxPlayers).toBeLessThanOrEqual(MAX_PLAYERS);
    expect(m.minPlayers).toBeLessThanOrEqual(m.maxPlayers);
    expect(m.settings.basic.length).toBeLessThanOrEqual(4);
    expect(m.rules.howToKeys.length).toBeGreaterThanOrEqual(3);
    expect(m.rules.howToKeys.length).toBeLessThanOrEqual(4);
    expect(m.rules.titleKey).toBe(`game.${id}.title`);
    expect(m.rules.taglineKey).toBe(`game.${id}.tagline`);
    for (const p of m.rules.pauseItems) for (const ph of p.phases) expect(m.phases, `${id} pause ${p.id}`).toContain(ph);
    for (const r of m.rules.ruleSections) for (const ph of r.phases) expect(m.phases, `${id} rules ${r.id}`).toContain(ph);
    expect(m.carriesScore).toBe(id === "mishana");
    expect(m.settings.premiumKeys).toEqual(id === "mishana" ? ["points"] : []);
    if (id !== "mishana") expect(m.settings.advanced).toEqual([]);
  });
  it("gives each game its own world", () => {
    expect(GAME_IDS.map((id) => GAME_META[id].rules.world)).toEqual([...WORLD_IDS]);
  });
  it.each(GAME_IDS)("%s: defaults satisfy the settings schema, and normalize repairs anything", (id) => {
    const def = GAMES[id];
    const defaults = def.meta.settings.defaults;
    expect(GameSettingsSchema[id].safeParse(defaults).success).toBe(true);
    expect(def.settings.normalize(undefined)).toEqual(defaults);
    expect(def.settings.normalize("junk")).toEqual(defaults);
    expect(def.settings.normalize({ ...defaults, extra: 1 })).toEqual(defaults);
    const firstKey = Object.keys(defaults)[0] as string;
    expect(def.settings.normalize({ ...defaults, [firstKey]: { wrong: true } })).toEqual(defaults);
    expect(Object.keys(def.settings.normalize({}))).toEqual(Object.keys(defaults));
    expect(GameSettingsPatchSchema[id].safeParse({}).success).toBe(true);
    expect(GameSettingsPatchSchema[id].safeParse({ nope: 1 }).success).toBe(false);
  });
  it.each(["bluff", "likely", "trivia"] as const)("%s is a stub: disabled, no intents, cannot start", (id) => {
    const def = GAMES[id];
    expect(def.enabled).toBe(false);
    expect(GameIntentSchema[id].safeParse({ type: "HOST_ADVANCE" }).success).toBe(false);
    const content = contentCatalog(TEST_FREE_CATALOG)[id];
    const roster = [{ id: "p_1", seat: 0, locale: "en" as const, connected: true, carryScore: 0 }];
    expect(def.startBlocker(roster, def.meta.settings.defaults as never, content, "en")).toBe("GAME_DISABLED");
    const r = def.start({ roster, settings: def.meta.settings.defaults as never, locale: "en", memory: { usedKeys: [] }, seed: 1, now: 0, graceMs: 0, content });
    expect(r.ok).toBe(false);
    expect(def.reduce({ schema: 0 }, { type: "TICK" }, { now: 0, content, isHost: () => true, hostPlayerId: null })).toMatchObject({ ok: false, error: "GAME_DISABLED" });
    expect(def.settings.apply(def.meta.settings.defaults as never, {}, content, "en")).toBeNull();
    const s = def.meta.settings.defaults as never;
    expect(def.settings.restrict(s, { playableIds: new Set(), premium: false }, content, "en")).toBe(s);
    expect(def.settings.packIds(s)).toEqual([]);
    expect(def.nextWakeAt({ schema: 0 })).toBeNull();
    expect(def.outcome({ schema: 0 })).toBeNull();
    expect(def.memory({ schema: 0 })).toEqual({ usedKeys: [] });
    expect(def.projectPublic({ schema: 0 }, content)).toEqual({});
    expect(def.projectMe({ schema: 0 }, "p_1", content)).toBeNull();
    expect(def.projectStatus({ schema: 0 }).phase).toBe(def.meta.phases[0]);
    expect(def.secretsFor({ schema: 0 }, null)).toEqual([]);
    expect(def.leakCheck({ schema: 0 }, null, {})).toEqual([]);
    def.assertInvariants({ schema: 0 });
    const extras = def.projectSetup(s, roster, content, { premium: false, packs: new Set() }, "en", { usedKeys: [] });
    expect(SetupExtrasSchema.parse(extras)).toMatchObject({ gameId: id, available: 0 });
    const env = { gameId: id, n: 1, phase: "X", doneIds: [], awaitedIds: [], public: {}, me: null, over: false };
    expect(GameEnvelopeSchema.safeParse(env).success).toBe(true);
  });
  it("trivia's packIds is its quiz family", () => {
    expect(GAMES.trivia.settings.packIds({ quizId: "lb-quiz-01", length: "normal", pace: "normal" })).toEqual(["lb-quiz-01"]);
  });
});

describe("competitionRanking (§2.4)", () => {
  it("ranks 1,1,3 and drops left and zero-point players", () => {
    const pts = { a: 10, b: 10, c: 2, d: 0, e: 5 };
    expect(competitionRanking(pts, ["a", "b", "c", "d", "e"], new Set(["e"]))).toEqual([["a", "b"], ["c"]]);
    expect(competitionRanking({}, ["a"])).toEqual([]);
  });
});
