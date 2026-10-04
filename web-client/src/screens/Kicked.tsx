// PH-14 Kicked (close 4006). The host was told "They can rejoin with the code", so rejoining (a fresh session on
// the same code → PH-02 Join) is the primary action.
import { isolateLtr, t } from "../i18n/t";
import { startSession, stopSession } from "../state/session";
import { EndState } from "./RoomGone";

export function Kicked({ code }: { code: string }) {
  return (
    <EndState icon="user-x" title={t("phone.kicked")} body={t("phone.kickedBody")}
      primary={{ label: t("phone.rejoin", { code: isolateLtr(code) }), onClick: () => { stopSession(); startSession(code); } }} />
  );
}
