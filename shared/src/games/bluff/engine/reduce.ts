// GAME-BLUFF §4–§7: the pure Bluff engine. No I/O, no Date.now(), no Math.random(): time comes from ctx.now and
// randomness from mulberry32 with its state in `rngState`. `reduce` never mutates its input, returns the SAME object
// when nothing changed, and returns its input state on every error (the room discards failed results, JAMAA-PLATFORM §2.6).
import type { Locale } from "../../../constants";
import type { ErrorCode } from "../../../protocol/errors";
import type { GameAction, GameActor, GameCtx, GameMemory, GameOutcome, GameReduceResult, RosterEntry } from "../../types";
import { competitionRanking } from "../../ranking";
import { BLOCKLIST } from "./blocklist";
import {
  AWARDS_BASE_MS, AWARDS_PER_CARD_MS, HIDE_MIN_REMAINING_MS, HIDES_PER_PROMPT_MAX, LIE_EDITS_MAX, LIKE_GRACE_MS, LIKES_MAX,
  MAX_PLAYERS, MEMORY_MAX_KEYS, MIN_CONNECTED, MIN_FINAL_OPTIONS, MIN_LIES, PACE_FACTOR, PTS, ROUND_INTRO_FINAL_MS,
  ROUND_INTRO_MS, SCORES_MS, SCORES_VOIDED_MS, SKIPS_PER_PROMPT_MAX, TOO_CLOSE_PROBES_MAX, WRITING_FINAL_MS, WRITING_MS,
  floor10, scaleSec, votingMs,
} from "./constants";
import {
  type BluffCatalog, type Candidate, type RoundKind, drawPrompt, hasEnoughContent, planFor,
  playableItems,
} from "./catalog";
import { type Rng, createRng, hexId, shuffleInPlace } from "./rng";
import { collides, hitsBlocklist, isTooClose } from "./similar";
import type {
  Award, BPlayer, BluffIntent, BluffSettings, BluffState, Notice, OptionState, PromptState, Reveal, RevealDelta, RevealStep,
} from "./state";
import { STATE_SCHEMA } from "./state";
import {
  LIE_MAX_CHARS, LIE_MAX_CODEPOINTS, displayNormalize, graphemes, lengthHintOf, letterCount, presentLie, sanitizeLie, scriptOk,
} from "./text";

interface X { now: number; cat: BluffCatalog; rng: Rng; isHost: (a: GameActor) => boolean }
/** null = ok; a code = error (the state is discarded: the room keeps its input). */
type Out = null | ErrorCode;

// ---------- small queries ----------

export const slotKind = (s: BluffState): RoundKind => s.plan[Math.min(s.promptIndex, s.plan.length - 1)] as RoundKind;
export const multiplier = (s: BluffState): 1 | 2 => (slotKind(s) === "fact" ? 2 : 1);
const findPlayer = (s: BluffState, id: string): BPlayer | undefined => s.players.find((p) => p.id === id);
const active = (s: BluffState): BPlayer[] => s.players.filter((p) => !p.left && !p.waiting);
const connectedActive = (s: BluffState): BPlayer[] => active(s).filter((p) => p.connected);
export const hasSubmitted = (s: BluffState, id: string): boolean => s.lies[id] !== undefined || s.spotOn[id] === true;
const connectedNonLeft = (s: BluffState): number => s.players.filter((p) => !p.left && p.connected).length;
const paceF = (s: BluffState): number => PACE_FACTOR[s.settings.pace];

function writingMs(s: BluffState): number {
  return scaleSec(slotKind(s) === "noTruth" ? WRITING_FINAL_MS : WRITING_MS, paceF(s));
}

function recordUsed(s: BluffState, itemId: string): void {
  s.drawn.push(itemId);
  s.usedKeys = [...s.usedKeys.filter((k) => k !== itemId), itemId].slice(-MEMORY_MAX_KEYS);
}

function clearPerPrompt(s: BluffState): void {
  s.lies = {}; s.edits = {}; s.tooCloseProbes = {}; s.foundWhileWriting = {}; s.spotOn = {}; s.firstSubmitDone = {};
  s.firstProbe = {}; s.help = {}; s.housePool = []; s.options = []; s.votes = {}; s.likes = {}; s.hides = 0;
  s.voided = false; s.notice = null; s.reveal = null;
}

// ---------- prompt draw ----------

const dedupe = (xs: readonly string[]): string[] => [...new Set(xs)];

export function buildPrompt(rng: Rng, cand: Candidate, locale: Locale, rerun: boolean, crossRound: boolean): PromptState {
  const { pack, item } = cand;
  const src = pack.sourceLocale;
  const truth = item.type === "no_truth" ? null : (item.truth[locale] ?? null);
  const alts = [...(item.truthAlt[locale] ?? [])];
  if (src !== locale) {
    const st = item.truth[src];
    if (st) alts.push(st);
    alts.push(...(item.truthAlt[src] ?? []));
  }
  const truthAll = truth === null ? [] : dedupe([truth, ...alts].filter((t) => t.trim().length > 0));
  const house: string[] = [];
  for (const raw of [...(item.houseLies[locale] ?? []), ...(pack.fallbackHouseLies[item.type]?.[locale] ?? [])]) {
    const h = displayNormalize(raw);
    if (h.length === 0) continue;
    if (truthAll.length > 0 && isTooClose(h, truthAll)) continue;
    if (house.some((x) => collides(x, h))) continue;
    house.push(h);
  }
  const srcTruth = src !== locale ? item.truth[src] : undefined;
  return {
    id: hexId(rng),
    itemId: item.id,
    packId: pack.id,
    type: item.type,
    knownIn: [...item.knownIn],
    crossRound,
    original: item.prompt.original,
    translit: src !== locale ? item.prompt.translit : null,
    display: src !== locale ? (item.prompt.display[locale] ?? null) : null,
    lengthHint: lengthHintOf(truth),
    rerun,
    truthText: truth === null ? null : displayNormalize(truth),
    truthOriginal: truth !== null && srcTruth ? displayNormalize(srcTruth) : null,
    truthAll,
    truthAlt: dedupe(alts).filter((t) => t !== truth),
    note: item.note[locale] ?? null,
    houseLies: house,
  };
}

/** Draws a prompt into WRITING (fresh slot, skip, "Too famous!" swap or §4.2 step 5 redraw). false: nothing drawable. */
function drawIntoWriting(s: BluffState, x: X, replacing: boolean, notice: Notice): boolean {
  const r = drawPrompt(x.rng, {
    candidates: playableItems(x.cat, s.settings.packIds, s.locale),
    slotKind: slotKind(s),
    usedKeys: s.usedKeys,
    drawn: s.drawn,
    currentId: replacing && s.prompt ? s.prompt.itemId : null,
    prevType: s.prevType,
    factRich: s.factRich,
  });
  if (r === null) return false;
  clearPerPrompt(s);
  s.prompt = buildPrompt(x.rng, r.cand, s.locale, r.rerun, r.crossRound);
  recordUsed(s, r.cand.item.id);
  s.housePool = shuffleInPlace(x.rng, [...s.prompt.houseLies]);
  s.phase = "WRITING";
  s.deadline = x.now + writingMs(s);
  s.notice = notice;
  return true;
}

// ---------- phase entries ----------

function enterRoundIntro(s: BluffState, now: number): void {
  clearPerPrompt(s);
  s.prompt = null;
  s.phase = "ROUND_INTRO";
  s.deadline = now + (slotKind(s) === "noTruth" ? ROUND_INTRO_FINAL_MS : ROUND_INTRO_MS);
}

/** Start of a prompt slot: admit waiting joiners, HOLD under 3 connected, else draw and write. */
function enterSlot(s: BluffState, x: X): void {
  for (const p of s.players) {
    if (p.waiting && !p.left) {
      p.waiting = false;
      p.newAtPrompt = s.promptIndex;
    }
  }
  clearPerPrompt(s);
  s.prompt = null;
  if (connectedNonLeft(s) < MIN_CONNECTED) {
    s.phase = "HOLD";
    s.deadline = null;
    return;
  }
  s.skipsUsed = 0;
  s.swapped = false;
  s.emptyRedraw = false;
  for (const p of s.players) p.scoreBefore = p.score;
  if (!drawIntoWriting(s, x, false, null)) enterAwards(s, x.now); // unreachable with a start-validated catalog
}

function enterAwards(s: BluffState, now: number): void {
  clearPerPrompt(s);
  s.prompt = null;
  s.awards = computeAwards(s);
  s.phase = "AWARDS";
  s.deadline = now + AWARDS_BASE_MS + AWARDS_PER_CARD_MS * s.awards.length;
}

function nextAfterScores(s: BluffState, x: X): void {
  if (s.prompt) s.prevType = s.prompt.type;
  s.promptIndex++;
  if (s.promptIndex >= s.plan.length) return enterAwards(s, x.now);
  if (s.plan[s.promptIndex] !== s.plan[s.promptIndex - 1]) return enterRoundIntro(s, x.now);
  enterSlot(s, x);
}

function checkWritingDone(s: BluffState, x: X): void {
  if (s.phase !== "WRITING") return;
  if (connectedActive(s).every((p) => hasSubmitted(s, p.id))) finishWriting(s, x);
}

function eligibleVoter(s: BluffState, p: BPlayer): boolean {
  return !p.left && !p.waiting && s.spotOn[p.id] !== true;
}

function checkVotingDone(s: BluffState, now: number): void {
  if (s.phase !== "VOTING" || s.deadline === null) return;
  const waitingFor = s.players.filter((p) => p.connected && eligibleVoter(s, p) && s.votes[p.id] === undefined);
  if (waitingFor.length === 0) s.deadline = Math.min(s.deadline, now + LIKE_GRACE_MS);
}

/** WRITING → VOTING ("build options", §4.2). */
function finishWriting(s: BluffState, x: X): void {
  const prompt = s.prompt as PromptState;
  const kind = slotKind(s);
  const lies = Object.entries(s.lies)
    .filter(([pid]) => findPlayer(s, pid)?.left === false)
    .sort((a, b) => a[1].seq - b[1].seq);
  const spotIds = s.players.filter((p) => s.spotOn[p.id]).map((p) => p.id);

  // §4.2 step 5: nobody submitted and the item has no house lie at all → redraw once.
  if (lies.length === 0 && spotIds.length === 0 && s.housePool.length === 0 && !s.emptyRedraw) {
    s.emptyRedraw = true;
    const { skipsUsed, swapped } = s;
    if (drawIntoWriting(s, x, true, null)) {
      s.emptyRedraw = true;
      s.skipsUsed = skipsUsed;
      s.swapped = swapped;
      return;
    }
  }

  // Spot-on points are applied now, before VOTING (§5.0).
  for (const id of spotIds) {
    const p = findPlayer(s, id) as BPlayer;
    p.score += PTS.SPOT_ON;
    p.stats.truthsFound++;
  }

  // Merge duplicates (§5.3): earliest text shown, every author credited.
  type Draft = { raws: string[]; opt: OptionState };
  const drafts: Draft[] = [];
  for (const [pid, l] of lies) {
    const hit = drafts.find((d) => d.raws.some((r) => collides(r, l.text)));
    if (hit) {
      hit.opt.authors.push(pid);
      hit.raws.push(l.text);
      hit.opt.helped ||= l.helped;
    } else drafts.push({ raws: [l.text], opt: { id: "", text: presentLie(l.text, s.locale), kind: "lie", authors: [pid], helped: l.helped } });
  }
  const opts: OptionState[] = drafts.map((d) => d.opt);

  const allKnew = kind === "saying" && spotIds.length > 0 && !s.players.some((p) => p.connected && eligibleVoter(s, p));
  if (!allKnew) {
    const inGame = s.players.filter((p) => !p.left && !p.waiting).length;
    let need = kind === "noTruth" ? Math.max(0, MIN_FINAL_OPTIONS - opts.length) : Math.max(MIN_LIES - opts.length, inGame <= 4 ? 1 : 0);
    const keep: string[] = [];
    while (need > 0 && s.housePool.length > 0) {
      const h = s.housePool.splice(x.rng.int(s.housePool.length), 1)[0] as string;
      if (drafts.some((d) => d.raws.some((r) => collides(r, h)))) {
        keep.push(h);                     // a player wrote it: the player's option replaces it (§4.2 step 2)
        continue;
      }
      opts.push({ id: "", text: h, kind: "house", authors: [], helped: false });
      need--;
    }
    s.housePool.push(...keep);
  }
  if (kind !== "noTruth" && prompt.truthText !== null) opts.push({ id: "", text: prompt.truthText, kind: "truth", authors: [], helped: false });

  // Canonical order before the shuffle, so order and ids never depend on submission order or player ids (§2.10).
  opts.sort((a, b) => (a.text < b.text ? -1 : a.text > b.text ? 1 : 0));
  shuffleInPlace(x.rng, opts);
  const ids = new Set<string>();
  for (const o of opts) {
    let id = hexId(x.rng);
    while (ids.has(id)) id = hexId(x.rng);
    ids.add(id);
    o.id = id;
  }
  s.options = opts;
  s.votes = {};
  s.likes = {};

  if (allKnew) {
    s.notice = "allKnew";
    return enterReveal(s, x);
  }
  if (opts.length < 2) return enterReveal(s, x);   // nothing to choose from: reveal without a vote (spec gap, GAME-BLUFF §4.2 step 5)
  s.phase = "VOTING";
  s.deadline = x.now + votingMs(opts.length, paceF(s));
  checkVotingDone(s, x.now);
}

// ---------- scoring and the reveal (§6, §12.2) ----------

export function revealDurationMs(r: Omit<Reveal, "durationMs">): number {
  const hasLikes = r.steps.some((st) => st.likerIds.length > 0) || r.unpicked.some((u) => u.likerIds.length > 0);
  const tail = (r.unpicked.length > 0 ? 2500 : 0) + (hasLikes ? 1500 : 0);
  if (r.final) return 1500 + 2800 * r.steps.length + 3000 + 2000 + tail;
  let ms = 1500 + 4500 + tail;
  for (const st of r.steps) {
    if (st.kind === "truth") continue;
    ms += st.quick ? 1200 : 3500 + 120 * st.voteCount;
  }
  return ms;
}

function enterReveal(s: BluffState, x: X): void {
  const prompt = s.prompt as PromptState;
  const final = slotKind(s) === "noTruth";
  const m = multiplier(s);
  const seatOrder = (ids: string[]): string[] => s.players.filter((p) => ids.includes(p.id)).map((p) => p.id);
  const votersOf = (oid: string): string[] => seatOrder(Object.keys(s.votes).filter((v) => s.votes[v] === oid));
  const likersOf = (oid: string): string[] => seatOrder(Object.keys(s.likes).filter((v) => (s.likes[v] ?? []).includes(oid)));
  const add = (deltas: RevealDelta[], ids: string[], pts: number, reason: RevealDelta["reason"]): void => {
    if (pts > 0) for (const id of ids) deltas.push({ playerId: id, points: pts, reason });
  };

  const lieOpts = s.options.filter((o) => o.kind === "lie");
  const maxVotes = Math.max(0, ...lieOpts.map((o) => votersOf(o.id).length));
  const stepFor = (o: OptionState): RevealStep => {
    const voters = votersOf(o.id);
    const likers = likersOf(o.id);
    const deltas: RevealDelta[] = [];
    const k = o.authors.length;
    const top = final && o.kind === "lie" && maxVotes >= 1 && voters.length === maxVotes;
    let foundEarly: string[] = [];
    if (o.kind === "lie") {
      let fooled = (final ? PTS.FINAL_VOTE : PTS.FOOLED * m) * voters.length;
      if (o.helped) fooled = Math.max(0, fooled - (final ? PTS.FINAL_HELP_FEE : PTS.HELP_FEE * m));
      add(deltas, o.authors, floor10(fooled / k), "fooled");
      add(deltas, o.authors, floor10(((final ? PTS.FINAL_LIKE : PTS.LIKE) * likers.length) / k), "like");
      if (top) add(deltas, o.authors, floor10(PTS.FINAL_TOP / k), "convincing");
    } else if (o.kind === "truth") {
      foundEarly = voters.filter((v) => s.foundWhileWriting[v]);
      add(deltas, voters.filter((v) => !s.foundWhileWriting[v]), PTS.TRUTH * m, "truth");
    }
    return {
      optionId: o.id, kind: o.kind, quick: false, text: o.text, authorIds: [...o.authors], helped: o.helped,
      voteCount: voters.length, voterIds: final ? [] : voters, likerIds: likers, foundEarlyIds: foundEarly,
      spotOnIds: o.kind === "truth" ? s.players.filter((p) => s.spotOn[p.id]).map((p) => p.id) : [], top, deltas,
    };
  };

  // Order: lies and house lies with votes, fewest first (ties: RNG order), quick hits first; the truth last.
  const voted = shuffleInPlace(x.rng, s.options.filter((o) => o.kind !== "truth" && votersOf(o.id).length > 0)).map(stepFor);
  voted.sort((a, b) => a.voteCount - b.voteCount);
  if (!final && voted.length > 5) for (const st of voted) st.quick = st.voteCount === 1;
  const steps = [...voted.filter((st) => st.quick), ...voted.filter((st) => !st.quick)];
  const truthOpt = s.options.find((o) => o.kind === "truth");
  if (truthOpt) steps.push(stepFor(truthOpt));

  const unpicked = s.options
    .filter((o) => o.kind === "lie" && votersOf(o.id).length === 0)
    .map((o) => {
      const likers = likersOf(o.id);
      const deltas: RevealDelta[] = [];
      add(deltas, o.authors, floor10(((final ? PTS.FINAL_LIKE : PTS.LIKE) * likers.length) / o.authors.length), "like");
      return { optionId: o.id, text: o.text, authorIds: [...o.authors], likerIds: likers, deltas };
    });

  // Apply (scores never go down) and collect stats.
  for (const d of [...steps.flatMap((st) => st.deltas), ...unpicked.flatMap((u) => u.deltas)]) (findPlayer(s, d.playerId) as BPlayer).score += d.points;
  for (const st of steps) {
    for (const v of votersOf(st.optionId)) {
      const p = findPlayer(s, v) as BPlayer;
      if (st.kind === "truth" && !s.foundWhileWriting[v]) p.stats.truthsFound++;
      if (st.kind !== "truth" && !final) p.stats.fooledTimes++;
    }
  }
  for (const o of lieOpts) {
    const nv = votersOf(o.id).length;
    const nl = likersOf(o.id).length;
    for (const a of o.authors) {
      const p = findPlayer(s, a) as BPlayer;
      p.stats.fooledOthers += nv;
      p.stats.likesReceived += nl;
    }
  }
  s.records.push({
    promptIndex: s.promptIndex,
    options: lieOpts.map((o) => ({ text: o.text, authorIds: [...o.authors], votes: votersOf(o.id).length, likes: likersOf(o.id).length })),
  });

  const base: Omit<Reveal, "durationMs"> = {
    final,
    steps,
    spotOnDeltas: s.players.filter((p) => s.spotOn[p.id]).map((p) => ({ playerId: p.id, points: PTS.SPOT_ON })),
    unpicked,
    truth: final || prompt.truthText === null ? null : { text: prompt.truthText, original: prompt.truthOriginal, note: prompt.note },
  };
  s.reveal = { ...base, durationMs: revealDurationMs(base) };
  s.phase = "REVEAL";
  s.deadline = x.now + s.reveal.durationMs;
}

function enterScores(s: BluffState, now: number): void {
  s.phase = "SCORES";
  s.deadline = now + (s.voided ? SCORES_VOIDED_MS : SCORES_MS);
}

// ---------- awards (§6.6) ----------

export function computeAwards(s: BluffState): Award[] {
  const live = s.players.filter((p) => !p.left);
  const out: Award[] = [];
  // Bluff of the Night
  let best: { votes: number; likes: number; promptIndex: number; text: string; authorIds: string[] }[] = [];
  for (const r of s.records) {
    for (const o of r.options) {
      if (o.votes < 2 || !o.authorIds.some((a) => live.some((p) => p.id === a))) continue;
      const c = { votes: o.votes, likes: o.likes, promptIndex: r.promptIndex, text: o.text, authorIds: o.authorIds };
      const b = best[0];
      const cmp = b === undefined ? 1 : c.votes - b.votes || c.likes - b.likes || c.promptIndex - b.promptIndex;
      if (cmp > 0) best = [c];
      else if (cmp === 0) best.push(c);
    }
  }
  const b0 = best[0];
  if (b0) {
    const ids = new Set(best.flatMap((b) => b.authorIds));
    out.push({ id: "bluffOfTheNight", playerIds: live.filter((p) => ids.has(p.id)).map((p) => p.id), value: b0.votes, text: b0.text, promptIndex: b0.promptIndex });
  }
  const byStat = (id: Award["id"], f: (p: BPlayer) => number, min: number): void => {
    const top = Math.max(0, ...live.map(f));
    if (top >= min) out.push({ id, playerIds: live.filter((p) => f(p) === top).map((p) => p.id), value: top, text: null, promptIndex: null });
  };
  byStat("lieDetector", (p) => p.stats.truthsFound, 2);
  byStat("crowdFavourite", (p) => p.stats.likesReceived, 2);
  byStat("hookLineSinker", (p) => p.stats.fooledTimes, 3);
  return out;
}

// ---------- intents ----------

function playerCheck(s: BluffState, id: string): BPlayer | ErrorCode {
  const p = findPlayer(s, id);
  if (!p) return "NOT_IN_GAME";
  if (p.left || p.waiting) return "WRONG_PHASE";
  return p;
}

function submitLie(s: BluffState, x: X, pid: string, text: string, promptId: string): Out {
  if (s.phase !== "WRITING" || !s.prompt) return "WRONG_PHASE";
  const p = playerCheck(s, pid);
  if (typeof p === "string") return p;
  if (promptId !== s.prompt.id) return "STALE_PROMPT";
  if (s.spotOn[pid]) return "WRONG_PHASE";
  if ((s.edits[pid] ?? 0) >= LIE_EDITS_MAX) return "TOO_MANY_EDITS";
  const t = sanitizeLie(typeof text === "string" ? text : "");
  if (t.length === 0) return "LIE_EMPTY";
  if (graphemes(t).length > LIE_MAX_CHARS || [...t].length > LIE_MAX_CODEPOINTS) return "LIE_TOO_LONG";
  if (letterCount(t) < 2) return "LIE_EMPTY";
  if (!scriptOk(t, s.locale)) return "LIE_WRONG_SCRIPT";
  if (hitsBlocklist(t, BLOCKLIST[s.locale])) return "LIE_BLOCKED_WORD";

  const kind = slotKind(s);
  const first = !s.firstSubmitDone[pid];
  const close = kind !== "noTruth" && isTooClose(t, s.prompt.truthAll);
  const spot = close && kind === "saying" && first;
  // §5.1: a 4th too-close attempt is refused outright (nothing is recorded, so the error leaves the state alone).
  if (close && !spot && (s.tooCloseProbes[pid] ?? 0) >= TOO_CLOSE_PROBES_MAX) return "TOO_MANY_EDITS";
  s.edits[pid] = (s.edits[pid] ?? 0) + 1;
  s.firstSubmitDone[pid] = true;
  if (spot) {
    s.spotOn[pid] = true;
    delete s.lies[pid];
    checkWritingDone(s, x);
    return null;
  }
  if (close) {
    // §5.2 anti-oracle: the probe is RECORDED (accepted), and the player learns it from me.tooCloseCount (JAMAA-GAP:
    // an error result cannot carry a state change). The previous lie, if any, stays as it was.
    s.tooCloseProbes[pid] = (s.tooCloseProbes[pid] ?? 0) + 1;
    s.foundWhileWriting[pid] = true;
    if (first) s.firstProbe[pid] = true;
    if (kind === "fact") maybeTooFamous(s, x);
    return null;
  }
  const h = s.help[pid];
  s.lies[pid] = { text: t, seq: s.seq++, helped: typeof h === "string" && collides(t, h) };
  checkWritingDone(s, x);
  return null;
}

/** §4.2 "Too famous!": ≥ 50 % of connected players (min 2) hit LIE_TOO_CLOSE on their first submission. */
function maybeTooFamous(s: BluffState, x: X): boolean {
  if (s.swapped) return false;
  const conn = connectedActive(s);
  const n = conn.filter((p) => s.firstProbe[p.id]).length;
  if (n < Math.max(2, Math.ceil(conn.length / 2))) return false;
  const { skipsUsed, emptyRedraw } = s;
  if (!drawIntoWriting(s, x, true, "tooFamous")) return false;
  s.swapped = true;
  s.skipsUsed = skipsUsed;
  s.emptyRedraw = emptyRedraw;
  return true;
}

function requestHelp(s: BluffState, x: X, pid: string, promptId: string): Out {
  if (s.phase !== "WRITING" || !s.prompt) return "WRONG_PHASE";
  const p = playerCheck(s, pid);
  if (typeof p === "string") return p;
  if (promptId !== s.prompt.id) return "STALE_PROMPT";
  if (s.spotOn[pid] || s.lies[pid] !== undefined || pid in s.help) return "WRONG_PHASE";
  s.help[pid] = s.housePool.length > 0 ? (s.housePool.splice(x.rng.int(s.housePool.length), 1)[0] as string) : null;
  return null;
}

function vote(s: BluffState, x: X, pid: string, optionId: string): Out {
  if (s.phase !== "VOTING") return "WRONG_PHASE";
  const p = playerCheck(s, pid);
  if (typeof p === "string") return p;
  if (s.spotOn[pid]) return "CANNOT_VOTE_SPOT_ON";
  const o = s.options.find((q) => q.id === optionId);
  if (!o) return "INVALID_TARGET";
  if (o.authors.includes(pid)) return "CANNOT_VOTE_OWN";
  s.votes[pid] = optionId;
  checkVotingDone(s, x.now);
  return null;
}

function like(s: BluffState, pid: string, optionId: string, on: boolean): Out {
  if (s.phase !== "VOTING") return "WRONG_PHASE";
  const p = playerCheck(s, pid);
  if (typeof p === "string") return p;
  const o = s.options.find((q) => q.id === optionId);
  if (!o) return "INVALID_TARGET";
  if (o.authors.includes(pid)) return "CANNOT_VOTE_OWN";
  const cur = s.likes[pid] ?? [];
  if (on) {
    if (cur.includes(optionId)) return null;
    if (cur.length >= LIKES_MAX) return "INVALID_TARGET";
    s.likes[pid] = [...cur, optionId];
  } else {
    if (!cur.includes(optionId)) return null;
    const next = cur.filter((c) => c !== optionId);
    if (next.length) s.likes[pid] = next;
    else delete s.likes[pid];
  }
  return null;
}

function skipPrompt(s: BluffState, x: X, promptId: string): Out {
  if (s.phase !== "WRITING" || !s.prompt) return "WRONG_PHASE";
  if (promptId !== s.prompt.id) return "STALE_PROMPT";
  if (s.skipsUsed >= SKIPS_PER_PROMPT_MAX) return "WRONG_PHASE";
  const { skipsUsed, swapped, emptyRedraw } = s;
  if (!drawIntoWriting(s, x, true, null)) return "NO_CONTENT_AVAILABLE";
  s.skipsUsed = skipsUsed + 1;
  s.swapped = swapped;
  s.emptyRedraw = emptyRedraw;
  return null;
}

function hideOption(s: BluffState, x: X, optionId: string): Out {
  if (s.phase !== "VOTING" || s.deadline === null) return "WRONG_PHASE";
  // Kind-independent checks first (§5.4): the reply never depends on what the card is.
  if (s.hides >= HIDES_PER_PROMPT_MAX || s.options.length - 1 < 2) return "CANNOT_HIDE";
  const o = s.options.find((q) => q.id === optionId);
  if (!o) return "INVALID_TARGET";
  s.hides++;
  if (o.kind === "truth") {
    s.voided = true;
    s.notice = "voided";
    s.votes = {};
    s.likes = {};
    s.reveal = null;
    enterScores(s, x.now);
    return null;
  }
  s.options = s.options.filter((q) => q.id !== optionId);
  for (const v of Object.keys(s.votes)) if (s.votes[v] === optionId) delete s.votes[v];
  for (const v of Object.keys(s.likes)) {
    const next = (s.likes[v] ?? []).filter((q) => q !== optionId);
    if (next.length) s.likes[v] = next;
    else delete s.likes[v];
  }
  if (s.deadline - x.now < HIDE_MIN_REMAINING_MS) s.deadline = x.now + HIDE_MIN_REMAINING_MS;
  checkVotingDone(s, x.now);
  return null;
}

/** Expires the current phase (deadline reached, or host HOST_ADVANCE inline). */
function expire(s: BluffState, x: X): void {
  switch (s.phase) {
    case "ROUND_INTRO": return enterSlot(s, x);
    case "WRITING": return finishWriting(s, x);
    case "VOTING": return enterReveal(s, x);
    case "REVEAL": return enterScores(s, x.now);
    case "SCORES": return nextAfterScores(s, x);
    case "AWARDS":
      s.phase = "RESULTS";
      s.deadline = null;
      return;
    case "HOLD":
      if (connectedNonLeft(s) >= MIN_CONNECTED) return enterSlot(s, x);
      s.deadline = null;
      return;
    case "RESULTS":
      s.deadline = null;
      return;
  }
}

function intent(s: BluffState, x: X, i: BluffIntent, by: GameActor): Out {
  const host = x.isHost(by);
  const pid = by.kind === "player" ? by.playerId : null;
  switch (i.type) {
    case "SUBMIT_LIE": return pid === null ? "WRONG_PHASE" : submitLie(s, x, pid, i.text, i.promptId);
    case "REQUEST_HELP": return pid === null ? "WRONG_PHASE" : requestHelp(s, x, pid, i.promptId);
    case "VOTE": return pid === null ? "WRONG_PHASE" : vote(s, x, pid, i.optionId);
    case "LIKE": return pid === null ? "WRONG_PHASE" : like(s, pid, i.optionId, i.on === true);
    case "SKIP_PROMPT": return host ? skipPrompt(s, x, i.promptId) : "NOT_HOST";
    case "HIDE_OPTION": return host ? hideOption(s, x, i.optionId) : "NOT_HOST";
    case "HOST_ADVANCE":
      if (!host) return "NOT_HOST";
      if (s.phase === "WRITING" || s.phase === "VOTING") return null;          // ignored: players are never cut off
      if (s.phase === "ROUND_INTRO" || s.phase === "REVEAL" || s.phase === "SCORES" || s.phase === "AWARDS") {
        expire(s, x);
        return null;
      }
      return "WRONG_PHASE";
    case "END_GAME":
      if (!host) return "NOT_HOST";
      if (s.phase !== "HOLD") return "WRONG_PHASE";
      enterAwards(s, x.now);
      return null;
    default:
      return "BAD_MESSAGE";
  }
}

function step(s: BluffState, a: GameAction<BluffIntent>, x: X): Out {
  switch (a.type) {
    case "INTENT": return intent(s, x, a.intent, a.by);
    case "TICK": {
      for (let guard = 0; guard < 16 && s.deadline !== null && x.now >= s.deadline; guard++) expire(s, x);
      return null;
    }
    case "PLAYER_AWAY": {
      const p = findPlayer(s, a.playerId);
      if (!p || !p.connected) return null;
      p.connected = false;
      checkWritingDone(s, x);
      checkVotingDone(s, x.now);
      return null;
    }
    case "PLAYER_BACK": {
      const p = findPlayer(s, a.playerId);
      if (!p || p.connected || p.left) return null;
      p.connected = true;
      if (s.phase === "HOLD" && connectedNonLeft(s) >= MIN_CONNECTED) enterSlot(s, x);
      return null;
    }
    case "PLAYER_GONE": {
      const p = findPlayer(s, a.playerId);
      if (!p || p.left) return null;
      p.left = true;
      p.connected = false;
      delete s.votes[p.id];
      delete s.likes[p.id];
      checkWritingDone(s, x);
      checkVotingDone(s, x.now);
      return null;
    }
  }
}

// ---------- GameDefinition entry points ----------

export function startBlocker(roster: readonly RosterEntry[], settings: BluffSettings, cat: BluffCatalog, locale: Locale): ErrorCode | null {
  if (roster.filter((r) => r.connected).length < MIN_CONNECTED) return "NOT_ENOUGH_PLAYERS";
  if (!hasEnoughContent(cat, settings.packIds, locale, settings.length)) return "NO_CONTENT_AVAILABLE";
  return null;
}

export function start(a: {
  roster: readonly RosterEntry[]; settings: BluffSettings; locale: Locale; memory: GameMemory; seed: number; now: number; graceMs: number; content: BluffCatalog;
}): GameReduceResult<BluffState> {
  const plan = planFor(a.settings.length);
  const usedKeys = a.memory.usedKeys.slice(-MEMORY_MAX_KEYS);
  const used = new Set(usedKeys);
  const unusedFacts = playableItems(a.content, a.settings.packIds, a.locale).filter((c) => c.item.type === "fact_blank" && !used.has(c.item.id)).length;
  const s: BluffState = {
    schema: STATE_SCHEMA,
    phase: "ROUND_INTRO",
    deadline: a.now + ROUND_INTRO_MS + a.graceMs,
    locale: a.locale,
    settings: { packIds: [...a.settings.packIds], length: a.settings.length, pace: a.settings.pace },
    rngState: a.seed >>> 0,
    players: [...a.roster].sort((p, q) => p.seat - q.seat).map((r) => ({
      id: r.id, seat: r.seat, locale: r.locale, connected: r.connected, left: false, waiting: false, newAtPrompt: null,
      score: 0, scoreBefore: 0, stats: { truthsFound: 0, likesReceived: 0, fooledTimes: 0, fooledOthers: 0 },
    })),
    plan,
    promptIndex: 0,
    factRich: unusedFacts >= plan.filter((k) => k === "fact").length + 2,
    prompt: null,
    prevType: null,
    skipsUsed: 0, swapped: false, emptyRedraw: false, seq: 0,
    lies: {}, edits: {}, tooCloseProbes: {}, foundWhileWriting: {}, spotOn: {}, firstSubmitDone: {}, firstProbe: {}, help: {},
    housePool: [], options: [], votes: {}, likes: {}, hides: 0, voided: false, notice: null, reveal: null, awards: [], records: [],
    usedKeys, drawn: [],
  };
  const blocked = startBlocker(a.roster, a.settings, a.content, a.locale);
  if (blocked) return { ok: false, error: blocked, state: s };
  return { ok: true, state: s };
}

export function reduce(s0: BluffState, a: GameAction<BluffIntent>, ctx: GameCtx<BluffCatalog>): GameReduceResult<BluffState> {
  if (a.type === "TICK" && (s0.deadline === null || ctx.now < s0.deadline)) return { ok: true, state: s0 };
  const s = structuredClone(s0);
  const rng = createRng(s.rngState);
  const x: X = { now: ctx.now, cat: ctx.content, rng, isHost: ctx.isHost };
  const out = step(s, a, x);
  s.rngState = rng.state;
  if (out === null) return { ok: true, state: JSON.stringify(s) === JSON.stringify(s0) ? s0 : s };
  return { ok: false, error: out, state: s0 };
}

export function join(s0: BluffState, entry: RosterEntry): GameReduceResult<BluffState> {
  if (s0.players.some((p) => p.id === entry.id)) return { ok: false, error: "ALREADY_JOINED", state: s0 };
  if (s0.players.filter((p) => !p.left).length >= MAX_PLAYERS) return { ok: false, error: "GAME_FULL", state: s0 };
  if (s0.phase === "RESULTS") return { ok: false, error: "WRONG_PHASE", state: s0 };
  const s = structuredClone(s0);
  s.players.push({
    id: entry.id, seat: entry.seat, locale: entry.locale, connected: entry.connected, left: false, waiting: true, newAtPrompt: null,
    score: 0, scoreBefore: 0, stats: { truthsFound: 0, likesReceived: 0, fooledTimes: 0, fooledOthers: 0 },
  });
  s.players.sort((p, q) => p.seat - q.seat);
  // HOLD has no clock in `join` (no ctx.now): deadline 0 asks the room for an immediate TICK, which resumes the prompt.
  if (s.phase === "HOLD" && connectedNonLeft(s) >= MIN_CONNECTED) s.deadline = 0;
  return { ok: true, state: s };
}

export const nextWakeAt = (s: BluffState): number | null => s.deadline;

export function outcome(s: BluffState): GameOutcome | null {
  if (s.phase !== "RESULTS") return null;
  const points: Record<string, number> = {};
  for (const p of s.players) points[p.id] = p.left ? 0 : p.score;
  const left = new Set(s.players.filter((p) => p.left).map((p) => p.id));
  return { points, ranking: competitionRanking(points, s.players.map((p) => p.id), left) };
}

export const memory = (s: BluffState): GameMemory => ({ usedKeys: s.usedKeys.slice(-MEMORY_MAX_KEYS) });
