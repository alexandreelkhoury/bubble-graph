// GAME-BLUFF §13.3 engine invariants (plus structural basics). Throws InvariantError.
import { HIDES_PER_PROMPT_MAX, LIKES_MAX, MEMORY_MAX_KEYS, PTS, SKIPS_PER_PROMPT_MAX } from "./constants";
import { ROUND_OF_KIND, ROUND_OF_TYPE } from "./catalog";
import { slotKind } from "./reduce";
import { type BluffState, PHASES } from "./state";

export class InvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvariantError";
  }
}


export function assertInvariants(s: BluffState): void {
  const fail = (n: string, msg: string): never => {
    throw new InvariantError(`bluff invariant ${n}: ${msg}`);
  };
  if (!PHASES.includes(s.phase)) fail("phase", s.phase);
  const ids = s.players.map((p) => p.id);
  if (new Set(ids).size !== ids.length) fail("players", "duplicate ids");
  for (const p of s.players) if (!Number.isInteger(p.score) || p.score < 0) fail("score", `${p.id} has ${p.score}`);
  if ((s.phase === "RESULTS") !== (s.deadline === null) && s.phase !== "HOLD") fail("deadline", `${s.phase} with deadline ${s.deadline}`);
  if (s.phase === "HOLD" && s.deadline !== null && s.deadline !== 0) fail("deadline", "HOLD with a clock");
  if (s.usedKeys.length > MEMORY_MAX_KEYS) fail("memory", "usedKeys over cap");
  if (s.skipsUsed > SKIPS_PER_PROMPT_MAX || s.hides > HIDES_PER_PROMPT_MAX) fail("limits", "skips/hides");
  if (s.promptIndex < 0 || s.promptIndex > s.plan.length) fail("promptIndex", String(s.promptIndex));
  const kind = slotKind(s);
  const inPrompt = s.phase === "WRITING" || s.phase === "VOTING" || s.phase === "REVEAL" || s.phase === "SCORES";
  if (inPrompt !== (s.prompt !== null)) fail("prompt", `${s.phase} with prompt ${s.prompt ? "set" : "null"}`);

  // 1. WRITING: no options, no reveal.
  if (s.phase === "WRITING" && (s.options.length > 0 || s.reveal !== null)) fail("1", "options or reveal in WRITING");

  const p = s.prompt;
  if (p) {
    // 7. never knownIn the content locale.
    if (p.knownIn.includes(s.locale)) fail("7", `${p.itemId} is knownIn ${s.locale}`);
    // 8. round of type matches the slot (short-pool exception), final always no_truth.
    if (kind === "noTruth" && p.type !== "no_truth") fail("8", "final is not no_truth");
    if (kind !== "noTruth" && p.type === "no_truth") fail("8", "no_truth outside the final");
    if (!p.crossRound && ROUND_OF_TYPE[p.type] !== ROUND_OF_KIND[kind]) fail("8", `${p.type} in a ${kind} slot`);
  }

  // 9. Spot on only in round-1 slots.
  if (kind !== "saying" && Object.keys(s.spotOn).length > 0) fail("9", "spotOn outside round 1");
  for (const id of Object.keys(s.spotOn)) {
    if (!s.firstSubmitDone[id]) fail("9", `${id} spot on without a first submission`);
    if (s.lies[id]) fail("9", `${id} is spot on and has a lie`);
  }

  const optIds = s.options.map((o) => o.id);
  if (new Set(optIds).size !== optIds.length) fail("4", "option ids not unique");
  for (const id of optIds) if (!/^[0-9a-f]{8}$/.test(id)) fail("4", `option id ${id}`);

  if (s.phase === "VOTING") {
    // 2.
    if (s.options.length < 2) fail("2", "fewer than 2 options");
    const truths = s.options.filter((o) => o.kind === "truth").length;
    if (kind === "noTruth" ? truths !== 0 : truths !== 1) fail("2", `${truths} truth options in ${kind}`);
    for (const o of s.options) for (const a of o.authors) if (s.spotOn[a]) fail("2", `spot-on ${a} authored an option`);
    for (const [v, oid] of Object.entries(s.votes)) {
      const o = s.options.find((q) => q.id === oid);
      if (!o) fail("2", `vote of ${v} targets a missing option`);
      if (o?.authors.includes(v)) fail("2", `${v} voted own option`);
      if (s.spotOn[v]) fail("2", `spot-on ${v} voted`);
    }
    for (const [v, ls] of Object.entries(s.likes)) {
      if (ls.length > LIKES_MAX || new Set(ls).size !== ls.length) fail("2", `${v} likes ${ls.length}`);
      for (const oid of ls) {
        const o = s.options.find((q) => q.id === oid);
        if (!o) fail("2", `like of ${v} targets a missing option`);
        if (o?.authors.includes(v)) fail("2", `${v} liked own option`);
      }
    }
  }

  // 3. points add up with the script. 6. foundWhileWriting / voided.
  if (inPrompt) {
    const moved = s.players.reduce((a, q) => a + (q.score - q.scoreBefore), 0);
    const spot = Object.keys(s.spotOn).length * PTS.SPOT_ON;
    if (s.phase === "WRITING" && moved !== 0) fail("3", "scores moved during WRITING");
    if (s.phase === "VOTING" && moved !== spot) fail("3", `VOTING moved ${moved}, spot-on ${spot}`);
    if ((s.phase === "REVEAL" || s.phase === "SCORES") && !s.voided) {
      const r = s.reveal;
      if (!r) fail("3", "no reveal");
      else {
        const sum = r.steps.reduce((a, st) => a + st.deltas.reduce((b, d) => b + d.points, 0), 0)
          + r.unpicked.reduce((a, u) => a + u.deltas.reduce((b, d) => b + d.points, 0), 0)
          + r.spotOnDeltas.reduce((a, d) => a + d.points, 0);
        if (sum !== moved) fail("3", `reveal sums ${sum}, scores moved ${moved}`);
        for (const st of r.steps) {
          for (const d of st.deltas) if (d.reason === "truth" && s.foundWhileWriting[d.playerId]) fail("6", `${d.playerId} paid for the truth after a probe`);
          // 10. final: anonymous ballots.
          if (r.final && st.voterIds.length > 0) fail("10", "final voterIds");
        }
        if (r.final !== (kind === "noTruth")) fail("10", "final flag");
      }
    }
    if (s.voided && (s.reveal !== null || moved !== Object.keys(s.spotOn).length * PTS.SPOT_ON)) fail("6", "voided prompt paid");
  }
}
