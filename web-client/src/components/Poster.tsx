// DESIGN-JAMAA §2.2: a game poster, code-drawn (no bitmaps): the world stage, 2–3 props, three characters acting the
// game, the title lockup and the tagline. Used by the TV hub carousel, the setup title and the phone hub card.
import type { ColorId } from "@jamaa/shared/constants";
import type { GameId } from "@jamaa/shared/games/ids";
import type { Locale } from "@jamaa/shared/constants";
import { t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import type { Expression } from "../characters/data";
import { Character } from "./Character";

/** Three characters acting each game (DESIGN-JAMAA §2.2 "Art"). */
const CAST: Record<GameId, readonly [ColorId, Expression][]> = {
  mishana: [["azure", "point"], ["plum", "shock"], ["lemon", "point"]],
  bluff: [["jade", "think"], ["tangerine", "smug"], ["lilac", "think"]],
  likely: [["aqua", "point"], ["rose", "shy"], ["sand", "point"]],
  trivia: [["grape", "idle"], ["coral", "cheer"], ["mint", "idle"]],
};

export { WORLD_OF } from "../lib/meta";
import { WORLD_OF } from "../lib/meta";

/** The game's title lockup: Mish Ana!'s "shared bang" wordmark; for G2–G4 the world's treatment in CSS (§1.6). */
export function TitleLockup({ id, script, class: cls }: { id: GameId; script?: Locale; class?: string }) {
  const title = t(`game.${id}.title` as MessageKey);
  if (id === "mishana") {
    const src = script === "ar" ? "/games/mishana/wordmark-ar.svg" : "/games/mishana/wordmark-latin.svg";
    return <img class={`lockup lockup--mishana${cls ? ` ${cls}` : ""}`} src={src} alt={title} draggable={false} />;
  }
  return <span class={`lockup lockup--${id}${cls ? ` ${cls}` : ""}`} dir="auto">{title}</span>;
}

/** The poster's art layer (props + characters); `size` is the character size in CSS px. */
export function PosterArt({ id, size }: { id: GameId; size: number }) {
  return (
    <div class={`poster__art poster__art--${id}`} aria-hidden="true">
      <span class="poster__prop poster__prop--a" />
      <span class="poster__prop poster__prop--b" />
      <span class="poster__prop poster__prop--c" />
      <div class="poster__cast">
        {CAST[id].map(([c, e], i) => <Character key={c} color={c} size={i === 1 ? Math.round(size * 1.15) : size} expression={e} look={i === 0 ? "end" : i === 2 ? "start" : null} />)}
      </div>
    </div>
  );
}

export interface PosterProps {
  id: GameId;
  /** The content language: the title speaks the language the game will be played in (§2.2). */
  script: Locale;
  isNew?: boolean;
  passChip?: boolean;
  dim?: string | null;
  charSize?: number;
  class?: string;
}

export function Poster({ id, script, isNew, passChip, dim, charSize = 48, class: cls }: PosterProps) {
  return (
    <div class={`poster${dim ? " is-dim" : ""}${cls ? ` ${cls}` : ""}`} data-world={WORLD_OF[id]}>
      <div class="poster__stage" />
      {isNew && <span class="poster__badge poster__badge--new">{t("hub.new")}</span>}
      {passChip && <span class="poster__badge poster__badge--pass">{t("hub.passChip")}</span>}
      <PosterArt id={id} size={charSize} />
      <div class="poster__title"><TitleLockup id={id} script={script} /></div>
      <p class="poster__tagline">{t(`game.${id}.tagline` as MessageKey)}</p>
      {dim && <p class="poster__dim">{dim}</p>}
    </div>
  );
}
