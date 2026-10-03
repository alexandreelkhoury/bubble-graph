import { describe, expect, it } from "vitest";
import { nameKey, sanitizeName } from "../../src/engine/sanitize";

const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const graphemes = (s: string): number => [...seg.segment(s)].length;

describe("sanitizeName (§7.9)", () => {
  it("strips bidi and other control/format characters", () => {
    expect(sanitizeName("‮Ali‏⁦ce⁩")).toBe("Alice");
    expect(sanitizeName("Bo\u0000b‍")).toBe("Bob");
    expect(sanitizeName("Pri")).toBe("Pri"); // private use
  });
  it("collapses whitespace and trims", () => {
    expect(sanitizeName("  Léa \t  Marie \n")).toBe("Léa Marie");
  });
  it("cuts Zalgo (1 base + 15 marks) to 2 combining marks", () => {
    const marks = Array.from({ length: 15 }, (_, i) => String.fromCodePoint(0x0300 + i + 1)).join("");
    const out = sanitizeName("a" + marks) ?? "";
    // NFC first composes a+U+0301 into U+00E1; the grapheme then keeps at most 2 combining marks.
    expect(out).toBe("á̂̃");
    expect([...out].filter((c) => /\p{M}/u.test(c)).length).toBe(2);
    const z = sanitizeName("x" + marks) ?? "";
    expect(z).toBe("x́̂");
  });
  it("cuts 17 graphemes to 16 and trims again", () => {
    expect(sanitizeName("abcdefghijklmnopq")).toBe("abcdefghijklmnop");
    expect(sanitizeName("abcdefghijklmno pq")).toBe("abcdefghijklmno");
    // ZWJ is stripped (Cf), so each family emoji splits into 4 graphemes; 16 are kept.
    const family = "\u{1F468}‍\u{1F469}‍\u{1F467}";
    expect(graphemes(sanitizeName(family.repeat(17)) ?? "")).toBe(16);
  });
  it("rejects empty results", () => {
    expect(sanitizeName("   ")).toBeNull();
    expect(sanitizeName("‎‏")).toBeNull();
  });
  it("rejects more than 64 code points after sanitising", () => {
    // Hangul conjoining jamo: one grapheme of 5 code points after NFC, no combining marks. 16 × 5 = 80 > 64.
    const cluster = "ᄀᄀᄀᄀ각";
    expect(graphemes(cluster)).toBe(1);
    expect(sanitizeName(cluster.repeat(16))).toBeNull();
    expect(sanitizeName(cluster.repeat(12))).not.toBeNull(); // 12 × 5 code points after NFC = 60
    expect(sanitizeName(cluster.repeat(13))).toBeNull(); // 13 × 5 = 65
  });
  it("nameKey treats full-width and case variants as equal", () => {
    expect(nameKey("ＲＡＭＩ")).toBe(nameKey("rami"));
    expect(nameKey("Léa")).toBe(nameKey("LÉA"));
  });
});
