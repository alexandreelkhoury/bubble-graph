// GAME-LIKELY §9 settings and the §9.1 Spicy 18+ gate.
import { describe, expect, it } from "vitest";
import { LIKELY_META, LIKELY_SPICY_ENABLED } from "../../../src/games/likely/meta";
import type { LikelySettings } from "../../../src/games/likely/meta";
import type { LikelySettingsPatch } from "../../../src/games/likely/engine/settings";
import type { GameActor } from "../../../src/games/types";
import { CATALOG, DEF, FAMILY_ONLY, SHIPPED, likelyFamilyPack, likelySpicyPack, roster, settings, tv } from "./helpers";

const vip: GameActor = { kind: "player", playerId: "p1" };
const DEFAULTS = LIKELY_META.settings.defaults;
const apply = (s: LikelySettings, patch: LikelySettingsPatch, by?: GameActor, content = CATALOG): LikelySettings | null => DEF.settings.apply(s, patch, content, "en", by);
const access = { premium: true, packs: new Set<string>() };

describe("settings (§9)", () => {
  it("schema 2, mode defaults to family; Spicy compiled out: 3 rows, no mode row", () => {
    expect(LIKELY_META.SETTINGS_SCHEMA).toBe(2);
    expect(DEFAULTS).toEqual({ packIds: [], length: "normal", showVoters: true, mode: "family" });
    expect(LIKELY_SPICY_ENABLED).toBe(false);
    expect(LIKELY_META.settings.basic.map((f) => f.key)).toEqual(["packIds", "length", "showVoters"]);
    expect(LIKELY_META.settings.advanced).toEqual([]);
    expect(LIKELY_META.settings.premiumKeys).toEqual([]);
  });
  it("normalize: missing, extra and wrong-typed keys fall back per key; old schema-1 values → family", () => {
    expect(DEF.settings.normalize(undefined)).toEqual(DEFAULTS);
    expect(DEF.settings.normalize("x")).toEqual(DEFAULTS);
    expect(DEF.settings.normalize([1])).toEqual(DEFAULTS);
    expect(DEF.settings.normalize({ packIds: ["BAD ID"], length: "huge", showVoters: "yes", mode: "wild", extra: 1 })).toEqual(DEFAULTS);
    expect(DEF.settings.normalize({ packIds: ["a", "a"], length: "long" })).toEqual({ ...DEFAULTS, length: "long" });
    expect(DEF.settings.normalize({ packIds: ["a", "b"], length: "long", showVoters: false })).toEqual({ packIds: ["a", "b"], length: "long", showVoters: false, mode: "family" });
    expect(DEF.settings.normalize({ ...DEFAULTS, mode: "spicy" }).mode).toBe("spicy");
    expect(SHIPPED.settings.normalize({ ...DEFAULTS, mode: "spicy" }).mode).toBe("family");   // compiled out
    const n = DEF.settings.normalize({ ...DEFAULTS });
    expect(Object.keys(n)).toEqual(["packIds", "length", "showVoters", "mode"]);
  });
  it("apply validates values and returns the same object when nothing changes", () => {
    const s = settings();
    expect(apply(s, { length: "short" })).toBe(s);
    expect(apply(s, {})).toBe(s);
    expect(apply(s, { length: "xl" as never })).toBeNull();
    expect(apply(s, { showVoters: "no" as never })).toBeNull();
    expect(apply(s, { mode: "wild" as never })).toBeNull();
    expect(apply(s, { packIds: ["nope"] })).toBeNull();
    expect(apply(s, { packIds: "x" as never })).toBeNull();
    expect(apply(s, { ageConfirmed: "y" as never })).toBeNull();
    expect(apply(s, { packIds: ["syn-spicy"] })).toBeNull();   // adult pack never selectable in family mode
    expect(apply(s, { packIds: ["syn-family"] })).toEqual({ ...s, packIds: ["syn-family"] });
    expect(apply(s, { showVoters: false }, vip)).toEqual({ ...s, showVoters: false });
    expect(apply(s, { length: "long" })).toEqual({ ...s, length: "long" });
    expect(apply(s, { foo: 1 } as never)).toBeNull();
    expect(apply(s, null as never)).toBeNull();
  });
  it("restrict: drops locked packs; same object when nothing changes", () => {
    const s = settings({ packIds: ["syn-family"] });
    expect(DEF.settings.restrict(s, { playableIds: new Set(["syn-family"]), premium: false }, CATALOG, "en")).toBe(s);
    expect(DEF.settings.restrict(s, { playableIds: new Set(), premium: false }, CATALOG, "en")).toEqual({ ...s, packIds: [] });
    const d = settings();
    expect(DEF.settings.restrict(d, { playableIds: new Set(), premium: false }, CATALOG, "en")).toBe(d);
  });
  it("packIds is the pack filter itself (every Likely pack is its own family)", () => {
    expect(DEF.settings.packIds(settings({ packIds: ["syn-family"] }))).toEqual(["syn-family"]);
  });
  it("projectSetup counts the cards the room can draw for these settings", () => {
    expect(DEF.projectSetup(settings(), roster(4), CATALOG, access, "en", { usedKeys: [] })).toEqual({ gameId: "likely", available: 40 });
    // Spicy: every unnamed card (family 40 + spicy 30 − 10 named).
    expect(DEF.projectSetup(settings({ mode: "spicy" }), roster(4), CATALOG, access, "en", { usedKeys: [] }).available).toBe(60);
    expect(DEF.projectSetup(settings({ packIds: ["syn-family"] }), roster(4), { packs: [likelyFamilyPack(), likelySpicyPack({ id: "x-spicy" })] }, access, "en", { usedKeys: [] }).available).toBe(40);
  });
});

describe("Spicy 18+ gate (§9.1)", () => {
  const fam = settings();
  it("spicy needs the TV actor AND ageConfirmed: true", () => {
    expect(apply(fam, { mode: "spicy" }, tv)).toBeNull();
    expect(apply(fam, { mode: "spicy", ageConfirmed: false }, tv)).toBeNull();
    expect(apply(fam, { mode: "spicy", ageConfirmed: true }, vip)).toBeNull();
    expect(apply(fam, { mode: "spicy", ageConfirmed: true })).toBeNull();   // the platform passes no actor: fail closed
    expect(apply(fam, { mode: "spicy", ageConfirmed: true }, tv)).toMatchObject({ mode: "spicy" });
  });
  it("switching to spicy sets showVoters:false in the same patch; the host may switch it back after", () => {
    const sp = apply(fam, { mode: "spicy", ageConfirmed: true }, tv) as LikelySettings;
    expect(sp.showVoters).toBe(false);
    expect(apply(fam, { mode: "spicy", ageConfirmed: true, showVoters: true }, tv)?.showVoters).toBe(false);
    expect(apply(sp, { showVoters: true }, vip)).toEqual({ ...sp, showVoters: true });
  });
  it("moving back to family is always allowed, from the TV or the VIP, and drops the adult pack", () => {
    const sp = settings({ mode: "spicy", packIds: ["syn-spicy", "syn-family"] });
    expect(apply(sp, { mode: "family" }, vip)).toEqual({ ...sp, mode: "family", packIds: ["syn-family"] });
    expect(apply(sp, { mode: "family" }, tv)).toMatchObject({ mode: "family" });
  });
  it("an unrelated patch while already spicy needs no new confirmation", () => {
    const sp = settings({ mode: "spicy", showVoters: false });
    expect(apply(sp, { length: "long" }, vip)).toEqual({ ...sp, length: "long" });
  });
  it("refused where no Spicy card is playable (free room), and always in the shipped build", () => {
    expect(apply(fam, { mode: "spicy", ageConfirmed: true }, tv, FAMILY_ONLY)).toBeNull();
    expect(SHIPPED.settings.apply(fam, { mode: "spicy", ageConfirmed: true }, CATALOG, "en", tv)).toBeNull();
    expect(SHIPPED.startBlocker(roster(4), settings({ mode: "spicy" }), CATALOG, "en")).toBe("NO_CONTENT_AVAILABLE");
  });
  it("restrict falls back to family when Spicy cannot be played", () => {
    const sp = settings({ mode: "spicy", packIds: ["syn-spicy"] });
    expect(DEF.settings.restrict(sp, { playableIds: new Set(["syn-family"]), premium: false }, FAMILY_ONLY, "en")).toEqual({ ...sp, mode: "family", packIds: [] });
    expect(SHIPPED.settings.restrict(sp, { playableIds: new Set(["syn-family", "syn-spicy"]), premium: true }, CATALOG, "en")).toMatchObject({ mode: "family" });
  });
});
