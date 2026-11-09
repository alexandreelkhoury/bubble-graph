// GAME-LIKELY §12.6 sounds on /tv. The platform player only knows the platform cue ids (tv-mock/sound/cues.ts is not
// this lane's file), so Most Likely's own cues (tools/gen-sounds → public/sounds/likely/likely_*.ogg) play through
// small cached HTMLAudioElements here, under the same per-device mute. Platform cues go through `soundCue`.
import { soundMuted } from "../../../tv-mock/sound/player";
import { soundCue } from "../../../tv-mock/sound/controller";
import type { CueId } from "../../../tv-mock/sound/cues";

export type LikelyCue = "deal" | "tok" | "spot" | "rosette" | "confetti" | "scramble" | "ballot" | "puff" | "glint";

const pool = new Map<LikelyCue, HTMLAudioElement[]>();

/** Plays a Most Likely cue (`rate` = playback rate: the conga "tok" rises with the line length). */
export function sfx(cue: LikelyCue, rate = 1): void {
  if (soundMuted.value || typeof Audio === "undefined") return;
  try {
    let list = pool.get(cue);
    if (!list) pool.set(cue, (list = []));
    let a = list.find((x) => x.paused || x.ended);
    if (!a) {
      if (list.length >= 4) return;
      a = new Audio(`${import.meta.env.BASE_URL}sounds/likely/likely_${cue}.ogg`);
      a.preload = "auto";
      list.push(a);
    }
    a.playbackRate = rate;
    a.currentTime = 0;
    void a.play().catch(() => undefined);
  } catch {
    /* sound is never required: every cue has a visual counterpart */
  }
}

/** A platform cue (coin_fly, counter_tick, sfx.drumroll, …). */
export function platformCue(cue: CueId): void {
  soundCue(cue);
}

/** Pentatonic playback rates for a rising line (≤ 10 steps). */
export function riseRate(step: number): number {
  const semis = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21][Math.min(9, Math.max(0, step))]!;
  return Math.pow(2, semis / 12);
}
