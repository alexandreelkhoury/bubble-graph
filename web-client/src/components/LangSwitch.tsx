// PH-17 menu sheet: language (labels in their own language), vibration, leave.
import { useState } from "preact/hooks";
import { LOCALES } from "@jamaa/shared/constants";
import type { Locale } from "@jamaa/shared/constants";
import { dirOf, locale, LOCALE_NATIVE_NAME, setLocale, t } from "../i18n/t";
import { clearHowToFlags, saveLocale } from "../lib/storage";
import { pushToast } from "../state/store";
import { setVibration, vibrationEnabled } from "../lib/haptics";
import { Icon } from "./Icon";
import { ConfirmSheet, Sheet } from "./UI";

export function switchLocale(l: Locale): void {
  const root = document.documentElement;
  root.classList.add("lang-fade");
  saveLocale(l);
  void setLocale(l).then(() => setTimeout(() => root.classList.remove("lang-fade"), 160));
}

/** The language radios; `labelled` adds a small "Language" label (the menu sheet, whose title is "Menu"). */
export function LangSwitch({ labelled = false }: { labelled?: boolean }) {
  const cur = locale.value;
  return (
    <>
      {labelled && <p class="sheet__label" id="lang-label">{t("common.language")}</p>}
      <div class="langlist" role="radiogroup" aria-label={labelled ? undefined : t("common.language")} aria-labelledby={labelled ? "lang-label" : undefined}>
        {LOCALES.map((l) => (
          <button key={l} type="button" role="radio" aria-checked={cur === l} class={`radiorow${cur === l ? " is-selected" : ""}`} onClick={() => switchLocale(l)}>
            <span class="radiorow__dot" aria-hidden="true" />
            <span class="radiorow__label"><bdi lang={l} dir={dirOf(l)}>{LOCALE_NATIVE_NAME[l]}</bdi></span>
            {cur === l && <Icon name="check" size={20} class="radiorow__check" />}
          </button>
        ))}
      </div>
    </>
  );
}

/** `onEndGame`: the VIP's way out of a running game (ABORT_GAME, JAMAA-PLATFORM §2.3 "Host"), only while one runs. */
export function MenuSheet({ open, onClose, onLeave, onEndGame, joined }: { open: boolean; onClose(): void; onLeave?(): void; onEndGame?(): void; joined: boolean }) {
  const [vib, setVib] = useState(vibrationEnabled());
  const [confirm, setConfirm] = useState<"leave" | "end" | null>(null);
  return (
    <>
      <Sheet open={open && !confirm} onClose={onClose} title={joined ? t("phone.menu") : t("common.language")}>
        <LangSwitch labelled={joined} />
        {typeof navigator !== "undefined" && "vibrate" in navigator && (
          <>
            <hr class="sheet__rule" />
            <button type="button" role="switch" aria-checked={vib} class="switchrow" onClick={() => { setVibration(!vib); setVib(!vib); }}>
              <Icon name="vibrate" />
              <span>{t("phone.vibration")}</span>
              <span class={`switch${vib ? " is-on" : ""}`} aria-hidden="true"><span /></span>
            </button>
          </>
        )}
        {joined && (
          <>
            <hr class="sheet__rule" />
            <button type="button" class="switchrow" onClick={() => { clearHowToFlags(); pushToast(t("settings.showHowToDone"), "success"); onClose(); }}>
              <Icon name="play" />
              <span>{t("settings.showHowTo")}</span>
              <Icon name="refresh" size={20} />
            </button>
          </>
        )}
        {joined && ([["end", onEndGame, "x", "phone.endGame"], ["leave", onLeave, "door-out", "phone.leave"]] as const).map(([k, f, icon, key]) => f && (
          <>
            <hr class="sheet__rule" />
            <button type="button" class="switchrow switchrow--danger" onClick={() => setConfirm(k)}>
              <Icon name={icon} />
              <span>{t(key)}</span>
              <Icon name="chevron-forward" size={20} />
            </button>
          </>
        ))}
      </Sheet>
      <ConfirmSheet open={open && !!confirm} title={t(confirm === "end" ? "phone.endGameConfirm" : "phone.leaveConfirm")} body={confirm === "end" ? undefined : t("phone.leaveBody")}
        confirm={t(confirm === "end" ? "phone.endGame" : "phone.leaveShort")}
        onConfirm={() => { (confirm === "end" ? onEndGame : onLeave)?.(); }} onClose={() => { setConfirm(null); onClose(); }} />
    </>
  );
}
