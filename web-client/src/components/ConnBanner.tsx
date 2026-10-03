// PH-16 reconnecting overlay: appears 400 ms after the socket leaves OPEN; "still trying" after 20 s.
import { useEffect, useState } from "preact/hooks";
import { conn, fatalCode } from "../state/store";
import { t } from "../i18n/t";
import { Icon } from "./Icon";
import { Button } from "./UI";

export const BANNER_DELAY_MS = 400;
export const STILL_TRYING_MS = 20_000;

export function ConnBanner() {
  const status = conn.value;
  const down = status === "reconnecting" && fatalCode.value === null;
  const [show, setShow] = useState(false);
  const [still, setStill] = useState(false);
  useEffect(() => {
    if (!down) {
      setShow(false);
      setStill(false);
      return;
    }
    const a = setTimeout(() => setShow(true), BANNER_DELAY_MS);
    const b = setTimeout(() => setStill(true), STILL_TRYING_MS);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [down]);
  if (!show) return null;
  return (
    <div class="reconnect" role="alertdialog" aria-live="assertive" aria-label={t("conn.reconnecting")}>
      <div class="reconnect__card">
        <Icon name="refresh" size={40} class="spin" />
        <p class="reconnect__title">{t("conn.reconnecting")}</p>
        <p class="reconnect__body">{still ? t("conn.stillTrying") : t("conn.seatSaved")}</p>
        {still && <Button kind="secondary" onClick={() => location.reload()}>{t("conn.reload")}</Button>}
      </div>
    </div>
  );
}
