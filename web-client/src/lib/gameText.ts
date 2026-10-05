// In-game sentences shared by the phone and the TV mock (they need the view and t(), so they live outside lib/view).
import type { PublicView } from "@mishana/shared/protocol";
import { listOf, t } from "../i18n/t";
import { playersOf } from "./view";

type TieView = Pick<PublicView, "players" | "tieCandidates" | "settings">;

/** "Re-vote: Ben or Eli. Another tie? Random pick." — says what a second tie does (settings.tieBreak). */
export function revoteLine(view: TieView): string {
  return t("vote.revoteBetween", {
    names: listOf(playersOf(view, view.tieCandidates).map((p) => p.name), "disjunction"),
    outcome: t(view.settings.tieBreak === "random" ? "settings.tieBreakRandom" : "settings.tieBreakNone"),
  });
}

/** TV-05 during TIE_BREAK: "Ben and Eli are tied. One more clue each, then a re-vote." */
export function tieLine(view: TieView): string {
  return t("tie.persist", { names: listOf(playersOf(view, view.tieCandidates).map((p) => p.name)) });
}
