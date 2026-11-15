// GAME-TAQRIBAN §8: the phone keypad entry and the number-line layout (pure).
import { describe, expect, it } from "vitest";
import { EMPTY, entryState, layoutLine, press, valueOf, withMag } from "../../../src/games/taqriban/model";
import type { Entry } from "../../../src/games/taqriban/model";

const type = (keys: string, e: Entry = EMPTY): Entry => [...keys].reduce((x, k) => press(x, k === "<" ? "del" : k), e);

describe("keypad entry", () => {
  it("digits, one decimal point, 2 decimals (3 with a magnitude), no leading zeros", () => {
    expect(type("0012").digits).toBe("12");
    expect(type("3.141").digits).toBe("3.14");
    expect(type(".5").digits).toBe("0.5");
    expect(type("1..2").digits).toBe("1.2");
    expect(type("12<").digits).toBe("1");
    expect(valueOf(type("8.25"))).toBe(8.25);
    expect(valueOf(EMPTY)).toBeNull();
  });
  it("magnitude chips: 8 + billion = 8 000 000 000; 8.2 million; the same chip again removes it", () => {
    expect(valueOf(withMag(type("8"), "billion"))).toBe(8_000_000_000);
    expect(valueOf(withMag(type("8.2"), "million"))).toBe(8_200_000);
    expect(valueOf(press(withMag(type("3.04"), "trillion"), "1"))).toBe(3_041_000_000_000);
    expect(withMag(withMag(type("8"), "billion"), "billion").mag).toBeNull();
    expect(press(withMag(EMPTY, "million"), "del").mag).toBeNull();
  });
  it("too big beyond a quadrillion", () => {
    expect(entryState(withMag(type("999"), "trillion"))).toBe("ok");
    expect(entryState(withMag(type("1001"), "trillion"))).toBe("tooBig");
    expect(entryState(EMPTY)).toBe("empty");
  });
});

describe("number line", () => {
  it("log line: ordered positions in [0, 1], 0 at the start, ticks on powers of 10", () => {
    const l = layoutLine(3_040_000_000_000, [{ id: "a", value: 3 }, { id: "b", value: 1e12 }, { id: "c", value: 0 }], true);
    const x = Object.fromEntries(l.dots.map((d) => [d.id, d.x]));
    expect(x.c).toBe(0);
    expect(x.a).toBeLessThan(x.b as number);
    expect(l.answerX).toBeGreaterThan(x.b as number);
    expect(l.answerX).toBeLessThanOrEqual(1);
    expect(l.ticks.length).toBeGreaterThan(2);
    expect(l.ticks.length).toBeLessThanOrEqual(8);
  });
  it("linear line; close dots stack into lanes", () => {
    const l = layoutLine(330, [{ id: "a", value: 320 }, { id: "b", value: 321 }, { id: "c", value: 322 }, { id: "d", value: 500 }], false);
    const lanes = l.dots.filter((d) => d.value < 400).map((d) => d.lane);
    expect(new Set(lanes).size).toBe(3);
    for (const d of l.dots) expect(d.x).toBeGreaterThanOrEqual(0);
  });
});
