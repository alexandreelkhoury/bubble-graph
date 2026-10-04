import { describe, expect, it } from "vitest";
import { FATAL_CLOSE_CODES, SLOW_RECONNECT_CLOSE_CODES } from "../../src/constants";
import { CLOSE_CODES, ERROR_CODES, ERROR_INFO } from "../../src/protocol/errors";

describe("close codes (§6.4)", () => {
  it("FATAL_CLOSE_CODES is exactly the close codes of the fatal errors", () => {
    const fromErrors = ERROR_CODES.filter((c) => ERROR_INFO[c].fatal).map((c) => ERROR_INFO[c].closeCode);
    expect([...fromErrors].sort()).toEqual([...FATAL_CLOSE_CODES].sort());
  });

  it("every error close code is a known close code, and slow-reconnect codes are not fatal", () => {
    const known = new Set<number>(Object.values(CLOSE_CODES));
    for (const c of ERROR_CODES) {
      const code = ERROR_INFO[c].closeCode;
      if (code !== null) expect(known.has(code)).toBe(true);
    }
    for (const c of SLOW_RECONNECT_CLOSE_CODES) expect((FATAL_CLOSE_CODES as readonly number[]).includes(c)).toBe(false);
  });
});
