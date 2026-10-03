// DESIGN §5.2 avatars: a squircle in the player colour holding its shape glyph. Never colour alone.
import type { ComponentChildren } from "preact";
import { COLORS } from "@mishana/shared/constants";
import type { ColorId } from "@mishana/shared/constants";
import type { Role } from "@mishana/shared/engine";
import type { PublicPlayer } from "@mishana/shared/protocol";
import { t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { Icon } from "./Icon";
import { RoleEmblem } from "./Role";

export const SHAPES: Record<string, string> = {
  circle: '<circle cx="12" cy="12" r="9"/>',
  square: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/>',
  star: '<path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" stroke-linejoin="round"/>',
  triangle: '<path d="M12 3.2 21.4 19.8H2.6z" stroke-linejoin="round"/>',
  diamond: '<path d="M12 2.2 21.8 12 12 21.8 2.2 12z"/>',
  hexagon: '<path d="M12 2.6 20.2 7.3v9.4L12 21.4 3.8 16.7V7.3z"/>',
  plus: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  drop: '<path d="M12 2.5S5 10.4 5 15a7 7 0 0 0 14 0c0-4.6-7-12.5-7-12.5z"/>',
  crescent: '<path d="M15 2.7a9.5 9.5 0 1 0 6.3 13.6A7.6 7.6 0 0 1 15 2.7z"/>',
  bolt: '<path d="M13.5 2 5 13.5h6L10 22l9-12h-6.2z"/>',
  flower: '<circle cx="12" cy="7.4" r="4.6"/><circle cx="16.6" cy="12" r="4.6"/><circle cx="12" cy="16.6" r="4.6"/><circle cx="7.4" cy="12" r="4.6"/><circle cx="12" cy="12" r="4"/>',
  arch: '<path d="M5 21.5V11a7 7 0 0 1 14 0v10.5h-4.5V15a2.5 2.5 0 0 0-5 0v6.5z"/>',
};

export const COLOR_BY_ID = Object.fromEntries(COLORS.map((c) => [c.id, c])) as Record<ColorId, (typeof COLORS)[number]>;
export const LIGHT_GLYPH = (id: ColorId): boolean => COLOR_BY_ID[id].glyph === "cream";

export function colorVars(id: ColorId): Record<string, string> {
  const c = COLOR_BY_ID[id];
  return { "--avatar-color": c.hex, "--avatar-glyph": c.glyph === "ink" ? "var(--color-ink)" : "var(--color-text)" };
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
}

/** Badges: away (wifi-off) wins over ready/voted (check); host crown top-start; role emblem bottom-end when out. */
export function Avatar({ color, size = 56, state = "normal", role = null, host = false, check = false, speaking = false, class: cls }: AvatarProps) {
  const away = state === "away";
  const out = state === "out" || state === "left";
  const badge = Math.max(16, Math.round(size * 0.36));
  return (
    <span
      class={`avatar avatar--${state}${speaking ? " avatar--speaking" : ""}${cls ? ` ${cls}` : ""}`}
      style={{ ...colorVars(color), "--avatar-size": `${size}px`, "--badge-size": `${badge}px` }}
      aria-hidden="true"
    >
      <span class="avatar__tile"><Glyph color={color} /></span>
      {host && <span class="badge badge--host"><Icon name="crown" /></span>}
      {state === "left" ? (
        <span class="badge badge--end badge--left"><Icon name="door-out" /></span>
      ) : away ? (
        <span class="badge badge--end badge--away"><Icon name="wifi-off" /></span>
      ) : check ? (
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
