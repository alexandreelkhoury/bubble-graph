// TV-12 pause menu, TV-14 dialogs and the TV-02 language list: overlays (elev.3, centred) that trap the D-pad,
// open on their safe option, close with Back, and give focus back to whatever opened them.
import { signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { LOCALES } from "@mishana/shared/constants";
import type { TvView } from "@mishana/shared/protocol";
import { isolate, locale, LOCALE_NATIVE_NAME, setLocale, t } from "../i18n/t";
import { saveLocale } from "../lib/storage";
import { Avatar, avatarState } from "../components/PlayerChip";
import { Icon } from "../components/Icon";
import { tvAct, tvExit, tvLangOpen, tvPaused, tvPausePage } from "./tvStore";
import { refocus, useInitialFocus } from "./dpad";

export interface DialogSpec { title: string; body?: string; confirm: string; safe?: string; danger?: boolean; onConfirm(): void }
export const tvDialog = signal<DialogSpec | null>(null);

/** What had focus when each overlay opened (restored on close, Kotlin's InitialFocus(restore = …)). */
const openers = { dialog: null as Element | null, pause: null as Element | null, lang: null as Element | null };

export function openDialog(d: DialogSpec): void {
  openers.dialog = document.activeElement;
  tvDialog.value = d;
}
export function closeDialog(): void {
  tvDialog.value = null;
  refocus(openers.dialog);
}

export function openPause(): void {
  openers.pause = document.activeElement;
  tvPausePage.value = "menu";
  tvPaused.value = true;
}
export function closePause(): void {
  tvPaused.value = false;
  tvPausePage.value = "menu";
  refocus(openers.pause);
}

export function openLanguages(): void {
  openers.lang = document.activeElement;
  tvLangOpen.value = true;
}
export function closeLanguages(): void {
  tvLangOpen.value = false;
  refocus(openers.lang);
}

/** Back, innermost first: dialog → language list → pause sub-page → pause menu. Returns false when nothing was open. */
export function closeTopOverlay(): boolean {
  if (tvDialog.value) { closeDialog(); return true; }
  if (tvLangOpen.value) { closeLanguages(); return true; }
  if (tvPaused.value && tvPausePage.value === "players") { tvPausePage.value = "menu"; return true; }
  if (tvPaused.value) { closePause(); return true; }
  return false;
}

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
          <button type="button" ref={safeRef} class="tvbtn" data-default-focus onClick={closeDialog}>{d.safe ?? t("common.cancel")}</button>
          <button type="button" class={`tvbtn ${d.danger ? "tvbtn--danger" : "tvbtn--primary"}`} onClick={() => { closeDialog(); d.onConfirm(); }}>{d.confirm}</button>
        </div>
      </div>
    </div>
  );
}

/** TV-02 language list (Kotlin LanguagePicker): the 3 languages in their own names, focus on the current one. */
export function LanguagePicker() {
  const cur = locale.value;
  const curRef = useInitialFocus<HTMLButtonElement>();
  return (
    <div class="tvoverlay" role="dialog" aria-modal="true" aria-label={t("common.language")}>
      <div class="tvdialog tvdialog--menu">
        <h2 class="tvdialog__title tvdialog__title--center">{t("common.language")}</h2>
        <div class="tvmenu" role="listbox" aria-label={t("common.language")}>
          {LOCALES.map((l) => (
            <button key={l} type="button" role="option" aria-selected={l === cur} lang={l} ref={l === cur ? curRef : undefined}
              class={`tvmenu__item${l === cur ? " is-on" : ""}`} data-default-focus={l === cur ? true : undefined}
              onClick={() => { void setLocale(l); saveLocale(l); closeLanguages(); }}>
              <bdi>{LOCALE_NATIVE_NAME[l]}</bdi>{l === cur && <Icon name="check" size={24} class="tvmenu__end tvmenu__end--ok" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PauseMenu({ view }: { view: TvView }) {
  const page = tvPausePage.value;
  const firstRef = useRef<HTMLButtonElement>(null);
  const playersRef = useRef<HTMLButtonElement>(null);
  const prevPage = useRef(page);
  useEffect(() => {
    // Initial focus on the first item; Back from "Players…" lands on "Players…" again (Kotlin PauseMenu).
    const target = prevPage.current === "players" && page === "menu" ? playersRef : firstRef;
    prevPage.current = page;
    const id = setTimeout(() => target.current?.focus(), 30);
    return () => clearTimeout(id);
  }, [page]);
  const kickable = view.players.filter((p) => !p.left);
  const players = page === "players";
  return (
    <div class="tvoverlay" role="dialog" aria-modal="true" aria-label={t("tv.pauseTitle")}>
      <div class="tvdialog tvdialog--menu">
        <h2 class="tvdialog__title tvdialog__title--center">{players ? t("tv.playersTitle") : t("tv.pauseTitle")}</h2>
        {players ? (
          // Kotlin PlayersList: the first player is focused, Back closes the page (the Back key too) and sits last.
          <div class="tvmenu" key="players">
            {kickable.map((p, i) => (
              <button key={p.id} type="button" ref={i === 0 ? firstRef : undefined} data-default-focus={i === 0 ? true : undefined}
                class="tvmenu__item tvmenu__item--player" onClick={() => openDialog({
                  title: t("lobby.kickConfirm", { name: isolate(p.name) }), body: t("lobby.kickBody"), confirm: t("lobby.kick"), danger: true,
                  onConfirm: () => tvAct({ type: "KICK", playerId: p.id }),
                })}>
                <Avatar color={p.color} size={32} state={avatarState(p)} role={p.revealedRole} />
                <bdi class="tvmenu__name">{p.name}</bdi>
                <Icon name="user-x" class="tvmenu__end tvmenu__end--kick" />
              </button>
            ))}
            <button type="button" ref={kickable.length === 0 ? firstRef : undefined} data-default-focus={kickable.length === 0 ? true : undefined}
              class="tvmenu__item" onClick={() => { tvPausePage.value = "menu"; }}><Icon name="chevron-back" />{t("common.back")}</button>
          </div>
        ) : (
          <div class="tvmenu" key="menu">
            <button type="button" ref={firstRef} class="tvmenu__item" data-default-focus onClick={closePause}><Icon name="play" />{t("tv.resume")}</button>
            {view.phase !== "RESULTS" && <button type="button" class="tvmenu__item" onClick={() => { tvAct({ type: "HOST_ADVANCE" }); closePause(); }}><Icon name="arrow-forward" />{t("tv.skip")}</button>}
            <button type="button" ref={playersRef} class="tvmenu__item" onClick={() => { tvPausePage.value = "players"; }}><Icon name="users" />{t("tv.players")}</button>
            <button type="button" class="tvmenu__item" onClick={() => openDialog({
              title: t("tv.endGameConfirm"), body: t("tv.endGameBody"), confirm: t("tv.endGame"), safe: t("tv.keepPlaying"), danger: true,
              onConfirm: () => { tvAct({ type: "BACK_TO_LOBBY" }); closePause(); },
            })}><Icon name="door-out" />{t("tv.endGame")}</button>
            <button type="button" class="tvmenu__item" onClick={tvExit}><Icon name="x" />{t("tv.exitApp")}</button>
          </div>
        )}
        <p class="tvdialog__note">{t("tv.pauseNote")}</p>
      </div>
    </div>
  );
}
