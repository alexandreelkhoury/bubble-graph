import { describe, expect, it } from "vitest";
import { capitalizeFirst, displayNormalize, graphemes, lengthHintOf, presentLie, sanitizeLie, scriptOk } from "../../../src/games/bluff/engine/text";

describe("display normalisation (§5.1 / §13.4 vectors)", () => {
  it("strips tashkeel and shadda", () => expect(displayNormalize("بيعدّها")).toBe("بيعدها"));
  it("maps guillemets (with their inner spaces) to plain quotes", () => expect(displayNormalize("« …est une gazelle »")).toBe('"…est une gazelle"'));
  it("drops trailing ! . …", () => {
    expect(displayNormalize("Gazelle!!")).toBe("Gazelle");
    expect(displayNormalize("A long story…")).toBe("A long story");
    expect(displayNormalize("Done.")).toBe("Done");
  });
  it("strips emoji", () => {
    expect(displayNormalize("gazelle 🦌")).toBe("gazelle");
    expect(displayNormalize("thumbs 👍🏽 up")).toBe("thumbs up");
  });
  it("typographic quotes and tatweel", () => {
    expect(displayNormalize("“hello” ‘there’")).toBe("\"hello\" 'there'");
    expect(displayNormalize("كتـــير")).toBe("كتير");
  });
  it("the Latin case rule applies to player lies only", () => {
    expect(capitalizeFirst("élan vital", "fr")).toBe("Élan vital");
    expect(capitalizeFirst("غزال", "ar")).toBe("غزال");
    expect(presentLie("a sleepy owl!", "en")).toBe("A sleepy owl");
  });
});

describe("input rules", () => {
  it("sanitises control/format chars, collapses spaces, caps combining marks", () => {
    expect(sanitizeLie("  a​\u0007b   c ")).toBe("a b c");
    // Cf characters are DELETED, never turned into a space: a zero-width split keeps the word whole.
    expect(sanitizeLie("شرم\u200Bوطة")).toBe("شرموطة");
    expect(sanitizeLie("fa\u00ADggot")).toBe("faggot");
    expect(sanitizeLie("a\u200C\u200D\u2060\uFEFF\u202Eb")).toBe("ab");
    // Invisible fillers that \p{L} or \s miss: Hangul fillers and the Braille blank.
    expect(sanitizeLie("a\u3164\u3164")).toBe("a");
    expect(sanitizeLie("a\u115F\u1160\uFFA0\u2800b")).toBe("ab");
    expect((sanitizeLie("e\u0301\u0301\u0301\u0301").match(/\p{M}/gu) ?? []).length).toBe(2);
    expect(graphemes(sanitizeLie("é́́́"))).toHaveLength(1);
  });
  it("script rule: every letter in the room's script", () => {
    expect(scriptOk("ghazal", "ar")).toBe(false);
    expect(scriptOk("غزال", "ar")).toBe(true);
    expect(scriptOk("غزال 3 مرات", "ar")).toBe(true);
    expect(scriptOk("غزال", "en")).toBe(false);
    expect(scriptOk("gazelle غزال", "fr")).toBe(false);            // mixed scripts are an instant tell
    expect(scriptOk("ya sharmouta ب", "ar")).toBe(false);          // Arabizi padded with one Arabic letter
    expect(scriptOk("nigger ب", "ar")).toBe(false);
    expect(scriptOk("Élan, cœur & ñandú!", "fr")).toBe(true);
    expect(scriptOk("123", "en")).toBe(false);
  });
  it("homoglyph clone of the truth (Greek Eta, Cyrillic а/с/е) → LIE_WRONG_SCRIPT", () => {
    expect(scriptOk("Ηumаn fасеs", "en")).toBe(false);
    expect(scriptOk("Human faces", "en")).toBe(true);
    expect(scriptOk(sanitizeLie("a\u3164\u3164"), "en")).toBe(true);   // the filler is gone: "a" (then LIE_EMPTY: 1 letter)
    expect(scriptOk("a\u3164\u3164", "en")).toBe(false);               // even unsanitised, Hangul is not Latin
  });
  it("length hint from the truth's word count", () => {
    expect(lengthHintOf("cubes")).toBe("short");
    expect(lengthHintOf("two words")).toBe("short");
    expect(lengthHintOf("a few more words")).toBe("few");
    expect(lengthHintOf("someone who idly watches canal boats go by")).toBe("sentence");
    expect(lengthHintOf(null)).toBe("free");
  });
});
