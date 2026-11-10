// Bluff's TV-only view helpers (GAME-BLUFF §12, DESIGN-JAMAA §4.3): character expressions and props from the PUBLIC
// projection, waiting late joiners, the reveal's running pill totals. Kept out of model.ts so the phone's budget
// (the shared game-bluff chunk) never carries them. Zod-free and DOM-free (web-client/test/games/bluff).
import type { Expression } from "@jamaa/shared/characters";
import { activeSeats } from "./model";
import type { Beat, BluffModel, BluffPub, Mark, Reveal, RevealPlan, Seat } from "./model";


/**
 * A late joiner waiting for the next prompt (GAME-BLUFF §7.1): connected, in the game, but neither awaited nor done on
 * this prompt (lane A's projectStatus already leaves waiting players out of `awaitedIds`). Public facts only.
 */
export function isWaiting(m: BluffModel, s: Seat): boolean {
  const p = m.pub.phase;
  if ((p !== "WRITING" && p !== "VOTING") || !s.connected || s.left) return false;
  if (m.awaitedIds.includes(s.id) || m.doneIds.includes(s.id)) return false;
  if (p === "WRITING" && m.pub.submittedIds.includes(s.id)) return false;
  if (p === "VOTING" && (m.pub.spotOnIds.includes(s.id) || m.pub.votedIds.includes(s.id))) return false;
  return true;
}

/** Players this prompt counts on (the envelope box's denominator): awaited plus done, connected, not waiting. */
export function countedSeats(m: BluffModel): Seat[] {
  return activeSeats(m).filter((s) => s.connected && !isWaiting(m, s));
}

/** A character's expression outside the reveal: away → done → think → idle (DESIGN-JAMAA §4.3, GAME-BLUFF §12.4). */
export function baseExpression(m: BluffModel, s: Seat): Expression {
  if (!s.connected) return "away";
  if (isWaiting(m, s)) return "idle";
  const p = m.pub.phase;
  if (p === "WRITING") return m.pub.submittedIds.includes(s.id) ? "done" : "think";
  if (p === "VOTING") {
    if (m.pub.spotOnIds.includes(s.id)) return "happy";
    return m.pub.votedIds.includes(s.id) ? "done" : "think";
  }
  if (p === "SCORES") return s.score > s.scoreBefore ? "happy" : "idle";
  return "idle";
}

/** The prop a seated character holds (DESIGN-JAMAA §4.5): pencil while writing, envelope once in, ballot once voted. */
export function propOf(m: BluffModel, s: Seat): "pencil" | "envelope" | "ballot" | null {
  if (!s.connected || s.left || isWaiting(m, s)) return null;
  if (m.pub.phase === "WRITING") return m.pub.submittedIds.includes(s.id) ? "envelope" : "pencil";
  if (m.pub.phase === "VOTING" && m.pub.votedIds.includes(s.id)) return "ballot";
  return null;
}

// ---------------------------------------------------------------- the reveal

/** Points a beat pays to each player (the odometers roll by these): fooled/truth on their beat, convincing on the
 *  crown, likes on the like tally. Σ beats + spot-on = score − scoreBefore (GAME-BLUFF §13.3 invariant 3). */
export function beatDeltas(r: Reveal, b: Beat): Map<string, number> {
  const out = new Map<string, number>();
  const add = (id: string, p: number): void => { out.set(id, (out.get(id) ?? 0) + p); };
  if (b.kind === "likes") {
    for (const s of r.steps) for (const d of s.deltas) if (d.reason === "like") add(d.playerId, d.points);
    for (const u of r.unpicked) for (const d of u.deltas) if (d.reason === "like") add(d.playerId, d.points);
    return out;
  }
  if (b.kind === "intro" || b.kind === "twist" || b.kind === "montage") return out;
  for (const i of b.steps) {
    const s = r.steps[i];
    if (!s) continue;
    for (const d of s.deltas) {
      if (d.reason === "like") continue;
      if (b.kind === "crown" ? d.reason === "convincing" : d.reason !== "convincing") add(d.playerId, d.points);
    }
  }
  return out;
}

/** Each player's pill value at the start of every beat, and at the end (`[beats.length]`). */
export function runningScores(m: { pub: BluffPub; seats: readonly Seat[] }, plan: RevealPlan): Map<string, number>[] {
  const r = m.pub.reveal;
  const cur = new Map(m.seats.map((s) => [s.id, s.scoreBefore]));
  if (r) for (const d of r.spotOnDeltas) cur.set(d.playerId, (cur.get(d.playerId) ?? 0) + d.points);
  const out: Map<string, number>[] = [new Map(cur)];
  for (const b of plan.beats) {
    if (r) for (const [id, p] of beatDeltas(r, b)) cur.set(id, (cur.get(id) ?? 0) + p);
    out.push(new Map(cur));
  }
  return out;
}


/** Expression of a seated (or hopping) character at this point of the reveal: a function of the public reveal only. */
export function seatExpression(r: Reveal, beat: Beat, mark: Mark, s: Seat, ended: boolean): Expression {
  if (!s.connected) return "away";
  if (ended) return r.final ? "laugh" : s.score > s.scoreBefore ? "happy" : "idle";
  const step = r.steps[beat.steps[0] ?? -1];
  switch (beat.kind) {
    case "lie":
    case "quick":
      if (!step) return "idle";
      if (step.voterIds.includes(s.id)) return mark >= 2 ? (step.kind === "house" ? "shock" : "facepalm") : "think";
      if (step.authorIds.includes(s.id)) return mark >= 3 ? "smug" : "idle";
      return "idle";
    case "truth": {
      if (!step) return "idle";
      if (step.spotOnIds.includes(s.id)) return "happy";
      const nobody = step.voterIds.length === 0 && step.spotOnIds.length === 0;
      if (mark < 2) return step.voterIds.includes(s.id) ? "think" : "idle";
      if (nobody) return "shock";
      return step.voterIds.includes(s.id) ? "cheer" : "sad";
    }
    case "answer":
      return step && step.authorIds.includes(s.id) && mark >= 3 ? (step.top ? "laugh" : "smug") : "idle";
    case "crown":
      return beat.steps.some((i) => r.steps[i]?.authorIds.includes(s.id)) && mark >= 2 ? "cheer" : "idle";
    case "twist":
      return mark >= 2 ? "laugh" : "idle";
    case "montage": {
      const mine = r.unpicked.some((u) => u.authorIds.includes(s.id));
      return mine ? "sad" : "idle";
    }
    default:
      return "idle";
  }
}

