// JAMAA-PLATFORM §3.3 PHH-02 / DESIGN-JAMAA §2.6: the phone follows the TV's carousel. A big poster card for
// `focusedGameId` slides left/right as the TV focus moves (direction from the registry order, mirrored in RTL). The VIP
// can swipe through the games locally (never HUB_FOCUS from a phone); local browsing holds for 6 s after the last swipe,
// with a "TV: {game}" chip to resync, then follows the TV again. The VIP opens the shown game (OPEN_GAME).
import { useEffect, useRef, useState } from "preact/hooks";
import type { GameId } from "@jamaa/shared/games/ids";
import type { PlayerRoomView } from "@jamaa/shared/protocol/v2";
import { isolate, LOCALE_NATIVE_NAME, locale, t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { act } from "../state/session";
import { shownCard } from "../state/store";
import { Poster, WORLD_OF } from "../components/Poster";
import { Button } from "../components/UI";
import { Icon } from "../components/Icon";
import { MembersStrip, ReactionsBar } from "./Reactions";

export const LOCAL_BROWSE_HOLD_MS = 6000;

export function Hub({ view }: { view: PlayerRoomView }) {
  const room = view.room;
  const myId = view.me?.id ?? null;
  const vip = myId !== null && room.hostPlayerId === myId;
  const ids = room.games.map((g) => g.id);
  const tvId: GameId = ids.includes(room.focusedGameId) ? room.focusedGameId : ids[0] ?? "mishana";
  const [local, setLocal] = useState<{ id: GameId; at: number } | null>(null);
  const shown: GameId = vip && local ? local.id : tvId;
  const prevShown = useRef(shown);
  const [dir, setDir] = useState<"next" | "prev" | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const rtl = locale.value === "ar";

  useEffect(() => { shownCard.value = shown; return () => { shownCard.value = null; }; }, [shown]);
  useEffect(() => {
    const a = ids.indexOf(prevShown.current), b = ids.indexOf(shown);
    if (a >= 0 && b >= 0 && a !== b) setDir(b > a ? "next" : "prev");
    prevShown.current = shown;
  }, [shown]);
  useEffect(() => {
    if (!local) return;
    const id = setTimeout(() => setLocal(null), Math.max(0, local.at + LOCAL_BROWSE_HOLD_MS - Date.now()));
    return () => clearTimeout(id);
  }, [local]);

  const step = (d: 1 | -1): void => {
    if (!vip || ids.length < 2) return;
    const i = ids.indexOf(shown);
    setLocal({ id: ids[(i + d + ids.length) % ids.length]!, at: Date.now() });
  };
  const onStart = (e: TouchEvent): void => { const p = e.touches[0]; if (p) touch.current = { x: p.clientX, y: p.clientY }; };
  const onEnd = (e: TouchEvent): void => {
    const s = touch.current, p = e.changedTouches[0];
    touch.current = null;
    if (!s || !p) return;
    const dx = p.clientX - s.x, dy = p.clientY - s.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    // Swiping toward the reading start shows the next game (the card moves the way the finger goes).
    step((dx < 0) !== rtl ? 1 : -1);
  };

  const card = room.games.find((g) => g.id === shown);
  const host = room.members.find((m) => m.id === room.hostPlayerId);
  const active = room.members.filter((m) => !m.left).length;
  const needs = card && active < card.minPlayers;
  const lang = LOCALE_NATIVE_NAME[room.contentLocale];
  return (
    <main class="screen screen--hub" data-world={WORLD_OF[shown]}>
      <div class="hubph__tint" aria-hidden="true" />
      <p class="hubph__line">
        {vip ? t("hub.pickingNoHost") : host ? t("hub.picking", { name: isolate(host.name) }) : t("hub.pickingNoHost")}
      </p>
      {vip && local && local.id !== tvId && (
        <button type="button" class="hubph__tvchip" onClick={() => setLocal(null)}>
          <Icon name="tv" size={18} />{t("hub.tvFocus", { game: t(`game.${tvId}.title` as MessageKey) })}
        </button>
      )}
      <div class="hubph__deck" onTouchStart={onStart} onTouchEnd={onEnd}>
        {vip && ids.length > 1 && <button type="button" class="hubph__nav hubph__nav--prev" aria-label={t("common.back")} onClick={() => step(-1)}><Icon name="chevron-back" class="flip-rtl" /></button>}
        <div class={`hubph__card${dir ? ` is-${dir}` : ""}`} key={shown} aria-live="polite">
          <Poster id={shown} script={room.contentLocale} charSize={84} class="poster--phone"
            dim={card && !card.available ? t("hub.notAvailable", { language: lang }) : null} />
        </div>
        {vip && ids.length > 1 && <button type="button" class="hubph__nav hubph__nav--next" aria-label={t("setup.next")} onClick={() => step(1)}><Icon name="chevron-forward" class="flip-rtl" /></button>}
      </div>
      {card && (
        <p class="hubph__meta tnum">
          <span class={needs ? "is-danger" : undefined}>{needs ? t("hub.needsPlayers", { count: card.minPlayers }) : t("hub.players", { min: card.minPlayers, max: card.maxPlayers })}</span>
          <span aria-hidden="true"> · </span>{t("hub.minutes", { min: card.durationMinutes[0], max: card.durationMinutes[1] })}
        </p>
      )}
      {ids.length > 1 && <div class="hubph__dots" aria-hidden="true">{ids.map((g) => <i key={g} class={g === shown ? "is-on" : undefined} />)}</div>}
      {vip && <Button class="hubph__open" disabled={!card} onClick={() => act({ type: "OPEN_GAME", gameId: shown })}>{t("hub.openGame")}</Button>}
      <div class="hubph__bottom">
        <MembersStrip members={room.members} myId={myId} />
        <ReactionsBar />
      </div>
    </main>
  );
}
