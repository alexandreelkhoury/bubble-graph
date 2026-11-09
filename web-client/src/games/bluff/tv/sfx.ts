// GAME-BLUFF §12.6 sounds on /tv (DESIGN-JAMAA §5.5 mapping). The platform player only knows the platform cue ids
// (tv-mock/sound/cues.ts is not this lane's file), so Bluff's own cues (tools/gen-sounds → public/sounds/bluff/*.ogg)
// play through small cached HTMLAudioElements here, under the same per-device mute. Platform cues go through soundCue.
import { soundMuted } from "../../../tv-mock/sound/player";
import { soundCue } from "../../../tv-mock/sound/controller";
import type { CueId } from "../../../tv-mock/sound/cues";

export type BluffCue = "envelope" | "tok" | "stamp_lie" | "like" | "no_truth" | "award";

const pool = new Map<BluffCue, HTMLAudioElement[]>();

/** Plays a Bluff cue (`rate` = playback rate: the landing "tok" rises with each voter). */
export function sfx(cue: BluffCue, rate = 1): void {
  if (soundMuted.value || typeof Audio === "undefined") return;
  try {
    let list = pool.get(cue);
    if (!list) pool.set(cue, (list = []));
    let a = list.find((x) => x.paused || x.ended);
    if (!a) {
      if (list.length >= 4) return;
      a = new Audio(`${import.meta.env.BASE_URL}sounds/bluff/bluff_${cue}.ogg`);
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

/** A platform cue (coin_fly, coin_land, counter_tick, truth_reveal, house_got_you, sfx.drumroll, …). */
export function cue(id: CueId): void {
  soundCue(id);
}

/** Pentatonic playback rates for rising steps (≤ 10, DESIGN-JAMAA §5.1). */
export function riseRate(step: number): number {
  const semis = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21][Math.min(9, Math.max(0, step))]!;
  return Math.pow(2, semis / 12);
}
