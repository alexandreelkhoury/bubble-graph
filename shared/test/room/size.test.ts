// JAMAA-PLATFORM §2.6 size and write cost: the worst-case `state` key ≤ 16 KiB, `history` ≤ 32 KiB.
import { describe, expect, it } from "vitest";
import { HISTORY_GAMES_MAX, MAX_PLAYERS, MEMORY_MAX_KEYS, NAME_MAX_CHARS } from "../../src/constants";
import type { ColorId } from "../../src/constants";
import { GAME_IDS } from "../../src/games/ids";
import { pid, RoomHarness, TEST_CATALOG } from "../../src/testing";
import { contentCatalog } from "../../src/content/catalog";
import type { RoomHistory } from "../../src/room/types";

const COLORS: ColorId[] = ["coral", "azure", "lemon", "jade", "grape", "tangerine", "aqua", "rose", "mint", "plum", "sand", "lilac"];
const bytes = (v: unknown): number => new TextEncoder().encode(JSON.stringify(v)).length;

describe("room storage size (§2.6)", () => {
  it("worst-case Mish Ana! state at 12 members (longest names, every slot, a full game) ≤ 16 KiB", () => {
    const h = new RoomHarness({ seed: 9, content: contentCatalog(TEST_CATALOG) });
    // Longest names: NAME_MAX_CHARS graphemes of a 4-byte UTF-8 character.
    for (let i = 0; i < MAX_PLAYERS; i++) h.join(pid(i), "𝔐".repeat(NAME_MAX_CHARS - 2) + String(i).padStart(2, "0"), COLORS[i] as ColorId);
    h.tv({ type: "OPEN_GAME", gameId: "mishana" });
    h.tv({ type: "UPDATE_GAME_SETTINGS", gameId: "mishana", patch: { packIds: ["test-en-01"] } });
    h.tv({ type: "START_GAME" });
    let max = 0;
    h.playMishanaToResults("Zzyzx", () => {
      max = Math.max(max, bytes(h.state));
    });
    for (const m of h.state.members) h.state.cup.stars[m.id] = 99;
    max = Math.max(max, bytes(h.state));
    console.log(`state worst case: ${max} bytes`);
    expect(max).toBeLessThanOrEqual(16 * 1024);
  });
  // Item keys as the games store them: Mish Ana! pair keys "<packId>:<pairId>" (a typical 14-character pack id), and
  // "<family>:<itemId>" for G2–G4 (e.g. "lb-quiz-01:q0123").
  it("history (4 games × 300 ids + 20 cup entries at 12 members) ≤ 32 KiB", () => {
    const ids = Array.from({ length: MAX_PLAYERS }, (_, i) => pid(i));
    const h: RoomHistory = {
      memory: Object.fromEntries(GAME_IDS.map((g) => [g, { usedKeys: Array.from({ length: MEMORY_MAX_KEYS }, (_, i) => (g === "mishana" ? `en-everyday-01:p${String(i).padStart(3, "0")}` : `lb-quiz-01:q${String(i).padStart(4, "0")}`)) }])),
      games: Array.from({ length: HISTORY_GAMES_MAX }, (_, n) => ({ gameId: GAME_IDS[n % 4] as "mishana", n: n + 1, ranking: ids.map((id) => [id]), endedAt: 1_790_000_000_000 + n })),
    };
    console.log(`history worst case: ${bytes(h)} bytes`);
    expect(bytes(h)).toBeLessThanOrEqual(32 * 1024);
  });
});
