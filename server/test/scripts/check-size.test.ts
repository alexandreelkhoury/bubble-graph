// JAMAA-PLATFORM §5.6: the Worker size checks (code, content text modules, whole upload).
import { describe, expect, it } from "vitest";
import { checkSizes, CONTENT_BUDGET, JS_BUDGET } from "../../scripts/check-size.mjs";

const bytes = (n: number, fill = 97): Uint8Array => new Uint8Array(n).fill(fill);

describe("check-size", () => {
  it("passes within budget and reports the three lines", () => {
    const js = new TextEncoder().encode('import m0 from "./a.txt";' + "x".repeat(1000));
    const r = checkSizes([{ name: "index.js", bytes: js }, { name: "a.txt", bytes: bytes(500) }, { name: "stale.txt", bytes: bytes(5000) }]);
    expect(r.ok).toBe(true);
    expect(r.lines).toHaveLength(3);
    expect(r.lines[1]).toMatch(/1 text modules/);
  });
  it("fails on code over 400 KB, content over 2 MB raw, or a missing script", () => {
    expect(checkSizes([{ name: "index.js", bytes: bytes(JS_BUDGET + 1) }]).ok).toBe(false);
    expect(checkSizes([{ name: "index.js", bytes: new TextEncoder().encode('"./x.txt"') }, { name: "x.txt", bytes: bytes(CONTENT_BUDGET + 1) }]).ok).toBe(false);
    expect(checkSizes([{ name: "x.txt", bytes: bytes(1) }]).ok).toBe(false);
  });
});
