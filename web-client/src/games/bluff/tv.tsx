// P stub (JAMAA-PLATFORM §6.1): the bluff lane (G milestone) replaces this file with the game's TV screens.
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { t } from "../../i18n/t";

export function Tv(_: { view: TvRoomView }) {
  return <div class="tvcenter"><p class="tvtitle">{t("hub.gameUnsupported")}</p></div>;
}
export function screenKey(view: TvRoomView): string {
  return view.game?.phase ?? "none";
}
