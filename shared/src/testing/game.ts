// Scripted engine driver and actor helpers for engine unit tests and the fixture generator.
import { COLORS } from "../constants";
import { assertInvariants } from "../engine/invariants";
import { createInitialState, reduce } from "../engine/reduce";
import type { Catalog } from "../engine/catalog";
import { isSpeakingPhase } from "../engine/queries";
import type { Action, ClientIntent, EngineError, GameState, Player, ReduceResult, Role, SettingsPatch, SystemAction } from "../engine/types";
import { TEST_CATALOG } from "./test-catalog";

/** Default scripted clock origin shared by engine, server and fixture drivers. */
export const T0 = 1_790_000_000_000;
export const pid = (i: number): string => "p_" + i.toString(16).padStart(24, "0");
export const TV = { kind: "tv" } as const;
export const SYS = { kind: "system" } as const;
export const P = (playerId: string) => ({ kind: "player", playerId }) as const;

/** Every timer off (patch for UPDATE_SETTINGS): phases only advance on actions or HOST_ADVANCE. */
export const TIMERS_OFF = { clueSeconds: 0, voteSeconds: 0, revealSeconds: 0, guessSeconds: 0 } as const satisfies SettingsPatch;

export interface GameOptions {
  seed?: number;
  now?: number;
  catalog?: Catalog;
  roomCode?: string;
  joinUrl?: string;
}

/** Scripted engine driver: a clock, `reduce` and assertInvariants after every dispatch. */
export class Game {
  state: GameState;
  now: number;
  readonly catalog: Catalog;
  constructor(opts: GameOptions = {}) {
    const roomCode = opts.roomCode ?? "TEST";
    this.state = createInitialState({ roomCode, joinUrl: opts.joinUrl ?? `https://x.test/${roomCode}`, seed: opts.seed ?? 1, wordLocale: "en" });
    this.now = opts.now ?? T0;
    this.catalog = opts.catalog ?? TEST_CATALOG;
  }
  #reduce(action: Action): ReduceResult {
    const r = reduce(this.state, action, { now: this.now, catalog: this.catalog });
    assertInvariants(r.state);
    if (r.ok) this.state = r.state;
    return r;
  }
  /** Dispatch `dt` ms after the previous one and expect success. */
  do(action: Action, dt = 1000): GameState {
    return expectOk(action, this.try(action, dt));
  }
  /** Dispatch at the absolute time `at` and expect success. */
  doAt(action: Action, at: number): GameState {
    this.now = at;
    return expectOk(action, this.#reduce(action));
  }
  /** Dispatch; returns the result (state updated only on success). */
  try(action: Action, dt = 1000): ReduceResult {
    this.now += dt;
    return this.#reduce(action);
  }
  /** Expect an error and that the state is unchanged (same object). */
  err(action: Action, dt = 0): EngineError {
    const before = this.state;
    const r = this.try(action, dt);
    if (r.ok) throw new Error(`${action.type} unexpectedly succeeded`);
    if (r.state !== before) throw new Error("error must return the input state");
    return r.error;
  }
  tv(a: ClientIntent): GameState { return this.do({ ...a, by: TV } as Action); }
  p(id: string, a: ClientIntent): GameState { return this.do({ ...a, by: P(id) } as Action); }
  sys(a: SystemAction): GameState { return this.do({ ...a, by: SYS } as Action); }
  tick(at?: number): ReduceResult {
    if (at !== undefined) this.now = at;
    return this.#reduce({ type: "TICK", by: SYS });
  }
  /** Advance the clock to the current deadline and TICK. */
  expire(): void {
    const d = this.state.deadline;
    if (!d) throw new Error("no deadline");
    this.tick(d.at);
  }
  join(i: number, name = `Player${i}`): GameState {
    const c = COLORS[i % COLORS.length];
    return this.do({ type: "JOIN", by: SYS, playerId: pid(i), name, color: c ? c.id : "coral", locale: "en" }, 10);
  }
  get(id: string) {
    const p = this.state.players.find((x) => x.id === id);
    if (!p) throw new Error(`no player ${id}`);
    return p;
  }
  ids(): string[] { return this.state.players.map((p) => p.id); }
  alive(): Player[] { return this.state.players.filter((p) => p.alive); }
  byRole(role: Role): string[] { return this.state.players.filter((p) => p.role === role).map((p) => p.id); }
  speaker(): string { return this.state.speakingOrder[this.state.turnIdx] as string; }
  /** All speakers of the current pass say CLUE_DONE. */
  speakAll(): void {
    while (isSpeakingPhase(this.state.phase)) this.p(this.speaker(), { type: "CLUE_DONE" });
  }
  readyAll(): void {
    for (const p of this.state.players) if (this.state.phase === "ROLE_REVEAL" && p.connected && !p.ready) this.p(p.id, { type: "READY" });
  }
  /** Every alive connected voter votes `target` (the target votes for `fallback` or the first other alive player). */
  voteOut(target: string, fallback?: string): void {
    const alive = this.alive();
    const other = fallback ?? alive.find((p) => p.id !== target && (!this.state.revote || this.state.tieCandidates.includes(p.id)))?.id;
    for (const p of alive) {
      if (this.state.phase !== "VOTING" || !p.connected) continue;
      this.p(p.id, { type: "CAST_VOTE", targetId: p.id === target ? (other as string) : target });
    }
  }
}

function expectOk(action: Action, r: ReduceResult): GameState {
  if (!r.ok) throw new Error(`${action.type} failed: ${r.error}`);
  return r.state;
}

/** A lobby with n joined players and optional settings (by TV). */
export function lobby(n: number, settings?: SettingsPatch, seed = 1): Game {
  const g = new Game({ seed });
  for (let i = 0; i < n; i++) g.join(i);
  if (settings) g.tv({ type: "UPDATE_SETTINGS", patch: settings });
  return g;
}

/** A game in CLUES round 1 (everyone ready). */
export function inClues(n: number, settings?: SettingsPatch, seed = 1): Game {
  const g = lobby(n, settings, seed);
  g.tv({ type: "START" });
  g.readyAll();
  return g;
}

/** Find a seed whose game (n players, settings) satisfies `pred` after START. */
export function findSeed(n: number, settings: SettingsPatch | undefined, pred: (g: Game) => boolean, max = 500): number {
  for (let seed = 1; seed <= max; seed++) {
    const g = lobby(n, settings, seed);
    g.tv({ type: "START" });
    if (pred(g)) return seed;
  }
  throw new Error("no seed found");
}
