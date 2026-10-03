// TV-12 pause menu and TV-14 dialogs (elev.3, centred, 520 wide, initial focus on the safe option).
import { signal } from "@preact/signals";
import { useState } from "preact/hooks";
import type { TvView } from "@mishana/shared/protocol";
import { t } from "../i18n/t";
import { Avatar, avatarState } from "../components/PlayerChip";
import { Icon } from "../components/Icon";
import { tvPaused, tvSend } from "./tvStore";
import { useInitialFocus } from "./tvParts";

export interface DialogSpec { title: string; body?: string; confirm: string; safe?: string; danger?: boolean; onConfirm(): void }
export const tvDialog = signal<DialogSpec | null>(null);
export function openDialog(d: DialogSpec): void { tvDialog.value = d; }
export function closeDialog(): void { tvDialog.value = null; }

export function TvDialog() {
  const d = tvDialog.value;
  const safeRef = useInitialFocus<HTMLButtonElement>(d);
  if (!d) return null;
  return (
    <div class="tvoverlay" role="dialog" aria-modal="true" aria-label={d.title}>
      <div class="tvdialog">
        <h2 class="tvdialog__title">{d.title}</h2>
        {d.body && <p class="tvdialog__body">{d.body}</p>}
        <div class="tvdialog__actions">
          <button type="button" ref={safeRef} class="tvbtn" onClick={closeDialog}>{d.safe ?? t("common.cancel")}</button>
          <button type="button" class={`tvbtn ${d.danger ? "tvbtn--danger" : "tvbtn--primary"}`} onClick={() => { closeDialog(); d.onConfirm(); }}>{d.confirm}</button>
        </div>
      </div>
    </div>
  );
}

export function PauseMenu({ view }: { view: TvView }) {
  const [players, setPlayers] = useState(false);
  const resumeRef = useInitialFocus<HTMLButtonElement>(players);
  const close = (): void => { tvPaused.value = false; };
  const kickable = view.players.filter((p) => !p.left);
  return (
    <div class="tvoverlay" role="dialog" aria-modal="true" aria-label={t("tv.pauseTitle")}>
      <div class="tvdialog tvdialog--menu">
        <h2 class="tvdialog__title tvdialog__title--center">{players ? t("tv.players") : t("tv.pauseTitle")}</h2>
        {players ? (
          <div class="tvmenu">
            <button type="button" ref={resumeRef} class="tvmenu__item" onClick={() => setPlayers(false)}><Icon name="chevron-back" />{t("common.back")}</button>
            {kickable.map((p) => (
              <button key={p.id} type="button" class="tvmenu__item tvmenu__item--player" onClick={() => openDialog({
                title: t("lobby.kickConfirm", { name: "⁨" + p.name + "⁩" }), body: t("lobby.kickBody"), confirm: t("lobby.kick"), danger: true,
                onConfirm: () => tvSend({ type: "KICK", playerId: p.id }),
              })}>
                <Avatar color={p.color} size={32} state={avatarState(p)} role={p.revealedRole} />
                <bdi>{p.name}</bdi>
                <Icon name="user-x" class="tvmenu__end" />
              </button>
            ))}
          </div>
        ) : (
          <div class="tvmenu">
            <button type="button" ref={resumeRef} class="tvmenu__item" onClick={close}><Icon name="play" />{t("tv.resume")}</button>
            {view.phase !== "RESULTS" && <button type="button" class="tvmenu__item" onClick={() => { tvSend({ type: "HOST_ADVANCE" }); close(); }}><Icon name="arrow-forward" />{t("tv.skip")}</button>}
            <button type="button" class="tvmenu__item" onClick={() => setPlayers(true)}><Icon name="users" />{t("tv.players")}</button>
            <button type="button" class="tvmenu__item" onClick={() => openDialog({
              title: t("tv.endGameConfirm"), body: t("tv.endGameBody"), confirm: t("tv.endGame"), safe: t("tv.keepPlaying"), danger: true,
              onConfirm: () => { tvSend({ type: "BACK_TO_LOBBY" }); close(); },
            })}><Icon name="door-out" />{t("tv.endGame")}</button>
            <button type="button" class="tvmenu__item" onClick={() => { close(); location.assign("/"); }}><Icon name="x" />{t("tv.exitApp")}</button>
          </div>
        )}
        <p class="tvdialog__note">{t("tv.pauseNote")}</p>
      </div>
    </div>
  );
}
