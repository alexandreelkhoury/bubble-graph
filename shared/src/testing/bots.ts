// Seeded bot driver shared by the property, golden and leak tests and by tools/sim (engine mode, §13.1).
import { COLORS } from "../constants";
import type { Catalog } from "../engine/catalog";
import { assertInvariants } from "../engine/invariants";
import { createInitialState, reduce } from "../engine/reduce";
import type { Rng } from "../engine/rng";
import { createRng } from "../engine/rng";
import type { Action, ClientIntent, GameState, ReduceResult, SettingsPatch, Winner } from "../engine/types";
import { checkWinner } from "../engine/win";
import { P, SYS, TV } from "./game";

export interface BotOptions {
  players: number;
  seed: number;
  settings?: SettingsPatch;
  correctGuessRate?: number; // 0.3
  overrideRate?: number;     // 0.05
  churnRate?: number;        // 0.02
  kickRate?: number;         // 0.01 (half from the TV, half from the VIP)
  leaveRate?: number;        // 0.005 (LEAVE by a random live player)
  vipRate?: number;          // 0.5: share of HOST_ADVANCE / HOST_OVERRIDE_GUESS / KICK sent by the VIP instead of the TV
  hostAdvanceRate?: number;  // 0.05 (HOST_ADVANCE instead of CLUE_DONE)
  noiseRate?: number;        // 0: random (often invalid) intents, checked to leave the state untouched on error
  maxActions?: number;       // 5000
  maxRounds?: number;        // 60
  startNow?: number;
}

export interface StepRecord { action: Action; now: number; ok: boolean; error: string | null; version: number }

export interface GameOutcome {
  final: GameState;
  log: StepRecord[];
  rounds: number;
  winner: Winner | null;
  stalemate: boolean;
  blankGuessWin: boolean;
  failure: string | null;
}

export type StepHook = (prev: GameState, action: Action, result: ReduceResult, now: number) => void;

export function botPlayerId(i: number): string {
  return "p_" + (0xb0700000 + i).toString(16).padStart(8, "0") + "0".repeat(16);
}


function pick<T>(rng: Rng, xs: readonly T[]): T | undefined {
  return xs.length ? xs[rng.int(xs.length)] : undefined;
}

/**
 * A speaking pass just opened: a new CLUES round (from any other phase or round) or a new TIE_BREAK.
 * Shared by checkStep and the starter tests, so the Blank-never-first rule and its test agree on "opening".
 */
export function isOpening(prev: GameState, s: GameState): boolean {
  return (
    (s.phase === "CLUES" && (prev.phase !== "CLUES" || prev.round !== s.round)) ||
    (s.phase === "TIE_BREAK" && prev.phase !== "TIE_BREAK")
  );
}

/**
 * The Blank never speaks first (§4.7, every round and tie-break): at an opening, the first actual speaker
 * is not the Blank whenever an alive, connected non-Blank is in the speaking order. Null when the rule holds.
 */
export function blankOpensViolation(s: GameState): string | null {
  const order = s.speakingOrder.map((id) => s.players.find((p) => p.id === id));
  if (!order.some((p) => p && p.alive && p.connected && p.role !== "BLANK")) return null;
  const sp = s.players.find((p) => p.id === s.speakingOrder[s.turnIdx]);
  return sp?.role === "BLANK" ? `the Blank opens ${s.phase} (round ${s.round})` : null;
}

/**
 * Cross-step checks the driver applies after every successful reduce (beyond assertInvariants), so every
 * property test and every `pnpm sim` game enforces them:
 * - at every opening (each CLUES round and each TIE_BREAK) the first actual speaker is not the Blank;
 * - on entering RESULTS, score deltas equal result.pointsAwarded and a non-Blank winner matches checkWinner.
 */
export function checkStep(prev: GameState, res: ReduceResult): void {
  if (!res.ok) return;
  const s = res.state;
  if (isOpening(prev, s)) {
    const v = blankOpensViolation(s);
    if (v) throw new Error(v);
  }
  if (s.phase === "RESULTS" && prev.phase !== "RESULTS" && s.result) {
    const r = s.result;
    for (const p of s.players) {
      const before = prev.players.find((x) => x.id === p.id);
      const delta = p.score - (before?.score ?? 0);
      if (delta !== (r.pointsAwarded[p.id] ?? 0)) throw new Error(`score delta ${delta} != pointsAwarded for ${p.id}`);
    }
    if (r.winner !== "BLANK" && checkWinner(s) !== r.winner) throw new Error(`result.winner ${r.winner} != checkWinner ${checkWinner(s)}`);
  }
}

/** Plays one game in a fresh room: joins, START, play to RESULTS (then PLAY_AGAIN once) or until it returns to LOBBY. */
export function playGame(catalog: Catalog, opts: BotOptions, onStep?: StepHook): GameOutcome {
  const rng = createRng((opts.seed ^ 0x9e3779b9) >>> 0);
  const maxActions = opts.maxActions ?? 5000;
  const maxRounds = opts.maxRounds ?? 60;
  const rate = {
    correct: opts.correctGuessRate ?? 0.3,
    override: opts.overrideRate ?? 0.05,
    churn: opts.churnRate ?? 0.02,
    kick: opts.kickRate ?? 0.01,
    leave: opts.leaveRate ?? 0.005,
    vip: opts.vipRate ?? 0.5,
    advance: opts.hostAdvanceRate ?? 0.05,
    noise: opts.noiseRate ?? 0,
  };
  let now = opts.startNow ?? 1_790_000_000_000;
  let state = createInitialState({ roomCode: "SIMR", joinUrl: "https://example.test/SIMR", seed: opts.seed >>> 0, wordLocale: opts.settings?.wordLocale ?? "en" });
  const log: StepRecord[] = [];
  let failure: string | null = null;
  let wrongN = 0;
  let rounds = 0;

  const step = (action: Action): ReduceResult => {
    const prev = state;
    const res = reduce(prev, action, { now, catalog });
    if (!res.ok && res.state !== prev) throw new Error("error result must return the input state");
    assertInvariants(res.state);
    checkStep(prev, res);
    onStep?.(prev, action, res, now);
    log.push({ action, now, ok: res.ok, error: res.ok ? null : res.error, version: res.state.version });
    state = res.state;
    rounds = Math.max(rounds, state.round);
    return res;
  };
  /** TV, or (with probability vipRate) the VIP when there is one. The VIP may be refused (e.g. NOT_HOST while guessing). */
  const hostActor = () => (rate.vip > 0 && state.hostPlayerId && rng.next() < rate.vip ? P(state.hostPlayerId) : TV);
  const advance = (): void => {
    if (state.deadline) {
      now = Math.max(now, state.deadline.at);
      step({ type: "TICK", by: SYS });
    } else {
      // Fall back to the TV when the VIP is refused so the driver always makes progress.
      if (!step({ type: "HOST_ADVANCE", by: hostActor() }).ok) step({ type: "HOST_ADVANCE", by: TV });
    }
  };

  for (let i = 0; i < opts.players; i++) {
    const c = COLORS[i % COLORS.length];
    step({ type: "JOIN", by: SYS, playerId: botPlayerId(i), name: `Bot${i + 1}`, color: c ? c.id : "coral", locale: "en" });
    now += 100;
  }
  if (opts.settings) {
    const r = step({ type: "UPDATE_SETTINGS", by: TV, patch: opts.settings });
    if (!r.ok) return { final: state, log, rounds, winner: null, stalemate: false, blankGuessWin: false, failure: `settings rejected: ${r.error}` };
  }
  const started = step({ type: "START", by: TV });
  if (!started.ok) return { final: state, log, rounds, winner: null, stalemate: false, blankGuessWin: false, failure: `START failed: ${started.error}` };

  let winner: Winner | null = null;
  let stalemate = false;
  while (true) {
    if (log.length > maxActions) { failure = `more than ${maxActions} actions`; break; }
    if (state.round > maxRounds) { failure = `more than ${maxRounds} rounds`; break; }
    now += rng.int(3000);
    const s = state;
    const live = s.players.filter((p) => !p.left);

    if (s.phase === "LOBBY") {
      stalemate = true; // only reachable through the stalemate rule (§4.7) in this driver
      break;
    }
    if (s.phase === "RESULTS") {
      winner = s.result?.winner ?? null;
      const host = s.hostPlayerId && rng.next() < 0.5 ? P(s.hostPlayerId) : TV;
      step({ type: "PLAY_AGAIN", by: host });
      break;
    }

    const r = rng.next();
    if (rate.noise > 0 && r < rate.noise) {
      noise(s);
      continue;
    }
    if (r < rate.noise + rate.churn) {
      const p = pick(rng, live);
      if (p) step({ type: p.connected ? "DISCONNECT" : "RECONNECT", by: SYS, playerId: p.id });
      continue;
    }
    if (r < rate.noise + rate.churn + rate.kick) {
      const p = pick(rng, live);
      if (p) step({ type: "KICK", by: hostActor(), playerId: p.id });
      continue;
    }
    if (r < rate.noise + rate.churn + rate.kick + rate.leave) {
      const p = pick(rng, live);
      if (p) step({ type: "LEAVE", by: P(p.id) });
      continue;
    }

    switch (s.phase) {
      case "ROLE_REVEAL": {
        const p = pick(rng, s.players.filter((x) => x.connected && !x.ready));
        if (p) step({ type: "READY", by: P(p.id) });
        else advance();
        break;
      }
      case "CLUES":
      case "TIE_BREAK": {
        const sp = s.players.find((p) => p.id === s.speakingOrder[s.turnIdx]);
        if (rng.next() < rate.advance) step({ type: "HOST_ADVANCE", by: hostActor() });
        else if (sp?.connected) step({ type: "CLUE_DONE", by: P(sp.id) });
        else advance();
        break;
      }
      case "VOTING": {
        const voters = s.players.filter((p) => p.alive && p.connected && s.votes[p.id] === undefined);
        const v = pick(rng, voters);
        const targets = v ? s.players.filter((p) => p.alive && p.id !== v.id && (!s.revote || s.tieCandidates.includes(p.id))) : [];
        const t = pick(rng, targets);
        if (v && t) step({ type: "CAST_VOTE", by: P(v.id), targetId: t.id });
        else advance();
        break;
      }
      case "ELIMINATION": {
        if (rng.next() < 0.3) step({ type: "HOST_ADVANCE", by: hostActor() });
        else advance();
        break;
      }
      case "MR_WHITE_GUESS": {
        const g = s.guess;
        const guesser = s.players.find((p) => p.id === g?.playerId);
        if (g?.status === "PENDING") {
          if (guesser?.connected && !guesser.left) {
            const correct = rng.next() < rate.correct;
            const text = correct && s.pair ? s.pair.civilian.text : `zzwrong${wrongN++}`;
            step({ type: "SUBMIT_GUESS", by: P(guesser.id), text });
          } else advance();
          break;
        }
        if (g && !g.overridden && rng.next() < rate.override) {
          if (g.status === "WRONG" && g.text !== null) {
            const vip = s.hostPlayerId && s.hostPlayerId !== g.playerId && rng.next() < 0.5 ? P(s.hostPlayerId) : TV;
            step({ type: "HOST_OVERRIDE_GUESS", by: vip, accept: true });
            break;
          }
          if (g.status === "CORRECT") {
            step({ type: "HOST_OVERRIDE_GUESS", by: hostActor(), accept: false });
            break;
          }
        }
        advance();
        break;
      }
    }
  }

  function noise(s: GameState): void {
    const actors = [TV, ...s.players.map((p) => P(p.id)), P("p_ffffffffffffffffffffffff")];
    const by = pick(rng, actors) ?? TV;
    const someone = pick(rng, s.players)?.id ?? "p_000000000000000000000000";
    const intents: ClientIntent[] = [
      { type: "UPDATE_SETTINGS", patch: { clueSeconds: 30 } },
      { type: "START" },
      { type: "READY" },
      { type: "CLUE_DONE" },
      { type: "CAST_VOTE", targetId: someone },
      { type: "SUBMIT_GUESS", text: rng.next() < 0.5 ? "   " : "zznoise" },
      { type: "HOST_OVERRIDE_GUESS", accept: rng.next() < 0.5 },
      { type: "HOST_ADVANCE" },
      { type: "KICK", playerId: someone },
    ];
    const intent = pick(rng, intents) ?? { type: "READY" };
    step({ ...intent, by } as Action);
  }

  return { final: state, log, rounds, winner, stalemate, blankGuessWin: winner === "BLANK", failure };
}
