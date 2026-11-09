// DESIGN §5.2 avatars: a squircle in the player colour holding its shape glyph. Never colour alone.
import type { PublicPlayer, Role } from "../games/mishana/view";
import type { ComponentChildren } from "preact";
import { COLORS } from "@jamaa/shared/constants";
import { BODY_PATHS } from "@jamaa/shared/characters";
import type { ColorId } from "@jamaa/shared/constants";
import { t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { Icon } from "./Icon";
import { RoleEmblem } from "./Role";
import { Character } from "./Character";
import type { Expression } from "@jamaa/shared/characters";
import { FACE_MIN_SIZE } from "@jamaa/shared/characters";

/** The DESIGN §5.2 glyphs, from the shared character geometry (one path per shape). */
export const SHAPES: Record<string, string> = Object.fromEntries(
  Object.entries(BODY_PATHS).map(([k, d]) => [k, `<path d="${d}" stroke-linejoin="round"/>`]),
);

export const COLOR_BY_ID = Object.fromEntries(COLORS.map((c) => [c.id, c])) as Record<ColorId, (typeof COLORS)[number]>;
export const LIGHT_GLYPH = (id: ColorId): boolean => COLOR_BY_ID[id].glyph === "cream";

/** DESIGN §2.3: on the palette-B surfaces coral, grape and plum fall under 3:1 (surface #3A2266 / elevated #4A2E7A),
 *  so their tiles always carry a 24 % cream ring. On overlay (#5A3A8E: sheets, TV dialogs) every tile gets it (styles.css). */
const RINGED: ReadonlySet<ColorId> = new Set(["coral", "grape", "plum"]);

export function colorVars(id: ColorId): Record<string, string> {
  const c = COLOR_BY_ID[id];
  return {
    "--avatar-color": c.hex, "--avatar-glyph": c.glyph === "ink" ? "var(--color-ink)" : "var(--color-text)",
    "--avatar-ring": RINGED.has(id) ? "rgb(var(--rgb-text) / 0.24)" : "transparent",
  };
}

export function Glyph({ color }: { color: ColorId }) {
  return (
    <svg viewBox="0 0 24 24" class="avatar__glyph" aria-hidden="true" focusable="false"
      dangerouslySetInnerHTML={{ __html: SHAPES[COLOR_BY_ID[color].shape] ?? "" }} />
  );
}

export type AvatarState = "normal" | "away" | "out" | "left";

export interface AvatarProps {
  color: ColorId;
  size?: number;
  state?: AvatarState;
  role?: Role | null;
  host?: boolean;
  check?: boolean;
  speaking?: boolean;
  class?: string;
  /** Character expression at ≥ 40 px (default: from the state: away → away, out → sad, check → done, else idle). */
  expression?: Expression;
}

/**
 * DESIGN-JAMAA §4.1: the character IS the avatar. At ≥ 40 px the player's character (body + face) is drawn, with the
 * DESIGN §5.2 badges on top; below 40 px the classic tile + glyph. The `done` face carries its own check badge.
 * Badges: away (wifi-off) wins over ready/voted (check); host crown top-start; role emblem bottom-end when out. */
export function Avatar({ color, size = 56, state = "normal", role = null, host = false, check = false, speaking = false, class: cls, expression }: AvatarProps) {
  const away = state === "away";
  const out = state === "out" || state === "left";
  const badge = Math.max(16, Math.round(size * 0.36));
  const face = size >= FACE_MIN_SIZE;
  const expr: Expression = expression ?? (away ? "away" : out ? "sad" : check ? "done" : "idle");
  return (
    <span
      class={`avatar avatar--${state}${face ? " avatar--char" : ""}${speaking ? " avatar--speaking" : ""}${cls ? ` ${cls}` : ""}`}
      style={{ ...colorVars(color), "--avatar-size": `${size}px`, "--badge-size": `${badge}px` }}
      aria-hidden="true"
    >
      {face ? <Character color={color} size={size} expression={expr} /> : <span class="avatar__tile"><Glyph color={color} /></span>}
      {host && <span class="badge badge--host"><Icon name="crown" /></span>}
      {state === "left" ? (
        <span class="badge badge--end badge--left"><Icon name="door-out" /></span>
      ) : away ? (
        <span class="badge badge--end badge--away"><Icon name="wifi-off" /></span>
      ) : check && !(face && expr === "done") ? (
        <span class="badge badge--end badge--check"><Icon name="check" /></span>
      ) : null}
      {out && role && <span class={`badge badge--role badge--${role.toLowerCase()}`}><RoleEmblem role={role} /></span>}
    </span>
  );
}

export function avatarState(p: PublicPlayer): AvatarState {
  if (p.left) return "left";
  if (!p.alive) return "out";
  if (!p.connected) return "away";
  return "normal";
}

/** Accessible label: "Lina, Lemon star, host". */
export function playerLabel(p: PublicPlayer, extras: string[] = []): string {
  const c = COLOR_BY_ID[p.color];
  const parts = [p.name, `${t(`color.${c.id}` as MessageKey)}`];
  if (p.isHost) parts.push(t("common.host"));
  if (!p.connected && !p.left) parts.push(t("common.away"));
  return [...parts, ...extras].join(", ");
}

/** Avatar + bidi-isolated name. */
export function PlayerChip({ p, size = 28, you = false, children, check = false }: { p: PublicPlayer; size?: number; you?: boolean; children?: ComponentChildren; check?: boolean }) {
  return (
    <span class="pchip" aria-label={playerLabel(p, you ? [t("common.you")] : [])}>
      <Avatar color={p.color} size={size} state={avatarState(p)} role={p.revealedRole} host={p.isHost} check={check} />
      <bdi class="pchip__name">{p.name}</bdi>
      {you && <span class="tag">{t("common.you")}</span>}
      {children}
    </span>
  );
}
