// JAMAA-PLATFORM §2.9 / §6.6: Likely's seeded bot and engine-mode driver (tests and tools/sim only; never clients).
// Bots send random but legal intents (votes, self-votes, vote changes, host skips and advances, END_GAME in HOLD), plus
// random AWAY/BACK/GONE events, late joins and invalid "noise" intents. After EVERY reduce the driver checks: the engine
// invariants, that a failed reduce returns its input untouched, the leak oracles on the TV view and every player's view
// (whole-leaf secrets, leakCheck, forbidden keys), that no score ever goes down and that family mode never deals Spicy.
import type { Locale } from "../../constants";
import { createRng, type Rng } from "../../room/rng";
import { createLikelyDefinition, definition as shipped } from "../../games/likely/definition";
import type { LikelyDefinition } from "../../games/likely/definition";
import type { LikelyCatalog } from "../../games/likely/engine/catalog";
import { isTarget, isVoter } from "../../games/likely/engine/reduce";
import type { LikelyIntent, LikelyState } from "../../games/likely/engine/state";
import type { LikelySettings } from "../../games/likely/meta";
import type { GameAction, GameActor, GameReduceResult, RosterEntry } from "../../games/types";
import { likelyTokenCatalog } from "../catalogs/likely";

export const LIKELY_T0 = 1_790_000_000_000;
export const LIKELY_GRACE = 2_500;
export const likelyPid = (i: number): string => `p_11ke1y${String(i).padStart(2, "0")}`;
/** The definition with Spicy switched on (tests only; the shipped one keeps it compiled out). */
export const LIKELY_SPICY_DEF: LikelyDefinition = createLikelyDefinition({ spicyEnabled: true });

// ---------------- leak checker (the platform's generic checker applied to the Likely envelope alone)

function walk(x: unknown, path: string[], onKey: (k: string, path: readonly string[]) => void, onLeaf: (v: unknown, path: readonly string[]) => void): void {
  if (Array.isArray(x)) x.forEach((v, i) => walk(v, [...path, String(i)], onKey, onLeaf));
  else if (x !== null && typeof x === "object") {
    for (const [k, v] of Object.entries(x)) {
      onKey(k, path);
      walk(v, [...path, k], onKey, onLeaf);
    }
  } else onLeaf(x, path);
}

export interface LikelyView { label: string; viewer: string | null; view: { game: { gameId: "likely"; public: unknown; me: unknown } } }

/** The TV view and each player's view of the game envelope, as the room composes them (left players: no `me`). */
export function likelyViews(s: LikelyState, def: LikelyDefinition = shipped, cat: LikelyCatalog = { packs: [] }): LikelyView[] {
  const pub = def.projectPublic(s, cat);
  const out: LikelyView[] = [{ label: "tv", viewer: null, view: { game: { gameId: "likely", public: pub, me: null } } }];
  for (const p of s.players) {
    const inGame = !p.left;
    out.push({ label: `player ${p.id}`, viewer: inGame ? p.id : null, view: { game: { gameId: "likely", public: pub, me: inGame ? def.projectMe(s, p.id, cat) : null } } });
  }
  return out;
}

export function findLikelyLeaks(s: LikelyState, def: LikelyDefinition = shipped): string[] {
  const errs: string[] = [];
  const forbidden = new Set(def.forbiddenKeys);
  for (const { label, viewer, view } of likelyViews(s, def)) {
    const secrets = new Set(def.secretsFor(s, viewer));
    walk(view, [], (k, path) => {
      if (forbidden.has(k)) errs.push(`${label}: forbidden key "${k}" at ${path.join(".")}`);
    }, (v, path) => {
      if (secrets.has(v)) errs.push(`${label}: secret ${JSON.stringify(v)} at ${path.join(".")}`);
    });
    for (const e of def.leakCheck(s, viewer, view)) errs.push(`${label}: ${e}`);
  }
  return errs;
}

// ---------------- bot moves

const pick = <T>(rng: Rng, xs: readonly T[]): T | undefined => (xs.length ? xs[rng.int(xs.length)] : undefined);

/** A random legal VOTE for `playerId` (self-votes included), or null when they cannot vote now. */
export function likelyBotVote(s: LikelyState, playerId: string, rng: Rng): LikelyIntent | null {
  const me = s.players.find((p) => p.id === playerId);
  if (!me || !isVoter(me) || !me.connected || s.phase !== "VOTING" || !s.card) return null;
  // A third of the bots herd onto the first target, so unanimous cards, Self-aware and ties actually happen.
  const targets = s.players.filter((p) => isTarget(s, p.id)).map((p) => p.id);
  const t = rng.next() < 0.35 ? targets[0] : pick(rng, targets);
  return t ? { type: "VOTE", cardId: s.card.cardId, targetId: t } : null;
}

/** The next intent a room-level driver can send for the active Likely instance (votes first, then the host). */
export function likelyNextIntent(s: LikelyState, rng: Rng, hostId: string | null): { intent: LikelyIntent; by: GameActor } | null {
  const by: GameActor = hostId && rng.next() < 0.5 ? { kind: "player", playerId: hostId } : { kind: "tv" };
  if ((s.phase === "CARD" || s.phase === "VOTING") && s.card && rng.next() < 0.03) return { intent: { type: "SKIP_CARD", cardId: s.card.cardId }, by };
  if (s.phase === "VOTING") {
    const voter = pick(rng, s.players.filter((p) => isVoter(p) && p.connected && s.votes[p.id] === undefined));
    const v = voter ? likelyBotVote(s, voter.id, rng) : null;
    if (voter && v) return { intent: v, by: { kind: "player", playerId: voter.id } };
    return null;
  }
  if (s.phase === "HOLD") return { intent: { type: "END_GAME" }, by };
  if (s.phase === "CARD" || s.phase === "REVEAL" || s.phase === "AWARDS") return { intent: { type: "HOST_ADVANCE" }, by };
  return null;
}

// ---------------- engine-mode driver

export interface LikelyBotOptions {
  players: number;
  seed: number;
  settings?: Partial<LikelySettings>;
  locale?: Locale;
  content?: LikelyCatalog;
  /** Use the Spicy-enabled definition (tests); default: the shipped one. */
  spicy?: boolean;
  /** "clock": phases mostly end at their deadline; "eager": the host advances and everyone votes at once. */
  pace?: "clock" | "eager";
  churnRate?: number;      // 0.03 AWAY/BACK
  goneRate?: number;       // 0.004 LEAVE/KICK
  joinRate?: number;       // 0.006 late join
  skipRate?: number;       // 0.02 host SKIP_CARD
  noiseRate?: number;      // 0.03 invalid intents (must leave the state untouched)
  disconnectedAtStart?: number;
  usedKeys?: string[];
  maxSteps?: number;       // 20 000
}

export interface LikelyStep { action: GameAction<LikelyIntent>; now: number; ok: boolean; error: string | null }
export interface LikelyGameResult {
  final: LikelyState | null;
  steps: LikelyStep[];
  cards: number;
  skips: number;
  joins: number;
  failure: string | null;
}

export type LikelyStepHook = (prev: LikelyState, action: GameAction<LikelyIntent>, res: GameReduceResult<LikelyState>, now: number) => void;

export function playLikelyGame(opts: LikelyBotOptions, onStep?: LikelyStepHook): LikelyGameResult {
  const def = opts.spicy ? LIKELY_SPICY_DEF : shipped;
  const rng = createRng((opts.seed ^ 0x5eed1e1) >>> 0);
  const content = opts.content ?? likelyTokenCatalog();
  const rate = {
    churn: opts.churnRate ?? 0.03, gone: opts.goneRate ?? 0.004, join: opts.joinRate ?? 0.006,
    skip: opts.skipRate ?? 0.02, noise: opts.noiseRate ?? 0.03,
  };
  const eager = opts.pace === "eager";
  const settings: LikelySettings = { ...def.meta.settings.defaults, packIds: [], ...opts.settings };
  let now = LIKELY_T0;
  const roster: RosterEntry[] = Array.from({ length: opts.players }, (_, i) => ({
    id: likelyPid(i), seat: i, locale: opts.locale ?? "en", connected: i >= (opts.disconnectedAtStart ?? 0), carryScore: 0,
  }));
  const steps: LikelyStep[] = [];
  const out = (final: LikelyState | null, failure: string | null, extra: Partial<LikelyGameResult> = {}): LikelyGameResult =>
    ({ final, steps, cards: final?.results.length ?? 0, skips: 0, joins: 0, failure, ...extra });
  const started = def.start({ roster, settings, locale: opts.locale ?? "en", memory: { usedKeys: opts.usedKeys ?? [] }, seed: opts.seed >>> 0, now, graceMs: LIKELY_GRACE, content });
  if (!started.ok) return out(null, `start failed: ${started.error}`);
  let s = started.state;
  def.assertInvariants(s);
  let nextSeat = opts.players;
  let skips = 0;
  let joins = 0;
  const hostId = (): string | null => s.players.find((p) => !p.left && !p.waiting)?.id ?? null;
  const ctx = () => ({ now, content, hostPlayerId: hostId(), isHost: (a: GameActor) => a.kind === "tv" || (a.kind === "player" && a.playerId === hostId()) });

  const step = (action: GameAction<LikelyIntent>): GameReduceResult<LikelyState> => {
    const prev = s;
    const res = def.reduce(prev, action, ctx());
    if (!res.ok && res.state !== prev) throw new Error(`${action.type}: a failed reduce must return its input state`);
    def.assertInvariants(res.state);
    const leaks = findLikelyLeaks(res.state, def);
    if (leaks.length) throw new Error(`leak after ${action.type}: ${leaks.slice(0, 3).join("; ")}`);
    for (const p of prev.players) if ((res.state.scores[p.id] ?? 0) < (prev.scores[p.id] ?? 0)) throw new Error(`score of ${p.id} went down`);
    if (res.state.settings.mode === "family" && res.state.card && (res.state.card.spicy || res.state.card.namedPlayerId)) throw new Error("Spicy card in family mode");
    if (action.type === "INTENT" && action.intent.type === "SKIP_CARD" && res.ok) skips++;
    onStep?.(prev, action, res, now);
    steps.push({ action, now, ok: res.ok, error: res.ok ? null : res.error });
    s = res.state;
    return res;
  };
  const host = (): GameActor => {
    const h = hostId();
    return h && rng.next() < 0.5 ? { kind: "player", playerId: h } : { kind: "tv" };
  };
  const tickToDeadline = (): void => {
    if (s.deadline !== null) now = Math.max(now, s.deadline);
    step({ type: "TICK" });
  };

  const maxSteps = opts.maxSteps ?? 20_000;
  try {
    while (s.phase !== "RESULTS") {
      if (steps.length > maxSteps) return out(s, `more than ${maxSteps} steps`, { skips, joins });
      now += 1 + rng.int(eager ? 400 : 2_500);
      const live = s.players.filter((p) => !p.left);
      const r = rng.next();
      let acc = rate.noise;
      if (r < acc) {
        noise();
        continue;
      }
      if (r < (acc += rate.churn)) {
        const p = pick(rng, live);
        if (p) step({ type: p.connected ? "PLAYER_AWAY" : "PLAYER_BACK", playerId: p.id });
        continue;
      }
      if (r < (acc += rate.gone)) {
        const p = pick(rng, live);
        if (p && live.length > 1) step({ type: "PLAYER_GONE", playerId: p.id, cause: rng.next() < 0.5 ? "LEAVE" : "KICK" });
        continue;
      }
      if (r < (acc += rate.join)) {
        if (live.length < 12 && def.join) {
          const res = def.join(s, { id: likelyPid(nextSeat), seat: nextSeat, locale: "en", connected: true, carryScore: 0 });
          nextSeat++;
          if (res.ok) {
            def.assertInvariants(res.state);
            s = res.state;
            joins++;
            if (def.nextWakeAt(s) === 0) step({ type: "TICK" });
          }
        }
        continue;
      }
      if (r < (acc += rate.skip) && (s.phase === "CARD" || s.phase === "VOTING") && s.card) {
        step({ type: "INTENT", intent: { type: "SKIP_CARD", cardId: s.card.cardId }, by: host() });
        continue;
      }
      switch (s.phase) {
        case "HOLD": {
          // Bring someone back, or (sometimes) the host ends the game.
          const away = live.filter((p) => !p.connected);
          if (away.length > 0 && rng.next() < 0.7) step({ type: "PLAYER_BACK", playerId: (pick(rng, away) as { id: string }).id });
          else step({ type: "INTENT", intent: { type: "END_GAME" }, by: host() });
          break;
        }
        case "VOTING": {
          const pending = live.filter((p) => isVoter(p) && p.connected && (s.votes[p.id] === undefined || rng.next() < 0.1));
          const voter = pick(rng, pending);
          const v = voter ? likelyBotVote(s, voter.id, rng) : null;
          if (voter && v && (eager || rng.next() < 0.8)) step({ type: "INTENT", intent: v, by: { kind: "player", playerId: voter.id } });
          else if (rng.next() < 0.05) step({ type: "INTENT", intent: { type: "HOST_ADVANCE" }, by: host() });   // ignored in VOTING
          else tickToDeadline();
          break;
        }
        case "CARD":
        case "REVEAL":
        case "AWARDS":
          if (eager || rng.next() < 0.25) step({ type: "INTENT", intent: { type: "HOST_ADVANCE" }, by: host() });
          else tickToDeadline();
          break;
      }
    }
  } catch (e) {
    return out(s, e instanceof Error ? e.message : String(e), { skips, joins });
  }

  function noise(): void {
    const someone = pick(rng, s.players)?.id ?? "p_ghost";
    const actors: GameActor[] = [{ kind: "tv" }, ...s.players.map((p) => ({ kind: "player", playerId: p.id }) as GameActor), { kind: "player", playerId: "p_ghost" }];
    const by = pick(rng, actors) ?? { kind: "tv" };
    const cardId = rng.next() < 0.5 && s.card ? s.card.cardId : "zz-stale-card";
    const intents: LikelyIntent[] = [
      { type: "VOTE", cardId, targetId: rng.next() < 0.5 ? someone : "p_ghost" },
      { type: "SKIP_CARD", cardId },
      { type: "HOST_ADVANCE" },
      { type: "END_GAME" },
    ];
    step({ type: "INTENT", intent: pick(rng, intents) ?? { type: "END_GAME" }, by });
  }

  return out(s, null, { skips, joins });
}
