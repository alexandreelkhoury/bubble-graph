// JAMAA-PLATFORM §2.9 / §6.5: Bluff's seeded bot and engine-mode driver (tests and tools/sim only; never clients).
// Bots send random but legal intents (2–4 word bluffs, sometimes the truth or a near-truth, help requests, votes, likes,
// host skips/hides/advances), plus random AWAY/BACK/GONE events and late joins. After EVERY reduce the driver checks:
// the engine invariants, the leak oracles on the TV view and every player's view (whole-leaf secrets, leakCheck,
// forbidden keys), that a failed reduce returns its input untouched, and that no score ever goes down.
import type { Locale } from "../../constants";
import { createRng, type Rng } from "../../room/rng";
import { definition } from "../../games/bluff/definition";
import type { BluffCatalog } from "../../games/bluff/engine/catalog";
import { slotKind } from "../../games/bluff/engine/reduce";
import { presentLie } from "../../games/bluff/engine/text";
import type { BluffIntent, BluffSettings, BluffState } from "../../games/bluff/engine/state";
import type { ErrorCode } from "../../protocol/errors";
import type { GameAction, GameActor, GameReduceResult, RosterEntry } from "../../games/types";
import { bluffTokenCatalog } from "../catalogs/bluff";

export const BLUFF_T0 = 1_790_000_000_000;
export const BLUFF_GRACE = 2_500;
export const bluffPid = (i: number): string => `p_b1uff${String(i).padStart(2, "0")}`;

const WORDS: Record<Locale, readonly string[]> = {
  en: ["purple", "goat", "sings", "quietly", "under", "moon", "grandma", "bakes", "tiny", "clouds", "forever", "jazz", "pickles", "sideways", "uncle"],
  fr: ["chèvre", "violette", "chante", "doucement", "sous", "lune", "mamie", "cuisine", "petits", "nuages", "toujours", "jazz", "cornichons"],
  ar: ["قطة", "بتغني", "تحت", "القمر", "تيتا", "بتخبز", "غيمة", "صغيرة", "زيتون", "دايماً", "عمو", "بالمقلوب"],
  es: ["cabra", "morada", "canta", "despacio", "bajo", "luna", "abuela", "hornea", "nubes", "siempre", "jazz", "pepinillos"],
};

// ---------------- leak checker (the platform's generic checker applied to the Bluff envelope alone)

function walk(x: unknown, path: string[], onKey: (k: string, path: readonly string[]) => void, onLeaf: (v: unknown, path: readonly string[]) => void): void {
  if (Array.isArray(x)) x.forEach((v, i) => walk(v, [...path, String(i)], onKey, onLeaf));
  else if (x !== null && typeof x === "object") {
    for (const [k, v] of Object.entries(x)) {
      onKey(k, path);
      walk(v, [...path, k], onKey, onLeaf);
    }
  } else onLeaf(x, path);
}

/** The TV view and each player's view of the game envelope (`{game:{public, me}}`), as the room composes them. */
export function bluffViews(s: BluffState, cat: BluffCatalog): { label: string; viewer: string | null; view: { game: { public: unknown; me: unknown } } }[] {
  const pub = definition.projectPublic(s, cat);
  const out: { label: string; viewer: string | null; view: { game: { public: unknown; me: unknown } } }[] = [
    { label: "tv", viewer: null, view: { game: { public: pub, me: null } } },
  ];
  for (const p of s.players) {
    const inGame = !p.left;
    out.push({ label: `player ${p.id}`, viewer: inGame ? p.id : null, view: { game: { public: pub, me: inGame ? definition.projectMe(s, p.id, cat) : null } } });
  }
  return out;
}

export function findBluffLeaks(s: BluffState, cat: BluffCatalog): string[] {
  const errs: string[] = [];
  const forbidden = new Set(definition.forbiddenKeys);
  for (const { label, viewer, view } of bluffViews(s, cat)) {
    const secrets = new Set(definition.secretsFor(s, viewer));
    walk(view, [], (k, path) => {
      if (forbidden.has(k)) errs.push(`${label}: forbidden key "${k}" at ${path.join(".")}`);
    }, (v, path) => {
      if (secrets.has(v)) errs.push(`${label}: secret ${JSON.stringify(v)} at ${path.join(".")}`);
    });
    for (const e of definition.leakCheck(s, viewer, view)) errs.push(`${label}: ${e}`);
  }
  return errs;
}

// ---------------- driver

export interface BluffBotOptions {
  players: number;                 // 3..12 at start
  seed: number;
  settings?: Partial<BluffSettings>;
  locale?: Locale;                 // "en"
  catalog?: BluffCatalog;          // default: the synthetic token catalog
  usedKeys?: string[];
  /** false: bots finish every phase before letting its clock run out; true: the clock also jumps mid-phase. */
  timers?: boolean;
  truthRate?: number;              // 0.15: submit the truth (or a near-truth) instead of a bluff
  helpRate?: number;               // 0.1
  likeRate?: number;               // 0.3
  skipRate?: number;               // 0.02 (host SKIP_PROMPT)
  hideRate?: number;               // 0.03 (host HIDE_OPTION)
  advanceRate?: number;            // 0.3 (host HOST_ADVANCE in reveal-type phases, else wait for the clock)
  churnRate?: number;              // 0.03 (AWAY / BACK)
  leaveRate?: number;              // 0.004 (PLAYER_GONE)
  joinRate?: number;               // 0.006 (late join through `join`)
  noiseRate?: number;              // 0.05: random, often invalid intents (a failure must leave the state untouched)
  checkLeaks?: boolean;            // true
  maxSteps?: number;               // 6000
}

export interface BluffStepRecord { action: GameAction<BluffIntent> | { type: "JOIN"; id: string }; now: number; ok: boolean; error: ErrorCode | null }
export interface BluffRunResult { final: BluffState; steps: number; log: BluffStepRecord[]; failure: string | null; joins: number; holds: number; voided: number; swaps: number }

const pick = <T>(rng: Rng, xs: readonly T[]): T | undefined => (xs.length ? xs[rng.int(xs.length)] : undefined);
const chance = (rng: Rng, p: number): boolean => rng.next() < p;

export function bluffBotLie(rng: Rng, locale: Locale): string {
  const n = 2 + rng.int(3);
  const w = WORDS[locale];
  return Array.from({ length: n }, () => w[rng.int(w.length)] as string).join(" ");
}

/** Plays one seeded game to RESULTS. Never throws: the first failure is returned with the state it happened in. */
export function runBluffBotGame(o: BluffBotOptions): BluffRunResult {
  const cat = o.catalog ?? bluffTokenCatalog();
  const locale = o.locale ?? "en";
  const rng = createRng(o.seed ^ 0x5bd1e995);
  const timers = o.timers ?? true;
  const rate = {
    truth: o.truthRate ?? 0.15, help: o.helpRate ?? 0.1, like: o.likeRate ?? 0.3, skip: o.skipRate ?? 0.02, hide: o.hideRate ?? 0.03,
    advance: o.advanceRate ?? 0.3, churn: o.churnRate ?? 0.03, leave: o.leaveRate ?? 0.004, join: o.joinRate ?? 0.006, noise: o.noiseRate ?? 0.05,
  };
  const checkLeaks = o.checkLeaks ?? true;
  const maxSteps = o.maxSteps ?? 6000;
  let now = BLUFF_T0;
  let nextId = o.players;
  const roster: RosterEntry[] = Array.from({ length: o.players }, (_, i) => ({ id: bluffPid(i), seat: i, locale, connected: true, carryScore: 0 }));
  const settings: BluffSettings = { packIds: [], length: "normal", pace: "normal", ...o.settings };
  const log: BluffStepRecord[] = [];
  const stats = { joins: 0, holds: 0, voided: 0, swaps: 0 };
  const started = definition.start({ roster, settings, locale, memory: { usedKeys: o.usedKeys ?? [] }, seed: o.seed >>> 0, now, graceMs: BLUFF_GRACE, content: cat });
  let s = started.state;
  const done = (failure: string | null): BluffRunResult => ({ final: s, steps: log.length, log, failure, ...stats });
  if (!started.ok) return done(`start failed: ${started.error}`);
  let host: string | null = roster[0]?.id ?? null;
  const ctx = () => ({ now, content: cat, isHost: (a: GameActor) => a.kind === "tv" || a.playerId === host, hostPlayerId: host });

  const check = (prev: BluffState, r: GameReduceResult<BluffState>, what: string): string | null => {
    if (!r.ok && r.state !== prev) return `${what}: a failed reduce changed the state`;
    try {
      definition.assertInvariants(r.state);
    } catch (e) {
      return `${what}: ${(e as Error).message}`;
    }
    for (const p of prev.players) {
      const q = r.state.players.find((x) => x.id === p.id);
      if (!q || q.score < p.score) return `${what}: score of ${p.id} went down`;
    }
    // No typographic tell (§5.1, §8.1): every option text, whatever its kind, is a fixed point of the display pipeline.
    for (const o of r.state.options) if (presentLie(o.text, locale) !== o.text) return `${what}: option "${o.text}" (${o.kind}) is not display-normalised`;
    if (r.state.phase === "HOLD" && prev.phase !== "HOLD") stats.holds++;
    if (r.state.voided && !prev.voided) stats.voided++;
    if (r.state.notice === "tooFamous" && prev.notice !== "tooFamous") stats.swaps++;
    if (checkLeaks) {
      const leaks = findBluffLeaks(r.state, cat);
      if (leaks.length) return `${what}: leak ${leaks.slice(0, 3).join("; ")}`;
    }
    return null;
  };
  const send = (a: GameAction<BluffIntent>): string | null => {
    const prev = s;
    let r: GameReduceResult<BluffState>;
    try {
      r = definition.reduce(prev, a, ctx());
    } catch (e) {
      return `${a.type} threw: ${(e as Error).stack ?? String(e)}`;
    }
    log.push({ action: a, now, ok: r.ok, error: r.ok ? null : r.error });
    const bad = check(prev, r, `${a.type}${a.type === "INTENT" ? ":" + a.intent.type : ""} @${prev.phase}`);
    s = r.state;
    return bad;
  };
  const intent = (i: BluffIntent, by: GameActor): string | null => send({ type: "INTENT", intent: i, by });
  const tickTo = (t: number): string | null => {
    now = Math.max(now, t);
    return send({ type: "TICK" });
  };

  while (s.phase !== "RESULTS") {
    if (log.length >= maxSteps) return done(`no RESULTS after ${maxSteps} steps (phase ${s.phase}, prompt ${s.promptIndex})`);
    now += 100 + rng.int(1500);
    const live = s.players.filter((p) => !p.left);
    const actors = live.filter((p) => !p.waiting);
    let bad: string | null = null;

    // Churn, leaves and joins.
    if (chance(rng, rate.churn)) {
      const p = pick(rng, live);
      if (p) bad = send(p.connected ? { type: "PLAYER_AWAY", playerId: p.id } : { type: "PLAYER_BACK", playerId: p.id });
    } else if (chance(rng, rate.leave) && live.length > 1) {
      const p = pick(rng, live) as { id: string };
      bad = send({ type: "PLAYER_GONE", playerId: p.id, cause: chance(rng, 0.5) ? "LEAVE" : "KICK" });
      if (host === p.id) host = s.players.find((q) => !q.left)?.id ?? null;
    } else if (chance(rng, rate.join) && live.length < 12) {
      const id = bluffPid(nextId++);
      const seat = Math.max(...s.players.map((p) => p.seat)) + 1;
      const prev = s;
      const r = definition.join?.(prev, { id, seat, locale, connected: true, carryScore: 0 }) as GameReduceResult<BluffState>;
      log.push({ action: { type: "JOIN", id }, now, ok: r.ok, error: r.ok ? null : r.error });
      bad = check(prev, r, "JOIN");
      s = r.state;
      if (r.ok) stats.joins++;
    } else if (chance(rng, rate.noise)) {
      // Noise: a random intent from a random actor, often illegal.
      const opt = pick(rng, s.options)?.id ?? "deadbeef";
      const pr = s.prompt?.id ?? "00000000";
      const by: GameActor = chance(rng, 0.2) ? { kind: "tv" } : { kind: "player", playerId: pick(rng, s.players)?.id ?? "p_nobody" };
      const i = pick<BluffIntent>(rng, [
        { type: "SUBMIT_LIE", text: chance(rng, 0.5) ? bluffBotLie(rng, locale) : pick(rng, ["", "?!", "x".repeat(70), "1 2 3", "porno night", "مرحبا", "hello"]) as string, promptId: chance(rng, 0.8) ? pr : "ffffffff" },
        { type: "REQUEST_HELP", promptId: pr }, { type: "VOTE", optionId: opt }, { type: "LIKE", optionId: opt, on: chance(rng, 0.5) },
        { type: "SKIP_PROMPT", promptId: pr }, { type: "HIDE_OPTION", optionId: opt }, { type: "HOST_ADVANCE" }, { type: "END_GAME" },
      ]) as BluffIntent;
      bad = intent(i, by);
    } else {
      const hostActor: GameActor = host && chance(rng, 0.5) ? { kind: "player", playerId: host } : { kind: "tv" };
      switch (s.phase) {
        case "ROUND_INTRO": case "REVEAL": case "SCORES": case "AWARDS":
          bad = chance(rng, rate.advance) ? intent({ type: "HOST_ADVANCE" }, hostActor) : tickTo(s.deadline ?? now);
          break;
        case "HOLD": {
          const away = live.find((p) => !p.connected);
          if (away && chance(rng, 0.8)) bad = send({ type: "PLAYER_BACK", playerId: away.id });
          else if (chance(rng, 0.5) || !away) bad = intent({ type: "END_GAME" }, hostActor);
          break;
        }
        case "WRITING": {
          const prompt = s.prompt;
          if (!prompt) return done("WRITING without a prompt");
          if (chance(rng, rate.skip)) {
            bad = intent({ type: "SKIP_PROMPT", promptId: prompt.id }, hostActor);
            break;
          }
          const todo = actors.filter((p) => p.connected && s.lies[p.id] === undefined && !s.spotOn[p.id]);
          const p = pick(rng, todo.length ? todo : actors.filter((q) => q.connected));
          if (!p || (timers && chance(rng, 0.03))) {
            bad = tickTo(s.deadline ?? now);
            break;
          }
          if (s.help[p.id] === undefined && s.lies[p.id] === undefined && chance(rng, rate.help)) {
            bad = intent({ type: "REQUEST_HELP", promptId: prompt.id }, { kind: "player", playerId: p.id });
            break;
          }
          const help = s.help[p.id];
          let text = bluffBotLie(rng, locale);
          if (typeof help === "string" && chance(rng, 0.6)) text = help;
          else if (prompt.truthText && chance(rng, rate.truth)) text = chance(rng, 0.5) ? prompt.truthText : `${prompt.truthText}!`;
          bad = intent({ type: "SUBMIT_LIE", text, promptId: prompt.id }, { kind: "player", playerId: p.id });
          // Edits run out (TOO_MANY_EDITS): the clock ends WRITING.
          if (!bad && log[log.length - 1]?.error === "TOO_MANY_EDITS") bad = tickTo(s.deadline ?? now);
          break;
        }
        case "VOTING": {
          if (chance(rng, rate.hide) && s.options.length > 2) {
            bad = intent({ type: "HIDE_OPTION", optionId: (pick(rng, s.options) as { id: string }).id }, hostActor);
            break;
          }
          const voters = actors.filter((p) => p.connected && !s.spotOn[p.id]);
          const todo = voters.filter((p) => s.votes[p.id] === undefined);
          const p = pick(rng, todo.length && !chance(rng, 0.1) ? todo : voters);
          if (!p || (timers && chance(rng, 0.03))) {
            bad = tickTo(s.deadline ?? now);
            break;
          }
          const mine = new Set(s.options.filter((o) => o.authors.includes(p.id)).map((o) => o.id));
          const choices = s.options.filter((o) => !mine.has(o.id));
          const target = pick(rng, choices);
          if (!target) {
            bad = tickTo(s.deadline ?? now);
            break;
          }
          bad = chance(rng, rate.like)
            ? intent({ type: "LIKE", optionId: target.id, on: chance(rng, 0.8) }, { kind: "player", playerId: p.id })
            : intent({ type: "VOTE", optionId: target.id }, { kind: "player", playerId: p.id });
          if (!bad && todo.length === 0 && chance(rng, 0.5)) bad = tickTo(s.deadline ?? now);
          break;
        }
      }
    }
    if (!bad && timers && chance(rng, 0.02) && s.deadline !== null) bad = tickTo(s.deadline);
    if (bad) return done(bad);
  }
  // At RESULTS: the outcome exists and matches the scores.
  const out = definition.outcome(s);
  if (!out) return done("RESULTS without an outcome");
  for (const p of s.players) if (out.points[p.id] !== (p.left ? 0 : p.score)) return done(`outcome points of ${p.id}`);
  if (slotKind(s) !== "noTruth" && s.promptIndex < s.plan.length && !log.some((l) => l.action.type === "INTENT" && (l.action as { intent: BluffIntent }).intent.type === "END_GAME" && l.ok)) {
    return done(`RESULTS before the final (prompt ${s.promptIndex})`);
  }
  return done(null);
}

/**
 * The next legal intent that moves a Bluff instance toward RESULTS (room-level tests, the server test and the sim's
 * session paths): every connected player writes a distinct lie, every eligible voter votes the first option that is not
 * theirs, the host advances reveal-type phases and ends a HOLD. `null`: nothing to send, let the clock run (TICK).
 * `by: null` means the TV remote.
 */
export function bluffProgressIntent(s: BluffState): { by: string | null; i: BluffIntent } | null {
  const actors = s.players.filter((p) => !p.left && !p.waiting && p.connected);
  switch (s.phase) {
    case "ROUND_INTRO": case "REVEAL": case "SCORES": case "AWARDS":
      return { by: null, i: { type: "HOST_ADVANCE" } };
    case "HOLD":
      return { by: null, i: { type: "END_GAME" } };
    case "WRITING": {
      const p = actors.find((q) => s.lies[q.id] === undefined && !s.spotOn[q.id]);
      if (!p || !s.prompt) return null;
      const n = s.players.indexOf(p);
      return { by: p.id, i: { type: "SUBMIT_LIE", text: `${["Purple", "Sleepy", "Brave", "Tiny", "Loud", "Shy"][n % 6]} ${["goat", "moon", "uncle", "cloud", "pickle", "kettle"][Math.floor(n / 6) % 6]} number ${"abcdefghijklmnop"[s.promptIndex % 16]}${"qrstuvwxyz"[n % 10]}`, promptId: s.prompt.id } };
    }
    case "VOTING": {
      for (const p of actors) {
        if (s.spotOn[p.id] || s.votes[p.id] !== undefined) continue;
        const o = s.options.find((x) => !x.authors.includes(p.id));
        if (o) return { by: p.id, i: { type: "VOTE", optionId: o.id } };
      }
      return null;
    }
    default:
      return null;
  }
}
