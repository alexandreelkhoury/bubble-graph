// Taqriban's own cues (tools/gen-sounds → public/sounds/taqriban/taqriban_*.ogg), under the per-device mute. Shared by
// the DOM /tv (tv.tsx) and the Pixi TV (tv-pixi/taqriban.ts).
import { soundMuted } from "../../../tv-mock/sound/player";

export type TaqCue = "drop" | "pin" | "closest";

/** The pitch of the `i`-th dropped guess: up a semitone each, capped at 9. */
export const dropRate = (i: number): number => Math.pow(2, Math.min(i, 9) / 12);

export function sfx(cue: TaqCue, rate = 1): void {
  if (soundMuted.value || typeof Audio === "undefined") return;
  try {
    const a = new Audio(`${import.meta.env.BASE_URL}sounds/taqriban/taqriban_${cue}.ogg`);
    a.playbackRate = rate;
    void a.play().catch(() => undefined);
  } catch {
    /* sound is never required: every cue has a visual counterpart */
  }
}
