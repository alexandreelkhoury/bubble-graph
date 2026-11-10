// Bluff's pause items on the TV, resolved with the ids the server's strict schema needs (pure, DOM-free; mirrors the
// native `BluffTv.pauseAction`). The /tv hide picker and `runPauseAction` live in ./hide.tsx.
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { bluffModel } from "../model";

export type PauseAction =
  | { kind: "send"; intent: { type: string; promptId?: string; optionId?: string } }
  /** "Hide an answer": open the card picker; its OK sends HIDE_OPTION with the picked card. */
  | { kind: "pickOptionToHide" }
  /** Cannot run now (wrong phase, no prompt, nothing left to skip or hide): show the item disabled. */
  | { kind: "unavailable" };

const ADVANCE = new Set(["ROUND_INTRO", "REVEAL", "SCORES", "AWARDS"]);

/** What a Bluff pause item (`GAME_META.bluff.rules.pauseItems[].intent`) does in this view. */
export function pauseAction(intent: string, view: TvRoomView): PauseAction {
  const m = bluffModel(view);
  if (!m || m.over) return { kind: "unavailable" };
  const p = m.pub;
  switch (intent) {
    case "HOST_ADVANCE": return ADVANCE.has(p.phase) ? { kind: "send", intent: { type: "HOST_ADVANCE" } } : { kind: "unavailable" };
    case "END_GAME": return p.phase === "HOLD" ? { kind: "send", intent: { type: "END_GAME" } } : { kind: "unavailable" };
    case "SKIP_PROMPT":
      return p.phase === "WRITING" && p.prompt && p.skipsLeft > 0 ? { kind: "send", intent: { type: "SKIP_PROMPT", promptId: p.prompt.id } } : { kind: "unavailable" };
    case "HIDE_OPTION":
      return p.phase === "VOTING" && p.hidesLeft > 0 && p.options.length > 2 ? { kind: "pickOptionToHide" } : { kind: "unavailable" };
    default: return { kind: "unavailable" };
  }
}
