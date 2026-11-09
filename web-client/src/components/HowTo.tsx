// JAMAA-PLATFORM §3.2 HUB-03 / §3.3 PHH-03, DESIGN-JAMAA §2.5: the how-to cards of a game (`rules.howToKeys`), each
// with a small scene of characters acting the step (no extra assets), shared by the TV intro and the phone sheet.
import type { ColorId } from "@jamaa/shared/constants";
import type { GameId } from "@jamaa/shared/games/ids";
import { metaOf } from "../lib/meta";
import { t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import type { Expression } from "@jamaa/shared/characters";
import { Character } from "./Character";
import { WORLD_OF } from "./Poster";

/** Per card: three characters and their expressions (step 1 → 4: receive, talk, vote, finale). */
const SCENES: readonly (readonly [ColorId, Expression][])[] = [
  [["coral", "think"], ["azure", "shy"], ["jade", "think"]],
  [["coral", "point"], ["azure", "laugh"], ["jade", "idle"]],
  [["coral", "point"], ["azure", "shock"], ["jade", "point"]],
  [["coral", "cheer"], ["azure", "happy"], ["jade", "smug"]],
];

export function howToKeys(id: GameId): readonly string[] {
  return metaOf(id)?.rules.howToKeys ?? [];
}

export function HowToScene({ index, size }: { index: number; size: number }) {
  const scene = SCENES[index % SCENES.length]!;
  return (
    <div class={`howto__scene howto__scene--${index % SCENES.length}`} aria-hidden="true">
      {scene.map(([c, e], i) => <Character key={`${index}:${c}`} color={c} size={i === 1 ? Math.round(size * 1.2) : size} expression={e} look={i === 0 ? "end" : i === 2 ? "start" : null} />)}
    </div>
  );
}

/** One card: the scene, "1/4", the sentence. */
export function HowToCard({ id, index, size, class: cls }: { id: GameId; index: number; size: number; class?: string }) {
  const keys = howToKeys(id);
  if (keys.length === 0) return <div class={`howto__card${cls ? ` ${cls}` : ""}`} data-world={WORLD_OF[id]} />;
  return (
    <div class={`howto__card${cls ? ` ${cls}` : ""}`} data-world={WORLD_OF[id]} key={index}>
      <HowToScene index={index} size={size} />
      <p class="howto__step tnum">{t("setup.introProgress", { current: index + 1, total: keys.length })}</p>
      <p class="howto__text">{t(keys[index] as MessageKey)}</p>
    </div>
  );
}

export function Dots({ n, i }: { n: number; i: number }) {
  return <div class="howto__dots" aria-hidden="true">{Array.from({ length: n }, (_, k) => <i key={k} class={k === i ? "is-on" : undefined} />)}</div>;
}
