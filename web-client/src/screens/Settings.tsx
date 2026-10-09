// PH-03b settings sheet: the TV-03 rows (lib/settingsModel), SETTINGS_BOUNDS steps, sent immediately (debounced 300 ms).
import type { ComponentChildren } from "preact";
import type { Settings, SettingsPatch } from "@mishana/shared/engine";
import type { PlayerView } from "@mishana/shared/protocol";
import { fmtNum, locale, t } from "../i18n/t";
import { actId } from "../state/session";
import { lastError, pushToast } from "../state/store";
import { lockedPackRows, settingLocked } from "../lib/premium";
import { canStep } from "../lib/settings";
import type { Bound } from "../lib/settings";
import { rolePreview } from "../lib/lobby";
import {
  CATEGORIES, CATEGORY_HELP, CATEGORY_LABEL, DIFFICULTIES, difficultyLabel, enumPatch, numValue, ROLE_HELP, rowBound, selectedPacks, stepRow,
  toggleDifficulty, togglePack, visibleRows,
} from "../lib/settingsModel";
import type { RowDef, SettingsCategory } from "../lib/settingsModel";
import { usePatcher } from "../hooks/usePatcher";
import { Icon } from "../components/Icon";
import { Button, Sheet } from "../components/UI";

export type SettingsSection = SettingsCategory;

function Segmented({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange(v: string): void }) {
  return (
    <div class="setrow">
      <span class="setrow__label" id={`l-${label}`}>{label}</span>
      <div class="segmented" role="radiogroup" aria-labelledby={`l-${label}`}>
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value} class={`segmented__opt${o.value === value ? " is-selected" : ""}`} onClick={() => onChange(o.value)}>
            {o.value === value && <Icon name="check" size={16} />}
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Stepper({ label, value, bound, format, onStep }: { label: string; value: number; bound: Bound; format(v: number): string; onStep(dir: 1 | -1): void }) {
  return (
    <div class="setrow setrow--inline">
      <span class="setrow__label">{label}</span>
      <div class="stepper" role="group" aria-label={label}>
        <button type="button" class="stepper__btn" aria-label={`${label} −`} disabled={!canStep(value, bound, -1)} onClick={() => onStep(-1)}><Icon name="minus" /></button>
        <output class="stepper__value tnum" aria-live="polite">{format(value)}</output>
        <button type="button" class="stepper__btn" aria-label={`${label} +`} disabled={!canStep(value, bound, 1)} onClick={() => onStep(1)}><Icon name="plus" /></button>
      </div>
    </div>
  );
}

/**
 * PAYMENTS-SPEC §5.1: a premium-only number row in a free room. The steppers stay visible but disabled; any tap on the
 * row says why (no buy button, no price: the TV is the only place to unlock).
 */
function LockedStepper({ label, value }: { label: string; value: string }) {
  return (
    <button type="button" class="lockedrow lockedrow--stepper"
      aria-label={`${label}: ${value}. ${t("settings.unlockOnTv")}`} onClick={() => pushToast(t("error.premiumRequired"), "error", 3000)}>
      <span class="setrow__label">{label}</span>
      <span class="stepper is-locked" aria-hidden="true">
        <span class="stepper__btn"><Icon name="minus" /></span>
        <span class="stepper__value tnum">{value}</span>
        <span class="stepper__btn"><Icon name="plus" /></span>
      </span>
      <span class="lockedrow__hint"><Icon name="lock" size={16} />{t("settings.unlockOnTv")}</span>
    </button>
  );
}

/** §5.1: the room's locked packs as disabled rows (lock, title, pair count, "Unlock on the TV"); a tap explains. */
function LockedPacks({ view }: { view: PlayerView }) {
  const rows = lockedPackRows(view.lockedPacks, locale.value);
  if (rows.length === 0) return null;
  return (
    <div class="setrow lockedpacks">
      <span class="setrow__label setrow__label--group">{t("settings.lockedPacks")}</span>
      <ul class="lockedpacks__list">
        {rows.map((r) => (
          <li key={r.id}>
            <button type="button" class="lockedrow lockedrow--pack" aria-label={`${r.title}. ${t("settings.locked")}. ${t(r.trailingKey)}`} onClick={() => pushToast(t("error.packLocked"), "error", 3000)}>
              <Icon name="lock" size={20} class="lockedrow__lock" />
              <span class="lockedrow__text">
                <bdi class="lockedrow__title">{r.title}</bdi>
                {/* lock · title / pairs · hint: the hint has its own line, so it never squeezes the title (the only
                    thing that names the pack). */}
                <span class="lockedrow__meta">{t("store.packPairs", { count: r.pairCount })} · <span class="lockedrow__hint">{t(r.trailingKey)}</span></span>
              </span>
            </button>
          </li>
        ))}
      </ul>
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

function Chip({ on, onClick, children }: { on: boolean; onClick(): void; children: ComponentChildren }) {
  return (
    <button type="button" class={`chip${on ? " is-selected" : ""}`} aria-pressed={on} onClick={onClick}>
      {on && <Icon name="check" size={16} />}{children}
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

/** One schema row as a native-feeling phone control. */
function Row({ row, s, set, view, groupStart }: { row: RowDef; s: Settings; set(p: SettingsPatch): void; view: PlayerView; groupStart: boolean }) {
  const label = t(row.label);
  switch (row.kind) {
    case "enum": {
      const help = row.help?.(s);
      return (
        <>
          <Segmented label={label} value={s[row.id]} onChange={(v) => set(enumPatch(row.id, v))}
            options={row.options.map((v) => ({ value: v, label: row.optionLabel(v) }))} />
          {help && <p class="setrow__help">{t(help)}</p>}
        </>
      );
    }
    case "bool": return <Toggle label={label} value={s[row.id]} onChange={(v) => set({ [row.id]: v })} />;
    case "num":
    case "points": {
      const step = (dir: 1 | -1): void => { const p = stepRow(row, s, dir); if (p) set(p); };
      const group = row.kind === "points" && groupStart && <p class="setrow__label setrow__label--group">{t(row.group)}</p>;
      if (row.kind === "points" && settingLocked(view, "points")) {
        return <>{group}<LockedStepper label={label} value={fmtNum(numValue(row, s))} /></>;
      }
      return (
        <>
          {group}
          <Stepper label={label} value={numValue(row, s)} bound={rowBound(row)}
            format={row.kind === "num" ? row.format : (v) => fmtNum(v)} onStep={step} />
        </>
      );
    }
    case "packs": {
      const l = locale.value;
      return (
        <div class="setrow">
          <span class="setrow__label">{label}</span>
          <div class="chips">
            <Chip on={selectedPacks(s, view.availablePacks).length === 0} onClick={() => set({ packIds: [] })}>{t("settings.allPacks")}</Chip>
            {view.availablePacks.map((p) => (
              <Chip key={p.id} on={s.packIds.includes(p.id)} onClick={() => set(togglePack(s, p.id))}>
                <bdi>{p.title[l]}</bdi>
                <span class="chip__meta num">{fmtNum(p.pairCount)}</span>
                {p.ageRating === "teen" && <span class="tag tag--warn">{t("settings.packTeen")}</span>}
              </Chip>
            ))}
          </div>
          <LockedPacks view={view} />
        </div>
      );
    }
    case "difficulty":
      return (
        <div class="setrow">
          <span class="setrow__label">{label}</span>
          <div class="chips">
            {DIFFICULTIES.map((d) => (
              <Chip key={d} on={s.difficulties.includes(d)} onClick={() => { const p = toggleDifficulty(s, d); if (p) set(p); }}>{difficultyLabel(d)}</Chip>
            ))}
          </div>
        </div>
      );
  }
}

export function SettingsSheet({ view, open, onClose, section }: { view: PlayerView; open: boolean; onClose(): void; section: SettingsSection | null }) {
  // The patcher stays mounted while the sheet is closed: a pending 300 ms flush must survive closing it.
  const [s, set] = usePatcher(view.settings, (patch) => actId({ type: "UPDATE_SETTINGS", patch }), lastError.value);
  if (!open) return null;
  const preview = rolePreview(view);
  return (
    <Sheet open onClose={onClose} title={t("settings.title")} closable
      footer={<Button onClick={onClose}><Icon name="check" />{t("common.done")}</Button>}>
      <div class="settings">
        {CATEGORIES.map((cat) => {
          const help = CATEGORY_HELP[cat];
          return (
            <Section key={cat} id={cat} title={t(CATEGORY_LABEL[cat])} open={section === cat || (section === null && cat === "game")}>
              {visibleRows(cat, s).map((row, i, rows) => (
                <Row key={row.id} row={row} s={s} set={set} view={view} groupStart={row.kind === "points" && rows[i - 1]?.kind !== "points"} />
              ))}
              {help && <p class="setrow__help">{t(help)}</p>}
              {cat === "roles" && preview && (
                preview.invalid
                  ? <p class="setrow__help setrow__help--danger" role="alert">{preview.text}</p>
                  : <p class="setrow__help setrow__help--preview">{preview.text}</p>
              )}
              {cat === "roles" && <p class="setrow__help">{t(ROLE_HELP.blankCount)}<br />{t(ROLE_HELP.undercoverCount)}</p>}
            </Section>
          );
        })}
        <p class="settings__footer">{t("settings.applies")}</p>
      </div>
    </Sheet>
  );
}
