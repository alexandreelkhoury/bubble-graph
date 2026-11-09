// GAME-TRIVIA §12.6 / DESIGN-JAMAA §5.5: which sound cue a Trivia TV moment calls for (TV and /tv only; one global
// mute). Pure and unit-tested. The game's own cue ids (`trivia.slam`, `trivia.zap`, `trivia.flame`, `sting.finalQuestion`,
// `sting.podium`…) are not generated yet (no web-client/public/sounds/trivia/index.json, lane D), so every mark maps to
// its platform alias or the closest existing cue (SPEC-GAP in the G4 report).
import type { CueId, CuePlay, TimelineMark } from "../../tv-mock/sound/cues";
import { PENTATONIC, semitones } from "../../tv-mock/sound/cues";
import type { Reveal, TriviaPub } from "./model";
import { REVEAL_STEPS } from "./layout";

/** `answer_lock` (= `trivia.buzz`) at most once per 120 ms, and at most 3 per broadcast (§5.4). */
export const LOCK_GAP_MS = 120;

/** Cues for one broadcast (phase changes and answer locks). Reveal, board and podium play their own timelines. */
export function viewCues(prev: TriviaPub | null, next: TriviaPub): CuePlay[] {
  if (!prev) return [];
  const out: CuePlay[] = [];
  const changed = prev.phase !== next.phase || prev.index !== next.index;
  if (changed) {
    switch (next.phase) {
      case "QUIZ_INTRO": out.push({ cue: "world_trivia_sting" }); break;
      // The question card slams in (`trivia.slam`): the stamp's thud when it lands (~150 ms into the 400 ms overshoot).
      case "READ": out.push({ cue: "sfx.stamp", delayMs: 150 }); break;
      // Tiles flip A→D, 90 ms apart (`trivia.tileFlip`).
      case "ANSWER": for (let i = 0; i < next.options.length; i++) out.push({ cue: "sfx.flip", delayMs: 90 * i, rate: semitones(PENTATONIC[5 + i]!) }); break;
      // `sting.finalQuestion`: a drum build, then the ×2 stamp.
      case "FINAL_INTRO": out.push({ cue: "sfx.drumroll" }, { cue: "sfx.stamp", delayMs: 1250 }); break;
      case "HOLD": out.push({ cue: "sfx.leave" }); break;
      default: break;
    }
    return out;
  }
  if (next.phase === "ANSWER") {
    const fresh = next.answeredIds.filter((id) => !prev.answeredIds.includes(id)).length;
    for (let i = 0; i < Math.min(fresh, 3); i++) out.push({ cue: "answer_lock", delayMs: LOCK_GAP_MS * i, rate: semitones(PENTATONIC[(prev.answeredIds.length + i) % 6 + 5]!) });
  }
  return out;
}

/** ANSWER's last 5 s: a tick per second (the bulbs pulse amber with it), the horn at 0 (`trivia.timeUp`). */
export function answerTickCue(prevMs: number | null, nowMs: number): CueId | null {
  if (prevMs === null || nowMs >= prevMs || prevMs - nowMs > 1000) return null;
  const crossed = (s: number): boolean => prevMs > s * 1000 && nowMs <= s * 1000;
  if (crossed(0)) return "sfx.timeUp";
  for (const s of [5, 4, 3, 2, 1]) if (crossed(s)) return s === 1 ? "sfx.tickLast" : "sfx.tick";
  return null;
}

const at = (id: string): number => REVEAL_STEPS.find((s) => s.id === id)!.startMs;

/**
 * The reveal script's cues (§12.3, DESIGN-JAMAA §5.4): right answer `quiz_correct` (never a per-player "wrong" sound;
 * Stumped / Too slow play `quiz_wrong`), landings tick up, the zap, coins and the counter, the new leader's crown.
 */
export function revealMarks(r: Reveal, corrects: number, leaderChanged: boolean): TimelineMark[] {
  const marks: TimelineMark[] = [];
  if (r.voided) return [{ at: 0, cue: "sfx.leave" }];
  marks.push({ at: at("out"), cue: r.stumped || r.tooSlow ? "quiz_wrong" : "quiz_correct" });
  const jumpers = r.choices.filter((c) => c.choice !== null).length;
  for (let i = 0; i < Math.min(jumpers, 6); i++) marks.push({ at: at("jump") + 300 + 60 * i * 2, cue: "coin_land", rate: 0.8 * semitones(PENTATONIC[2 + i]!) });
  if (r.fastestIds.length > 0) marks.push({ at: at("bolt"), cue: "reaction_pop", rate: 1.5 });
  if (corrects > 0) {
    marks.push({ at: at("coin"), cue: "coin_fly" });
    for (let i = 0; i < Math.min(corrects, 10); i++) marks.push({ at: at("coin") + 450 + 70 * i, cue: "coin_land", rate: semitones(PENTATONIC[Math.min(PENTATONIC.length - 1, 5 + i)]!) });
    marks.push({ at: at("counter"), cue: "counter_tick" });
  }
  if (r.onFireIds.length > 0) marks.push({ at: at("coin") + 200, cue: "cup_star", rate: 0.75 });
  if (r.genius) marks.push({ at: at("bolt") + 300, cue: "sfx.allReady" });
  if (leaderChanged) marks.push({ at: at("sort") + 300, cue: "crown_drop" });
  return marks.sort((a, b) => a.at - b.at);
}

/** LEADERBOARD race and RESULTS podium marks. */
export const BOARD_MARKS: readonly TimelineMark[] = [{ at: 200, cue: "counter_tick" }, { at: 1500, cue: "sfx.chipLand" }, { at: 2100, cue: "crown_drop" }];
export const PODIUM_MARKS: readonly TimelineMark[] = [
  { at: 0, cue: "sfx.drumroll" }, { at: 700, cue: "coin_land", rate: 0.84 }, { at: 1100, cue: "coin_land", rate: 1 },
  { at: 1550, cue: "coin_land", rate: 1.26 }, { at: 1900, cue: "crown_drop" }, { at: 2300, cue: "cup_star" },
];
/** QUIZ_INTRO: `cup_star` pitched up per filled star (DESIGN-JAMAA §5.4), 150 ms apart after the card lands. */
export function introMarks(stars: number): TimelineMark[] {
  return Array.from({ length: stars }, (_, i) => ({ at: 450 + 150 * i, cue: "cup_star" as CueId, rate: semitones(PENTATONIC[5 + 2 * i]!) }));
}
