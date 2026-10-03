// PH-02 colour grid: 12 swatches (shape + colour), taken ones hatched and disabled, selection = ring + check.
import { COLORS } from "@mishana/shared/constants";
import type { ColorId } from "@mishana/shared/constants";
import { t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { Icon } from "./Icon";
import { Glyph, colorVars } from "./PlayerChip";

export function firstFree(taken: ReadonlySet<string>, preferred?: ColorId | null): ColorId | null {
  if (preferred && !taken.has(preferred)) return preferred;
  return COLORS.find((c) => !taken.has(c.id))?.id ?? null;
}

export function ColorPicker({ value, taken, onChange, shake = false }: { value: ColorId | null; taken: ReadonlySet<string>; onChange(c: ColorId): void; shake?: boolean }) {
  return (
    <div class={`colorgrid${shake ? " shake" : ""}`} role="radiogroup" aria-label={t("join.colorLabel")}>
      {COLORS.map((c) => {
        const isTaken = taken.has(c.id);
        const sel = value === c.id;
        const name = t(`color.${c.id}` as MessageKey);
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={sel}
            aria-disabled={isTaken}
            aria-label={isTaken ? `${name}, ${t("join.colorTaken")}` : name}
            class={`swatch${sel ? " is-selected" : ""}${isTaken ? " is-taken" : ""}`}
            style={colorVars(c.id)}
            onClick={() => { if (!isTaken) onChange(c.id); }}
          >
            <Glyph color={c.id} />
            {sel && <span class="swatch__check"><Icon name="check" size={14} /></span>}
          </button>
        );
      })}
    </div>
  );
}
