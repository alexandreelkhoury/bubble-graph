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
import { RoleEmblem } from "../components/Role";
import { tvAct, tvExit, tvLangOpen, tvPaused, tvPausePage, tvShop } from "./tvStore";
import { closeShop } from "./shopState";
import { billing } from "./billing";
import { refocus, useInitialFocus } from "./dpad";
import { SoundToggle } from "./sound/SoundToggle";

/** `info`: a message with a single OK (no confirm action), e.g. the mock store's notices. */
export interface DialogSpec { title: string; body?: string; confirm: string; safe?: string; danger?: boolean; info?: boolean; onConfirm(): void }
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

/** Back, innermost first: dialog → store → language list → pause sub-page → pause menu. False when nothing was open. */
export function closeTopOverlay(): boolean {
  if (tvDialog.value) { closeDialog(); return true; }
  if (tvShop.value) { closeShop(); return true; }
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
          {d.info ? (
            <button type="button" ref={safeRef} class="tvbtn tvbtn--primary" data-default-focus onClick={() => { closeDialog(); d.onConfirm(); }}>{d.confirm}</button>
          ) : (
            <>
              <button type="button" ref={safeRef} class="tvbtn" data-default-focus onClick={closeDialog}>{d.safe ?? t("common.cancel")}</button>
              <button type="button" class={`tvbtn ${d.danger ? "tvbtn--danger" : "tvbtn--primary"}`} onClick={() => { closeDialog(); d.onConfirm(); }}>{d.confirm}</button>
            </>
          )}
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
  const history = !players && view.phase === "RESULTS" && view.history.length > 0;
  return (
    <div class="tvoverlay" role="dialog" aria-modal="true" aria-label={t("tv.pauseTitle")}>
      <div class={`tvdialog tvdialog--menu${history ? " tvdialog--history" : ""}`}>
        <h2 class="tvdialog__title tvdialog__title--center">{players ? t("tv.playersTitle") : t("tv.pauseTitle")}</h2>
        {/* The menu promises no pause: say so up front (the timers keep running). */}
        {!players && <p class="tvdialog__sub">{t("tv.pauseNote")}</p>}
        {history && <History view={view} />}
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
            <SoundToggle class="tvmenu__item" />
            <button type="button" class="tvmenu__item" onClick={() => openDialog({
              title: t("tv.endGameConfirm"), body: t("tv.endGameBody"), confirm: t("tv.endGame"), safe: t("tv.keepPlaying"), danger: true,
              onConfirm: () => { tvAct({ type: "BACK_TO_LOBBY" }); closePause(); },
            })}><Icon name="door-out" />{t("tv.endGame")}</button>
            <button type="button" class="tvmenu__item" onClick={tvExit}><Icon name="x" />{t("tv.exitApp")}</button>
            {/* PAY-GAP: §5.2 puts the fake-mode test controls in the Store, which opens only in LOBBY, while §5.3 test 4
                expires Premium mid-game. The same two debug controls (plain English, fake mode only) are here too. */}
            {billing.fake && billing.hasTestTarget("premium") && (
              <button type="button" class="tvmenu__item tvmenu__item--test" data-test="expire" onClick={() => { void billing.testExpirePremium(); closePause(); }}>
                <Icon name="timer" />Expire Premium now
              </button>
            )}
            {billing.fake && billing.hasTestTarget("pack") && (
              <button type="button" class="tvmenu__item tvmenu__item--test" data-test="refund" onClick={() => { void billing.testRefundPack(); closePause(); }}>
                <Icon name="refresh" />Refund pack
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const CAUSE_ICON: Record<string, string> = { RANDOM: "dice", KICK: "user-x", LEAVE: "door-out", NONE: "x" };

/** "R1 [avatar] Ben [Mole]": who went out each round; the cause icon only when it was not a plain vote. */
function History({ view }: { view: TvView }) {
  return (
    <ol class="tvhistory" aria-label={t("history.title")}>
      {view.history.map((h, i) => {
        const hp = view.players.find((p) => p.id === h.eliminatedId);
        const cause = CAUSE_ICON[h.cause];
        return (
          <li key={i} class="tvhistory__item">
            <span class="tvhistory__round tnum">{t("round.short", { count: h.round })}</span>
            {hp ? <><Avatar color={hp.color} size={28} state="out" /><bdi class="tvhistory__name">{hp.name}</bdi></> : null}
            {h.role && <span class={`tvhistory__emb tvhistory__emb--${h.role.toLowerCase()}`}><RoleEmblem role={h.role} size={16} /></span>}
            {cause && <Icon name={cause} size={22} />}
          </li>
        );
      })}
    </ol>
  );
}
