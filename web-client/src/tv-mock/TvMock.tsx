// Browser TV mock (/tv): a faithful 960 × 540 rendering of the DESIGN TV screens, with host controls,
// so the game is playable without Android TV. Arrow keys = D-pad, Enter = OK, Escape/Backspace = Back.
import "./tv.css";
import { useEffect, useRef, useState } from "preact/hooks";
import type { TvView } from "@mishana/shared/protocol";
import { dirOf, locale, t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { pushToast, toasts } from "../state/store";
import { Icon } from "../components/Icon";
import { tvConn, tvCreateRoom, tvDownSince, tvPaused, tvScreen, tvStop, tvUi, tvView, tvWake } from "./tvStore";
import { TvLobby, TvSettings } from "./tvLobby";
import { TvClues, TvRoleReveal, TvVoting } from "./tvGame";
import { TvElimination, TvGuess, TvResults } from "./tvReveal";
import { PauseMenu, TvDialog, closeDialog, tvDialog } from "./tvDialogs";
import { useInitialFocus } from "./tvParts";

const W = 960;
const H = 540;

function useScale(): number {
  const [s, setS] = useState(1);
  useEffect(() => {
    const f = (): void => setS(Math.min(window.innerWidth / W, window.innerHeight / H));
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return s;
}

/** D-pad emulation: move focus to the nearest focusable in the arrow's direction (geometry, so RTL mirrors naturally). */
export function moveFocus(root: HTMLElement, key: string): boolean {
  const scope = (root.querySelector(".tvoverlay:last-of-type") as HTMLElement | null) ?? root;
  const all = [...scope.querySelectorAll<HTMLElement>("button:not([disabled]), [tabindex='0']")].filter((n) => n.offsetParent !== null || n.getClientRects().length > 0);
  if (all.length === 0) return false;
  const cur = document.activeElement as HTMLElement | null;
  if (!cur || !all.includes(cur)) { all[0]!.focus(); return true; }
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let bestCost = Infinity;
  for (const n of all) {
    if (n === cur) continue;
    const b = n.getBoundingClientRect();
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const dx = bx - ax, dy = by - ay;
    let primary: number, secondary: number;
    if (key === "ArrowRight") { primary = dx; secondary = dy; }
    else if (key === "ArrowLeft") { primary = -dx; secondary = dy; }
    else if (key === "ArrowDown") { primary = dy; secondary = dx; }
    else { primary = -dy; secondary = dx; }
    if (primary <= 4) continue;
    const cost = primary + 2.5 * Math.abs(secondary);
    if (cost < bestCost) { bestCost = cost; best = n; }
  }
  if (best) { best.focus(); best.scrollIntoView?.({ block: "nearest" }); return true; }
  return false;
}

function Splash({ failed }: { failed: string | null }) {
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
            <p class="tvt-caption tv-muted num">{failed}</p>
            <button type="button" ref={retry} class="tvbtn tvbtn--primary" onClick={() => void tvCreateRoom()}><Icon name="refresh" />{t("common.retry")}</button>
          </>
        )}
      </div>
      <p class="tvt-caption tv-muted tvhome__foot">{t("brand.tagline")} · 3–12 · FR / EN / AR</p>
    </div>
  );
}

function Fatal({ messageKey }: { messageKey: MessageKey }) {
  const btn = useInitialFocus<HTMLButtonElement>();
  return (
    <div class="tvscreen tvfatal">
      <span class="tvfatal__icon"><Icon name={messageKey === "error.roomExpired" ? "door-out" : "wifi-off"} size={96} /></span>
      <h1 class="tvt-headline">{messageKey === "error.roomExpired" ? t("tv.roomClosed") : t(messageKey)}</h1>
      {messageKey === "error.roomExpired" && <p class="tvt-body tv-secondary">{t(messageKey)}</p>}
      <button type="button" ref={btn} class="tvbtn tvbtn--primary" onClick={() => void tvCreateRoom()}><Icon name="plus" />{t("tv.newRoom")}</button>
    </div>
  );
}

function ConnStates({ view }: { view: TvView | null }) {
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
    return (
      <div class="tvoverlay tvoverlay--solid">
        <div class="tvfatal">
          <span class="tvfatal__icon"><Icon name="wifi-off" size={96} /></span>
          <h1 class="tvt-headline">{t("conn.lost")}</h1>
          <p class="tvt-body tv-secondary tvfatal__body">{t("conn.tvLostBody")}</p>
          <button type="button" class="tvbtn tvbtn--primary" onClick={tvWake} autoFocus><Icon name="refresh" />{t("common.retry")}</button>
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

function PhonesAsleep({ view }: { view: TvView }) {
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
  return Date.now() - since.current > 60_000 ? <div class="tvconnbanner tvconnbanner--soft">{t("conn.phonesAsleep")}</div> : null;
}

/** Lobby join/leave toasts and in-game away toasts (TV-02 toast zone, TV-13c). */
function usePresenceToasts(view: TvView | null): void {
  const prev = useRef<TvView | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = view;
    if (!p || !view || p.roomCode !== view.roomCode) return;
    const before = new Map(p.players.map((x) => [x.id, x]));
    const after = new Map(view.players.map((x) => [x.id, x]));
    if (view.phase === "LOBBY" && p.phase === "LOBBY") {
      for (const x of view.players) if (!before.has(x.id)) pushToast(t("lobby.joined", { name: "⁨" + x.name + "⁩" }), "success");
      for (const x of p.players) if (!after.has(x.id)) pushToast(t("lobby.left", { name: "⁨" + x.name + "⁩" }));
    } else if (view.phase !== "LOBBY") {
      for (const x of view.players) {
        const b = before.get(x.id);
        if (b && b.connected && !x.connected && !x.left) pushToast(t("conn.playerAway", { name: "⁨" + x.name + "⁩" }));
      }
      for (const h of view.history.slice(p.gameNumber === view.gameNumber ? p.history.length : view.history.length)) {
        if ((h.cause === "LEAVE" || h.cause === "KICK") && h.eliminatedId && h.role) {
          const x = after.get(h.eliminatedId);
          const roleKey: MessageKey = h.role === "CIVILIAN" ? "role.civilian" : h.role === "UNDERCOVER" ? "role.undercover" : "role.blank";
          if (x) pushToast(t("elim.forfeit", { name: "⁨" + x.name + "⁩", role: t(roleKey) }));
        }
      }
    }
  }, [view]);
}

function Screen({ view }: { view: TvView }) {
  if (view.phase === "LOBBY") return tvScreen.value === "settings" ? <TvSettings view={view} /> : <TvLobby view={view} />;
  switch (view.phase) {
    case "ROLE_REVEAL": return <TvRoleReveal view={view} />;
    case "CLUES":
    case "TIE_BREAK": return <TvClues view={view} />;
    case "VOTING": return <TvVoting view={view} />;
    case "ELIMINATION": return <TvElimination view={view} />;
    case "MR_WHITE_GUESS": return <TvGuess view={view} />;
    case "RESULTS": return <TvResults view={view} />;
  }
}

export function TvMock() {
  const scale = useScale();
  const canvas = useRef<HTMLDivElement>(null);
  const ui = tvUi.value;
  const view = tvView.value;
  usePresenceToasts(view);
  useEffect(() => {
    void tvCreateRoom();
    const onVis = (): void => { if (document.visibilityState === "visible") tvWake(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", tvWake);
    document.title = "Mish Ana! · TV";
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", tvWake);
      tvStop();
    };
  }, []);
  // Settings that come from PLAY_AGAIN → "Change settings" open only once the lobby arrives.
  useEffect(() => { if (view && view.phase !== "LOBBY" && view.phase !== "RESULTS" && tvScreen.value === "settings") tvScreen.value = "main"; }, [view?.phase]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const root = canvas.current;
      if (!root) return;
      if (e.key.startsWith("Arrow")) {
        if (moveFocus(root, e.key)) e.preventDefault();
        return;
      }
      if (e.key === "Escape" || e.key === "Backspace" || e.key === "GoBack") {
        const target = e.target as HTMLElement | null;
        if (target && target.tagName === "INPUT") return;
        e.preventDefault();
        if (tvDialog.value) { closeDialog(); return; }
        if (tvPaused.value) { tvPaused.value = false; return; }
        const v = tvView.value;
        if (v && v.phase !== "LOBBY") tvPaused.value = true;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Keep something focused (TV rule): restore the screen default when focus is lost.
  useEffect(() => {
    const id = setInterval(() => {
      const root = canvas.current;
      const a = document.activeElement;
      if (root && (!a || a === document.body || !root.contains(a))) {
        const pill = root.querySelector<HTMLElement>(".tvoverlay button, [data-pill], .tvbtn--primary, button");
        pill?.focus();
      }
    }, 600);
    return () => clearInterval(id);
  }, []);
  const l = locale.value;
  let content;
  if (ui.kind === "creating" || ui.kind === "failed") content = <Splash failed={ui.kind === "failed" ? ui.error : null} />;
  else if (ui.kind === "fatal") content = <Fatal messageKey={ui.messageKey} />;
  else if (!view) content = <Splash failed={null} />;
  else content = <Screen view={view} />;
  const screenKey = view ? `${view.phase}:${view.round}:${view.gameNumber}:${tvScreen.value}` : ui.kind;
  return (
    <div class="tv" lang={l} dir={dirOf(l)}>
      <div class="tv__canvas" ref={canvas} style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div class="tv__bg" aria-hidden="true" />
        <div class="tv__stage" key={screenKey}>{content}</div>
        {view && ui.kind === "room" && view.phase !== "LOBBY" && !tvPaused.value && (
          <button type="button" class="tvmenu-btn" tabIndex={-1} aria-label={t("tv.pauseTitle")} onClick={() => { tvPaused.value = true; }}><Icon name="pause" size={20} /></button>
        )}
        {view && tvPaused.value && <PauseMenu view={view} />}
        <TvDialog />
        {ui.kind === "room" && <ConnStates view={view} />}
        {view && <PhonesAsleep view={view} />}
        <div class="tvtoasts" aria-live="polite">
          {toasts.value.map((x) => <div key={x.id} class={`tvtoast tvtoast--${x.tone}`}>{x.text}</div>)}
        </div>
      </div>
    </div>
  );
}
