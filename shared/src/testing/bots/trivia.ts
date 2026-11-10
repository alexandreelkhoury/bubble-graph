// JAMAA-PLATFORM §2.8 / §2.9: Trivia bots and the seeded engine driver shared by the property tests, the golden test
// and tools/sim (engine mode). Bots answer at random with random latencies; the host advances, voids and ends at
// random; seats drop, come back, leave and join late. Every step runs the invariants, the step checks and the leak
// oracles on the TV view and every player's view.
import type { Locale } from "../../constants";
import { definition as DEF } from "../../games/trivia/definition";
import { ADVANCEABLE, canPlay } from "../../games/trivia/engine/reduce";
import type { TriviaCatalog, TriviaIntent, TriviaSettings, TriviaState } from "../../games/trivia/engine/types";
import type { GameAction, GameActor, GameCtx, GameReduceResult, RosterEntry } from "../../games/types";
import { createRng, type Rng } from "../../room/rng";

export const TRIVIA_T0 = 1_790_000_000_000;
export const triviaBotId = (i: number): string => "p_" + (0x7a1a0000 + i).toString(16).padStart(8, "0") + "0".repeat(16);

/** One random legal-or-not answer for a bot that may still answer, else null. Choices stay in 0..options-1. */
export function botAnswer(s: TriviaState, playerId: string, rng: Rng): TriviaIntent | null {
  if (s.phase !== "ANSWER" || !s.cur) return null;
  const p = s.players.find((x) => x.id === playerId);
  if (!p || !canPlay(p) || !p.connected || s.answers[p.id]) return null;
  return { type: "ANSWER", choice: rng.int(s.cur.options.length) };
}

/** A random host move, or null (let the timers run). */
export function botHost(s: TriviaState, rng: Rng, rates: { advance: number; void: number; end: number }): TriviaIntent | null {
  if (s.phase === "HOLD") return rng.next() < rates.end ? { type: "END_GAME" } : null;
  if (s.phase === "REVEAL" && s.last && !s.last.voided && rng.next() < rates.void) return rng.next() < 0.5 ? { type: "VOID_QUESTION", questionId: s.last.questionId } : { type: "VOID_QUESTION" };
  if (ADVANCEABLE.includes(s.phase) && rng.next() < rates.advance) return { type: "HOST_ADVANCE" };
  return null;
}

export interface TriviaBotOptions {
  players: number;
  seed: number;
  content: TriviaCatalog;
  settings?: Partial<TriviaSettings>;
  locale?: Locale;
  usedKeys?: string[];
  /** Per-step probabilities. */
  awayRate?: number;        // 0.03: a connected player's socket drops
  backRate?: number;        // 0.3: a dropped player comes back
  goneRate?: number;        // 0.005: LEAVE/KICK
  joinRate?: number;        // 0.01: a late joiner (via `join`) while seats remain
  advanceRate?: number;     // 0.3: the host skips an advanceable phase
  voidRate?: number;        // 0.05
  endRate?: number;         // 0.3 per HOLD step
  noiseRate?: number;       // 0.05: random (often invalid) intents; an error must return the input state
  vipRate?: number;         // 0.5: host moves from the VIP phone instead of the TV
  /** Answer latency after ANSWER opens: uniform 0..maxLatencyMs (some land after the deadline: WRONG_PHASE). */
  maxLatencyMs?: number;    // 18 000
  maxSteps?: number;        // 5 000
  /** Run the leak oracles after every step (default true). */
  leaks?: boolean;
}

export interface TriviaStep { action: GameAction<TriviaIntent> | { type: "JOIN"; playerId: string }; now: number; ok: boolean; error: string | null }
export interface TriviaRun {
  final: TriviaState;
  steps: TriviaStep[];
  failure: string | null;
  questions: number;
  ended: "results" | "endGame" | "endedEarly" | null;
}

// ─── leak oracle on bare game views (engine mode) ────────────────────────────────────────────────────────────────────

function walk(x: unknown, path: string[], onKey: (k: string, path: readonly string[]) => void, onLeaf: (v: unknown, path: readonly string[]) => void): void {
  if (Array.isArray(x)) {
    for (let i = 0; i < x.length; i++) {
      path.push(String(i));
      walk(x[i], path, onKey, onLeaf);
      path.pop();
    }
  } else if (x !== null && typeof x === "object") {
    for (const k of Object.keys(x)) {
      onKey(k, path);
      path.push(k);
      walk((x as Record<string, unknown>)[k], path, onKey, onLeaf);
      path.pop();
    }
  } else onLeaf(x, path);
}

/** The game envelope as the room projects it, for the TV (viewer null) or one player. */
export function triviaEnvelope(s: TriviaState, content: TriviaCatalog, viewer: string | null, pub: unknown = DEF.projectPublic(s, content)): { game: { phase: string; doneIds: string[]; awaitedIds: string[]; public: unknown; me: unknown } } {
  const st = DEF.projectStatus(s);
  return { game: { ...st, public: pub, me: viewer === null ? null : DEF.projectMe(s, viewer, content) } };
}

/** Every leak (secretsFor leaves, leakCheck rules, forbidden keys) in the TV view and every player's view. */
export function findTriviaLeaks(s: TriviaState, content: TriviaCatalog): string[] {
  const errs: string[] = [];
  const forbidden = new Set<string>(DEF.forbiddenKeys);
  const viewers: (string | null)[] = [null, ...s.players.filter((p) => !p.left).map((p) => p.id)];
  // The public part is one value for every viewer (as the room sends it); it is projected once and checked with each me.
  const pub = DEF.projectPublic(s, content);
  for (const viewer of viewers) {
    const label = viewer ?? "tv";
    const view = triviaEnvelope(s, content, viewer, pub);
    const secrets = new Set(DEF.secretsFor(s, viewer));
    walk(view, [], (k, path) => {
      if (forbidden.has(k)) errs.push(`${label}: forbidden key "${k}" at ${path.join(".")}`);
    }, (v, path) => {
      if (secrets.has(v)) errs.push(`${label}: secret ${JSON.stringify(v)} at ${path.join(".")}`);
    });
    for (const e of DEF.leakCheck(s, viewer, view)) errs.push(`${label}: ${e}`);
  }
  return errs;
}

/**
 * Cross-step checks beyond assertInvariants (GAME-TRIVIA §13.3):
 * - Σ points of a revealed question = Σ (score − scoreBefore), and scores never decrease except by VOID_QUESTION, which
 *   restores exactly the pre-question scores and streaks;
 * - a READ never starts while someone is still answering; ANSWER always opens at the expiring tick's time.
 */
export function checkTriviaStep(prev: TriviaState, res: GameReduceResult<TriviaState>, action: GameAction<TriviaIntent>): void {
  if (!res.ok) {
    if (res.state !== prev) throw new Error(`error ${res.error} must return the input state`);
    return;
  }
  const s = res.state;
  if (s === prev) return;
  const voiding = action.type === "INTENT" && action.intent.type === "VOID_QUESTION";
  const score = (st: TriviaState, id: string): number => st.players.find((p) => p.id === id)?.score ?? 0;
  if (s.phase === "REVEAL" && prev.phase === "ANSWER" && s.last) {
    const gained = s.last.choices.reduce((n, c) => n + c.points + c.streakBonus, 0);
    const delta = s.players.reduce((n, p) => n + p.score - score(prev, p.id), 0);
    if (gained !== delta) throw new Error(`reveal points ${gained} != score delta ${delta}`);
  }
  for (const p of s.players) {
    const before = score(prev, p.id);
    if (p.score < before && !voiding) throw new Error(`${p.id}: score went down without a void`);
  }
  if (voiding && s.last && prev.last && s.last.voided && !prev.last.voided) {
    for (const c of prev.last.choices) {
      const p = s.players.find((x) => x.id === c.id);
      if (!p) continue;
      if (p.score !== score(prev, c.id) - c.points - c.streakBonus) throw new Error(`${c.id}: void did not restore the score`);
      if (p.streak !== c.prevStreak) throw new Error(`${c.id}: void did not restore the streak`);
    }
  }
}

// ─── the driver ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Plays one seeded game from start to RESULTS (or a failure) straight through the definition. */
export function playTrivia(o: TriviaBotOptions, onStep?: (prev: TriviaState, step: TriviaStep, next: TriviaState) => void): TriviaRun {
  const rng = createRng((o.seed ^ 0x51ed270b) >>> 0);
  const rate = {
    away: o.awayRate ?? 0.03, back: o.backRate ?? 0.3, gone: o.goneRate ?? 0.005, join: o.joinRate ?? 0.01,
    advance: o.advanceRate ?? 0.3, void: o.voidRate ?? 0.05, end: o.endRate ?? 0.3, noise: o.noiseRate ?? 0.05, vip: o.vipRate ?? 0.5,
  };
  const maxLatency = o.maxLatencyMs ?? 18_000;
  const maxSteps = o.maxSteps ?? 5_000;
  const leaks = o.leaks ?? true;
  const locale = o.locale ?? "en";
  let now = TRIVIA_T0;
  const roster: RosterEntry[] = Array.from({ length: o.players }, (_, i) => ({ id: triviaBotId(i), seat: i, locale, connected: true, carryScore: 0 }));
  const settings: TriviaSettings = { quizId: null, length: "normal", pace: "normal", ...o.settings };
  const started = DEF.start({ roster, settings, locale, memory: { usedKeys: o.usedKeys ?? [] }, seed: o.seed >>> 0, now, graceMs: 2_500, content: o.content });
  const steps: TriviaStep[] = [];
  if (!started.ok) return { final: started.state, steps, failure: `start failed: ${started.error}`, questions: 0, ended: null };
  let s = started.state;
  let nextSeat = o.players;
  let host: string | null = roster[0]?.id ?? null;
  let endedByHost = false;
  const fail = (m: string): TriviaRun => ({ final: s, steps, failure: m, questions: s.shown, ended: null });

  const check = (): string | null => {
    try { DEF.assertInvariants(s); } catch (e) { return e instanceof Error ? e.message : String(e); }
    if (leaks) {
      const l = findTriviaLeaks(s, o.content);
      if (l.length > 0) return `leak in ${s.phase}: ${l.slice(0, 3).join("; ")}`;
    }
    return null;
  };
  const initial = check();
  if (initial) return fail(initial);

  const ctx = (): GameCtx<TriviaCatalog> => ({
    now, content: o.content, hostPlayerId: host,
    isHost: (a: GameActor) => a.kind === "tv" || (a.kind === "player" && a.playerId === host),
  });
  const apply = (action: GameAction<TriviaIntent>): GameReduceResult<TriviaState> => {
    const prev = s;
    const res = DEF.reduce(prev, action, ctx());
    checkTriviaStep(prev, res, action);
    const step: TriviaStep = { action, now, ok: res.ok, error: res.ok ? null : res.error };
    steps.push(step);
    s = res.state;
    onStep?.(prev, step, s);
    return res;
  };
  const hostActor = (): GameActor => (host && rng.next() < rate.vip ? { kind: "player", playerId: host } : { kind: "tv" });
  /** Answer plan for the current ANSWER window: bot → receipt time. */
  let plan = new Map<string, number>();
  let planFor = -1;

  while (s.phase !== "RESULTS") {
    if (steps.length > maxSteps) return fail(`more than ${maxSteps} steps (${s.phase})`);
    // churn
    const live = s.players.filter((p) => !p.left);
    const r = rng.next();
    if (r < rate.away) {
      const p = live.filter((x) => x.connected)[rng.int(live.filter((x) => x.connected).length)];
      if (p) apply({ type: "PLAYER_AWAY", playerId: p.id });
    } else if (r < rate.away + rate.back) {
      const away = live.filter((x) => !x.connected);
      const p = away[rng.int(away.length)];
      if (p) apply({ type: "PLAYER_BACK", playerId: p.id });
    } else if (r < rate.away + rate.back + rate.gone) {
      const p = live[rng.int(live.length)];
      if (p) {
        apply({ type: "PLAYER_GONE", playerId: p.id, cause: rng.next() < 0.5 ? "LEAVE" : "KICK" });
        if (p.id === host) host = s.players.find((x) => !x.left)?.id ?? null;
      }
    } else if (r < rate.away + rate.back + rate.gone + rate.join && live.length < 12 && DEF.join) {
      const id = triviaBotId(nextSeat);
      const entry: RosterEntry = { id, seat: nextSeat++, locale, connected: true, carryScore: 0 };
      const prev = s;
      const res = DEF.join(prev, entry);
      if (!res.ok && res.state !== prev) return fail("join error must return the input state");
      const step: TriviaStep = { action: { type: "JOIN", playerId: id }, now, ok: res.ok, error: res.ok ? null : res.error };
      steps.push(step);
      s = res.state;
      onStep?.(prev, step, s);
    }
    if (rng.next() < rate.noise) {
      const by: GameActor = rng.next() < 0.5 ? { kind: "tv" } : { kind: "player", playerId: s.players[rng.int(s.players.length)]?.id ?? "nobody" };
      const pickNoise: TriviaIntent[] = [
        { type: "ANSWER", choice: rng.int(7) - 1 }, { type: "HOST_ADVANCE" }, { type: "END_GAME" },
        { type: "VOID_QUESTION", questionId: s.questionIds[rng.int(s.questionIds.length)] ?? "q001" },
      ];
      apply({ type: "INTENT", intent: pickNoise[rng.int(pickNoise.length)] as TriviaIntent, by });
    }
    let err = check();
    if (err) return fail(err);
    if (s.phase === "RESULTS") break;

    // host moves
    const h = botHost(s, rng, rate);
    if (h) {
      const res = apply({ type: "INTENT", intent: h, by: hostActor() });
      if (!res.ok && res.error === "NOT_HOST") apply({ type: "INTENT", intent: h, by: { kind: "tv" } });
      if (h.type === "END_GAME" && (s.phase as string) === "RESULTS") endedByHost = true;
      err = check();
      if (err) return fail(err);
      continue;
    }

    // answers: planned receipt times inside (or just past) the window, applied in time order before the deadline TICK
    if (s.phase === "ANSWER" && s.cur && s.cur.answerOpenAt !== null) {
      if (planFor !== s.index) {
        plan = new Map();
        planFor = s.index;
        for (const p of s.players) if (canPlay(p)) plan.set(p.id, s.cur.answerOpenAt + rng.int(maxLatency));
      }
      const due = [...plan.entries()].filter(([id]) => !s.answers[id]).sort((a, b) => a[1] - b[1])[0];
      const deadline = s.deadline?.at ?? Infinity;
      if (due && due[1] <= deadline) {
        plan.delete(due[0]);
        now = Math.max(now, due[1]);
        const intent = botAnswer(s, due[0], rng);
        if (intent) apply({ type: "INTENT", intent, by: { kind: "player", playerId: due[0] } });
        err = check();
        if (err) return fail(err);
        continue;
      }
      if (due && rng.next() < 0.2) {
        // A late tap that lands after the deadline but before the alarm: refused with WRONG_PHASE.
        now = Math.max(now, deadline + 1);
        const res = apply({ type: "INTENT", intent: { type: "ANSWER", choice: 0 }, by: { kind: "player", playerId: due[0] } });
        if (res.ok) return fail("an answer after the deadline was accepted");
      }
    }

    // time passes
    const wake = DEF.nextWakeAt(s);
    if (wake === null) {
      if (s.phase === "HOLD") {
        // Nobody connected: someone comes back (or the host ends it).
        const away = s.players.filter((p) => !p.left && !p.connected);
        if (away.length > 0) apply({ type: "PLAYER_BACK", playerId: (away[rng.int(away.length)] as { id: string }).id });
        else {
          apply({ type: "INTENT", intent: { type: "END_GAME" }, by: { kind: "tv" } });
          endedByHost = (s.phase as string) === "RESULTS";
        }
      } else return fail(`no wake time in ${s.phase}`);
    } else {
      now = Math.max(now, wake);
      apply({ type: "TICK" });
    }
    err = check();
    if (err) return fail(err);
  }
  const out = DEF.outcome(s);
  if (!out) return fail("RESULTS without an outcome");
  return { final: s, steps, failure: null, questions: s.shown, ended: s.endedEarly ? "endedEarly" : endedByHost ? "endGame" : "results" };
}
