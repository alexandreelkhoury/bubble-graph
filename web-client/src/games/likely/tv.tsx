// GAME-LIKELY §8 / §12 on /tv, lazy-loaded as the `tv-mock-game-likely` chunk. No focusable buttons in game (§3.2
// HUB-06): host actions are the pause-menu items ("Skip card", "Next", "End game"); OK only completes a running reveal
// or the current awards drop. Everything is drawn from the TV projection (no `me`, no ballots before REVEAL).
import "./tv/tv.css";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { likelyModel } from "./model";
import type { LikelyModel } from "./model";
import { TvHold, TvPlay } from "./tv/play";
import { TvReveal } from "./tv/reveal";
import { TvAwards, TvResults } from "./tv/awards";
import { platformCue, sfx } from "./tv/sfx";

export function Tv({ view }: { view: TvRoomView }) {
  const m = likelyModel(view);
  if (!m) return null;
  switch (m.pub.phase) {
    case "CARD":
    case "VOTING": return <TvPlay m={m} />;
    case "REVEAL": return m.pub.reveal ? <TvReveal m={m} /> : <TvPlay m={m} />;
    case "HOLD": return <TvHold m={m} />;
    case "AWARDS": return <TvAwards m={m} />;
    case "RESULTS": return <TvResults m={m} />;
    default: return null;
  }
}

/** CARD → VOTING keeps the same stage mounted (the card does not re-deal); a new card or phase group remounts. */
export function screenKey(view: TvRoomView): string {
  const m = likelyModel(view);
  if (!m) return "none";
  const p = m.pub.phase;
  const group = p === "CARD" || p === "VOTING" ? "play" : p;
  return `${m.n}:${group}:${m.pub.cardIndex}:${m.pub.card?.id ?? ""}`;
}

let last: LikelyModel | null = null;
/** One-shot sounds of a view change (the reveal and the awards play their own timeline). */
export function onTvView(_prev: TvRoomView | null, next: TvRoomView): void {
  const m = likelyModel(next);
  if (!m) { last = null; return; }
  const was = last;
  last = m;
  if (!was) return;
  if (m.pub.phase === "CARD" && (was.pub.phase !== "CARD" || was.pub.card?.id !== m.pub.card?.id)) sfx("deal");
  if (m.pub.phase === "VOTING" && was.pub.phase === "VOTING" && m.pub.votedIds.length > was.pub.votedIds.length) platformCue("sfx.voteCast");
}

/** Round 1 = the first card: the "◁ Back: menu & rules" hint stays on (§3.2 HUB-06). */
export function firstRound(view: TvRoomView): boolean {
  const m = likelyModel(view);
  return !!m && m.pub.cardIndex === 0 && (m.pub.phase === "CARD" || m.pub.phase === "VOTING" || m.pub.phase === "REVEAL");
}
