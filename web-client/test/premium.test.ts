// PAYMENTS-SPEC §7.3 (phone): locked-pack rows (lock, no price), locked points, the error toast keys, the VIP Start
// hint while the TV is in the store, and `lobby.premiumEndedPhone` once per flip.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import en from "@mishana/shared/i18n/en.json";
import fr from "@mishana/shared/i18n/fr.json";
import ar from "@mishana/shared/i18n/ar.json";
import type { PlayerView } from "@mishana/shared/protocol";
import { errorKeyOf } from "../src/i18n/t";
import { lockedPackRows, premiumEndedStep, settingLocked, tvBusyHint } from "../src/lib/premium";

const lobbyFixture = JSON.parse(readFileSync(new URL("../../shared/fixtures/s2c.state.player.lobby.json", import.meta.url), "utf8")) as { view: PlayerView };
const LOCKED = [
  { id: "en-food-01", locale: "en", title: { en: "Food", fr: "Cuisine", ar: "أكل" }, pairCount: 33, ageRating: "all" as const, productId: "pack_en_food_01" },
  { id: "lb-food-01", locale: "ar-LB", title: { en: "Lebanese food", fr: "Cuisine libanaise", ar: "أكل لبناني" }, pairCount: 27, ageRating: "all" as const, productId: "pack_lb_food_01" },
];

describe("locked pack rows (§5.1)", () => {
  it("carry a lock row's text only: title, count and 'Unlock on the TV', never a product id or a price", () => {
    const rows = lockedPackRows(LOCKED, "fr");
    expect(rows).toEqual([
      { id: "en-food-01", title: "Cuisine", pairCount: 33, trailingKey: "settings.unlockOnTv" },
      { id: "lb-food-01", title: "Cuisine libanaise", pairCount: 27, trailingKey: "settings.unlockOnTv" },
    ]);
    for (const r of rows) expect(Object.keys(r).sort()).toEqual(["id", "pairCount", "title", "trailingKey"]);
    expect(JSON.stringify(rows)).not.toMatch(/pack_|\$|€|price/i);
  });

  it("the phone's unlock text never offers a purchase in any locale", () => {
    for (const cat of [en, fr, ar] as Record<string, unknown>[]) {
      for (const k of ["settings.unlockOnTv", "error.packLocked", "error.premiumRequired", "lobby.premiumEndedPhone", "error.tvBusy"]) {
        expect(typeof cat[k], k).toBe("string");
        expect(cat[k] as string, k).not.toMatch(/\{price\}|buy|achet|شراء/i);
      }
    }
  });

  it("the lobby fixture parses into rows the same way (keys as the projection sends them)", () => {
    const v = lobbyFixture.view;
    expect(Array.isArray(v.lockedPacks)).toBe(true);
    for (const r of lockedPackRows(v.lockedPacks, "en")) expect(r.trailingKey).toBe("settings.unlockOnTv");
  });
});

describe("premium settings (§1.6)", () => {
  it("points are locked only in a room without premium", () => {
    expect(settingLocked({ premium: false }, "points")).toBe(true);
    expect(settingLocked({ premium: true }, "points")).toBe(false);
    expect(settingLocked({ premium: false }, "clueSeconds")).toBe(false);
    expect(settingLocked({ premium: false }, "packIds")).toBe(false);
  });
});

describe("error toasts (§5.1)", () => {
  it("every billing error code maps to an existing error.* key (incl. TV_BUSY)", () => {
    const keys = ["PREMIUM_REQUIRED", "PACK_LOCKED", "ENTITLEMENT_INVALID", "TV_BUSY"].map(errorKeyOf);
    expect(keys).toEqual(["error.premiumRequired", "error.packLocked", "error.entitlementInvalid", "error.tvBusy"]);
    for (const k of keys) expect(en).toHaveProperty([k]);
  });
});

describe("Start while the TV is in the store (§5.1)", () => {
  it("shows the hint under the VIP's (still enabled) Start, in the lobby only", () => {
    expect(tvBusyHint({ tvBusy: true, phase: "LOBBY" }, true)).toBe(true);
    expect(tvBusyHint({ tvBusy: true, phase: "LOBBY" }, false)).toBe(false);
    expect(tvBusyHint({ tvBusy: false, phase: "LOBBY" }, true)).toBe(false);
    expect(tvBusyHint({ tvBusy: true, phase: "CLUES" }, true)).toBe(false);
  });
});

describe("premium ended notice (§4.4, §5.1)", () => {
  type V = { premium: boolean; phase: PlayerView["phase"] };
  const run = (seq: V[]): number[] => {
    let pending = false;
    const shown: number[] = [];
    let prev: V | null = null;
    seq.forEach((v, i) => {
      const r = premiumEndedStep(pending, prev, v);
      pending = r.pending;
      if (r.show) shown.push(i);
      prev = v;
    });
    return shown;
  };
  it("a flip in the lobby shows once", () => {
    expect(run([{ premium: true, phase: "LOBBY" }, { premium: false, phase: "LOBBY" }, { premium: false, phase: "LOBBY" }])).toEqual([1]);
  });
  it("a flip mid-game shows on the first lobby after it, once", () => {
    expect(run([
      { premium: true, phase: "LOBBY" }, { premium: true, phase: "CLUES" }, { premium: false, phase: "VOTING" },
      { premium: false, phase: "RESULTS" }, { premium: false, phase: "LOBBY" }, { premium: false, phase: "LOBBY" },
    ])).toEqual([4]);
  });
  it("a free room never shows it; a re-upgrade cancels a pending notice; a second flip shows again", () => {
    expect(run([{ premium: false, phase: "LOBBY" }, { premium: false, phase: "CLUES" }, { premium: false, phase: "LOBBY" }])).toEqual([]);
    expect(run([{ premium: true, phase: "CLUES" }, { premium: false, phase: "CLUES" }, { premium: true, phase: "RESULTS" }, { premium: true, phase: "LOBBY" }])).toEqual([]);
    expect(run([
      { premium: true, phase: "LOBBY" }, { premium: false, phase: "LOBBY" }, { premium: true, phase: "LOBBY" }, { premium: false, phase: "LOBBY" },
    ])).toEqual([1, 3]);
  });
});

describe("VIP phone toast (session.onViewChange)", () => {
  it("only the VIP gets lobby.premiumEndedPhone, once per flip", async () => {
    vi.stubGlobal("document", undefined);
    const { onViewChange } = await import("../src/state/session");
    const { toasts } = await import("../src/state/store");
    const base = lobbyFixture.view;
    const me = base.me!;
    const asVip = (premium: boolean): PlayerView => ({ ...base, hostPlayerId: me.id, premium });
    toasts.value = [];
    onViewChange(asVip(true), asVip(false));
    onViewChange(asVip(false), asVip(false));
    expect(toasts.value.map((x) => x.text)).toEqual([en["lobby.premiumEndedPhone"]]);
    toasts.value = [];
    const notVip = (premium: boolean): PlayerView => ({ ...base, hostPlayerId: "someone-else", premium });
    onViewChange(notVip(true), notVip(false));
    expect(toasts.value).toEqual([]);
    vi.unstubAllGlobals();
  });
});
