// JAMAA-PLATFORM §3.6 (phone): the ⓘ rules bottom sheet (≤ 85 % height, ✕ or swipe down to close). The game keeps
// running underneath; when this phone owes an action, a sticky "Your turn! ✕ to go back" banner appears with a haptic
// tick. The sheet is never closed by force, so nothing is lost mid-read.
import { useEffect, useRef } from "preact/hooks";
import type { GameId } from "@jamaa/shared/games/ids";
import { t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { RulesBody } from "../components/RulesBody";
import { TitleLockup, WORLD_OF } from "../components/Poster";
import { Icon } from "../components/Icon";
import { HAPTIC, haptic } from "../lib/haptics";
import { locale } from "../i18n/t";

export function RulesSheet({ id, phase, hub, yourTurn, onClose }: { id: GameId; phase: string | null; hub: boolean; yourTurn: boolean; onClose(): void }) {
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    queueMicrotask(() => panel.current?.querySelector<HTMLElement>(".rsheet__close")?.focus());
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, []);
  useEffect(() => { if (yourTurn) haptic(HAPTIC.yourTurn); }, [yourTurn]);
  const onDown = (e: PointerEvent): void => { drag.current = { y: e.clientY, dy: 0 }; };
  const onMove = (e: PointerEvent): void => {
    const d = drag.current;
    if (!d || !panel.current) return;
    d.dy = Math.max(0, e.clientY - d.y);
    panel.current.style.transform = `translateY(${d.dy}px)`;
  };
  const onUp = (): void => {
    const d = drag.current;
    drag.current = null;
    if (!panel.current) return;
    panel.current.style.transform = "";
    if (d && d.dy > 90) onClose();
  };
  return (
    <div class="sheet-root">
      <div class="scrim" onClick={onClose} />
      <div class="sheet rsheet" data-world={WORLD_OF[id]} role="dialog" aria-modal="true" aria-label={`${t(`game.${id}.title` as MessageKey)} · ${t("rules.title")}`} ref={panel}>
        <header class="rsheet__head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <span class="sheet__handle" aria-hidden="true" />
          <TitleLockup id={id} script={locale.value} class="rsheet__lockup" />
          <h2 class="rsheet__title">{t("rules.title")}</h2>
          <button type="button" class="iconbtn rsheet__close" aria-label={t("common.close")} onClick={onClose}><Icon name="x" /></button>
        </header>
        {yourTurn && <p class="rsheet__turn" role="alert"><Icon name="hand-press" size={20} />{t("rules.yourTurn")}</p>}
        <div class="rsheet__body">
          <RulesBody id={id} phase={phase} hub={hub} />
          <p class="rsheet__note"><Icon name="timer" size={16} />{t("rules.keepsRunning")}</p>
        </div>
      </div>
    </div>
  );
}
