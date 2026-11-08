// TV-13 connection states, the closed and fatal screens, and the in-game presence toasts (TV-13c away, leaves).
// The hub shows its own live-join toast above the members strip (tvHub).
import { useEffect, useRef, useState } from "preact/hooks";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { isolate, t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { pushToast } from "../state/store";
import { Icon } from "../components/Icon";
import { tvConn, tvCreateRoom, tvDownSince, tvPaused, tvUi, tvWake } from "./tvStore";
import { useInitialFocus } from "./dpad";

/** After Exit: what an Android TV launcher would show, reduced to the one thing the remote can do here. */
export function Closed() {
  const btn = useInitialFocus<HTMLButtonElement>();
  return (
    <div class="tvscreen tvfatal">
      <img class="tvhome__mark" src="/brand/mark.svg" alt="" width={48} height={48} />
      <h1 class="tvt-headline">{t("tv.appClosed")}</h1>
      <button type="button" ref={btn} class="tvbtn tvbtn--primary" data-default-focus onClick={() => void tvCreateRoom()}><Icon name="play" />{t("tv.openAgain")}</button>
    </div>
  );
}

export function Fatal({ messageKey }: { messageKey: MessageKey }) {
  const btn = useInitialFocus<HTMLButtonElement>();
  const expired = messageKey === "error.roomExpired";
  return (
    <div class="tvscreen tvfatal">
      <span class="tvfatal__icon"><Icon name={expired ? "door-out" : "wifi-off"} size={96} /></span>
      <h1 class="tvt-headline">{expired ? t("tv.roomClosed") : t(messageKey)}</h1>
      {expired && <p class="tvt-body tv-secondary">{t(messageKey)}</p>}
      <button type="button" ref={btn} class="tvbtn tvbtn--primary" data-default-focus onClick={() => void tvCreateRoom()}><Icon name="plus" />{t("tv.newRoom")}</button>
    </div>
  );
}

/** TV-13a reconnecting banner (frozen stage), then TV-13b after 30 s: a full-screen "Connection lost" with Retry. */
export function ConnStates({ view }: { view: TvRoomView | null }) {
  const down = tvConn.value !== "open" && tvUi.value.kind === "room";
  const [, force] = useState(0);
  useEffect(() => {
    if (!down) return;
    const id = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [down]);
  const since = tvDownSince.value;
  if (!down || since === null || !view) return null;
  if (Date.now() - since > 30_000) {
    // Back opens the pause menu (Exit lives there): it replaces this screen until Resume (Kotlin: lostOverlay && !paused).
    if (tvPaused.value) return null;
    return (
      <div class="tvoverlay tvoverlay--solid">
        <div class="tvfatal">
          <span class="tvfatal__icon"><Icon name="wifi-off" size={96} /></span>
          <h1 class="tvt-headline">{t("conn.lost")}</h1>
          <p class="tvt-body tv-secondary tvfatal__body">{t("conn.tvLostBody")}</p>
          <button type="button" class="tvbtn tvbtn--primary" data-default-focus onClick={tvWake} autoFocus><Icon name="refresh" />{t("common.retry")}</button>
        </div>
      </div>
    );
  }
  return (
    <>
      <div class="tvfreeze" aria-hidden="true" />
      <div class="tvconnbanner" role="status"><Icon name="refresh" size={24} class="spin" />{t("conn.tvReconnecting")}</div>
    </>
  );
}

/** In game: "Lost connection with {name}" (TV-13c) and "{name} left" toasts, from the room's members. */
export function usePresenceToasts(view: TvRoomView | null): void {
  const prev = useRef<TvRoomView | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = view;
    if (!p || !view || p.room.roomCode !== view.room.roomCode || view.room.phase === "HUB") return;
    const before = new Map(p.room.members.map((x) => [x.id, x]));
    const after = new Set(view.room.members.map((x) => x.id));
    for (const x of view.room.members) {
      const b = before.get(x.id);
      if (b && b.connected && !x.connected && !x.left) pushToast(t("conn.playerAway", { name: isolate(x.name) }));
      if (b && !b.left && x.left) pushToast(t("lobby.left", { name: isolate(x.name) }));
    }
    for (const x of p.room.members) if (!after.has(x.id) && !x.left) pushToast(t("lobby.left", { name: isolate(x.name) }));
  }, [view]);
}
