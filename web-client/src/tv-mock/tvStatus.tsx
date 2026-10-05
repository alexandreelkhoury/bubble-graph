// TV-01 splash, TV-13 connection states, fatal screens, and the presence toasts (TV-02 joins/leaves, TV-13c away).
import { useEffect, useRef, useState } from "preact/hooks";
import type { TvView } from "@mishana/shared/protocol";
import { isolate, t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { ROLE_KEY } from "../lib/keys";
import { newForfeits } from "../lib/view";
import { pushToast } from "../state/store";
import { Icon } from "../components/Icon";
import { tvConn, tvCreateRoom, tvDownSince, tvPaused, tvUi, tvWake } from "./tvStore";
import { useInitialFocus } from "./dpad";

export function Splash({ failed }: { failed: string | null }) {
  const retry = useInitialFocus<HTMLButtonElement>(failed);
  return (
    <div class="tvscreen tvhome">
      <div class="tvhome__pattern" aria-hidden="true" />
      <img class="tvhome__mark" src="/brand/mark.svg" alt="" width={48} height={48} />
      <img class="tvhome__wordmark" src="/brand/wordmark-bilingual.svg" alt="Mish Ana! مش أنا!" width={560} height={140} />
      <p class="tvt-body tv-secondary tvhome__slogan">{t("brand.slogan")}</p>
      <div class="tvhome__status">
        {failed === null ? (
          <p class="tvt-body"><Icon name="refresh" size={24} class="spin" />{t("tv.creatingRoom")}</p>
        ) : (
          <>
            <p class="tvt-headline">{t("tv.createFailed")}</p>
            <p class="tvt-caption tv-muted tnum">{failed}</p>
            <button type="button" ref={retry} class="tvbtn tvbtn--primary" data-default-focus onClick={() => void tvCreateRoom()}><Icon name="refresh" />{t("common.retry")}</button>
          </>
        )}
      </div>
      <p class="tvt-caption tv-muted tvhome__foot">{t("brand.tagline")} · 3–12 · FR / EN / AR</p>
    </div>
  );
}

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
export function ConnStates({ view }: { view: TvView | null }) {
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

/** TV-13d: every phone has been away for a minute mid-game. */
export function PhonesAsleep({ view }: { view: TvView }) {
  const inGame = view.phase !== "LOBBY" && view.phase !== "RESULTS";
  const none = view.players.every((p) => !p.connected);
  const since = useRef<number | null>(null);
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 5000);
    return () => clearInterval(id);
  }, []);
  if (!(inGame && none)) { since.current = null; return null; }
  since.current ??= Date.now();
  // A running timer decides on its own: "the game is waiting" is only true with timers off.
  return Date.now() - since.current > 60_000 ? <div class="tvconnbanner tvconnbanner--soft">{t(view.deadline ? "conn.phonesAsleepTimer" : "conn.phonesAsleep")}</div> : null;
}

/** Lobby join/leave toasts (TV-02 toast zone), in-game away toasts (TV-13c) and forfeits with the revealed role. */
export function usePresenceToasts(view: TvView | null): void {
  const prev = useRef<TvView | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = view;
    if (!p || !view || p.roomCode !== view.roomCode) return;
    const before = new Map(p.players.map((x) => [x.id, x]));
    const after = new Set(view.players.map((x) => x.id));
    if (view.phase === "LOBBY" && p.phase === "LOBBY") {
      for (const x of view.players) if (!before.has(x.id)) pushToast(t("lobby.joined", { name: isolate(x.name) }), "success");
      for (const x of p.players) if (!after.has(x.id)) pushToast(t("lobby.left", { name: isolate(x.name) }));
    } else if (view.phase !== "LOBBY") {
      for (const x of view.players) {
        const b = before.get(x.id);
        if (b && b.connected && !x.connected && !x.left) pushToast(t("conn.playerAway", { name: isolate(x.name) }));
      }
      for (const f of newForfeits(p, view)) pushToast(t("elim.forfeit", { name: isolate(f.player.name), role: t(ROLE_KEY[f.role]) }));
    }
  }, [view]);
}
