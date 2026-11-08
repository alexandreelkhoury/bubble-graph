// JAMAA-PLATFORM §2.2: platform error codes and per-game code lists.
import { describe, expect, it } from "vitest";
import { ERROR_CODES, ERROR_INFO, GAME_ERROR_CODES, PLATFORM_ERROR_CODES, errorMessageKey } from "../../src/protocol/errors";

describe("platform error codes (§2.2)", () => {
  it("adds the eight platform codes, all non-fatal without a close code", () => {
    const added = ["UNKNOWN_GAME", "GAME_DISABLED", "GAME_UNAVAILABLE", "WRONG_GAME", "NOT_IN_GAME", "GAME_FULL", "NO_CONTENT_AVAILABLE", "REACTION_TOO_FAST"] as const;
    for (const c of added) {
      expect(PLATFORM_ERROR_CODES).toContain(c);
      expect(ERROR_INFO[c]).toEqual({ fatal: false, closeCode: null });
    }
    expect(errorMessageKey("NO_CONTENT_AVAILABLE")).toBe("error.noContentAvailable");
  });
  it("has no duplicate code across the platform and the games", () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
    const all = [...PLATFORM_ERROR_CODES, ...Object.values(GAME_ERROR_CODES).flat()];
    expect(new Set(all).size).toBe(all.length);
  });
  it("every game code is in ERROR_CODES and never fatal", () => {
    for (const list of Object.values(GAME_ERROR_CODES)) for (const c of list as readonly string[]) {
      expect(ERROR_CODES as readonly string[]).toContain(c);
      expect(ERROR_INFO[c as keyof typeof ERROR_INFO].fatal).toBe(false);
    }
  });
});
