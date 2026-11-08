// JAMAA-PLATFORM §3.3 PHH-04: Mish Ana!'s phone screens, lazy-loaded as the `game-mishana` chunk. The platform shell
// (top bar, ⓘ, coach marks, results cup panel, benched view) wraps whatever this module renders.
import type { PlayerRoomView } from "@jamaa/shared/protocol/v2";
import { isolate, t } from "../../i18n/t";
import { announce, pushToast } from "../../state/store";
import { HAPTIC, haptic } from "../../lib/haptics";
import { PHASE_KEY, ROLE_KEY } from "../../lib/keys";
import { ms } from "../../lib/motion";
import { mishanaPlayerView } from "./view";
import type { PlayerView } from "./view";
import { newForfeits, TV_VERDICT_MS } from "./lib";
import { Reveal } from "./phone/Reveal";
import { Clues } from "./phone/Clues";
import { Vote } from "./phone/Vote";
import { Elimination } from "./phone/Elimination";
import { Guess } from "./phone/Guess";
import { Results } from "./phone/Results";

/** A key that changes whenever the screen should reset (scroll to top, remount). */
export function screenKey(v: PlayerRoomView): string {
  const m = mishanaPlayerView(v);
  if (!m) return "none";
  const myId = m.me?.id ?? null;
  const p = m.players.find((x) => x.id === myId);
  const turn = (m.phase === "CLUES" || m.phase === "TIE_BREAK") && m.currentSpeakerId === myId;
  return `${m.phase}:${m.gameNumber}:${m.round}:${turn ? "turn" : ""}:${p?.alive ? "" : "out"}:${m.me?.myVote ? "voted" : ""}`;
}

/** Mish Ana!'s screen for this phone (`game.me` non-null), or null (the shell then shows the benched view). */
export function Phone({ view }: { view: PlayerRoomView }) {
  const v = mishanaPlayerView(view);
  if (!v) return null;
  const me = v.me;
  if (v.phase === "RESULTS") return <Results view={v} me={me} />;
  if (v.phase === "ELIMINATION") return <Elimination view={v} me={me} />;
  if (v.phase === "MR_WHITE_GUESS") return <Guess view={v} me={me} />;
  if (!me) return null;
  switch (v.phase) {
    case "ROLE_REVEAL": return <Reveal view={v} me={me} />;
    case "CLUES":
    case "TIE_BREAK": return <Clues view={v} me={me} />;
    case "VOTING": return <Vote view={v} me={me} />;
    default: return null;
  }
}

/** One-shot effects of a view change (haptics, announcements, forfeit toasts): the v1 onViewChange, game part. */
export function onPhoneView(prevRoom: PlayerRoomView | null, nextRoom: PlayerRoomView): void {
  const next = mishanaPlayerView(nextRoom);
  if (!next) return;
  const prev: PlayerView | null = prevRoom ? mishanaPlayerView(prevRoom) : null;
  if (prev && prev.phase !== next.phase) announce(t(PHASE_KEY[next.phase]));
  const myId = next.me?.id ?? null;
  if (!myId) return;
  const isTurn = (v: PlayerView | null): boolean => v?.currentSpeakerId === myId && (v.phase === "CLUES" || v.phase === "TIE_BREAK");
  if (isTurn(next) && !isTurn(prev)) {
    haptic(HAPTIC.yourTurn);
    announce(t("clues.yourTurn"), true);
  }
  const nextUp = (v: PlayerView | null): boolean => {
    if (!v || !(v.phase === "CLUES" || v.phase === "TIE_BREAK") || v.currentSpeakerId === null) return false;
    const i = v.speakingOrder.indexOf(v.currentSpeakerId);
    return i >= 0 && v.speakingOrder[i + 1] === myId;
  };
  if (nextUp(next) && !nextUp(prev)) haptic(HAPTIC.nextUp);
  const meP = next.players.find((p) => p.id === myId);
  const meWas = prev?.players.find((p) => p.id === myId);
  if (meP && meWas && meWas.alive && !meP.alive) {
    // A vote-out waits for the TV's OUT stamp: buzzing on the table at t = 0 would give the verdict away.
    const out = (): void => { haptic(HAPTIC.eliminated); announce(t("elim.you"), true); };
    if (next.phase === "ELIMINATION") setTimeout(out, ms(TV_VERDICT_MS)); else out();
  }
  if (prev) for (const f of newForfeits(prev, next)) pushToast(t("elim.forfeit", { name: isolate(f.player.name), role: t(ROLE_KEY[f.role]) }));
  if (next.phase === "RESULTS" && prev?.phase !== "RESULTS" && next.result?.winnerIds.includes(myId)) haptic(HAPTIC.win);
}

/** Whether this phone owes an action right now (the ⓘ sheet's "Your turn!" banner, §3.6). */
export function needsMe(view: PlayerRoomView): boolean {
  const v = mishanaPlayerView(view);
  const myId = v?.me?.id;
  if (!v || !myId) return false;
  const p = v.players.find((x) => x.id === myId);
  if (!p?.alive) return false;
  switch (v.phase) {
    case "ROLE_REVEAL": return !p.ready;
    case "CLUES":
    case "TIE_BREAK": return v.currentSpeakerId === myId;
    case "VOTING": return v.me?.myVote === null;
    case "MR_WHITE_GUESS": return v.guess?.playerId === myId && v.guess.status === "PENDING";
    default: return false;
  }
}
