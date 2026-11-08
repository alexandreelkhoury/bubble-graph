// JAMAA-PLATFORM §2.8 room properties (fast-check): random room intents interleaved with random Mish Ana! intents over
// random rosters (1–12) keep assertRoomInvariants after every step (the harness checks), leak nothing, and are
// deterministic; every game ends. ROOM_PROPS_RUNS raises the run count (the P acceptance run uses 2000).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { REACTIONS } from "../../src/room/types";
import type { RoomAction, RoomIntent } from "../../src/room/types";
import { findRoomLeaks, pid, RoomHarness } from "../../src/testing";
import type { ColorId } from "../../src/constants";

const RUNS = Number(process.env.ROOM_PROPS_RUNS ?? 150);
const COLORS: ColorId[] = ["coral", "azure", "lemon", "jade", "grape", "tangerine", "aqua", "rose", "mint", "plum", "sand", "lilac"];

/** A step: who (0 = TV, 1..13 = pid(k-1), possibly not a member) does what (an index into the menu below). */
type Step = { progress: boolean; who: number; what: number; arg: number; dt: number };
const stepArb: fc.Arbitrary<Step> = fc.record({
  progress: fc.integer({ min: 0, max: 9 }).map((x) => x < 7),
  who: fc.integer({ min: 0, max: 13 }),
  what: fc.integer({ min: 0, max: 29 }),
  arg: fc.integer({ min: 0, max: 0xffff }),
  dt: fc.constantFrom(0, 300, 1000, 5000, 30_000, 130_000),
});

/** The action that moves the session forward: open, start, play, then replay / back to setup / back to hub. */
function progressAction(h: RoomHarness, st: Step): RoomAction | null {
  const tv = { kind: "tv" } as const;
  const s = h.state;
  if (s.phase === "HUB") return { type: "OPEN_GAME", gameId: "mishana", by: tv };
  if (s.phase === "SETUP") return { type: "START_GAME", by: tv };
  const next = h.nextMishanaAction();
  if (next) return next;
  return { type: (["REPLAY", "REPLAY", "BACK_TO_SETUP", "BACK_TO_HUB"] as const)[st.arg % 4], by: tv } as RoomAction;
}

function actionFor(h: RoomHarness, st: Step): RoomAction {
  if (st.progress) {
    const p = progressAction(h, st);
    if (p) return p;
  }
  const by = st.who === 0 ? ({ kind: "tv" } as const) : ({ kind: "player", playerId: pid(st.who - 1) } as const);
  const members = h.state.members;
  const someone = members[st.arg % Math.max(1, members.length)]?.id ?? pid(st.arg % 12);
  const g = (i: unknown): RoomIntent => ({ type: "GAME", gameId: "mishana", i });
  const menu: (RoomIntent | { sys: RoomAction })[] = [
    { type: "OPEN_GAME", gameId: "mishana" },
    { type: "OPEN_GAME", gameId: ["bluff", "chess", "trivia"][st.arg % 3] as string },
    { type: "CLOSE_GAME" },
    { type: "SET_CONTENT_LOCALE", locale: (["en", "fr", "ar", "es"] as const)[st.arg % 4] as "en" },
    { type: "UPDATE_GAME_SETTINGS", gameId: "mishana", patch: [{ roleMode: "custom", undercoverCount: 1, blankCount: 1 }, { roleMode: "auto" }, { clueSeconds: 0, voteSeconds: 0, revealSeconds: 0, guessSeconds: 0 }, { revealRoles: true }, { tieBreak: "none" }][st.arg % 5] as Record<string, unknown> },
    { type: "START_GAME" },
    { type: "START_GAME" },
    { type: "REPLAY" },
    { type: "BACK_TO_SETUP" },
    { type: "BACK_TO_HUB" },
    { type: "ABORT_GAME" },
    { type: "REACT", kind: REACTIONS[st.arg % REACTIONS.length] as "laugh" },
    { type: "KICK", playerId: someone },
    { type: "LEAVE" },
    { type: "HUB_FOCUS", gameId: "mishana" },
    g({ type: "READY" }),
    g({ type: "READY" }),
    g({ type: "CLUE_DONE" }),
    g({ type: "CLUE_DONE" }),
    g({ type: "CAST_VOTE", targetId: someone }),
    g({ type: "CAST_VOTE", targetId: someone }),
    g({ type: "SUBMIT_GUESS", text: st.arg % 2 ? "Zzyzx" : "Cat" }),
    g({ type: "HOST_OVERRIDE_GUESS", accept: st.arg % 2 === 0 }),
    g({ type: "HOST_ADVANCE" }),
    { sys: { type: "JOIN", playerId: pid(st.arg % 13), name: `N${st.arg % 13}`, color: COLORS[st.arg % 12] as ColorId, locale: "en", by: { kind: "system" } } },
    { sys: { type: "DISCONNECT", playerId: someone, by: { kind: "system" } } },
    { sys: { type: "RECONNECT", playerId: someone, by: { kind: "system" } } },
    { sys: { type: "TICK", by: { kind: "system" } } },
    { sys: { type: "TICK", by: { kind: "system" } } },
    { sys: { type: "RESTRICT_SETTINGS", by: { kind: "system" } } },
  ];
  const m = menu[st.what % menu.length] as RoomIntent | { sys: RoomAction };
  if ("sys" in m) return m.sys;
  // The current speaker / voters act on their own turn more often than random actors would.
  if (st.who > 0 && m.type === "GAME" && h.state.game) {
    const s = h.mishana();
    const sp = s.speakingOrder[s.turnIdx];
    if (sp && (m.i as { type: string }).type === "CLUE_DONE") return { ...m, by: { kind: "player", playerId: sp } };
  }
  return { ...m, by } as RoomAction;
}

const STATS: Record<string, number> = {};
function run(roster: number, seed: number, steps: Step[], leaks: boolean): { h: RoomHarness; log: string[] } {
  const h = new RoomHarness({ seed });
  const log: string[] = [];
  for (let i = 0; i < roster; i++) h.join(pid(i), `Player${i}`, COLORS[i] as ColorId);
  for (const st of steps) {
    h.now += st.dt;
    const a = actionFor(h, st);
    const r = h.try(a);
    log.push(`${a.type}:${r.ok ? "ok" : r.error}`);
    if (process.env.ROOM_PROPS_STATS) STATS[`${h.state.phase}${h.state.game && h.tvView().game?.over ? "/over" : ""}`] = (STATS[`${h.state.phase}${h.state.game && h.tvView().game?.over ? "/over" : ""}`] ?? 0) + 1;
    if (leaks) {
      const errs = findRoomLeaks(h);
      if (errs.length) throw new Error(`leak after ${a.type}: ${errs.join("; ")}`);
    }
  }
  return { h, log };
}

describe("room properties (fast-check, §2.8)", () => {
  it("random sessions keep the room invariants and leak nothing", { timeout: 600_000 }, () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 12 }), fc.integer({ min: 0, max: 0xffffffff }), fc.array(stepArb, { minLength: 40, maxLength: 120, size: "max" }), (roster, seed, steps) => {
        run(roster, seed, steps, true);
      }),
      { numRuns: RUNS, seed: 20261108 },
    );
    if (process.env.ROOM_PROPS_STATS) console.log(JSON.stringify(STATS));
  });
  it("determinism: the same seed and the same actions give a JSON-equal state", { timeout: 600_000 }, () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 12 }), fc.integer({ min: 0, max: 0xffffffff }), fc.array(stepArb, { minLength: 40, maxLength: 120, size: "max" }), (roster, seed, steps) => {
        const a = run(roster, seed, steps, false);
        const b = run(roster, seed, steps, false);
        expect(JSON.stringify(b.h.state)).toBe(JSON.stringify(a.h.state));
        expect(JSON.stringify(b.h.history)).toBe(JSON.stringify(a.h.history));
        expect(b.log).toEqual(a.log);
      }),
      { numRuns: Math.max(30, Math.floor(RUNS / 5)), seed: 7 },
    );
  });
  it("every Mish Ana! instance ends (3–12 players, timers on and off), with leak checks every step", { timeout: 600_000 }, () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 12 }), fc.integer({ min: 0, max: 0xffffffff }), fc.boolean(), (n, seed, timersOff) => {
        const h = new RoomHarness({ seed });
        for (let i = 0; i < n; i++) h.join(pid(i), `Player${i}`, COLORS[i] as ColorId);
        h.tv({ type: "OPEN_GAME", gameId: "mishana" });
        if (timersOff) h.tv({ type: "UPDATE_GAME_SETTINGS", gameId: "mishana", patch: { clueSeconds: 0, voteSeconds: 0, revealSeconds: 0, guessSeconds: 0 } });
        h.tv({ type: "START_GAME" });
        h.playMishanaToResults("Zzyzx", () => {
          const errs = findRoomLeaks(h);
          if (errs.length) throw new Error(errs.join("; "));
        });
        expect(h.state.game && h.tvView().game?.over).toBe(true);
        expect(h.state.cup.last?.gameId).toBe("mishana");
      }),
      { numRuns: Math.max(40, Math.floor(RUNS / 3)), seed: 11 },
    );
  });
});
