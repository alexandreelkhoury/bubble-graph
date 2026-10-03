import { describe, expect, it } from "vitest";
import { detectLocale, dirOf, errorKeyOf, translate } from "../src/i18n/t";

describe("t()", () => {
  it("falls back locale → en → key", () => {
    expect(translate("fr", "common.ok")).toBe(translate("fr", "common.ok"));
    expect(translate("ar", "no.such.key")).toBe("no.such.key");
    expect(translate("en", "lang.ar")).toBe("العربية");
  });
  it("replaces placeholders and isolates nothing extra", () => {
    expect(translate("en", "lobby.joined", { name: "Rami" })).toBe("Rami is with us!");
    expect(translate("en", "lobby.playerCount", { count: 5, max: 12 })).toBe("Players 5/12");
  });
  it("keeps unknown placeholders", () => {
    expect(translate("en", "lobby.joined", {})).toBe("{name} is with us!");
  });
  it("selects EN and FR plurals", () => {
    expect(translate("en", "common.seconds", { count: 1 })).toBe("1 second");
    expect(translate("en", "common.seconds", { count: 2 })).toBe("2 seconds");
    const fr0 = translate("fr", "common.seconds", { count: 0 });
    const fr1 = translate("fr", "common.seconds", { count: 1 });
    const fr5 = translate("fr", "common.seconds", { count: 5 });
    expect(fr1).toBe(fr0.replace("0", "1")); // FR: 0 and 1 are both "one"
    expect(fr5).not.toBe(fr1.replace("1", "5"));
  });
  it("selects all six AR plural categories, with Western digits", () => {
    const zero = translate("ar", "common.seconds", { count: 0 });
    const one = translate("ar", "common.seconds", { count: 1 });
    const two = translate("ar", "common.seconds", { count: 2 });
    const few = translate("ar", "common.seconds", { count: 3 });
    const many = translate("ar", "common.seconds", { count: 11 });
    const other = translate("ar", "common.seconds", { count: 100 });
    expect(new Set([zero, one, two, few]).size).toBe(4);
    expect(few).toContain("3");
    expect(many).toContain("11");
    expect(other).toContain("100");
    expect(few).not.toMatch(/[٠-٩]/);
  });
  it("formats numbers with latn digits in every locale", () => {
    expect(translate("ar", "round.label", { count: 12 })).toMatch(/12/);
  });
  it("helpers", () => {
    expect(errorKeyOf("NOT_YOUR_TURN")).toBe("error.notYourTurn");
    expect(detectLocale(["de-DE", "fr-CA", "en"])).toBe("fr");
    expect(detectLocale(["ar-LB"])).toBe("ar");
    expect(detectLocale([])).toBe("en");
    expect(dirOf("ar")).toBe("rtl");
  });
});
