// GAME-LIKELY §13.1 intents / §9 settings on the wire, and §11.2 content: the pack schema and the platform ContentAdapter.
import { describe, expect, it } from "vitest";
import { content } from "../../../src/games/likely/content";
import { ERRORS } from "../../../src/games/likely/errors";
import { LikelyExtrasSchema, LikelyIntentSchema, LikelySettingsPatchSchema, LikelySettingsSchema } from "../../../src/games/likely/protocol";
import { LikelyPackSchema } from "../../../src/games/likely/schema";
import { GameIntentSchema, GameMsgIntentSchema, UpdateGameSettingsIntentSchema } from "../../../src/games/protocol";
import { ERROR_CODES, errorMessageKey } from "../../../src/protocol/errors";
import { LIKELY_DEMO_PACK, likelyFamilyPack, likelySpicyPack } from "../../../src/testing/catalogs/likely";
import { DEF } from "./helpers";

describe("intents (§13.1)", () => {
  it("accepts the four intents, strictly", () => {
    for (const i of [
      { type: "VOTE", cardId: "fam-001", targetId: "p_1" },
      { type: "SKIP_CARD", cardId: "fam-001" },
      { type: "HOST_ADVANCE" },
      { type: "END_GAME" },
    ]) expect(LikelyIntentSchema.safeParse(i).success, i.type).toBe(true);
    expect(GameIntentSchema.likely).toBe(LikelyIntentSchema);
    expect(GameMsgIntentSchema.safeParse({ type: "GAME", gameId: "likely", i: { type: "HOST_ADVANCE" } }).success).toBe(true);
  });
  it("rejects extra keys, bad card ids, unknown intents and client-side times", () => {
    for (const i of [
      { type: "VOTE", cardId: "fam-001", targetId: "p_1", extra: 1 },
      { type: "VOTE", cardId: "FAM 1", targetId: "p_1" },
      { type: "VOTE", cardId: "fam-001", targetId: "" },
      { type: "VOTE", cardId: "fam-001" },
      { type: "SKIP_CARD" },
      { type: "HOST_ADVANCE", at: 5 },
      { type: "START" },
    ]) expect(LikelyIntentSchema.safeParse(i).success, JSON.stringify(i)).toBe(false);
  });
  it("settings and patches: strict; ageConfirmed travels in a patch only", () => {
    expect(LikelySettingsSchema.safeParse(DEF.meta.settings.defaults).success).toBe(true);
    expect(LikelySettingsPatchSchema.safeParse({ mode: "spicy", ageConfirmed: true }).success).toBe(true);
    expect(LikelySettingsPatchSchema.safeParse({ length: "long" }).success).toBe(true);
    expect(LikelySettingsPatchSchema.safeParse({ nope: 1 }).success).toBe(false);
    expect(LikelySettingsPatchSchema.safeParse({ mode: "wild" }).success).toBe(false);
    expect(LikelySettingsSchema.safeParse({ ...DEF.meta.settings.defaults, ageConfirmed: true }).success).toBe(true);   // non-strict S2C
    expect(UpdateGameSettingsIntentSchema.safeParse({ type: "UPDATE_GAME_SETTINGS", gameId: "likely", patch: { showVoters: false } }).success).toBe(true);
    expect(LikelyExtrasSchema.safeParse({ gameId: "likely", available: 3 }).success).toBe(true);
  });
  it("error codes: STALE_CARD is Likely's own; INVALID_TARGET is the platform's; every code has its message key", () => {
    expect(ERRORS).toEqual(["STALE_CARD"]);
    expect(ERROR_CODES).toContain("STALE_CARD");
    expect(ERROR_CODES).toContain("INVALID_TARGET");
    expect(errorMessageKey("STALE_CARD")).toBe("error.staleCard");
  });
});

describe("content (§11.2, platform §5.2)", () => {
  it("the synthetic and demo packs pass the pack schema", () => {
    for (const p of [likelyFamilyPack(), likelySpicyPack(), { ...LIKELY_DEMO_PACK, cards: [...LIKELY_DEMO_PACK.cards, ...likelyFamilyPack({ id: "pad" }).cards.slice(0, 18)] }]) {
      const r = LikelyPackSchema.safeParse(p);
      expect(r.success, r.success ? "" : JSON.stringify(r.error.issues.slice(0, 2))).toBe(true);
    }
  });
  it("the schema enforces family stays family, {player} ⇔ namesPlayer, listed locales present", () => {
    const fam = likelyFamilyPack();
    const c0 = fam.cards[0] as (typeof fam.cards)[number];
    const bad = (cards: unknown[], over: object = {}) => LikelyPackSchema.safeParse({ ...fam, ...over, cards }).success;
    expect(bad([{ ...c0, spice: 1 }, ...fam.cards.slice(1)])).toBe(false);
    expect(bad([{ ...c0, namesPlayer: true }, ...fam.cards.slice(1)])).toBe(false);
    expect(bad([{ ...c0, prompt: { ...c0.prompt, en: "hug {player}" } }, ...fam.cards.slice(1)])).toBe(false);
    expect(bad([{ ...c0, tags: ["romance"] }, ...fam.cards.slice(1)])).toBe(false);
    expect(bad([{ ...c0, prompt: { en: "x", fr: "de x", ar: "x" } }, ...fam.cards.slice(1)])).toBe(false);   // es listed
    expect(bad([c0, c0, ...fam.cards.slice(2)])).toBe(false);                                                 // duplicate id
    expect(bad(fam.cards.slice(0, 29))).toBe(false);                                                          // ≥ 30
    const sp = likelySpicyPack();
    expect(LikelyPackSchema.safeParse({ ...sp, cards: [{ ...(sp.cards[1] as object), spice: 0 }, ...sp.cards.slice(1)] }).success).toBe(false);
  });
  it("adapter meta: item-level tiers", () => {
    expect(content.meta(likelyFamilyPack())).toMatchObject({ id: "syn-family", family: "syn-family", gameId: "likely", tier: "mixed", itemCount: 40, freeItemCount: 20, ageRating: "all" });
    expect(content.meta(likelySpicyPack())).toMatchObject({ tier: "premium", freeItemCount: 0, ageRating: "adult" });
    expect(content.meta(LIKELY_DEMO_PACK)).toMatchObject({ tier: "free" });
  });
  it("adapter playable: a free room gets only free Family cards and never the adult pack", () => {
    const fam = likelyFamilyPack();
    const free = content.playable(fam, { premium: false, ownedFamilies: new Set() });
    expect(free?.cards.every((c) => c.tier === "free")).toBe(true);
    expect(free?.cards).toHaveLength(20);
    expect(content.playable(likelySpicyPack(), { premium: false, ownedFamilies: new Set() })).toBeNull();
    expect(content.playable(fam, { premium: true, ownedFamilies: new Set() })).toBe(fam);
    expect(content.playable(fam, { premium: false, ownedFamilies: new Set(["syn-family"]) })).toBe(fam);
    expect(content.playable(LIKELY_DEMO_PACK, { premium: false, ownedFamilies: new Set() })).toBe(LIKELY_DEMO_PACK);
    expect(content.playable({ ...fam, cards: fam.cards.filter((c) => c.tier === "pass") }, { premium: false, ownedFamilies: new Set() })).toBeNull();
  });
  it("adapter setupView: the adult pack shows only in Spicy mode; counts follow the mode", () => {
    const setup = content.setupView;
    if (!setup) throw new Error("setupView missing");
    const s = DEF.meta.settings.defaults;
    expect(setup(likelySpicyPack(), s)).toEqual({ shown: false, itemCount: 0 });
    expect(setup(likelySpicyPack(), { ...s, mode: "spicy" })).toEqual({ shown: true, itemCount: 30 });
    expect(setup(likelyFamilyPack(), s)).toEqual({ shown: true, itemCount: 40 });
  });
});
