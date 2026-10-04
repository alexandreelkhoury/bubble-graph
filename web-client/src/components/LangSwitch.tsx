// PH-17 menu sheet: language (labels in their own language), vibration, leave.
import { useState } from "preact/hooks";
import { LOCALES } from "@mishana/shared/constants";
import type { Locale } from "@mishana/shared/constants";
import { dirOf, locale, LOCALE_NATIVE_NAME, setLocale, t } from "../i18n/t";
import { saveLocale } from "../lib/storage";
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

export function MenuSheet({ open, onClose, onLeave, joined }: { open: boolean; onClose(): void; onLeave?(): void; joined: boolean }) {
  const [vib, setVib] = useState(vibrationEnabled());
  const [confirm, setConfirm] = useState(false);
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
        {joined && onLeave && (
          <>
            <hr class="sheet__rule" />
            <button type="button" class="switchrow switchrow--danger" onClick={() => setConfirm(true)}>
              <Icon name="door-out" />
              <span>{t("phone.leave")}</span>
              <Icon name="chevron-forward" size={20} />
            </button>
          </>
        )}
      </Sheet>
      <ConfirmSheet open={open && confirm} title={t("phone.leaveConfirm")} body={t("phone.leaveBody")} confirm={t("phone.leaveShort")}
        onConfirm={() => { onLeave?.(); }} onClose={() => { setConfirm(false); onClose(); }} />
    </>
  );
}
