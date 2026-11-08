// PAYMENTS-SPEC §7.3 (phone): locked-pack rows (lock, no price), locked points, the error toast keys, the VIP Start
// hint while the TV is in the store, and `lobby.premiumEndedPhone` once per flip.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import en from "@jamaa/shared/i18n/en.json";
import fr from "@jamaa/shared/i18n/fr.json";
import ar from "@jamaa/shared/i18n/ar.json";
import type { PlayerRoomView, RoomPublic } from "@jamaa/shared/protocol/v2";
import { GAME_META } from "@jamaa/shared/games/meta";
import { errorKeyOf } from "../src/i18n/t";
import { lockedPackRows, premiumEndedStep, tvBusyHint } from "../src/lib/premium";

const hubFixture = JSON.parse(readFileSync(new URL("../../shared/fixtures/v2/s2c.state.player.hub.host.json", import.meta.url), "utf8")) as { view: PlayerRoomView };
const extra = { gameId: "mishana" as const, stars: null, domain: null, topics: [] };
const LOCKED = [
  { id: "en-food-01", family: "en-food-01", locale: "en", title: { en: "Food", fr: "Cuisine", ar: "أكل" }, pairCount: 33, ageRating: "all" as const, productId: "pack_en_food_01", ...extra },
  { id: "lb-food-01", family: "lb-food-01", locale: "ar-LB", title: { en: "Lebanese food", fr: "Cuisine libanaise", ar: "أكل لبناني" }, pairCount: 27, ageRating: "all" as const, productId: "pack_lb_food_01", ...extra },
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
      for (const k of ["settings.unlockOnTv", "error.packLocked", "error.premiumRequired", "pass.endedPhone", "error.tvBusy"]) {
        expect(typeof cat[k], k).toBe("string");
        expect(cat[k] as string, k).not.toMatch(/\{price\}|buy|achet|شراء/i);
      }
    }
  });

  it("the v2 hub fixture carries no locked packs outside SETUP (metadata only reaches setup)", () => {
    expect(hubFixture.view.room.setup).toBeNull();
  });
});

describe("premium settings (§1.6)", () => {
  it("Mish Ana!'s premium keys are exactly ['points'] (JAMAA-PLATFORM §4.3); G2–G4 have none", () => {
    expect(GAME_META.mishana.settings.premiumKeys).toEqual(["points"]);
    for (const id of ["bluff", "likely", "trivia"] as const) expect(GAME_META[id].settings.premiumKeys).toEqual([]);
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
  it("shows the hint under the VIP's (still enabled) Start, in SETUP only", () => {
    expect(tvBusyHint({ tvBusy: true, phase: "SETUP" }, true)).toBe(true);
    expect(tvBusyHint({ tvBusy: true, phase: "SETUP" }, false)).toBe(false);
    expect(tvBusyHint({ tvBusy: false, phase: "SETUP" }, true)).toBe(false);
    expect(tvBusyHint({ tvBusy: true, phase: "PLAYING" }, true)).toBe(false);
  });
});

describe("premium ended notice (§4.4, §5.1)", () => {
  type V = { premium: boolean; phase: RoomPublic["phase"] };
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
  it("a flip outside a game shows once", () => {
    expect(run([{ premium: true, phase: "HUB" }, { premium: false, phase: "HUB" }, { premium: false, phase: "HUB" }])).toEqual([1]);
  });
  it("a flip mid-game shows on the first HUB/SETUP after it, once", () => {
    expect(run([
      { premium: true, phase: "HUB" }, { premium: true, phase: "PLAYING" }, { premium: false, phase: "PLAYING" },
      { premium: false, phase: "PLAYING" }, { premium: false, phase: "HUB" }, { premium: false, phase: "HUB" },
    ])).toEqual([4]);
  });
  it("a free room never shows it; a re-upgrade cancels a pending notice; a second flip shows again", () => {
    expect(run([{ premium: false, phase: "HUB" }, { premium: false, phase: "PLAYING" }, { premium: false, phase: "HUB" }])).toEqual([]);
    expect(run([{ premium: true, phase: "PLAYING" }, { premium: false, phase: "PLAYING" }, { premium: true, phase: "PLAYING" }, { premium: true, phase: "HUB" }])).toEqual([]);
    expect(run([
      { premium: true, phase: "HUB" }, { premium: false, phase: "HUB" }, { premium: true, phase: "HUB" }, { premium: false, phase: "HUB" },
    ])).toEqual([1, 3]);
  });
});

describe("VIP phone toast (session.onViewChange)", () => {
  it("only the VIP gets pass.endedPhone, once per flip", async () => {
    vi.stubGlobal("document", undefined);
    const { onViewChange } = await import("../src/state/session");
    const { toasts } = await import("../src/state/store");
    await (await import("../src/i18n/t")).loadCatalog("en");
    const base = hubFixture.view;
    const me = base.me!;
    const as = (host: string, premium: boolean): PlayerRoomView => ({ ...base, room: { ...base.room, hostPlayerId: host, premium } });
    toasts.value = [];
    onViewChange(as(me.id, true), as(me.id, false));
    onViewChange(as(me.id, false), as(me.id, false));
    expect(toasts.value.map((x) => x.text)).toEqual([en["pass.endedPhone"]]);
    toasts.value = [];
    onViewChange(as("someone-else", true), as("someone-else", false));
    expect(toasts.value).toEqual([]);
    vi.unstubAllGlobals();
  });
});
