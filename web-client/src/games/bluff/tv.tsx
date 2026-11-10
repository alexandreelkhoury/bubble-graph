// GAME-BLUFF §8 / §12 on /tv, lazy-loaded as the `tv-mock-game-bluff` chunk. No focusable buttons in game (§3.2
// HUB-06): host actions are the pause-menu items ("Skip prompt", "Hide an answer", "Next", "End game"); OK only
// completes a running reveal, awards drop or podium. Everything is drawn from the TV projection (no `me`; no
// authorship, kind, vote or like before REVEAL; final ballots never).
import "./tv/tv.css";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { bluffModel } from "./model";
import type { BluffModel } from "./model";
import { TvHold, TvRoundIntro, TvScores, TvVoting, TvWriting } from "./tv/play";
import { TvReveal, completeReveal } from "./tv/reveal";
import { TvAwards, TvResults } from "./tv/awards";
import { cue, sfx } from "./tv/sfx";
import { ruleParams } from "./model";
export { runPauseAction, hidePickerOpen } from "./tv/hide";
export { pauseAction } from "./tv/pause";
export type { PauseAction } from "./tv/pause";
/** The ⓘ rules copy's `{seconds}` (JAMAA-GAP: the platform RulesBody must pass it, see model.ruleParams). */
export { ruleParams };

export function Tv({ view }: { view: TvRoomView }) {
  const m = bluffModel(view);
  if (!m) return null;
  if (m.over || m.pub.phase === "RESULTS") return <TvResults m={m} />;
  switch (m.pub.phase) {
    case "ROUND_INTRO": return <TvRoundIntro m={m} />;
    case "WRITING": return <TvWriting m={m} />;
    case "VOTING": return <TvVoting m={m} />;
    case "REVEAL": return m.pub.reveal ? <TvReveal m={m} /> : <TvVoting m={m} />;
    case "SCORES": return <TvScores m={m} />;
    case "HOLD": return <TvHold m={m} />;
    case "AWARDS": return <TvAwards m={m} />;
    default: return null;
  }
}

/** A new phase, prompt or instance remounts the stage (a skip or a "Too famous!" swap deals a new prompt card). */
export function screenKey(view: TvRoomView): string {
  const m = bluffModel(view);
  if (!m) return "none";
  return `${m.n}:${m.over ? "RESULTS" : m.pub.phase}:${m.pub.promptIndex}:${m.pub.prompt?.id ?? ""}`;
}

let last: BluffModel | null = null;
/** One-shot sounds of a view change (the reveal, the awards and the podium play their own timelines). */
export function onTvView(_prev: TvRoomView | null, next: TvRoomView): void {
  const m = bluffModel(next);
  if (!m) { last = null; return; }
  const was = last;
  last = m;
  if (!was) return;
  const p = m.pub.phase, wp = was.pub.phase;
  if (p === "ROUND_INTRO" && wp !== "ROUND_INTRO" && m.pub.roundKind === "noTruth") sfx("no_truth");
  if (p === "WRITING" && wp === "WRITING" && m.pub.submittedIds.length > was.pub.submittedIds.length) sfx("envelope");
  if (p === "VOTING" && wp === "VOTING" && m.pub.votedIds.length > was.pub.votedIds.length) cue("sfx.voteCast");
  if (p === "VOTING" && wp === "VOTING" && m.pub.options.length < was.pub.options.length) cue("sfx.leave");
  if (p === "SCORES" && wp !== "SCORES" && !m.pub.voided) cue("counter_tick");
}

/** OK in game: completes the running reveal (the platform's choreography rule already covers it; this is the hook). */
export function onOk(): boolean {
  return completeReveal();
}

/** Round 1 keeps the "◁ Back: menu & rules" hint on (§3.2 HUB-06). */
export function firstRound(view: TvRoomView): boolean {
  const m = bluffModel(view);
  return !!m && m.pub.round === 1 && !m.over;
}
