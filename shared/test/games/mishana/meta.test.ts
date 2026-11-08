// JAMAA-PLATFORM §0 / §1.3 / §2.2: game #1's meta (zod-free, engine-free) mirrors the engine exactly.
import { describe, expect, it } from "vitest";
import { GAME1, MISHANA_DEFAULT_PACK_IDS, MISHANA_META, MISHANA_PHASES, mishanaDefaultSettings, TIMER_PRESETS, timerPresetOf } from "../../../src/games/mishana/meta";
import { DEFAULT_PACK_IDS, DEFAULT_SETTINGS } from "../../../src/games/mishana/engine/settings";
import { PHASES } from "../../../src/games/mishana/engine/types";
import { PREMIUM_SETTING_KEYS } from "../../../src/billing/products";

describe("GAME1", () => {
  it("is Mish Ana! with the id mishana", () => {
    expect(GAME1).toEqual({ id: "mishana", name: "Mish Ana!", nameAr: "مش أنا!" });
  });
});

describe("MISHANA_META", () => {
  it("defaults are the engine defaults minus wordLocale, in the same key order", () => {
    const { wordLocale: _w, ...rest } = DEFAULT_SETTINGS;
    void _w;
    expect(MISHANA_META.settings.defaults).toEqual(rest);
    expect(Object.keys(MISHANA_META.settings.defaults)).toEqual(Object.keys(rest));
    expect(MISHANA_DEFAULT_PACK_IDS).toEqual(DEFAULT_PACK_IDS);
    const copy = mishanaDefaultSettings();
    expect(copy).toEqual(rest);
    copy.points.civilian = 99;
    expect(MISHANA_META.settings.defaults.points.civilian).toBe(2);
  });
  it("phases are the engine phases minus LOBBY", () => {
    expect([...MISHANA_PHASES]).toEqual(PHASES.filter((p) => p !== "LOBBY"));
  });
  it("premiumKeys are PREMIUM_SETTING_KEYS", () => {
    expect(MISHANA_META.settings.premiumKeys).toEqual([...PREMIUM_SETTING_KEYS]);
  });
  it("timer presets (§3.5): Normal is today's default; anything else is custom", () => {
    expect(timerPresetOf(DEFAULT_SETTINGS)).toBe("normal");
    expect(timerPresetOf(TIMER_PRESETS.off)).toBe("off");
    expect(timerPresetOf({ ...TIMER_PRESETS.fast, clueSeconds: 35 })).toBe("custom");
  });
});
