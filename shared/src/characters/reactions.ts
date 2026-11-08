// JAMAA-PLATFORM §2.3 / §3.7: every reaction IS an expression, plus an icon burst above the character for 1.5 s. Zod-free.
import type { ReactionKind } from "../room/types";
import type { Expression } from "./expressions";

export const REACTION_EXPRESSION: { readonly [R in ReactionKind]: Expression } = {
  laugh: "laugh", shock: "shock", facepalm: "facepalm", happy: "happy", sad: "sad", cheer: "cheer",
};
/** Burst ids (§3.7); the TV and the phone draw the same six icons (no emoji). */
export const REACTION_BURST: { readonly [R in ReactionKind]: string } = {
  laugh: "burst.tears", shock: "burst.exclaim", facepalm: "burst.sweat", happy: "burst.heart", sad: "burst.raincloud", cheer: "burst.confetti",
};
/** A REACT shows its expression and burst for this long, keyed by `reaction.n` so repeats replay. */
export const REACTION_HOLD_MS = 1500;
