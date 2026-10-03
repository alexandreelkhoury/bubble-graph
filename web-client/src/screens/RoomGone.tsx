// PH-14 RoomGone (4004 not found, 4010 expired, 4002 unsupported version) and the shared end-state layout.
import { t } from "../i18n/t";
import { goHome } from "../router";
import { Button } from "../components/UI";
import { Icon } from "../components/Icon";

export function EndState({ icon, title, body, primary, home = true, homeLabel }: { icon: string; title: string; body?: string; primary?: { label: string; onClick(): void }; home?: boolean; homeLabel?: string }) {
  return (
    <>
      <main class="screen screen--end">
        <span class="end__icon"><Icon name={icon} size={64} /></span>
        <h1 class="h1" tabIndex={-1}>{title}</h1>
        {body && <p class="sub">{body}</p>}
      </main>
      <footer class="actionbar">
        {primary && <Button onClick={primary.onClick}>{primary.label}</Button>}
        {home && <Button kind={primary ? "secondary" : "primary"} onClick={() => goHome()}>{homeLabel ?? t("phone.goHome")}</Button>}
      </footer>
    </>
  );
}

export function RoomGone({ closeCode, code }: { closeCode: number; code: string }) {
  if (closeCode === 4002) {
    return <EndState icon="refresh" title={t("error.unsupportedVersion")} primary={{ label: t("conn.reload"), onClick: () => location.reload() }} home={false} />;
  }
  if (closeCode === 4004) {
    return (
      <>
        <main class="screen screen--end">
          <span class="end__icon"><Icon name="info" size={64} /></span>
          <h1 class="h1" tabIndex={-1}>{t("phone.noRoom", { code: "⁦" + code + "⁩" })}</h1>
          <p class="sub">{t("error.roomNotFound")}</p>
        </main>
        <footer class="actionbar">
          <Button onClick={() => goHome(code)}>{t("phone.differentCode")}</Button>
        </footer>
      </>
    );
  }
  return <EndState icon="door-out" title={t("phone.roomGone")} body={t("phone.roomGoneBody")} />;
}
