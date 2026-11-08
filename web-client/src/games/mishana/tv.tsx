// JAMAA-PLATFORM §3.2 / §6.4: Mish Ana!'s /tv screens, lazy-loaded as the `tv-mock-game-mishana` chunk. The platform
// canvas wraps them (entrance, pause menu with "Skip", rules sheet, back hint, results bar with the cup).
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { mishanaTvView } from "./view";
import type { TvView } from "./view";
import { TvClues, TvRoleReveal, TvVoting } from "./tv/tvGame";
import { TvElimination } from "./tv/tvElimination";
import { TvGuess, TvResults } from "./tv/tvResults";
import { soundOnView } from "../../tv-mock/sound/controller";

export function Tv({ view }: { view: TvRoomView }) {
  const v = mishanaTvView(view);
  if (!v) return null;
  switch (v.phase) {
    case "ROLE_REVEAL": return <TvRoleReveal view={v} />;
    case "CLUES":
    case "TIE_BREAK": return <TvClues view={v} />;
    case "VOTING": return <TvVoting view={v} />;
    case "ELIMINATION": return <TvElimination view={v} />;
    case "MR_WHITE_GUESS": return <TvGuess view={v} />;
    case "RESULTS": return <TvResults view={v} />;
    default: return null;
  }
}

export function screenKey(view: TvRoomView): string {
  const v = mishanaTvView(view);
  return v ? `${v.phase}:${v.round}:${v.gameNumber}` : "none";
}

let last: TvView | null = null;
export function onTvView(_prev: TvRoomView | null, next: TvRoomView): void {
  const v = mishanaTvView(next);
  if (!v) { last = null; return; }
  soundOnView(last, v);
  last = v;
}

/** The guess override (accept / reject a Mole's guess) is a host dialog: the rules sheet closes for it (§3.6). */
export function hostDialogOpen(view: TvRoomView): boolean {
  const v = mishanaTvView(view);
  const g = v?.guess;
  return !!v && v.phase === "MR_WHITE_GUESS" && !!g && !g.overridden && (g.status === "WRONG" || g.status === "CORRECT");
}

export function firstRound(view: TvRoomView): boolean {
  const v = mishanaTvView(view);
  return !!v && v.round <= 1 && v.phase !== "RESULTS";
}
