// PH-14 Replaced (close 4005): "Use it here" reconnects with the stored resume token.
import { t } from "../i18n/t";
import { useHere } from "../state/session";
import { EndState } from "./RoomGone";

export function Replaced() {
  return <EndState icon="phone" title={t("phone.replaced")} primary={{ label: t("phone.useHere"), onClick: useHere }} />;
}
