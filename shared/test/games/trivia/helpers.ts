// Trivia engine test helpers: a scripted clock over the GameDefinition, on the synthetic unique-token catalog.
import type { Locale } from "../../../src/constants";
import { definition as DEF } from "../../../src/games/trivia/definition";
import type { TriviaCatalog, TriviaIntent, TriviaSettings, TriviaState } from "../../../src/games/trivia/engine/types";
import type { GameAction, GameActor, GameCtx, GameReduceResult, RosterEntry } from "../../../src/games/types";
import { findTriviaLeaks } from "../../../src/testing/bots/trivia";
import { TRIVIA_SYNTH_CATALOG } from "../../../src/testing/catalogs/trivia";

export { DEF };
export const CATALOG = TRIVIA_SYNTH_CATALOG;
export const GRACE = 2_500;
export const T0 = 1_000_000;
export const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `p${i + 1}`);
export const roster = (n: number, locale: Locale = "en"): RosterEntry[] =>
  ids(n).map((id, i) => ({ id, seat: i, locale, connected: true, carryScore: 0 }));
export const settings = (p: Partial<TriviaSettings> = {}): TriviaSettings => ({ quizId: null, length: "normal", pace: "normal", ...p });

export const tv: GameActor = { kind: "tv" };
export const player = (id: string): GameActor => ({ kind: "player", playerId: id });

export function ctx(now: number, content: TriviaCatalog = CATALOG, host: string | null = "p1"): GameCtx<TriviaCatalog> {
  return { now, content, hostPlayerId: host, isHost: (a) => a.kind === "tv" || (a.kind === "player" && a.playerId === host) };
}

/** Checks invariants and the leak oracles on every state a test builds. */
export function checked(s: TriviaState, content: TriviaCatalog = CATALOG): TriviaState {
  DEF.assertInvariants(s);
  const leaks = findTriviaLeaks(s, content);
  if (leaks.length > 0) throw new Error(`leaks: ${leaks.join("; ")}`);
  return s;
}

export function startGame(n: number, s: Partial<TriviaSettings> = {}, o: { content?: TriviaCatalog; seed?: number; usedKeys?: string[]; locale?: Locale; roster?: RosterEntry[]; now?: number } = {}): TriviaState {
  const r = DEF.start({
    roster: o.roster ?? roster(n, o.locale), settings: settings(s), locale: o.locale ?? "en", memory: { usedKeys: o.usedKeys ?? [] },
    seed: o.seed ?? 42, now: o.now ?? T0, graceMs: GRACE, content: o.content ?? CATALOG,
  });
  if (!r.ok) throw new Error(`start failed: ${r.error}`);
  return checked(r.state, o.content);
}

export function tryStep(s: TriviaState, a: GameAction<TriviaIntent>, now: number, content: TriviaCatalog = CATALOG, host: string | null = "p1"): GameReduceResult<TriviaState> {
  return DEF.reduce(s, a, ctx(now, content, host));
}
export function step(s: TriviaState, a: GameAction<TriviaIntent>, now: number, content: TriviaCatalog = CATALOG): TriviaState {
  const r = tryStep(s, a, now, content);
  if (!r.ok) throw new Error(`reduce failed: ${r.error} for ${JSON.stringify(a)}`);
  return checked(r.state, content);
}
/** Expects an error and the SAME input state back. */
export function stepErr(s: TriviaState, a: GameAction<TriviaIntent>, now: number, content: TriviaCatalog = CATALOG, host: string | null = "p1"): string {
  const r = tryStep(s, a, now, content, host);
  if (r.ok) throw new Error(`${JSON.stringify(a)} unexpectedly succeeded`);
  if (r.state !== s) throw new Error("an error must return the input state");
  return r.error;
}
export const intent = (i: TriviaIntent, by: GameActor = tv): GameAction<TriviaIntent> => ({ type: "INTENT", intent: i, by });

/** TICK at the deadline (+ late ms). */
export function tick(s: TriviaState, late = 0, content: TriviaCatalog = CATALOG): TriviaState {
  if (!s.deadline) throw new Error(`tick without a deadline in ${s.phase}`);
  return step(s, { type: "TICK" }, s.deadline.at + late, content);
}
export function until(s: TriviaState, phase: TriviaState["phase"], content: TriviaCatalog = CATALOG): TriviaState {
  let x = s;
  for (let i = 0; i < 300 && x.phase !== phase; i++) x = tick(x, 0, content);
  if (x.phase !== phase) throw new Error(`never reached ${phase} (at ${x.phase})`);
  return x;
}
export const answer = (s: TriviaState, id: string, choice: number, now: number, content: TriviaCatalog = CATALOG): TriviaState =>
  step(s, intent({ type: "ANSWER", choice }, player(id)), now, content);

/** Test-only peek at the displayed position of the right answer. */
export const right = (s: TriviaState): number => (s.cur as NonNullable<TriviaState["cur"]>).correctIndex;
export const wrong = (s: TriviaState): number => (right(s) + 1) % (s.cur as NonNullable<TriviaState["cur"]>).options.length;
export const openAt = (s: TriviaState): number => (s.cur as NonNullable<TriviaState["cur"]>).answerOpenAt as number;

/** From READ: open ANSWER, apply the plan (player → right? + ms after open), then reveal. */
export function playQuestion(s: TriviaState, plan: Record<string, { ok: boolean; after: number }>, content: TriviaCatalog = CATALOG): TriviaState {
  if (s.phase !== "READ") throw new Error(`playQuestion from ${s.phase}`);
  let x = tick(s, 0, content);
  const open = openAt(x);
  for (const [id, p] of Object.entries(plan).sort((a, b) => a[1].after - b[1].after)) {
    if (x.phase === "ANSWER") x = answer(x, id, p.ok ? right(x) : wrong(x), open + p.after, content);
  }
  if (x.phase === "ANSWER") x = tick(x, 0, content);
  return x;
}
export const score = (s: TriviaState, id: string): number => s.players.find((p) => p.id === id)?.score ?? NaN;
export const pl = (s: TriviaState, id: string) => {
  const p = s.players.find((x) => x.id === id);
  if (!p) throw new Error(`no ${id}`);
  return p;
};
