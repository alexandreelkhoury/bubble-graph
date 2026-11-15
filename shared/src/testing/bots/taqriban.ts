// JAMAA-PLATFORM §2.9 / §6.6: Taqriban's seeded bot and engine-mode driver (tests and tools/sim only; never clients).
// Bots guess (spot-on, close, wild, zero, duplicate ties), the host skips and advances, plus AWAY/BACK/GONE churn, late
// joins and invalid "noise" intents. After EVERY reduce the driver checks: the invariants, that a failed reduce returns its
// input untouched, the leak oracles on the TV view and every player's view, and that no score ever goes down.
import type { Locale } from "../../constants";
import { createRng, type Rng } from "../../room/rng";
import { definition as def } from "../../games/taqriban/definition";
import { canPlay } from "../../games/taqriban/engine/reduce";
import type { TaqribanCatalog, TaqribanIntent, TaqribanState } from "../../games/taqriban/engine/types";
import type { TaqribanSettings } from "../../games/taqriban/meta";
import type { GameAction, GameActor, GameReduceResult, RosterEntry } from "../../games/types";
import { taqribanTokenCatalog } from "../catalogs/taqriban";

export const TAQ_T0 = 1_790_000_000_000;
export const TAQ_GRACE = 2_500;
export const taqribanPid = (i: number): string => `p_7aqr1b${String(i).padStart(2, "0")}`;

function walk(x: unknown, path: string[], onKey: (k: string, path: readonly string[]) => void, onLeaf: (v: unknown, path: readonly string[]) => void): void {
  if (Array.isArray(x)) x.forEach((v, i) => walk(v, [...path, String(i)], onKey, onLeaf));
  else if (x !== null && typeof x === "object") {
    for (const [k, v] of Object.entries(x)) {
      onKey(k, path);
      walk(v, [...path, k], onKey, onLeaf);
    }
  } else onLeaf(x, path);
}

export interface TaqribanView { label: string; viewer: string | null; view: { game: { gameId: "taqriban"; public: unknown; me: unknown } } }

export function taqribanViews(s: TaqribanState, cat: TaqribanCatalog = { packs: [] }): TaqribanView[] {
  const pub = def.projectPublic(s, cat);
  const out: TaqribanView[] = [{ label: "tv", viewer: null, view: { game: { gameId: "taqriban", public: pub, me: null } } }];
  for (const p of s.players) {
    const inGame = !p.left;
    out.push({ label: `player ${p.id}`, viewer: inGame ? p.id : null, view: { game: { gameId: "taqriban", public: pub, me: inGame ? def.projectMe(s, p.id, cat) : null } } });
  }
  return out;
}

export function findTaqribanLeaks(s: TaqribanState): string[] {
  const errs: string[] = [];
  const forbidden = new Set(def.forbiddenKeys);
  for (const { label, viewer, view } of taqribanViews(s)) {
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

const pick = <T>(rng: Rng, xs: readonly T[]): T | undefined => (xs.length ? xs[rng.int(xs.length)] : undefined);

/** A guess around the answer: exact, within 2 %, ×/÷ up to 10, wild (×1000), or 0; integers or 2 decimals. */
export function taqribanBotGuess(answer: number, rng: Rng): number {
  const r = rng.next();
  let v: number;
  if (r < 0.08) v = answer;
  else if (r < 0.2) v = answer * (0.98 + rng.next() * 0.04);
  else if (r < 0.85) v = answer * 10 ** ((rng.next() * 2 - 1) * (rng.next() < 0.5 ? 0.3 : 1));
  else if (r < 0.95) v = answer * (rng.next() < 0.5 ? 1000 : 0.001);
  else v = 0;
  v = Math.min(1e15, Math.max(0, v));
  return v >= 100 ? Math.round(v) : Math.round(v * 100) / 100;
}

/** The next intent a room-level driver can send for the active instance (guesses first, then the host). */
export function taqribanNextIntent(s: TaqribanState, rng: Rng, hostId: string | null): { intent: TaqribanIntent; by: GameActor } | null {
  const by: GameActor = hostId && rng.next() < 0.5 ? { kind: "player", playerId: hostId } : { kind: "tv" };
  if (s.phase === "QUESTION" && s.cur) {
    if (rng.next() < 0.02) return { intent: { type: "SKIP_QUESTION", questionId: s.cur.id }, by };
    const p = pick(rng, s.players.filter((x) => canPlay(x) && x.connected && s.guesses[x.id] === undefined));
    if (p) return { intent: { type: "GUESS", questionId: s.cur.id, value: taqribanBotGuess(s.cur.answer, rng) }, by: { kind: "player", playerId: p.id } };
    return null;
  }
  if (s.phase === "HOLD") return { intent: { type: "END_GAME" }, by };
  if (s.phase === "REVEAL" || s.phase === "LEADERBOARD" || s.phase === "FINAL_INTRO") return { intent: { type: "HOST_ADVANCE" }, by };
  return null;
}

export interface TaqribanBotOptions {
  players: number;
  seed: number;
  settings?: Partial<TaqribanSettings>;
  locale?: Locale;
  content?: TaqribanCatalog;
  pace?: "clock" | "eager";
  churnRate?: number;      // 0.03 AWAY/BACK
  goneRate?: number;       // 0.004 LEAVE/KICK
  joinRate?: number;       // 0.006 late join
  skipRate?: number;       // 0.01 host SKIP_QUESTION
  noiseRate?: number;      // 0.03 invalid intents
  disconnectedAtStart?: number;
  usedKeys?: string[];
  maxSteps?: number;       // 20 000
}

export interface TaqribanGameResult {
  final: TaqribanState | null;
  steps: number;
  questions: number;
  ties: number;
  bullseyes: number;
  wild: number;
  skips: number;
  joins: number;
  failure: string | null;
}

export type TaqribanStepHook = (prev: TaqribanState, action: GameAction<TaqribanIntent>, res: GameReduceResult<TaqribanState>, now: number) => void;

export function playTaqribanGame(opts: TaqribanBotOptions, onStep?: TaqribanStepHook): TaqribanGameResult {
  const rng = createRng((opts.seed ^ 0x7a9b1b) >>> 0);
  const content = opts.content ?? taqribanTokenCatalog();
  const rate = { churn: opts.churnRate ?? 0.03, gone: opts.goneRate ?? 0.004, join: opts.joinRate ?? 0.006, skip: opts.skipRate ?? 0.01, noise: opts.noiseRate ?? 0.03 };
  const eager = opts.pace === "eager";
  const settings: TaqribanSettings = { ...def.meta.settings.defaults, packIds: [], ...opts.settings };
  let now = TAQ_T0;
  const roster: RosterEntry[] = Array.from({ length: opts.players }, (_, i) => ({
    id: taqribanPid(i), seat: i, locale: opts.locale ?? "en", connected: i >= (opts.disconnectedAtStart ?? 0), carryScore: 0,
  }));
  const r: TaqribanGameResult = { final: null, steps: 0, questions: 0, ties: 0, bullseyes: 0, wild: 0, skips: 0, joins: 0, failure: null };
  const started = def.start({ roster, settings, locale: opts.locale ?? "en", memory: { usedKeys: opts.usedKeys ?? [] }, seed: opts.seed >>> 0, now, graceMs: TAQ_GRACE, content });
  if (!started.ok) return { ...r, failure: `start failed: ${started.error}` };
  let s = started.state;
  def.assertInvariants(s);
  let nextSeat = opts.players;
  const hostId = (): string | null => s.players.find((p) => !p.left && !p.waiting)?.id ?? null;
  const ctx = () => ({ now, content, hostPlayerId: hostId(), isHost: (a: GameActor) => a.kind === "tv" || (a.kind === "player" && a.playerId === hostId()) });

  const step = (action: GameAction<TaqribanIntent>): void => {
    const prev = s;
    const res = def.reduce(prev, action, ctx());
    if (!res.ok && res.state !== prev) throw new Error(`${action.type}: a failed reduce must return its input state`);
    def.assertInvariants(res.state);
    const leaks = findTaqribanLeaks(res.state);
    if (leaks.length) throw new Error(`leak after ${action.type}: ${leaks.slice(0, 3).join("; ")}`);
    for (const p of prev.players) {
      const q = res.state.players.find((x) => x.id === p.id);
      if (!q || q.score < p.score) throw new Error(`score of ${p.id} went down`);
    }
    if (res.state.phase === "REVEAL" && prev.phase !== "REVEAL" && res.state.last) {
      r.questions++;
      if (res.state.last.closestIds.length > 1) r.ties++;
      r.bullseyes += res.state.last.bullseyeIds.length;
      if (res.state.last.wildId) r.wild++;
    }
    if (action.type === "INTENT" && action.intent.type === "SKIP_QUESTION" && res.ok) r.skips++;
    onStep?.(prev, action, res, now);
    r.steps++;
    s = res.state;
  };
  const host = (): GameActor => {
    const h = hostId();
    return h && rng.next() < 0.5 ? { kind: "player", playerId: h } : { kind: "tv" };
  };
  const tickToDeadline = (): void => {
    if (s.deadline !== null) now = Math.max(now, s.deadline.at);
    step({ type: "TICK" });
  };
  const noise = (): void => {
    const actors: GameActor[] = [{ kind: "tv" }, ...s.players.map((p) => ({ kind: "player", playerId: p.id }) as GameActor), { kind: "player", playerId: "p_ghost" }];
    const by = pick(rng, actors) ?? { kind: "tv" };
    const qid = rng.next() < 0.5 && s.cur ? s.cur.id : "zz-999";
    const bad = pick(rng, [-1, Number.NaN, 1e16, 0.001, Number.POSITIVE_INFINITY, 12.345]) ?? -1;
    const intents: TaqribanIntent[] = [
      { type: "GUESS", questionId: qid, value: bad },
      { type: "GUESS", questionId: "zz-999", value: 5 },
      { type: "SKIP_QUESTION", questionId: "zz-999" },
      { type: "HOST_ADVANCE" },
      { type: "END_GAME" },
    ];
    step({ type: "INTENT", intent: pick(rng, intents) ?? { type: "END_GAME" }, by });
  };

  const maxSteps = opts.maxSteps ?? 20_000;
  try {
    while (s.phase !== "RESULTS") {
      if (r.steps > maxSteps) return { ...r, final: s, failure: `more than ${maxSteps} steps` };
      now += 1 + rng.int(eager ? 400 : 2_500);
      const live = s.players.filter((p) => !p.left);
      const x = rng.next();
      let acc = rate.noise;
      if (x < acc) { noise(); continue; }
      if (x < (acc += rate.churn)) {
        const p = pick(rng, live);
        if (p) step({ type: p.connected ? "PLAYER_AWAY" : "PLAYER_BACK", playerId: p.id });
        continue;
      }
      if (x < (acc += rate.gone)) {
        const p = pick(rng, live);
        if (p && live.length > 1) step({ type: "PLAYER_GONE", playerId: p.id, cause: rng.next() < 0.5 ? "LEAVE" : "KICK" });
        continue;
      }
      if (x < (acc += rate.join)) {
        if (live.length < 12 && def.join) {
          const res = def.join(s, { id: taqribanPid(nextSeat), seat: nextSeat, locale: "en", connected: true, carryScore: 0 });
          nextSeat++;
          if (res.ok) {
            def.assertInvariants(res.state);
            s = res.state;
            r.joins++;
            if (def.nextWakeAt(s) === 0) step({ type: "TICK" });
          }
        }
        continue;
      }
      if (x < (acc += rate.skip) && s.phase === "QUESTION" && s.cur) {
        step({ type: "INTENT", intent: { type: "SKIP_QUESTION", questionId: s.cur.id }, by: host() });
        continue;
      }
      switch (s.phase) {
        case "HOLD": {
          const away = live.filter((p) => !p.connected);
          if (away.length > 0 && rng.next() < 0.7) step({ type: "PLAYER_BACK", playerId: (pick(rng, away) as { id: string }).id });
          else step({ type: "INTENT", intent: { type: "END_GAME" }, by: host() });
          break;
        }
        case "QUESTION": {
          const n = taqribanNextIntent(s, rng, hostId());
          if (n && n.intent.type === "GUESS" && (eager || rng.next() < 0.8)) step({ type: "INTENT", intent: n.intent, by: n.by });
          else if (rng.next() < 0.05) step({ type: "INTENT", intent: { type: "HOST_ADVANCE" }, by: host() });   // ignored in QUESTION
          else tickToDeadline();
          break;
        }
        default:
          if (eager || rng.next() < 0.25) step({ type: "INTENT", intent: { type: "HOST_ADVANCE" }, by: host() });
          else tickToDeadline();
      }
    }
  } catch (e) {
    return { ...r, final: s, failure: e instanceof Error ? e.message : String(e) };
  }
  if (!def.outcome(s)) return { ...r, final: s, failure: "RESULTS without an outcome" };
  return { ...r, final: s };
}
