// Test harness for the Likely engine (GAME-LIKELY), on the synthetic token catalog.
import type { Locale } from "../../../src/constants";
import { createLikelyDefinition, definition as SHIPPED } from "../../../src/games/likely/definition";
import type { LikelyCatalog } from "../../../src/games/likely/engine/catalog";
import type { LikelyIntent, LikelyState } from "../../../src/games/likely/engine/state";
import type { LikelySettings } from "../../../src/games/likely/meta";
import type { GameAction, GameActor, GameCtx, RosterEntry } from "../../../src/games/types";
import { likelyFamilyPack, likelySpicyPack, likelyTokenCatalog } from "../../../src/testing/catalogs/likely";

export { SHIPPED };
export const DEF = createLikelyDefinition({ spicyEnabled: true });
export const CATALOG: LikelyCatalog = likelyTokenCatalog();
export const FAMILY_ONLY: LikelyCatalog = { packs: [likelyFamilyPack()] };
export { likelyFamilyPack, likelySpicyPack };
export const GRACE = 2_500;
export const T0 = 1_000_000;
export const tv: GameActor = { kind: "tv" };
export const P = (playerId: string): GameActor => ({ kind: "player", playerId });

export const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `p${i + 1}`);
export function roster(n: number, locale: Locale = "en"): RosterEntry[] {
  return ids(n).map((id, i) => ({ id, seat: i, locale, connected: true, carryScore: 0 }));
}
export function settings(p: Partial<LikelySettings> = {}): LikelySettings {
  return { packIds: [], length: "short", showVoters: true, mode: "family", ...p };
}

export function startGame(n: number, s: Partial<LikelySettings> = {}, o: { content?: LikelyCatalog; seed?: number; usedKeys?: string[]; locale?: Locale } = {}): LikelyState {
  const r = DEF.start({ roster: roster(n, o.locale), settings: settings(s), locale: o.locale ?? "en", memory: { usedKeys: o.usedKeys ?? [] }, seed: o.seed ?? 42, now: T0, graceMs: GRACE, content: o.content ?? CATALOG });
  if (!r.ok) throw new Error(`start failed: ${r.error}`);
  DEF.assertInvariants(r.state);
  return r.state;
}

export function ctx(now: number, content: LikelyCatalog = CATALOG, host: string | null = "p1"): GameCtx<LikelyCatalog> {
  return { now, content, hostPlayerId: host, isHost: (a: GameActor) => a.kind === "tv" || (a.kind === "player" && a.playerId === host) };
}

/** Reduce and check invariants; throws on an engine error. */
export function step(s: LikelyState, a: GameAction<LikelyIntent>, now: number, content: LikelyCatalog = CATALOG): LikelyState {
  const r = DEF.reduce(s, a, ctx(now, content));
  if (!r.ok) throw new Error(`reduce failed: ${r.error} for ${JSON.stringify(a)}`);
  DEF.assertInvariants(r.state);
  return r.state;
}
/** The engine error of `a` (and that the input state comes back untouched). */
export function fail(s: LikelyState, a: GameAction<LikelyIntent>, now = T0, host: string | null = "p1"): string {
  const r = DEF.reduce(s, a, ctx(now, CATALOG, host));
  if (r.ok) throw new Error(`${JSON.stringify(a)} unexpectedly succeeded`);
  if (r.state !== s) throw new Error("a failed reduce must return its input state");
  return r.error;
}
export const tick = (s: LikelyState, content: LikelyCatalog = CATALOG): LikelyState => step(s, { type: "TICK" }, s.deadline ?? T0, content);
export const intent = (i: LikelyIntent, by: GameActor): GameAction<LikelyIntent> => ({ type: "INTENT", intent: i, by });
export const vote = (s: LikelyState, voter: string, target: string, now: number): LikelyState =>
  step(s, intent({ type: "VOTE", cardId: (s.card as { cardId: string }).cardId, targetId: target }, P(voter)), now);
export const host = (s: LikelyState, i: LikelyIntent, now: number): LikelyState => step(s, intent(i, tv), now);

/** From CARD: open voting, cast `ballots` (voter → target), and reveal. */
export function playCard(s: LikelyState, ballots: Record<string, string>): LikelyState {
  if (s.phase !== "CARD") throw new Error(`playCard from ${s.phase}`);
  let x = tick(s);
  const now = (x.deadline as number) - 10_000;
  for (const [v, t] of Object.entries(ballots)) x = vote(x, v, t, now);
  while (x.phase === "VOTING") x = tick(x);
  return x;
}

/** Plays every remaining card with the same ballots, then ticks to `until`. */
export function playTo(s: LikelyState, ballots: Record<string, string>, until: "AWARDS" | "RESULTS"): LikelyState {
  let x = s;
  for (let guard = 0; x.phase !== until; guard++) {
    if (guard > 500) throw new Error("did not reach " + until);
    x = x.phase === "CARD" ? playCard(x, ballots) : tick(x);
  }
  return x;
}
