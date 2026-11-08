// JAMAA-PLATFORM §3.5: the settings rows of any game, from its zod-free GameMeta (`settings.basic` ≤ 4 rows, then
// "Advanced"). One model for the TV setup pane (‹ value › rows) and the VIP phone. Rows with one possible value are
// hidden. Mish Ana!'s virtual "timers" row maps onto its four seconds settings (TIMER_PRESETS); its "Custom" impostors
// mode opens the two counts inline.
import type { GameId } from "@jamaa/shared/games/ids";
import { GAME_META } from "@jamaa/shared/games/meta";
import type { SettingField } from "@jamaa/shared/games/types";
import { TIMER_PRESETS, TIMER_PRESET_IDS, timerPresetOf } from "@jamaa/shared/games/mishana/meta";
import type { RoomSetup } from "@jamaa/shared/protocol/v2";
import { fmtNum, t, titleIn } from "../i18n/t";
import type { MessageKey } from "../i18n/t";

type Settings = Record<string, unknown>;
export type Patch = Record<string, unknown>;

export interface Row {
  id: string;
  field: SettingField;
  label: string;
  value: string;
  /** Left/Right steps (null: not steppable, e.g. packs open a picker). */
  step: ((dir: -1 | 1) => Patch | null) | null;
  /** A pack row opens the pack picker. */
  packs: boolean;
  premium: boolean;
  /** An inline sub-row (Mish Ana! Custom impostor counts). */
  sub?: boolean;
}

const tk = (k: string): string => t(k as MessageKey);

function cycle<T>(list: readonly T[], cur: T, dir: -1 | 1): T {
  const i = list.indexOf(cur);
  return list[(((i < 0 ? 0 : i) + dir) % list.length + list.length) % list.length]!;
}

function stepNum(v: number, b: { min: number; max: number; step: number; off?: 0 }, dir: -1 | 1): number | null {
  if (b.off === 0 && v === 0) return dir > 0 ? b.min : null;
  const n = v + dir * b.step;
  if (n < b.min) return b.off === 0 ? 0 : null;
  if (n > b.max) return null;
  return n;
}

function packRow(f: Extract<SettingField, { kind: "packs" }>, s: Settings, setup: RoomSetup): Row {
  const sel = Array.isArray(s[f.key]) ? (s[f.key] as string[]) : [];
  const avail = setup.availablePacks;
  const chosen = avail.filter((p) => sel.includes(p.id) || sel.includes(p.family));
  const value = chosen.length === 0 ? t("settings.allPacks")
    : chosen.length === 1 ? titleIn(chosen[0]!.title) : t("setup.packCount", { count: chosen.length });
  return { id: f.key, field: f, label: tk(f.labelKey), value, step: null, packs: true, premium: false };
}

function fieldRow(id: GameId, f: SettingField, s: Settings, setup: RoomSetup): Row | null {
  const premium = (GAME_META[id].settings.premiumKeys as readonly string[]).includes(f.key);
  const base = { id: f.key, field: f, label: tk(f.labelKey), packs: false, premium };
  switch (f.kind) {
    case "packs": {
      // A packs row with one possible value (one playable pack, no locked one) is hidden (§3.5).
      if (setup.availablePacks.length + setup.lockedPacks.length <= 1) return null;
      return packRow(f, s, setup);
    }
    case "toggle": {
      const v = s[f.key] === true;
      return { ...base, value: t(v ? "common.on" : "common.off"), step: () => ({ [f.key]: !v }) };
    }
    case "stepper": {
      const v = s[f.key];
      if (typeof v === "object" && v !== null) {
        // Mish Ana! points {civilian, undercover, blank}: shown as one summary; edited per role on the phone/TV sheet.
        const pts = v as Record<string, number>;
        return { ...base, value: Object.values(pts).map((n) => fmtNum(n)).join(" / "), step: null };
      }
      const n = typeof v === "number" ? v : f.bounds.min;
      return {
        ...base, value: n === 0 && f.bounds.off === 0 ? t("common.off") : fmtNum(n),
        step: (dir) => { const x = stepNum(n, f.bounds, dir); return x === null ? null : { [f.key]: x }; },
      };
    }
    case "choice": {
      if (f.options.length <= 1) return null;
      // Mish Ana!'s virtual timers row.
      if (id === "mishana" && f.key === "timers") {
        const cur = timerPresetOf(s as Parameters<typeof timerPresetOf>[0]);
        const label = cur === "custom" ? t("setup.custom") : tk(f.options.find((o) => o.value === cur)?.labelKey ?? "");
        return { ...base, value: label, step: (dir) => ({ ...TIMER_PRESETS[cycle(TIMER_PRESET_IDS, cur === "custom" ? "normal" : cur, dir)] }) };
      }
      const raw = s[f.key];
      if (Array.isArray(raw)) {
        // A multi-select choice (Mish Ana! difficulties): Left/Right walks the useful subsets.
        const all = f.options.map((o) => o.value);
        const subsets: (string | number)[][] = [all, ...all.map((v) => [v]), ...(all.length > 2 ? [all.slice(0, 2), all.slice(1)] : [])];
        const curKey = JSON.stringify([...raw].sort());
        const i = Math.max(0, subsets.findIndex((x) => JSON.stringify([...x].sort()) === curKey));
        const value = f.options.filter((o) => (raw as unknown[]).includes(o.value)).map((o) => tk(o.labelKey)).join(" · ");
        return { ...base, value, step: (dir) => ({ [f.key]: subsets[((i + dir) % subsets.length + subsets.length) % subsets.length] }) };
      }
      const opt = f.options.find((o) => o.value === raw) ?? f.options[0]!;
      return {
        ...base, value: tk(opt.labelKey),
        step: (dir) => ({ [f.key]: cycle(f.options.map((o) => o.value), opt.value, dir) }),
      };
    }
  }
}

/** The ≤ 4 basic rows (plus Mish Ana!'s inline Custom counts), hiding rows with one possible value. */
export function basicRows(setup: RoomSetup): Row[] {
  const id = setup.gameId;
  const s = setup.settings as Settings;
  const out: Row[] = [];
  for (const f of GAME_META[id].settings.basic) {
    const r = fieldRow(id, f, s, setup);
    if (!r) continue;
    out.push(r);
    if (id === "mishana" && f.key === "roleMode" && s.roleMode === "custom") {
      for (const key of ["blankCount", "undercoverCount"]) {
        const adv = GAME_META.mishana.settings.advanced.find((x) => x.key === key);
        const sub = adv ? fieldRow(id, adv, s, setup) : null;
        if (sub) out.push({ ...sub, sub: true });
      }
    }
  }
  return out;
}

/** The "Advanced" rows (empty for G2–G4), minus the ones already shown inline. */
export function advancedRows(setup: RoomSetup): Row[] {
  const id = setup.gameId;
  const s = setup.settings as Settings;
  const inline = id === "mishana" && s.roleMode === "custom" ? new Set(["blankCount", "undercoverCount"]) : new Set<string>();
  const out: Row[] = [];
  for (const f of GAME_META[id].settings.advanced) {
    if (inline.has(f.key)) continue;
    const r = fieldRow(id, f, s, setup);
    if (r) out.push(r);
  }
  return out;
}

/** "Need 3 players" / "No content in this language" / any other blocker in words. */
export function blockerLine(setup: RoomSetup, activeMembers: number, minPlayers: number): string | null {
  switch (setup.startBlocker) {
    case null: return null;
    case "NOT_ENOUGH_PLAYERS": return t("setup.blockerPlayers", { count: minPlayers });
    case "GAME_UNAVAILABLE":
    case "NO_CONTENT_AVAILABLE":
    case "NO_WORDS_AVAILABLE": return t("setup.blockerContent");
    case "INVALID_ROLE_CONFIG": return t("lobby.blockerRoles");
    default: void activeMembers; return t(`error.${setup.startBlocker.toLowerCase().replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())}` as MessageKey);
  }
}
