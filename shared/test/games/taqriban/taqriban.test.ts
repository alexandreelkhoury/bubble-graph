// GAME-TAQRIBAN: scoring rule (§5), flow (§4), secrecy (§8.1), settings (§9) and seeded bot games (§13.3).
import { describe, expect, it } from "vitest";
import { definition as def } from "../../../src/games/taqriban/definition";
import {
  compactParts, errorOf, groupDigits, isBullseye, isWild, modeOf, useLogLine, validGuess,
} from "../../../src/games/taqriban/constants";
import { scoreQuestion } from "../../../src/games/taqriban/engine/reduce";
import type { TaqribanState } from "../../../src/games/taqriban/engine/types";
import { TaqribanPackSchema } from "../../../src/games/taqriban/schema";
import { GameEnvelopeSchema } from "../../../src/games/protocol";
import { findTaqribanLeaks, playTaqribanGame, TAQ_GRACE, TAQ_T0, taqribanPid } from "../../../src/testing/bots/taqriban";
import { taqribanPack, taqribanTokenCatalog } from "../../../src/testing/catalogs/taqriban";
import type { GameActor, RosterEntry } from "../../../src/games/types";

const cat = taqribanTokenCatalog();
const roster = (n: number): RosterEntry[] => Array.from({ length: n }, (_, i) => ({ id: taqribanPid(i), seat: i, locale: "en", connected: true, carryScore: 0 }));
const ctx = (now: number) => ({ now, content: cat, hostPlayerId: taqribanPid(0), isHost: (a: GameActor) => a.kind === "tv" || (a.kind === "player" && a.playerId === taqribanPid(0)) });
const startGame = (n = 3, settings: Partial<TaqribanState["settings"]> = {}): TaqribanState => {
  const r = def.start({ roster: roster(n), settings: { ...def.meta.settings.defaults, ...settings }, locale: "en", memory: { usedKeys: [] }, seed: 7, now: TAQ_T0, graceMs: TAQ_GRACE, content: cat });
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const guess = (s: TaqribanState, i: number, value: number, now = TAQ_T0 + 1000) =>
  def.reduce(s, { type: "INTENT", intent: { type: "GUESS", questionId: s.cur?.id ?? "", value }, by: { kind: "player", playerId: taqribanPid(i) } }, ctx(now));

describe("§5 closeness rule", () => {
  it("ratio from 100 up: half and double are equally far; 0 is infinitely far", () => {
    expect(modeOf(100)).toBe("ratio");
    expect(modeOf(99.9)).toBe("absolute");
    expect(errorOf(50, 100)).toBeCloseTo(errorOf(200, 100), 12);
    expect(errorOf(0, 1000)).toBe(Number.POSITIVE_INFINITY);
    expect(errorOf(1_000_000, 8_000_000_000)).toBeGreaterThan(errorOf(80_000_000_000, 8_000_000_000));
  });
  it("absolute below 100: plain difference", () => {
    expect(errorOf(5, 8)).toBe(3);
    expect(errorOf(11, 8)).toBe(3);
    expect(errorOf(0, 8)).toBe(8);
  });
  it("ties all win; Bullseye within 2 % even when not the closest; final doubles", () => {
    const sc = scoreQuestion(1000, [{ id: "a", value: 500 }, { id: "b", value: 2000 }, { id: "c", value: null }, { id: "d", value: 10 }], false);
    expect(sc.closestIds).toEqual(["a", "b"]);
    expect(sc.rows.map((r) => r.points)).toEqual([1000, 1000, 0, 0]);
    expect(sc.rows.map((r) => r.rank)).toEqual([1, 1, null, 3]);
    const b = scoreQuestion(1000, [{ id: "a", value: 1000 }, { id: "b", value: 1019 }, { id: "c", value: 1021 }], true);
    expect(b.closestIds).toEqual(["a"]);
    expect(b.bullseyeIds).toEqual(["a", "b"]);
    expect(b.rows.map((r) => r.points)).toEqual([3000, 1000, 0]);
  });
  it("Way off!: the unique farthest guess, ≥ 3 guesses, ≥ 10× off (ratio) or ≥ the answer away (absolute)", () => {
    expect(scoreQuestion(3e12, [{ id: "a", value: 3e12 }, { id: "b", value: 2e12 }, { id: "c", value: 3 }], false).wildId).toBe("c");
    expect(scoreQuestion(3e12, [{ id: "a", value: 3e12 }, { id: "c", value: 3 }], false).wildId).toBeNull();
    expect(scoreQuestion(8, [{ id: "a", value: 8 }, { id: "b", value: 9 }, { id: "c", value: 20 }], false).wildId).toBe("c");
    expect(isWild(15, 8)).toBe(false);
  });
  it("guess validity and number helpers", () => {
    expect([0, 1, 8.25, 1e15].every(validGuess)).toBe(true);
    expect([-1, 1.234, 1e15 + 1, Number.NaN, Number.POSITIVE_INFINITY, "5"].some(validGuess)).toBe(false);
    expect(isBullseye(102, 100)).toBe(true);
    expect(isBullseye(103, 100)).toBe(false);
    expect(compactParts(8_000_000_000)).toEqual({ mantissa: "8", mag: "billion" });
    expect(compactParts(3_040_000_000_000)).toEqual({ mantissa: "3.04", mag: "trillion" });
    expect(compactParts(384_400)).toEqual({ mantissa: "384", mag: "thousand" });
    expect(compactParts(8849)).toEqual({ mantissa: "8849", mag: null });
    expect(groupDigits(8_000_000_000)).toBe("8 000 000 000");
    expect(groupDigits(42.195)).toBe("42.2");
    expect(useLogLine([1, 100])).toBe(true);
    expect(useLogLine([300, 330, 900])).toBe(false);
  });
});

describe("§4 flow and §8.1 secrecy", () => {
  it("starts in QUESTION; the answer never leaves the state before REVEAL; all guessed → early end → REVEAL scores", () => {
    let s = startGame(3);
    expect(s.phase).toBe("QUESTION");
    expect(s.questionIds).toHaveLength(10);
    const pub = def.projectPublic(s, cat);
    expect(JSON.stringify(pub)).not.toContain(String(s.cur?.answer));
    expect(GameEnvelopeSchema.safeParse({ gameId: "taqriban", n: 1, phase: s.phase, doneIds: [], awaitedIds: [], public: pub, me: def.projectMe(s, taqribanPid(0), cat), over: false }).success).toBe(true);
    const answer = s.cur?.answer as number;
    for (const [i, v] of [answer, answer * 2, answer * 3].entries()) {
      const r = guess(s, i, Math.round(v * 100) / 100);
      expect(r.ok).toBe(true);
      s = r.state;
    }
    expect(guess(s, 0, 5).ok && false).toBe(false);
    expect(guess(s, 0, 5)).toMatchObject({ ok: false, error: "ALREADY_GUESSED" });
    expect(def.projectMe(s, taqribanPid(1), cat)?.myGuess).toBe(Math.round(answer * 200) / 100);
    expect(findTaqribanLeaks(s)).toEqual([]);
    expect(s.deadline?.durationMs).toBe(800);
    s = def.reduce(s, { type: "TICK" }, ctx(s.deadline?.at as number)).state;
    expect(s.phase).toBe("REVEAL");
    const rv = def.projectPublic(s, cat).reveal;
    expect(rv?.answer).toBe(answer);
    expect(rv?.closestIds).toEqual([taqribanPid(0)]);
    expect(s.players[0]?.score).toBe(1500);
    expect(findTaqribanLeaks(s)).toEqual([]);
  });
  it("refuses a bad value, a stale question, a TV guess and HOST_ADVANCE never cuts QUESTION short", () => {
    const s = startGame(3);
    expect(guess(s, 0, -3)).toMatchObject({ ok: false, error: "VALUE_INVALID" });
    expect(def.reduce(s, { type: "INTENT", intent: { type: "GUESS", questionId: "zz-999", value: 1 }, by: { kind: "player", playerId: taqribanPid(0) } }, ctx(TAQ_T0 + 1))).toMatchObject({ ok: false, error: "STALE_QUESTION" });
    expect(def.reduce(s, { type: "INTENT", intent: { type: "GUESS", questionId: s.cur?.id ?? "", value: 1 }, by: { kind: "tv" } }, ctx(TAQ_T0 + 1))).toMatchObject({ ok: false, error: "NOT_IN_GAME" });
    expect(def.reduce(s, { type: "INTENT", intent: { type: "HOST_ADVANCE" }, by: { kind: "tv" } }, ctx(TAQ_T0 + 1)).state).toBe(s);
  });
  it("SKIP_QUESTION replaces the current question in place and remembers the skipped one", () => {
    const s = startGame(2);
    const before = s.cur?.id as string;
    const r = def.reduce(s, { type: "INTENT", intent: { type: "SKIP_QUESTION", questionId: before }, by: { kind: "tv" } }, ctx(TAQ_T0 + 5));
    expect(r.ok).toBe(true);
    expect(r.state.cur?.id).not.toBe(before);
    expect(r.state.skippedIds).toEqual([before]);
    expect(def.memory(r.state).usedKeys).toContain(before);
  });
  it("needs 2 connected players and enough questions", () => {
    expect(def.startBlocker(roster(1), def.meta.settings.defaults, cat, "en")).toBe("NOT_ENOUGH_PLAYERS");
    expect(def.startBlocker(roster(2), { packIds: ["nope"], length: "normal", pace: "normal" }, cat, "en")).toBe("NO_CONTENT_AVAILABLE");
    expect(def.startBlocker(roster(2), def.meta.settings.defaults, cat, "en")).toBeNull();
  });
  it("a whole game: final doubles, leaderboard every 3rd, RESULTS outcome ranks by points", () => {
    let s = startGame(4, { length: "short" });
    const phases: string[] = [];
    let now = TAQ_T0;
    while (s.phase !== "RESULTS") {
      if (phases[phases.length - 1] !== s.phase) phases.push(s.phase);
      const a = s.phase === "QUESTION" && s.cur ? s.cur.answer : null;
      if (a !== null) for (let i = 0; i < 4; i++) if (s.guesses[taqribanPid(i)] === undefined) s = guess(s, i, Math.round((i === 0 ? a : a * (i + 2)) * 100) / 100, now).state;
      now = (s.deadline?.at ?? now) + 1;
      s = def.reduce(s, { type: "TICK" }, ctx(now)).state;
      def.assertInvariants(s);
    }
    expect(phases).toEqual(["QUESTION", "REVEAL", "QUESTION", "REVEAL", "QUESTION", "REVEAL", "LEADERBOARD", "QUESTION", "REVEAL", "QUESTION", "REVEAL", "FINAL_INTRO", "QUESTION", "REVEAL"]);
    expect(s.players[0]?.score).toBe(5 * 1500 + 3000);
    expect(def.outcome(s)?.ranking[0]).toEqual([taqribanPid(0)]);
  });
});

describe("settings (§9)", () => {
  it("apply / normalize / restrict", () => {
    const d = def.meta.settings.defaults;
    expect(def.settings.apply(d, { length: "long" }, cat, "en")).toEqual({ ...d, length: "long" });
    expect(def.settings.apply(d, { packIds: ["missing"] }, cat, "en")).toBeNull();
    expect(def.settings.apply(d, { pace: "warp" as "fast" }, cat, "en")).toBeNull();
    expect(def.settings.normalize({ length: "long", junk: 1 })).toEqual({ ...d, length: "long" });
    expect(def.settings.restrict({ ...d, packIds: ["syn-taq", "syn-taq-b"] }, { playableIds: new Set(["syn-taq"]), premium: false }, cat, "en").packIds).toEqual(["syn-taq"]);
  });
});

describe("schema", () => {
  it("the synthetic pack parses", () => expect(TaqribanPackSchema.safeParse(taqribanPack()).success).toBe(true));
});

describe("seeded bot games (§13.3)", () => {
  it("2–12 players, both paces, every locale: no invariant, leak or termination failure", () => {
    const locales = ["en", "fr", "ar", "es"] as const;
    for (let players = 2; players <= 12; players++) {
      for (let k = 0; k < 6; k++) {
        const r = playTaqribanGame({ players, seed: players * 101 + k, locale: locales[k % 4], pace: k % 2 ? "eager" : "clock", settings: { length: (["short", "normal", "long"] as const)[k % 3] }, disconnectedAtStart: k % 3 === 2 && players > 2 ? 1 : 0 });
        expect(r.failure, `players=${players} k=${k}`).toBeNull();
      }
    }
  });
});
