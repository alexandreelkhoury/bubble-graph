// P stub (JAMAA-PLATFORM §6.1): the trivia lane (G milestone) replaces this file with the game's phone screens.
import type { PlayerRoomView } from "@jamaa/shared/protocol/v2";
import { t } from "../../i18n/t";

export function Phone(_: { view: PlayerRoomView }) {
  return <main class="screen screen--center"><p class="lead">{t("hub.gameUnsupported")}</p></main>;
}
export function screenKey(view: PlayerRoomView): string {
  return view.game?.phase ?? "none";
}
