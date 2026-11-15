// Owner report (2026-11-15): on Join the "Let me in!" button vanished while typing the name and only flashed when a
// character was tapped. Root cause: the on-screen keyboard covers the page (only the visual viewport shrinks), so the
// sticky action bar sat under it. lib/keyboard.ts lifts every action bar above the keyboard; the button is never
// unmounted and says why it is disabled.
import { describe, expect, it } from "vitest";
import { keyboardInset, watchKeyboard } from "../src/lib/keyboard";
import { joinBlockedReason } from "../src/screens/Join";
import { t } from "../src/i18n/t";

function fakeViewport(height: number, offsetTop = 0) {
  const ls: Record<string, (() => void)[]> = {};
  return {
    height, offsetTop,
    addEventListener(type: string, f: () => void) { (ls[type] ??= []).push(f); },
    fire(type: string) { for (const f of ls[type] ?? []) f(); },
  };
}

describe("keyboard inset (the action bar rides above the on-screen keyboard)", () => {
  it("is the part of the layout viewport under the keyboard, 0 without one", () => {
    expect(keyboardInset(844, { height: 844, offsetTop: 0 })).toBe(0);
    expect(keyboardInset(844, { height: 500, offsetTop: 0 })).toBe(344);        // Android: keyboard over the page
    expect(keyboardInset(844, { height: 500, offsetTop: 120 })).toBe(224);      // iOS: the visual viewport also panned
    expect(keyboardInset(844, { height: 820, offsetTop: 0 })).toBe(0);          // a collapsing URL bar is not a keyboard
  });
  it("watchKeyboard keeps --kb-inset in step (open, pan, close) and writes only on change", () => {
    const vv = fakeViewport(844);
    const writes: string[] = [];
    const root = { clientHeight: 844, style: { setProperty: (k: string, v: string) => { writes.push(`${k}=${v}`); } } };
    watchKeyboard({ visualViewport: vv }, root);
    expect(writes).toEqual(["--kb-inset=0px"]);
    vv.height = 500;
    vv.fire("resize");
    vv.fire("resize");
    vv.offsetTop = 100;
    vv.fire("scroll");
    vv.height = 844;
    vv.offsetTop = 0;
    vv.fire("resize");
    expect(writes).toEqual(["--kb-inset=0px", "--kb-inset=344px", "--kb-inset=244px", "--kb-inset=0px"]);
  });
  it("does nothing without a visualViewport", () => {
    const root = { clientHeight: 844, style: { setProperty: () => { throw new Error("no write"); } } };
    expect(() => watchKeyboard({}, root)).not.toThrow();
  });
});

describe("Join button reason", () => {
  it("says why it is disabled; nothing once it can join, while joining, or when the room-full error shows", () => {
    expect(joinBlockedReason(null, "coral", false, false)).toBe(t("error.nameInvalid"));
    expect(joinBlockedReason("Rami", null, false, false)).not.toBeNull();
    expect(joinBlockedReason("Rami", "coral", false, false)).toBeNull();
    expect(joinBlockedReason(null, "coral", true, false)).toBeNull();
    expect(joinBlockedReason(null, null, false, true)).toBeNull();
  });
});
