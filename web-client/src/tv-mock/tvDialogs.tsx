// /tv overlays (JAMAA-PLATFORM §3.2): HUB-06 pause menu (Resume · the game's items · Rules · Sound · Quit game), confirm
// dialogs, a list picker, the interface-language list and the hub Settings. Every overlay traps the D-pad, opens on its
// safe option, closes with Back, and gives focus back to whatever opened it.
import { useRef } from "preact/hooks";
import { LOCALES } from "@jamaa/shared/constants";
import { GAME_IDS } from "@jamaa/shared/games/ids";
import { GAME_META } from "@jamaa/shared/games/meta";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { locale, LOCALE_NATIVE_NAME, setLocale, t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { clearHowToFlags, saveLocale } from "../lib/storage";
import { calm, setCalm } from "../lib/motion";
import { billingEnabled } from "../lib/billingFlag";
import { pushToast } from "../state/store";
import { Icon } from "../components/Icon";
import {
  tvAct, tvAdvanced, tvCupOpen, tvDialog, tvExit, tvHubSettings, tvIntro, tvLangOpen, tvPackPicker, tvPaused, tvPicker, tvRules, tvShop,
} from "./tvStore";
import type { DialogSpec, PickerSpec } from "./tvStore";
import { closeShop } from "./shopState";
import { billing } from "./billing";
import { refocus, useInitialFocus } from "./dpad";
import { SoundToggle } from "./sound/SoundToggle";
import { armGuard, clearTvIntroFlags, markTvIntroSeen } from "./tvPlatform";
import { displayInstallId } from "./roomLife";

export { tvDialog, tvPicker } from "./tvStore";
export type { DialogSpec, PickerSpec } from "./tvStore";

/** What had focus when each overlay opened (restored on close, Kotlin's InitialFocus(restore = …)). */
const openers = { dialog: null as Element | null, picker: null as Element | null, pause: null as Element | null, lang: null as Element | null, rules: null as Element | null, side: null as Element | null };

export function openDialog(d: DialogSpec): void {
  openers.dialog = document.activeElement;
  tvDialog.value = d;
}
export function closeDialog(): void {
  tvDialog.value = null;
  refocus(openers.dialog);
}
export function openPicker(p: PickerSpec): void {
  openers.picker = document.activeElement;
  tvPicker.value = p;
}
export function closePicker(): void {
  tvPicker.value = null;
  refocus(openers.picker);
}
export function openPause(): void {
  openers.pause = document.activeElement;
  tvPaused.value = true;
}
export function closePause(): void {
  tvPaused.value = false;
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
/** HUB-07: opened from the pause menu → closes straight to the game (focus as the game had it, §3.2 back stack). */
export function openRules(r: NonNullable<typeof tvRules.value>): void {
  openers.rules = r.fromPause ? openers.pause : document.activeElement;
  if (r.fromPause) tvPaused.value = false;
  tvRules.value = r;
}
export function closeRules(): void {
  tvRules.value = null;
  refocus(openers.rules);
}
/** Side sheets of the hub/setup (cup, settings, packs, advanced). */
export function rememberSideOpener(): void { openers.side = document.activeElement; }
export function closeSide(sig: { value: boolean }): void {
  sig.value = false;
  refocus(openers.side);
}

/** Back, innermost first. False when nothing was open. */
export function closeTopOverlay(): boolean {
  if (tvDialog.value) { closeDialog(); return true; }
  if (tvPicker.value) { closePicker(); return true; }
  if (tvShop.value) { closeShop(); return true; }
  if (tvLangOpen.value) { closeLanguages(); return true; }
  if (tvRules.value) { closeRules(); return true; }
  if (tvPackPicker.value) { closeSide(tvPackPicker); return true; }
  if (tvAdvanced.value) { closeSide(tvAdvanced); return true; }
  if (tvCupOpen.value) { closeSide(tvCupOpen); return true; }
  if (tvHubSettings.value) { closeSide(tvHubSettings); return true; }
  if (tvPaused.value) { closePause(); return true; }
  if (tvIntro.value) { markTvIntroSeen(tvIntro.value); tvIntro.value = null; armGuard(); return true; } // Back skips the intro
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

export function TvPicker() {
  const p = tvPicker.value;
  const first = useInitialFocus<HTMLButtonElement>(p);
  if (!p) return null;
  return (
    <div class="tvoverlay" role="dialog" aria-modal="true" aria-label={p.title}>
      <div class="tvdialog tvdialog--menu">
        <h2 class="tvdialog__title tvdialog__title--center">{p.title}</h2>
        {p.body && <p class="tvdialog__sub">{p.body}</p>}
        <div class="tvmenu">
          {p.items.map((it, i) => (
            <button key={it.id} type="button" ref={i === 0 ? first : undefined} data-default-focus={i === 0 ? true : undefined} lang={it.lang}
              class="tvmenu__item" onClick={() => { closePicker(); it.onPick(); }}><bdi>{it.label}</bdi></button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Interface language (hub Settings): the 4 languages in their own names, focus on the current one. */
export function LanguagePicker() {
  const cur = locale.value;
  const curRef = useInitialFocus<HTMLButtonElement>();
  return (
    <div class="tvoverlay" role="dialog" aria-modal="true" aria-label={t("common.language")}>
      <div class="tvdialog tvdialog--menu">
        <h2 class="tvdialog__title tvdialog__title--center">{t("settings.interfaceLanguage")}</h2>
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

/** HUB-06 (Back in game): Resume (initial focus), the game's items, Rules ⓘ, Sound, Quit game (confirm). */
export function PauseMenu({ view }: { view: TvRoomView }) {
  const firstRef = useInitialFocus<HTMLButtonElement>();
  const g = view.game;
  if (!g) return null;
  const meta = GAME_META[g.gameId];
  // On the results (outcome reached) the menu keeps Resume, Rules and Sound only (native PauseMenuModel).
  const over = g.over;
  const items = over ? [] : meta.rules.pauseItems.filter((it) => it.phases.includes(g.phase));
  const send = (intent: string): void => { tvAct({ type: "GAME", gameId: g.gameId, i: { type: intent } } as Parameters<typeof tvAct>[0]); };
  return (
    <div class="tvoverlay" role="dialog" aria-modal="true" aria-label={t("tv.pauseTitle")}>
      <div class="tvdialog tvdialog--menu">
        <h2 class="tvdialog__title tvdialog__title--center">{t("tv.pauseTitle")}</h2>
        {!over && <p class="tvdialog__sub">{t("rules.keepsRunning")}</p>}
        <div class="tvmenu">
          <button type="button" ref={firstRef} class="tvmenu__item" data-default-focus onClick={closePause}><Icon name="play" />{t("tv.resume")}</button>
          {items.map((it) => (
            <button key={it.id} type="button" class="tvmenu__item" data-pause-item={it.id} onClick={() => {
              if (it.confirm) openDialog({ title: t(it.labelKey as MessageKey), confirm: t(it.labelKey as MessageKey), onConfirm: () => { send(it.intent); closePause(); } });
              else { send(it.intent); closePause(); }
            }}><Icon name="arrow-forward" class="flip-rtl" />{t(it.labelKey as MessageKey)}</button>
          ))}
          <button type="button" class="tvmenu__item" data-pause-rules onClick={() => openRules({ id: g.gameId, hub: false, fromPause: true })}><Icon name="info" />{t("rules.title")}</button>
          <SoundToggle class="tvmenu__item" />
          {!over && <button type="button" class="tvmenu__item" data-pause-quit onClick={() => openDialog({
            title: t("tv.endGameConfirm"), body: t("tv.endGameBody"), confirm: t("tv.endGame"), safe: t("tv.keepPlaying"), danger: true,
            onConfirm: () => { tvAct({ type: "ABORT_GAME" }); closePause(); },
          })}><Icon name="door-out" />{t("tv.endGame")}</button>}
          {/* PAY-GAP: the fake-mode test controls (plain English, fake mode only) also live here, so a Pass can be
              expired mid-game (PAYMENTS-SPEC §5.3 test 4). */}
          {billing.fake && billing.hasTestTarget("premium") && (
            <button type="button" class="tvmenu__item tvmenu__item--test" data-test="expire" onClick={() => { void billing.testExpirePremium(); closePause(); }}>
              <Icon name="timer" />Expire Pass now
            </button>
          )}
          {billing.fake && billing.hasTestTarget("pack") && (
            <button type="button" class="tvmenu__item tvmenu__item--test" data-test="refund" onClick={() => { void billing.testRefundPack(); closePause(); }}>
              <Icon name="refresh" />Refund pack
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Hub Settings: sound, interface language, Calm animations, Show how-to again, About (install id). */
export function HubSettings() {
  const first = useInitialFocus<HTMLButtonElement>();
  const calmOn = calm.value;
  let id: string | null = null;
  try { if (billingEnabled.value) id = billing.installId(); } catch { id = null; }
  const soundRef = useRef<HTMLDivElement>(null);
  return (
    <div class="tvoverlay tvoverlay--sheet" role="dialog" aria-modal="true" aria-label={t("hub.settings")}>
      <div class="tvsheet tvsheet--end">
        <h2 class="tvsheet__title"><Icon name="settings" size={28} />{t("hub.settings")}</h2>
        <div class="tvmenu" ref={soundRef}>
          <SoundToggle class="tvmenu__item" />
          <button type="button" ref={first} class="tvmenu__item" data-default-focus onClick={openLanguages}>
            <Icon name="globe" />{t("settings.interfaceLanguage")}<span class="tvmenu__value"><bdi>{LOCALE_NATIVE_NAME[locale.value]}</bdi></span>
          </button>
          <button type="button" class="tvmenu__item" role="switch" aria-checked={calmOn} data-calm onClick={() => setCalm(!calmOn)}>
            <Icon name="eye" />{t("settings.calmMotion")}<span class={`tvswitch${calmOn ? " is-on" : ""}`} aria-hidden="true"><span /></span>
          </button>
          <button type="button" class="tvmenu__item" data-howto-reset onClick={() => { clearTvIntroFlags(GAME_IDS); clearHowToFlags(); pushToast(t("settings.showHowToDone"), "success"); }}>
            <Icon name="refresh" />{t("settings.showHowTo")}
          </button>
        </div>
        <div class="tvabout" data-about>
          <p class="tvabout__line">{t("settings.appVersion")} <bdi dir="ltr">web mock</bdi></p>
          {id !== null && (
            <>
              <p class="tvabout__line">{t("settings.installId")}</p>
              <p class="tvabout__id"><bdi dir="ltr" data-install-id>{displayInstallId(id)}</bdi></p>
            </>
          )}
        </div>
        <button type="button" class="tvbtn tvsheet__close" onClick={() => closeSide(tvHubSettings)}>{t("common.close")}</button>
      </div>
    </div>
  );
}

export { tvExit };
