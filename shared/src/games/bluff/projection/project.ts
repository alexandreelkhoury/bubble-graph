// GAME-BLUFF §8.1 / §13.2: per-role projections and the leak oracles (JAMAA-PLATFORM §2.10).
import { HIDES_PER_PROMPT_MAX, LIE_EDITS_MAX, SKIPS_PER_PROMPT_MAX } from "../engine/constants";
import { ROUND_OF_KIND } from "../engine/catalog";
import { hasSubmitted, multiplier, slotKind } from "../engine/reduce";
import type { BluffMe, BluffPublic, BluffState, Phase } from "../engine/state";
import { presentLie } from "../engine/text";

const REVEALED: readonly Phase[] = ["REVEAL", "SCORES"];
const seatIds = (s: BluffState, f: (id: string) => boolean): string[] => s.players.filter((p) => f(p.id)).map((p) => p.id);

export function projectPublic(s: BluffState): BluffPublic {
  const kind = slotKind(s);
  const spotOnVisible = s.phase === "VOTING" || s.phase === "REVEAL" || s.phase === "SCORES";
  const optionsVisible = s.phase === "VOTING" || s.phase === "REVEAL" || s.phase === "SCORES";
  const p = s.prompt;
  return {
    schema: s.schema,
    phase: s.phase,
    round: ROUND_OF_KIND[kind],
    roundCount: 3,
    roundKind: kind,
    promptIndex: s.promptIndex,
    promptCount: s.plan.length,
    multiplier: multiplier(s),
    deadline: s.deadline,
    prompt: p === null ? null : { id: p.id, type: p.type, original: p.original, translit: p.translit, display: p.display, lengthHint: p.lengthHint, rerun: p.rerun },
    submittedIds: s.phase === "WRITING" ? seatIds(s, (id) => hasSubmitted(s, id)) : [],
    spotOnIds: spotOnVisible ? seatIds(s, (id) => s.spotOn[id] === true) : [],
    options: optionsVisible && !s.voided ? s.options.map((o) => ({ id: o.id, text: o.text })) : [],
    votedIds: s.phase === "VOTING" ? seatIds(s, (id) => s.votedOnce[id] === true) : [],
    voided: s.voided,
    notice: s.notice,
    reveal: REVEALED.includes(s.phase) && s.reveal ? structuredClone(s.reveal) : null,
    scores: s.players.map((q) => ({ playerId: q.id, score: q.score, scoreBefore: q.scoreBefore })),
    newIds: s.players.filter((q) => q.newAtPrompt !== null && q.newAtPrompt === s.promptIndex && !q.waiting).map((q) => q.id),
    awards: s.phase === "AWARDS" || s.phase === "RESULTS" ? structuredClone(s.awards) : [],
    skipsLeft: s.phase === "WRITING" ? SKIPS_PER_PROMPT_MAX - s.skipsUsed : 0,
    hidesLeft: s.phase === "VOTING" ? HIDES_PER_PROMPT_MAX - s.hides : 0,
  };
}

export function projectMe(s: BluffState, playerId: string): BluffMe | null {
  const p = s.players.find((q) => q.id === playerId);
  if (!p) return null;
  const spot = s.spotOn[playerId] === true;
  const lie = s.lies[playerId];
  const inPrompt = s.phase === "WRITING" || s.phase === "VOTING" || s.phase === "REVEAL" || s.phase === "SCORES";
  const help = s.help[playerId];
  return {
    // A Spot-on player's text is the truth: never echoed back before REVEAL (§8.1), so myLie stays null.
    myLie: inPrompt && lie ? presentLie(lie.text, s.locale) : null,
    myLieStatus: !inPrompt ? "none" : spot ? "spotOn" : lie ? "locked" : "none",
    spotOn: inPrompt && spot,
    help: s.phase === "WRITING" && typeof help === "string" ? help : null,
    helpNone: s.phase === "WRITING" && help === null,
    myOptionIds: s.phase === "VOTING" || REVEALED.includes(s.phase) ? s.options.filter((o) => o.authors.includes(playerId)).map((o) => o.id) : [],
    myVote: s.phase === "VOTING" || REVEALED.includes(s.phase) ? (s.votes[playerId] ?? null) : null,
    myLikes: s.phase === "VOTING" || REVEALED.includes(s.phase) ? [...(s.likes[playerId] ?? [])] : [],
    foundWhileWriting: inPrompt && s.foundWhileWriting[playerId] === true,
    editsLeft: s.phase === "WRITING" && !spot ? LIE_EDITS_MAX - (s.edits[playerId] ?? 0) : 0,
    tooCloseCount: s.phase === "WRITING" ? (s.tooCloseProbes[playerId] ?? 0) : 0,
    waitingForNext: p.waiting,
  };
}

export function projectStatus(s: BluffState): { phase: string; doneIds: string[]; awaitedIds: string[] } {
  // VOTING: from votedOnce, never s.votes, so a host hide does not drop (and so expose) the hidden card's voters.
  const doneIds = s.phase === "WRITING" ? seatIds(s, (id) => hasSubmitted(s, id)) : s.phase === "VOTING" ? seatIds(s, (id) => s.votedOnce[id] === true) : [];
  const awaitedIds = s.phase === "WRITING" || s.phase === "VOTING"
    ? s.players.filter((p) => p.connected && !p.left && !p.waiting && !doneIds.includes(p.id) && !(s.phase === "VOTING" && s.spotOn[p.id])).map((p) => p.id)
    : [];
  return { phase: s.phase, doneIds, awaitedIds };
}

/** State-only keys that never appear in any view (§13.2). `spotOn` and `foundWhileWriting` are left out on purpose:
 *  they exist as the viewer's own booleans in `me`; leakCheck polices them structurally. */
export const FORBIDDEN_KEYS: readonly string[] = [
  "truthAll", "truthAlt", "houseLies", "ownHouseCount", "housePool", "lies", "authors", "votes", "votedOnce", "likes", "likeToggles", "tooCloseProbes",
  "firstSubmitDone", "firstProbe", "rngState", "usedKeys", "drawn", "records", "edits", "seq", "itemId", "packId", "truthText",
];

/** Whole-leaf secrets for the TV (viewer null) or one player's view, right now (§2.10). */
export function secretsFor(s: BluffState, viewer: string | null): string[] {
  const p = s.prompt;
  if (!p) return [];
  const own = new Set<string>();
  if (viewer !== null) {
    const l = s.lies[viewer];
    if (l) own.add(l.text).add(presentLie(l.text, s.locale));
    const h = s.help[viewer];
    if (typeof h === "string") own.add(h);
  }
  const shown = new Set<string>();
  if (s.phase === "VOTING" || REVEALED.includes(s.phase)) for (const o of s.options) shown.add(o.text);
  if (REVEALED.includes(s.phase) && s.reveal?.truth) {
    shown.add(s.reveal.truth.text);
    if (s.reveal.truth.original) shown.add(s.reveal.truth.original);
    if (s.reveal.truth.note) shown.add(s.reveal.truth.note);
  }
  const out = new Set<string>();
  const addSecret = (t: string | null | undefined): void => {
    if (t && !own.has(t) && !shown.has(t)) out.add(t);
  };
  // Before VOTING: the truth (all locales), alternatives, house lies, the note, every other lie text.
  // From VOTING: whatever is not legitimately on screen (alternatives, unused house lies, merged-away lie texts).
  for (const t of p.truthAll) addSecret(t);
  addSecret(p.truthText);
  addSecret(p.truthOriginal);
  addSecret(p.note);
  for (const h of p.houseLies) addSecret(h);
  for (const [pid, l] of Object.entries(s.lies)) if (pid !== viewer) { addSecret(l.text); addSecret(presentLie(l.text, s.locale)); }
  for (const [pid, h] of Object.entries(s.help)) if (pid !== viewer && typeof h === "string") addSecret(h);
  return [...out];
}

type Env = { public: BluffPublic; me: BluffMe | null };
function envelope(view: unknown): Env | null {
  if (view === null || typeof view !== "object") return null;
  const v = view as Record<string, unknown>;
  const g = (v.game ?? v) as Record<string, unknown> | null;
  if (!g || typeof g !== "object" || !("public" in g)) return null;
  return { public: g.public as BluffPublic, me: (g.me ?? null) as BluffMe | null };
}

function walkKeys(x: unknown, path: string[], on: (k: string, path: readonly string[]) => void): void {
  if (Array.isArray(x)) x.forEach((v, i) => walkKeys(v, [...path, String(i)], on));
  else if (x !== null && typeof x === "object") {
    for (const [k, v] of Object.entries(x)) {
      on(k, path);
      walkKeys(v, [...path, k], on);
    }
  }
}

const REVEAL_ONLY_KEYS = new Set(["authorIds", "voterIds", "likerIds", "kind", "voteCount", "foundEarlyIds", "deltas", "unpicked", "top"]);

/** Structural leak rules (§2.10, §8.1, §13.3), on the game envelope of a view ({game:{public,me}} or {public,me}). */
export function leakCheck(s: BluffState, viewer: string | null, view: unknown): string[] {
  const env = envelope(view);
  if (!env) return [];
  const errs: string[] = [];
  const pub = env.public;
  const revealed = REVEALED.includes(s.phase);
  walkKeys(pub, ["public"], (k, path) => {
    if (!revealed && REVEAL_ONLY_KEYS.has(k)) errs.push(`"${k}" at ${path.join(".")} before REVEAL`);
    if (k === "foundWhileWriting" || k === "spotOn") errs.push(`"${k}" in the public view at ${path.join(".")}`);
  });
  for (const o of pub.options) {
    const keys = Object.keys(o).sort().join(",");
    if (keys !== "id,text") errs.push(`option ${o.id} carries keys ${keys}`);
  }
  if (s.phase !== "VOTING" && !revealed && pub.options.length > 0) errs.push(`options in ${s.phase}`);
  if (s.phase === "WRITING" && pub.spotOnIds.length > 0) errs.push("spotOnIds during WRITING");
  if (s.phase === "WRITING" && pub.scores.some((x) => x.score !== x.scoreBefore)) errs.push("score moved during WRITING (Spot-on leak)");
  if (!revealed && pub.reveal !== null) errs.push("reveal before REVEAL");
  if (pub.reveal) {
    if (pub.reveal.final) {
      for (const st of pub.reveal.steps) if (st.voterIds.length > 0) errs.push(`final ballots exposed on ${st.optionId}`);
      if (pub.reveal.truth !== null) errs.push("final has a truth");
    }
  }
  if (s.voided && (pub.reveal !== null || pub.options.length > 0)) errs.push("voided prompt reveals options");
  const me = env.me;
  if (me !== null) {
    if (viewer === null) errs.push("me in a TV/spectator view");
    else {
      const ownOpts = s.options.filter((o) => o.authors.includes(viewer)).map((o) => o.id);
      for (const id of me.myOptionIds) if (!ownOpts.includes(id)) errs.push(`myOptionIds holds ${id}, not authored by ${viewer}`);
      if (me.foundWhileWriting && s.foundWhileWriting[viewer] !== true) errs.push("foundWhileWriting of someone else");
      if (me.spotOn && s.spotOn[viewer] !== true) errs.push("spotOn of someone else");
      const mine = s.votes[viewer] ?? null;
      if (me.myVote !== null && me.myVote !== mine) errs.push("myVote is not the viewer's vote");
      if (me.myLieStatus === "spotOn" && me.myLie !== null && !revealed) errs.push("Spot-on text echoed before REVEAL");
    }
    walkKeys(me, ["me"], (k, path) => {
      if (REVEAL_ONLY_KEYS.has(k)) errs.push(`"${k}" at ${path.join(".")}`);
    });
  }
  return errs;
}
