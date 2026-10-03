// PH-03b settings sheet: exactly the TV-03 rows, SETTINGS_BOUNDS steps, sent immediately (debounced 300 ms).
import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { LOCALES, SETTINGS_BOUNDS } from "@mishana/shared/constants";
import type { Locale } from "@mishana/shared/constants";
import type { Points, Settings, SettingsPatch } from "@mishana/shared/engine";
import type { PlayerView } from "@mishana/shared/protocol";
import { fmtNum, locale, t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { act } from "../state/session";
import { canStep, stepValue } from "../lib/settings";
import type { Bound } from "../lib/settings";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/UI";

export type SettingsSection = "game" | "roles" | "timers" | "words";

function Segmented<T extends string | boolean>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange(v: T): void }) {
  return (
    <div class="setrow">
      <span class="setrow__label" id={`l-${label}`}>{label}</span>
      <div class="segmented" role="radiogroup" aria-labelledby={`l-${label}`}>
        {options.map((o) => (
          <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} class={`segmented__opt${o.value === value ? " is-selected" : ""}`} onClick={() => onChange(o.value)}>
            {o.value === value && <Icon name="check" size={16} />}
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Stepper({ label, value, bound, format, onChange }: { label: string; value: number; bound: Bound; format(v: number): string; onChange(v: number): void }) {
  return (
    <div class="setrow setrow--inline">
      <span class="setrow__label">{label}</span>
      <div class="stepper" role="group" aria-label={label}>
        <button type="button" class="stepper__btn" aria-label={`${label} −`} disabled={!canStep(value, bound, -1)} onClick={() => onChange(stepValue(value, bound, -1))}><Icon name="minus" /></button>
        <output class="stepper__value num" aria-live="polite">{format(value)}</output>
        <button type="button" class="stepper__btn" aria-label={`${label} +`} disabled={!canStep(value, bound, 1)} onClick={() => onChange(stepValue(value, bound, 1))}><Icon name="plus" /></button>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange(v: boolean): void }) {
  return (
    <button type="button" role="switch" aria-checked={value} class="setrow setrow--inline switchrow" onClick={() => onChange(!value)}>
      <span class="setrow__label">{label}</span>
      <span class={`switch${value ? " is-on" : ""}`} aria-hidden="true"><span /></span>
    </button>
  );
}

function Section({ id, title, open, children }: { id: SettingsSection; title: string; open: boolean; children: ComponentChildren }) {
  return (
    <details class="setsection" open={open} id={`set-${id}`}>
      <summary class="setsection__title"><span>{title}</span><Icon name="chevron-forward" size={20} class="setsection__chev" /></summary>
      <div class="setsection__body">{children}</div>
    </details>
  );
}

const NATIVE: Record<Locale, string> = { en: "English", fr: "Français", ar: "العربية" };

/** Optimistic local values, flushed as one UPDATE_SETTINGS patch after 300 ms. */
export function usePatcher(server: Settings, send: (patch: SettingsPatch) => void): [Settings, (p: SettingsPatch) => void] {
  const [over, setOver] = useState<SettingsPatch>({});
  const pending = useRef<SettingsPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Drop overrides the server has confirmed (or replaced) once nothing is pending.
    if (Object.keys(pending.current).length === 0) setOver({});
  }, [server]);
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);
  const set = (p: SettingsPatch): void => {
    pending.current = { ...pending.current, ...p };
    setOver((o) => ({ ...o, ...p }));
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      const patch = pending.current;
      pending.current = {};
      send(patch);
    }, 300);
  };
  return [{ ...server, ...over } as Settings, set];
}

export function SettingsSheet({ view, open, onClose, section }: { view: PlayerView; open: boolean; onClose(): void; section: SettingsSection | null }) {
  const [s, set] = usePatcher(view.settings, (patch) => act({ type: "UPDATE_SETTINGS", patch }));
  const B = SETTINGS_BOUNDS;
  const secs = (v: number): string => (v === 0 ? t("common.off") : t("common.seconds", { count: v }));
  const n = view.players.filter((p) => !p.left).length;
  const rc = view.roleCounts;
  const l = locale.value;
  const points = (k: keyof Points, v: number): void => set({ points: { ...s.points, [k]: v } });
  const packTitle = (title: { en: string; fr: string; ar: string }): string => title[l];
  const toggleDiff = (d: 1 | 2 | 3): void => {
    const has = s.difficulties.includes(d);
    if (has && s.difficulties.length === 1) return; // non-empty
    const next = has ? s.difficulties.filter((x) => x !== d) : [...s.difficulties, d].sort();
    set({ difficulties: next });
  };
  const togglePack = (id: string): void => {
    const has = s.packIds.includes(id);
    set({ packIds: has ? s.packIds.filter((x) => x !== id) : [...s.packIds, id] });
  };
  return (
    <Sheet open={open} onClose={onClose} title={t("settings.title")}>
      <div class="settings">
        <Section id="game" title={t("settings.catGame")} open={section === null || section === "game"}>
          <Segmented label={t("settings.winRule")} value={s.winRule} onChange={(v) => set({ winRule: v })}
            options={[{ value: "official", label: t("settings.winRuleOfficial") }, { value: "parity", label: t("settings.winRuleParity") }]} />
          <p class="setrow__help">{t(s.winRule === "official" ? "settings.winRuleOfficialHelp" : "settings.winRuleParityHelp")}</p>
          <Toggle label={t("settings.revealRoles")} value={s.revealRoles} onChange={(v) => set({ revealRoles: v })} />
          <Segmented label={t("settings.tieBreak")} value={s.tieBreak} onChange={(v) => set({ tieBreak: v })}
            options={[{ value: "random", label: t("settings.tieBreakRandom") }, { value: "none", label: t("settings.tieBreakNone") }]} />
          <Toggle label={t("settings.blankGuess")} value={s.blankGuess} onChange={(v) => set({ blankGuess: v })} />
          <p class="setrow__label setrow__label--group">{t("settings.points")}</p>
          <Stepper label={t("role.civilian")} value={s.points.civilian} bound={B.points} format={(v) => fmtNum(v)} onChange={(v) => points("civilian", v)} />
          <Stepper label={t("role.undercover")} value={s.points.undercover} bound={B.points} format={(v) => fmtNum(v)} onChange={(v) => points("undercover", v)} />
          <Stepper label={t("role.blank")} value={s.points.blank} bound={B.points} format={(v) => fmtNum(v)} onChange={(v) => points("blank", v)} />
        </Section>

        <Section id="roles" title={t("settings.catRoles")} open={section === "roles"}>
          <Segmented label={t("settings.roleMode")} value={s.roleMode} onChange={(v) => set({ roleMode: v })}
            options={[{ value: "auto", label: t("settings.roleModeAuto") }, { value: "custom", label: t("settings.roleModeCustom") }]} />
          {s.roleMode === "custom" && (
            <>
              <Stepper label={t("settings.undercoverCount")} value={s.undercoverCount} bound={B.undercoverCount} format={(v) => fmtNum(v)} onChange={(v) => set({ undercoverCount: v })} />
              <Stepper label={t("settings.blankCount")} value={s.blankCount} bound={B.blankCount} format={(v) => fmtNum(v)} onChange={(v) => set({ blankCount: v })} />
            </>
          )}
          {rc ? (
            <p class="setrow__help setrow__help--preview">{t("settings.rolePreview", { count: n, civilian: rc.civilian, undercover: rc.undercover, blank: rc.blank })}</p>
          ) : n >= 3 ? (
            <p class="setrow__help setrow__help--danger" role="alert">{t("lobby.blockerRoles")}</p>
          ) : null}
        </Section>

        <Section id="timers" title={t("settings.catTimers")} open={section === "timers"}>
          <Stepper label={t("settings.clueSeconds")} value={s.clueSeconds} bound={B.clueSeconds} format={secs} onChange={(v) => set({ clueSeconds: v })} />
          <Stepper label={t("settings.voteSeconds")} value={s.voteSeconds} bound={B.voteSeconds} format={secs} onChange={(v) => set({ voteSeconds: v })} />
          <Stepper label={t("settings.revealSeconds")} value={s.revealSeconds} bound={B.revealSeconds} format={secs} onChange={(v) => set({ revealSeconds: v })} />
          <Stepper label={t("settings.guessSeconds")} value={s.guessSeconds} bound={B.guessSeconds} format={secs} onChange={(v) => set({ guessSeconds: v })} />
          <p class="setrow__help">{t("settings.timerOffHelp")}</p>
        </Section>

        <Section id="words" title={t("settings.catWords")} open={section === "words"}>
          <Segmented label={t("settings.wordLocale")} value={s.wordLocale} onChange={(v) => set({ wordLocale: v })}
            options={LOCALES.map((x) => ({ value: x, label: NATIVE[x] }))} />
          <div class="setrow">
            <span class="setrow__label">{t("settings.packs")}</span>
            <div class="chips">
              <button type="button" class={`chip${s.packIds.length === 0 ? " is-selected" : ""}`} aria-pressed={s.packIds.length === 0} onClick={() => set({ packIds: [] })}>
                {s.packIds.length === 0 && <Icon name="check" size={16} />}{t("settings.allPacks")}
              </button>
              {view.availablePacks.map((p) => {
                const on = s.packIds.includes(p.id);
                return (
                  <button key={p.id} type="button" class={`chip${on ? " is-selected" : ""}`} aria-pressed={on} onClick={() => togglePack(p.id)}>
                    {on && <Icon name="check" size={16} />}
                    <bdi>{packTitle(p.title)}</bdi>
                    <span class="chip__meta num">{fmtNum(p.pairCount)}</span>
                    {p.ageRating === "teen" && <span class="tag tag--warn">{t("settings.packTeen")}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div class="setrow">
            <span class="setrow__label">{t("settings.difficulty")}</span>
            <div class="chips">
              {([1, 2, 3] as const).map((d) => {
                const on = s.difficulties.includes(d);
                return (
                  <button key={d} type="button" class={`chip${on ? " is-selected" : ""}`} aria-pressed={on} onClick={() => toggleDiff(d)}>
                    {on && <Icon name="check" size={16} />}{t(`settings.difficulty${d}` as MessageKey)}
                  </button>
                );
              })}
            </div>
          </div>
          <Toggle label={t("settings.familyFilter")} value={s.familyFilter} onChange={(v) => set({ familyFilter: v })} />
          <Toggle label={t("settings.swapSides")} value={s.swapSides} onChange={(v) => set({ swapSides: v })} />
        </Section>
        <p class="settings__footer">{t("settings.applies")}</p>
      </div>
    </Sheet>
  );
}
