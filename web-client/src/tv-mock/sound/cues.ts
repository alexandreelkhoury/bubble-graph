// Sound cues (DESIGN §6.4), pure: which cue a view change, a deadline or a reveal timeline calls for.
// Mirrored in Kotlin (tv-app game/SoundCues.kt); the files come from tools/gen-sounds.
import type { DeadlineKind, Role } from "@mishana/shared/engine";
import type { TvView } from "@mishana/shared/protocol";

export const CUE_IDS = [
  "sfx.join", "sfx.leave", "sfx.ready", "sfx.allReady", "sfx.turn", "sfx.tick", "sfx.tickLast", "sfx.timeUp",
  "sfx.voteCast", "sfx.drumroll", "sfx.chipLand", "sfx.stamp", "sfx.flip", "sfx.heartbeat", "sfx.wheel", "sfx.error",
  "sting.civilian", "sting.mole", "sting.blank", "sting.correct", "sting.wrong", "sting.winCivilians", "sting.winInfiltrators",
  "ui.move", "ui.select", "ui.back",
] as const;
export type CueId = (typeof CUE_IDS)[number];
export type Bus = "sfx" | "sting" | "ui";

export function busOf(cue: CueId): Bus {
  return cue.startsWith("sting.") ? "sting" : cue.startsWith("ui.") ? "ui" : "sfx";
}

/** `sfx.allReady` → `sfx_all_ready` (tools/gen-sounds fileName). */
export function cueFile(cue: CueId): string {
  return cue.replace(/\./g, "_").replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
}

/** A cue to play, optionally pitch-shifted (playback rate) and delayed. */
export interface CuePlay { cue: CueId; rate?: number; delayMs?: number }

/** Two octaves of a major pentatonic around the recorded pitch, within the 0.5–2× SoundPool rate range. */
export const PENTATONIC = [-12, -10, -8, -5, -3, 0, 2, 4, 7, 9, 12] as const;
export const semitones = (n: number): number => Math.pow(2, n / 12);

/** `sfx.join` pitch by seat: a full lobby plays a chord. */
export function joinRate(seat: number): number {
  return semitones(PENTATONIC[((seat % PENTATONIC.length) + PENTATONIC.length) % PENTATONIC.length]!);
}
/** `sfx.turn`: a different pitch each turn (position in the speaking order). */
export function turnRate(index: number): number {
  return semitones(PENTATONIC[5 + (Math.max(0, index) % 5)]!);
}
/** `sfx.chipLand`: rises with the target's tally (1, 2, 3…). */
export function chipRate(tally: number): number {
  return semitones(PENTATONIC[Math.min(PENTATONIC.length - 1, 4 + Math.max(1, tally))]!);
}

export const ROLE_STING: Record<Role, CueId> = { CIVILIAN: "sting.civilian", UNDERCOVER: "sting.mole", BLANK: "sting.blank" };

const CLUE_PHASES = new Set(["CLUES", "TIE_BREAK"]);

/** Cues for one view change (the server's broadcasts, in order). The ELIMINATION reveal plays its own timeline. */
export function viewCues(prev: TvView | null, next: TvView): CuePlay[] {
  if (!prev) return [];
  const out: CuePlay[] = [];
  if (prev.phase === "LOBBY" && next.phase === "LOBBY") {
    const was = new Map(prev.players.filter((p) => !p.left).map((p) => [p.id, p]));
    const now = new Map(next.players.filter((p) => !p.left).map((p) => [p.id, p]));
    let i = 0;
    for (const [id, p] of now) if (!was.has(id)) out.push({ cue: "sfx.join", rate: joinRate(p.seat), delayMs: 90 * i++ });
    for (const id of was.keys()) if (!now.has(id)) { out.push({ cue: "sfx.leave" }); break; }
    return out;
  }
  if (prev.phase === "LOBBY" && next.phase === "ROLE_REVEAL") return [{ cue: "sfx.flip" }];
  if (prev.gameNumber !== next.gameNumber) return out;

  // In-game LEAVE / KICK (a forfeit reveals the role).
  if (next.history.slice(prev.history.length).some((h) => h.cause === "LEAVE" || h.cause === "KICK")) out.push({ cue: "sfx.leave" });

  if (prev.phase === "ROLE_REVEAL" && next.phase === "ROLE_REVEAL") {
    const ready = next.players.filter((p) => p.ready && !prev.players.find((q) => q.id === p.id)?.ready).length;
    for (let i = 0; i < Math.min(ready, 3); i++) out.push({ cue: "sfx.ready", delayMs: 80 * i });
  }

  const speakerChanged = next.currentSpeakerId !== null && (next.currentSpeakerId !== prev.currentSpeakerId || next.phase !== prev.phase || next.round !== prev.round);
  if (prev.phase === "ROLE_REVEAL" && next.phase === "CLUES") out.push({ cue: "sfx.allReady" });
  if (prev.phase === "VOTING" && next.phase === "TIE_BREAK") out.push({ cue: "sfx.stamp" });
  if (CLUE_PHASES.has(next.phase) && speakerChanged) {
    const delayMs = prev.phase === "ROLE_REVEAL" || prev.phase === "VOTING" ? 550 : 0;
    out.push({ cue: "sfx.turn", rate: turnRate(next.speakingOrder.indexOf(next.currentSpeakerId!)), delayMs });
  }

  if (prev.phase === "VOTING" && next.phase === "VOTING" && prev.round === next.round && next.votesCast > prev.votesCast) {
    for (let i = 0; i < Math.min(next.votesCast - prev.votesCast, 3); i++) out.push({ cue: "sfx.voteCast", delayMs: 90 * i });
  }

  if (next.phase === "MR_WHITE_GUESS" && next.guess && prev.guess?.status !== next.guess.status) {
    if (next.guess.status === "CORRECT") out.push({ cue: "sting.correct" });
    else if (next.guess.status === "WRONG") out.push({ cue: "sting.wrong" });
    else if (next.guess.status === "TIMEOUT") out.push({ cue: "sfx.timeUp" });
  }

  if (prev.phase !== "RESULTS" && next.phase === "RESULTS" && next.result) {
    out.push({ cue: next.result.winner === "CIVILIANS" ? "sting.winCivilians" : "sting.winInfiltrators" });
  }
  return out;
}

/** Timers that tick in their last 5 s and sound the horn at 0 (the holds between phases stay silent). */
const TICKING: ReadonlySet<DeadlineKind> = new Set(["REVEAL", "CLUE", "VOTE"]);
/** The Blank's guess: a heartbeat every 2 s for the last 10 s, then every second (DESIGN §6.2-D). */
const HEARTBEATS = [10, 8, 6, 5, 4, 3, 2, 1];

/**
 * The cue for a countdown sampled at `prevMs` then `nowMs` remaining (ms on the server clock), or null.
 * Only a crossing between two close samples counts, so a late mount or a long stall never plays a stale tick.
 */
export function deadlineCue(kind: DeadlineKind, prevMs: number | null, nowMs: number): CueId | null {
  if (prevMs === null || nowMs >= prevMs || prevMs - nowMs > 1000) return null;
  const crossed = (s: number): boolean => prevMs > s * 1000 && nowMs <= s * 1000;
  if (TICKING.has(kind)) {
    if (crossed(0)) return "sfx.timeUp";
    if (crossed(1)) return "sfx.tickLast";
    for (const s of [5, 4, 3, 2]) if (crossed(s)) return "sfx.tick";
    return null;
  }
  if (kind === "GUESS") return HEARTBEATS.some(crossed) ? "sfx.heartbeat" : null;
  return null;
}

/** A cue placed on a local animation timeline (ms since the sequence started). */
export interface TimelineMark { at: number; cue: CueId; rate?: number }

/** How far past a mark the timeline may be and still play it: a skip (OK) jumps further, and stays silent. */
export const TIMELINE_SLACK_MS = 250;

/** Marks the timeline crossed between `prevEl` (exclusive) and `el` (inclusive), skipping ones jumped over. */
export function timelineCues(marks: readonly TimelineMark[], prevEl: number, el: number): TimelineMark[] {
  return marks.filter((m) => m.at > prevEl && m.at <= el && el - m.at <= TIMELINE_SLACK_MS);
}

/** At most one play per `gapMs` (the D-pad focus tick must stay subtle under key repeat). */
export class RateLimiter {
  private last = -Infinity;
  constructor(private readonly gapMs: number) {}
  allow(now: number): boolean {
    if (now - this.last < this.gapMs) return false;
    this.last = now;
    return true;
  }
}
