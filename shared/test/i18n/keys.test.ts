import { describe, expect, it } from "vitest";
import { COLORS } from "../../src/constants";
import { errorKey, MESSAGES } from "../../src/i18n/index";
import { ERROR_CODES } from "../../src/protocol/errors";

type Value = string | Record<string, string>;
const KEY_RE = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/;
const placeholders = (s: string): Set<string> => new Set([...s.matchAll(/\{([a-z][a-zA-Z0-9]*)\}/g)].map((m) => m[1] as string));
const union = (v: Value): Set<string> => (typeof v === "string" ? placeholders(v) : new Set(Object.values(v).flatMap((x) => [...placeholders(x)])));
const sorted = (s: Set<string>): string[] => [...s].sort();

const en = MESSAGES.en as Record<string, Value>;
const others = { fr: MESSAGES.fr as Record<string, Value>, ar: MESSAGES.ar as Record<string, Value>, es: MESSAGES.es as Record<string, Value> };

describe("i18n keys (§11)", () => {
  it("keys match the key regex", () => {
    for (const k of Object.keys(en)) expect(KEY_RE.test(k), k).toBe(true);
  });
  it.each(Object.entries(others))("%s has exactly the en key set", (_l, m) => {
    expect(Object.keys(m).sort()).toEqual(Object.keys(en).sort());
  });
  it.each(Object.entries(others))("%s placeholder names equal en per key (plural: union rule)", (_l, m) => {
    for (const [k, v] of Object.entries(en)) {
      const o = m[k];
      if (o === undefined) continue;
      expect(sorted(union(o)), k).toEqual(sorted(union(v)));
      if (typeof v === "string") expect(typeof o, k).toBe("string");
    }
  });
  it("plural objects have `other`; no literal percent", () => {
    for (const m of [en, others.fr, others.ar, others.es]) {
      for (const [k, v] of Object.entries(m)) {
        if (typeof v !== "string") expect(v.other, k).toBeTypeOf("string");
        const strings = typeof v === "string" ? [v] : Object.values(v);
        for (const s of strings) expect(s.includes("%"), k).toBe(false);
      }
    }
  });
  it("every ErrorCode has an error.* key", () => {
    for (const c of ERROR_CODES) expect(en[errorKey(c)], c).toBeDefined();
  });
  it("PAYMENTS-SPEC §4.7 billing keys exist in every locale", () => {
    const keys = [
      "lobby.premium", "lobby.premiumRoom", "lobby.premiumEnded", "lobby.premiumEndedPhone", "lobby.wordsRepeating",
      "store.title", "store.premiumTitle", "store.premiumPitch", "store.unlockPremium", "store.premiumLifetime",
      "store.premiumActive", "store.packsTitle", "store.otherLanguages",
      "store.packPairs", "store.buy", "store.owned", "store.included", "store.pending", "store.pendingBody", "store.confirming",
      "store.unlocked", "store.addedToGame", "store.switchLanguage", "store.restore", "store.restored", "store.nothingToRestore",
      "store.help", "store.loading", "store.unavailable", "store.playUnavailable", "store.network", "store.itemUnavailable",
      "store.errorGeneric", "store.alreadyOwned", "store.verifyFailed", "store.installLimit", "store.installLimitNoHelp",
      "store.testMode", "store.tvAppOnly", "settings.locked", "settings.premiumOnly", "settings.unlockHint",
      "settings.unlockOnTv", "settings.lockedPacks", "tv.packLocked", "tv.premiumRequired", "error.premiumRequired",
      "error.packLocked", "error.entitlementInvalid", "error.tvBusy",
    ];
    for (const m of [en, others.fr, others.ar, others.es]) for (const k of keys) expect(m[k], k).toBeDefined();
    const plural = ["store.premiumPitch", "store.packPairs"];
    for (const k of plural) expect(typeof en[k], k).toBe("object");
    expect(sorted(union(en["store.unlockPremium"] as Value))).toEqual(["price"]);
    expect(sorted(union(en["store.premiumPitch"] as Value))).toEqual(["count", "pairs"]);
  });
  it("FR uses U+202F, never an ordinary space, before ! ? : ; (all of fr.json)", () => {
    for (const [k, v] of Object.entries(others.fr)) {
      for (const s of typeof v === "string" ? [v] : Object.values(v)) expect(/ [!?:;]/.test(s), `${k}: ${s}`).toBe(false);
    }
  });
  it("ES uses the house role names (Topo / Infiltrado), never trademarked ones, and no vosotros forms", () => {
    const all = Object.values(others.es).flatMap((v) => (typeof v === "string" ? [v] : Object.values(v))).join("\n").replace(/\{[a-zA-Z]+\}/g, "");
    expect(all).not.toMatch(/Undercover|Mr\.? ?White|Señor Blanco/i);
    expect(all).not.toMatch(/\b(vosotros|vuestr[oa]s?|os)\b|\b\w+(áis|éis)\b/i);
    expect(others.es["reveal.youAreBlank"]).toBe("¡Eres el Topo!");
    expect(others.es["role.undercover"]).toBe("Infiltrado");
  });
  it("every locale names every UI language (lang.*)", () => {
    for (const m of [en, others.fr, others.ar, others.es]) for (const l of ["en", "fr", "ar", "es"]) expect(m[`lang.${l}`], l).toBeTypeOf("string");
  });
  it("color.* keys match COLORS", () => {
    const colorKeys = Object.keys(en).filter((k) => k.startsWith("color.")).map((k) => k.slice(6)).sort();
    expect(colorKeys).toEqual(COLORS.map((c) => c.id).sort());
  });
});
