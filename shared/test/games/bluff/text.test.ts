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
    expect((sanitizeLie("e\u0301\u0301\u0301\u0301").match(/\p{M}/gu) ?? []).length).toBe(2);
    expect(graphemes(sanitizeLie("é́́́"))).toHaveLength(1);
  });
  it("script rule", () => {
    expect(scriptOk("ghazal", "ar")).toBe(false);
    expect(scriptOk("غزال", "ar")).toBe(true);
    expect(scriptOk("غزال", "en")).toBe(false);
    expect(scriptOk("gazelle غزال", "fr")).toBe(true);
  });
  it("length hint from the truth's word count", () => {
    expect(lengthHintOf("cubes")).toBe("short");
    expect(lengthHintOf("two words")).toBe("short");
    expect(lengthHintOf("a few more words")).toBe("few");
    expect(lengthHintOf("someone who idly watches canal boats go by")).toBe("sentence");
    expect(lengthHintOf(null)).toBe("free");
  });
});
