// JAMAA-PLATFORM §3.6 / DESIGN-JAMAA §2.4 HUB-07: the ⓘ rules side sheet on the END side (right in LTR, left in RTL),
// 420 dp on the hub and setup, 360 dp in game, opaque, a 24 dp shadow edge and NO scrim: the game stays visible and
// keeps running. Local only (sends nothing). "Close" has the initial focus; Up/Down scroll by a third of the screen.
import { useEffect, useRef } from "preact/hooks";
import type { GameId } from "@jamaa/shared/games/ids";
import { locale, t } from "../i18n/t";
import { RulesBody } from "../components/RulesBody";
import { TitleLockup, WORLD_OF } from "../components/Poster";
import { Icon } from "../components/Icon";
import { closeRules } from "./tvDialogs";
import { useInitialFocus } from "./dpad";

export const RULES_SCROLL_STEP = 180; // 1/3 of the 540 dp canvas

/**
 * Up/Down move a third of the screen, snapped to a section start inside that third so a heading never stops half
 * hidden under the top edge (a long section without a heading in reach scrolls by the plain step).
 */
export function snapScroll(at: number, dir: 1 | -1, starts: readonly number[], max: number, step = RULES_SCROLL_STEP): number {
  const target = at + dir * step;
  const inReach = starts.map((s) => s - 8).filter((s) => (dir === 1 ? s > at + 1 && s <= target : s < at - 1 && s >= target));
  const next = inReach.length ? (dir === 1 ? Math.max(...inReach) : Math.min(...inReach)) : target;
  return Math.max(0, Math.min(max, next));
}

export function RulesSheet({ id, hub, phase, inGame }: { id: GameId; hub: boolean; phase: string | null; inGame: boolean }) {
  const close = useInitialFocus<HTMLButtonElement>(id);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      const b = body.current;
      if (!b) return;
      e.preventDefault();
      const top = b.getBoundingClientRect().top;
      const starts = [...b.querySelectorAll<HTMLElement>(".rules__hereLabel, .rules__h")].map((h) => h.getBoundingClientRect().top - top + b.scrollTop);
      b.scrollTo({ top: snapScroll(b.scrollTop, e.key === "ArrowDown" ? 1 : -1, starts, b.scrollHeight - b.clientHeight), behavior: "smooth" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div class={`tvoverlay tvoverlay--clear tvrules${inGame ? " tvrules--game" : ""}`} role="dialog" aria-modal="true" aria-label={t("rules.title")} data-rules={id}>
      <div class="tvrules__sheet" data-world={WORLD_OF[id]}>
        <header class="tvrules__head">
          <TitleLockup id={id} script={locale.value} class="tvrules__lockup" />
          <h2 class="tvt-headline">{t("rules.title")}</h2>
        </header>
        <div class="tvrules__body" ref={body}>
          <RulesBody id={id} phase={phase} hub={hub} />
        </div>
        <footer class="tvrules__foot">
          {inGame && <span class="tvt-caption tv-muted tvrules__note"><Icon name="timer" size={18} />{t("rules.keepsRunning")}</span>}
          <button type="button" ref={close} class="tvbtn tvbtn--primary" data-default-focus data-rules-close onClick={closeRules}>{t("common.close")}</button>
        </footer>
      </div>
    </div>
  );
}
