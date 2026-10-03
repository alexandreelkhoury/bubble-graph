// PH-17 menu sheet: language (labels in their own language), vibration, leave.
import { useState } from "preact/hooks";
import { LOCALES } from "@mishana/shared/constants";
import type { Locale } from "@mishana/shared/constants";
import { locale, setLocale, t } from "../i18n/t";
import { saveLocale } from "../lib/storage";
import { setVibration, vibrationEnabled } from "../lib/haptics";
import { Icon } from "./Icon";
import { ConfirmSheet, Sheet } from "./UI";

const NATIVE: Record<Locale, string> = { en: "English", fr: "Français", ar: "العربية" };

export function switchLocale(l: Locale): void {
  const root = document.documentElement;
  root.classList.add("lang-fade");
  setLocale(l);
  saveLocale(l);
  setTimeout(() => root.classList.remove("lang-fade"), 160);
}

export function LangSwitch() {
  const cur = locale.value;
  return (
    <div class="langlist" role="radiogroup" aria-label={t("common.language")}>
      {LOCALES.map((l) => (
        <button key={l} type="button" role="radio" aria-checked={cur === l} class={`radiorow${cur === l ? " is-selected" : ""}`} onClick={() => switchLocale(l)} lang={l} dir={l === "ar" ? "rtl" : "ltr"}>
          <span class="radiorow__dot" aria-hidden="true" />
          <span>{NATIVE[l]}</span>
          {cur === l && <Icon name="check" size={20} class="radiorow__check" />}
        </button>
      ))}
    </div>
  );
}

export function MenuSheet({ open, onClose, onLeave, joined }: { open: boolean; onClose(): void; onLeave?(): void; joined: boolean }) {
  const [vib, setVib] = useState(vibrationEnabled());
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Sheet open={open && !confirm} onClose={onClose} title={t("common.language")}>
        <LangSwitch />
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
      <ConfirmSheet open={open && confirm} title={t("phone.leaveConfirm")} confirm={t("phone.leave")}
        onConfirm={() => { onLeave?.(); }} onClose={() => { setConfirm(false); onClose(); }} />
    </>
  );
}
