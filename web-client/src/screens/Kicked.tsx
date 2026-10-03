// PH-14 Kicked (close 4006).
import { t } from "../i18n/t";
import { EndState } from "./RoomGone";

export function Kicked() {
  return <EndState icon="user-x" title={t("phone.kicked")} body={t("phone.kickedBody")} />;
}
