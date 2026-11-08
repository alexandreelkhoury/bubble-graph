// JAMAA-PLATFORM §2.7: the Mish Ana! adapter behind the GameDefinition (tests listed there, through the real room).
import { describe, expect, it } from "vitest";
import { ENTRANCE_GRACE_MS } from "../../../src/constants";
import { mishanaDefinition as def, fromEngineSettings, toEngineSettings } from "../../../src/games/mishana/adapter";
import { MISHANA_META } from "../../../src/games/mishana/meta";
import { DEFAULT_SETTINGS } from "../../../src/games/mishana/engine/settings";
import { pid, RoomHarness, TEST_CATALOG, TEST_FREE_CATALOG } from "../../../src/testing";
import type { RosterEntry } from "../../../src/games/types";

const COLORS = ["coral", "azure", "lemon", "jade", "grape", "tangerine"] as const;

function room(n: number, opts: { timersOff?: boolean } = {}): RoomHarness {
  const h = new RoomHarness({ seed: 7 });
  for (let i = 0; i < n; i++) h.join(pid(i), `Player${i}`, COLORS[i] as (typeof COLORS)[number]);
  h.tv({ type: "OPEN_GAME", gameId: "mishana" });
  if (opts.timersOff) h.tv({ type: "UPDATE_GAME_SETTINGS", gameId: "mishana", patch: { clueSeconds: 0, voteSeconds: 0, revealSeconds: 0, guessSeconds: 0 } });
  return h;
}
const intent = (i: unknown) => ({ type: "GAME" as const, gameId: "mishana" as const, i });

describe("Mish Ana! adapter (§2.7)", () => {
  it("the VIP's HOST_ADVANCE works", () => {
    const h = room(4);
    h.tv({ type: "START_GAME" });
    expect(h.mishana().phase).toBe("ROLE_REVEAL");
    h.p(pid(0), intent({ type: "HOST_ADVANCE" }));
    expect(h.mishana().phase).toBe("CLUES");
    expect(h.err({ ...intent({ type: "HOST_ADVANCE" }), by: { kind: "player", playerId: pid(1) } })).toBe("NOT_HOST");
  });
  it("the VIP's override of their own guess is rejected (NOT_HOST)", () => {
    // Find a seed where the VIP (seat 0) is the Mole, then get them eliminated and let them guess wrong.
    for (let seed = 1; seed < 400; seed++) {
      const h = new RoomHarness({ seed });
      for (let i = 0; i < 4; i++) h.join(pid(i), `Player${i}`, COLORS[i] as (typeof COLORS)[number]);
      h.tv({ type: "OPEN_GAME", gameId: "mishana" });
      h.tv({ type: "START_GAME" });
      if (h.mishana().players.find((p) => p.id === pid(0))?.role !== "BLANK") continue;
      h.tv(intent({ type: "HOST_ADVANCE" }));
      while (h.mishana().phase === "CLUES") h.p(h.mishana().speakingOrder[h.mishana().turnIdx] as string, intent({ type: "CLUE_DONE" }));
      for (const p of h.mishana().players) h.p(p.id, intent({ type: "CAST_VOTE", targetId: p.id === pid(0) ? pid(1) : pid(0) }));
      expect(h.mishana().phase).toBe("ELIMINATION");
      h.tv(intent({ type: "HOST_ADVANCE" }));
      expect(h.mishana().phase).toBe("MR_WHITE_GUESS");
      h.p(pid(0), intent({ type: "SUBMIT_GUESS", text: "Zzyzx" }));
      expect(h.err({ ...intent({ type: "HOST_OVERRIDE_GUESS", accept: true }), by: { kind: "player", playerId: pid(0) } })).toBe("NOT_HOST");
      return;
    }
    throw new Error("no seed with the VIP as the Mole");
  });
  it("after the VIP leaves, the room's new host has engine host power and nobody else does", () => {
    const h = room(4);
    h.tv({ type: "START_GAME" });
    h.p(pid(0), { type: "LEAVE" });
    expect(h.state.hostPlayerId).toBe(pid(1));
    expect(h.err({ ...intent({ type: "HOST_ADVANCE" }), by: { kind: "player", playerId: pid(2) } })).toBe("NOT_HOST");
    h.p(pid(1), intent({ type: "HOST_ADVANCE" }));
    expect(h.mishana().hostPlayerId).toBe(pid(1));
  });
  it("a disconnected roster member starts with connected:false, ready:true", () => {
    const h = room(4);
    h.sys({ type: "DISCONNECT", playerId: pid(3) });
    h.tv({ type: "START_GAME" });
    const p = h.mishana().players.find((x) => x.id === pid(3));
    expect(p).toMatchObject({ connected: false, ready: true });
  });
  it("the first REVEAL deadline equals the normal one + ENTRANCE_GRACE_MS", () => {
    const h = room(4);
    h.tv({ type: "START_GAME" });
    const d = h.mishana().deadline;
    expect(d?.at).toBe(h.now + DEFAULT_SETTINGS.revealSeconds * 1000 + ENTRANCE_GRACE_MS);
    expect(ENTRANCE_GRACE_MS).toBe(2500);
    const off = room(4, { timersOff: true });
    off.tv({ type: "START_GAME" });
    expect(off.mishana().deadline).toBeNull();
  });
  it("a KICK appears in history with cause KICK", () => {
    const h = room(4);
    h.tv({ type: "START_GAME" });
    h.tv(intent({ type: "HOST_ADVANCE" }));
    h.tv({ type: "KICK", playerId: pid(2) });
    expect(h.mishana().history.at(-1)).toMatchObject({ eliminatedId: pid(2), cause: "KICK" });
    expect(h.state.members.find((m) => m.id === pid(2))?.left).toBe(true);
  });
  it("REPLAY carries scores (carriesScore) and the no-repeat list", () => {
    const h = room(4);
    h.tv({ type: "START_GAME" });
    h.playMishanaToResults();
    const scores = Object.fromEntries(h.mishana().players.map((p) => [p.id, p.score]));
    const used = [...h.mishana().usedPairKeys];
    h.tv({ type: "REPLAY" });
    expect(Object.fromEntries(h.mishana().players.map((p) => [p.id, p.score]))).toEqual(scores);
    expect(h.mishana().usedPairKeys.slice(0, used.length)).toEqual(used);
    expect(h.mishana().gameNumber).toBe(1);   // a fresh engine instance; the room numbers instances (game.n)
    expect(h.state.game?.n).toBe(2);
  });
  it("NO_WORDS_AVAILABLE maps to the platform NO_CONTENT_AVAILABLE", () => {
    const roster: RosterEntry[] = [0, 1, 2].map((i) => ({ id: pid(i), seat: i, locale: "en", connected: true, carryScore: 0 }));
    const s = { ...MISHANA_META.settings.defaults, difficulties: [3 as const], packIds: ["test-en-teen-01"] };
    expect(def.startBlocker(roster, s, TEST_CATALOG, "en")).toBe("NO_CONTENT_AVAILABLE");
    const r = def.start({ roster, settings: s, locale: "en", memory: { usedKeys: [] }, seed: 1, now: 0, graceMs: 0, content: TEST_CATALOG });
    expect(r).toMatchObject({ ok: false, error: "NO_CONTENT_AVAILABLE" });
    expect(def.startBlocker(roster.slice(0, 2), MISHANA_META.settings.defaults, TEST_FREE_CATALOG, "en")).toBe("NOT_ENOUGH_PLAYERS");
    expect(def.startBlocker(roster, { ...MISHANA_META.settings.defaults, roleMode: "custom", undercoverCount: 2, blankCount: 2 }, TEST_FREE_CATALOG, "en")).toBe("INVALID_ROLE_CONFIG");
  });
  it("settings: apply/normalize/restrict keep the engine rules and identity", () => {
    const d = MISHANA_META.settings.defaults;
    expect(fromEngineSettings(toEngineSettings(d, "fr"))).toEqual(d);
    expect(Object.keys(toEngineSettings(d, "fr"))).toEqual(Object.keys(DEFAULT_SETTINGS));
    expect(def.settings.apply(d, { revealRoles: true }, TEST_FREE_CATALOG, "en")).toMatchObject({ revealRoles: true });
    expect(def.settings.apply(d, { clueSeconds: 3 }, TEST_FREE_CATALOG, "en")).toBeNull();
    expect(def.settings.apply(d, { wordLocale: "fr" } as never, TEST_FREE_CATALOG, "en")).toBeNull();
    expect(def.settings.restrict(d, { playableIds: new Set(), premium: false }, TEST_FREE_CATALOG, "en")).toBe(d);
    const pts = { ...d, points: { civilian: 5, undercover: 10, blank: 10 }, packIds: ["test-en-teen-01", "en-everyday-01"] };
    const r = def.settings.restrict(pts, { playableIds: new Set(["test-en-01"]), premium: false }, TEST_FREE_CATALOG, "en");
    expect(r.points).toEqual(d.points);
    expect(r.packIds).toEqual(["en-everyday-01"]);
    expect(def.settings.restrict(pts, { playableIds: new Set(["test-en-teen-01"]), premium: true }, TEST_FREE_CATALOG, "en")).toBe(pts);
    expect(def.settings.normalize({ ...d, difficulties: [3, 1], points: { civilian: 1 } })).toEqual(d);
  });
  it("projectStatus says who acted, never what", () => {
    const h = room(4);
    h.tv({ type: "START_GAME" });
    h.p(pid(1), intent({ type: "READY" }));
    expect(def.projectStatus(h.mishana())).toMatchObject({ phase: "ROLE_REVEAL", doneIds: [pid(1)] });
    h.tv(intent({ type: "HOST_ADVANCE" }));
    const st = def.projectStatus(h.mishana());
    expect(st.awaitedIds).toEqual([h.mishana().speakingOrder[0]]);
  });
});
