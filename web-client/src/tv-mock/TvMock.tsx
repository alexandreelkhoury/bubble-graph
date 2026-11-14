// Browser TV (/tv): the JAMAA platform on a 960 × 540 canvas, driven by the remote only (JAMAA-PLATFORM §3.2).
// Arrow keys = D-pad, Enter = OK, Escape/Backspace = Back, `i` = INFO (rules), F = full screen.
// HUB-01 splash → HUB-02 hub → (portal) HUB-03 setup → (entrance) the game → HUB-05 results bar → hub/setup/replay.
import "./tv.css";
import "./tvPlatform.css";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { GameId } from "@jamaa/shared/games/ids";
import type { RoomPhase } from "@jamaa/shared/room";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { dirOf, locale, registerRootExtras, t } from "../i18n/t";
import { toasts } from "../state/store";
import {
  inRunningGame, openedGames, tvAct, tvAdvanced, tvCreateRoom, tvCupOpen, tvExit, tvHubSettings, tvIntro, tvLangOpen, tvPackPicker, tvQuizShelf,
  tvPaused, tvRules, tvScale, tvShop, tvStop, tvUi, tvView,
} from "./tvStore";
import { TvShop } from "./tvShop";
import { bootBilling, useBillingView, useBillingVisibility } from "./billingEffects";
import { loadBillingFlag } from "../lib/billingFlag";
import { canvasRect, CupSheet, Splash, TvHub } from "./tvHub";
import { AdvancedSheet, PackPicker, TvQuizShelf, TvSetup } from "./tvSetup";
import { isTriviaSetup } from "../games/trivia/setupModel";
import { TvGameHost, tvGameModule, loadTvGame } from "./tvGameHost";
import { RulesSheet } from "./tvRules";
import { Entrance, Portal, PortalBack } from "./tvTransitions";
import type { Box } from "./tvTransitions";
import {
  closeRules, closeTopOverlay, HubSettings, LanguagePicker, openDialog, openPause, openRules, PauseMenu, TvDialog, TvPicker, tvDialog, tvPicker,
} from "./tvDialogs";
import { Closed, ConnStates, Fatal, usePresenceToasts } from "./tvStatus";
import { isBackKey, useDpad } from "./dpad";
import { useRemoteSounds, soundCue } from "./sound/controller";
import { inGameOk } from "./tvParts";
import { applyInputRule, armGuard, transitionFor } from "./tvPlatform";
import { calm } from "../lib/motion";
import { registerIcons } from "../components/Icon";
import { TV_ICONS } from "../components/iconsTv";

registerIcons(TV_ICONS);
// The TV part of the root catalogs (the Store, the Pass, TV-only strings; lib/i18nSplit.ts): phones never load it.
void registerRootExtras({
  en: () => import("virtual:jamaa-i18n-tv/en"), fr: () => import("virtual:jamaa-i18n-tv/fr"),
  ar: () => import("virtual:jamaa-i18n-tv/ar"), es: () => import("virtual:jamaa-i18n-tv/es"),
}).catch(() => undefined);

/** How long an optimistic portal waits for the room's SETUP before it rolls back into the poster. */
export const PORTAL_ANSWER_MS = 4000;
const W = 960;
const H = 540;

/** Fits the 960 × 540 canvas into the window; the offset is snapped to whole pixels so 1 dp edges stay crisp. */
function useCanvasBox(): { scale: number; x: number; y: number } {
  const measure = (): { scale: number; x: number; y: number } => {
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    return { scale, x: Math.round((window.innerWidth - W * scale) / 2), y: Math.round((window.innerHeight - H * scale) / 2) };
  };
  const [box, setBox] = useState(measure);
  useEffect(() => {
    const f = (): void => setBox(measure());
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  useEffect(() => { tvScale.value = box.scale; }, [box.scale]);
  return box;
}

/** F toggles full screen (a laptop host otherwise plays in a tab with the browser chrome). */
function useFullscreenKey(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.key !== "f" && e.key !== "F") || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
      else void document.documentElement.requestFullscreen?.().catch(() => undefined);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

type Tr =
  /** `ready`: the room is in SETUP for this game (false while the portal runs optimistically from the TV's own OK). */
  | { kind: "portal"; id: GameId; from: Box | null; first: boolean; handed: boolean; ready: boolean; hub: TvRoomView }
  | { kind: "back"; id: GameId }
  | { kind: "entrance"; id: GameId };

export function TvMock() {
  const box = useCanvasBox();
  const canvas = useRef<HTMLDivElement>(null);
  const hubRoot = (): HTMLElement | null => canvas.current?.querySelector<HTMLElement>(".tvhub") ?? null;
  const ui = tvUi.value;
  const view = tvView.value;
  const [, force] = useState(0);
  const tr = useRef<Tr | null>(null);
  const lastPhase = useRef<RoomPhase | null>(null);
  const lastHub = useRef<TvRoomView | null>(null);
  const portalFrom = useRef<{ id: GameId; box: Box | null } | null>(null);
  const lastGameKey = useRef<string | null>(null);
  useBillingView(view);
  useBillingVisibility();
  usePresenceToasts(view);
  useRemoteSounds(canvas, isBackKey);

  // Decide transitions synchronously on the render that first sees a new phase (no frame of the next screen leaks).
  if (view) {
    const phase = view.room.phase;
    if (phase === "HUB") lastHub.current = view;
    if (lastPhase.current !== phase) {
      const kind = transitionFor(lastPhase.current, phase);
      lastPhase.current = phase;
      const id = view.room.setupGameId ?? view.game?.gameId ?? view.room.focusedGameId;
      const cur0 = tr.current;
      if (kind === "portal" && cur0?.kind === "portal" && cur0.id === id && !cur0.ready) {
        // The optimistic portal started on OK is already running: SETUP only allows its hand-off.
        tr.current = { ...cur0, ready: true };
      } else if (kind === "portal" && lastHub.current) {
        const from = portalFrom.current?.id === id ? portalFrom.current.box : null;
        tr.current = { kind: "portal", id, from, first: !openedGames.has(id), handed: false, ready: true, hub: lastHub.current };
        openedGames.add(id);
        soundCue("portal_open");
      } else if (kind === "back") {
        tr.current = { kind: "back", id };
        soundCue("portal_close");
      } else if (kind === "entrance" && view.game) {
        tr.current = { kind: "entrance", id: view.game.gameId };
        void loadTvGame(view.game.gameId);
        soundCue(`world_${view.game.gameId}_sting` as "world_mishana_sting");
      } else if (kind === "guard") {
        tr.current = null;
        armGuard();
      }
    }
    // REPLAY: a new instance of the same game also gets the guard (results → in game).
    const gk = view.game ? `${view.game.gameId}:${view.game.n}` : null;
    if (gk !== lastGameKey.current) {
      if (lastGameKey.current !== null && gk !== null) armGuard();
      lastGameKey.current = gk;
    }
  } else {
    lastPhase.current = null;
  }

  useEffect(() => {
    // PAYMENTS-SPEC §5.2: the catalog (mode) and a token first, so the room can be created with it.
    void loadBillingFlag().then(() => bootBilling()).then(() => tvCreateRoom());
    document.title = "JAMAA · TV";
    return () => tvStop();
  }, []);
  // The input rule (capture phase, before the D-pad and the buttons) and the INFO key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (applyInputRule(e)) return;
      const v = tvView.value;
      if ((e.key === "i" || e.key === "I" || e.key === "Info" || e.key === "ContextMenu") && !e.repeat && v && tvUi.value.kind === "room") {
        if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
        e.preventDefault();
        if (tvRules.value) { closeRules(); return; }
        // The interface-language list renders above the rules sheet and Back closes it first: INFO waits until it is closed.
        if (tvDialog.value || tvPicker.value || tvShop.value || tvIntro.value || tvLangOpen.value) return;
        const room = v.room;
        if (room.phase === "PLAYING" && v.game) { tvPaused.value = false; openRules({ id: v.game.gameId, hub: false, fromPause: false }); }
        else if (room.phase === "SETUP" && room.setupGameId) openRules({ id: room.setupGameId, hub: false, fromPause: false });
        else openRules({ id: room.focusedGameId, hub: true, fromPause: false });
        return;
      }
      // §3.10 E rule 5: in game OK only completes a local reveal (no focusable buttons in game).
      if ((e.key === "Enter" || e.key === " ") && v && inRunningGame(v) && !tvPaused.value && !tvRules.value && !tvDialog.value) {
        // A host dialog's own buttons (Mish Ana!'s guess override) keep OK; anywhere else OK completes the reveal.
        const a = document.activeElement as HTMLElement | null;
        const onControl = !!a && a.matches("button, [tabindex]") && a.tabIndex >= 0;
        if (!onControl && inGameOk()) { e.preventDefault(); e.stopImmediatePropagation(); }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  // The rules sheet closes by itself when the TV must act (a host dialog, e.g. Mish Ana!'s guess override; §3.6).
  useEffect(() => {
    const g = view?.game;
    if (!view || !g || !tvRules.value) return;
    if (tvGameModule(g.gameId)?.hostDialogOpen?.(view)) closeRules();
  }, [view]);
  // Back: the innermost overlay; in a running game the pause menu; on setup → hub; on the hub "Close JAMAA?".
  useDpad(canvas, () => {
    if (closeTopOverlay()) return;
    const v = tvView.value;
    if (!v || tvUi.value.kind !== "room") return;
    const room = v.room;
    // On the results the menu still opens (Resume, Rules, Sound: native PauseMenuModel), without game items or Quit.
    if (room.phase === "PLAYING") { openPause(); return; }
    if (room.phase === "SETUP") { tvAct({ type: "CLOSE_GAME" }); return; }
    openDialog({
      title: t("hub.closeConfirm.title"), body: t("hub.closeConfirm.body"), confirm: t("hub.closeConfirm.close"),
      safe: t("hub.closeConfirm.stay"), danger: true, onConfirm: tvExit,
    });
  });
  useFullscreenKey();

  const l = locale.value;
  const room = ui.kind === "room" && view !== null;
  const cur = tr.current;
  const done = (): void => { tr.current = null; force((x) => x + 1); };
  /**
   * §3.10 A, optimistic: OK on a poster starts the portal at once (press dip, others out, the arch grows from the
   * poster); the hand-off waits for the room's SETUP. If the server does not answer (or refuses), the world shrinks
   * back into the poster.
   */
  const startPortal = (id: GameId, from: Box | null, hub: TvRoomView): void => {
    portalFrom.current = { id, box: from };
    if (tr.current) return;
    tr.current = { kind: "portal", id, from, first: !openedGames.has(id), handed: false, ready: false, hub };
    openedGames.add(id);
    soundCue("portal_open");
    force((x) => x + 1);
    setTimeout(() => {
      const c = tr.current;
      if (c?.kind === "portal" && c.id === id && !c.ready) { tr.current = { kind: "back", id }; soundCue("portal_close"); force((x) => x + 1); }
    }, PORTAL_ANSWER_MS);
  };
  let content;
  if (ui.kind === "creating" || ui.kind === "failed") content = <Splash failed={ui.kind === "failed" ? ui.error : null} onRetry={() => void tvCreateRoom()} />;
  else if (ui.kind === "fatal") content = <Fatal messageKey={ui.messageKey} />;
  else if (ui.kind === "closed") content = <Closed />;
  else if (!view) content = <Splash failed={null} onRetry={() => void tvCreateRoom()} />;
  else if (cur?.kind === "portal" && !cur.handed) content = <TvHub view={view.room.phase === "HUB" ? view : cur.hub} portalOut onOpen={() => undefined} />;
  else if (view.room.phase === "HUB") {
    content = <TvHub view={view} portalOut={cur?.kind === "back"} onOpen={(id, r) => startPortal(id, canvasRect(r, canvas.current, box.scale), view)} />;
  } else if (view.room.phase === "SETUP") content = <TvSetup view={view} entering={cur?.kind === "portal" ? (cur.first ? 1 : 0.64) : null} />;
  else content = <TvGameHost view={view} />;

  const screenKey = view ? (cur?.kind === "portal" && !cur.handed ? "HUB" : view.room.phase === "PLAYING" ? `PLAYING:${view.game?.gameId}:${view.game?.n}` : view.room.phase) : ui.kind;
  const overlayOpen = room && (tvDialog.value !== null || tvPicker.value !== null || tvPaused.value || tvLangOpen.value || tvShop.value !== null
    || tvRules.value !== null || tvHubSettings.value || tvCupOpen.value || tvPackPicker.value || tvQuizShelf.value || tvAdvanced.value || tvIntro.value !== null);
  const toast = toasts.value.at(-1);
  const rules = tvRules.value;
  // §3.10 E rule 2: an overlay becoming interactive ignores OK and the D-pad for INPUT_GUARD_MS (a double OK on "JAMAA
  // Pass" must not buy, Back → Right → OK must not close the room). One place for every overlay: the topmost one. The
  // rules sheet is exempt (local, read-only, as on native).
  const top = !room ? null
    : tvDialog.value ? "dialog" : tvPicker.value ? "picker" : tvShop.value ? "shop" : tvLangOpen.value ? "lang" : tvRules.value ? null
    : tvPackPicker.value ? "packs" : tvQuizShelf.value ? "quizzes" : tvAdvanced.value ? "advanced" : tvCupOpen.value ? "cup" : tvHubSettings.value ? "settings"
    : tvPaused.value ? "pause" : null;
  const topKey = top === "dialog" ? `dialog:${tvDialog.value?.title}` : top === "picker" ? `picker:${tvPicker.value?.title}` : top;
  const lastTop = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (topKey !== null && topKey !== lastTop.current) armGuard();
    lastTop.current = topKey;
  }, [topKey]);
  const setup = view?.room.setup ?? null;
  return (
    <div class={`tv${calm.value ? " is-calm" : ""}`} lang={l} dir={dirOf(l)}>
      <div class="tv__canvas" ref={canvas} onScroll={(e) => { e.currentTarget.scrollTop = 0; e.currentTarget.scrollLeft = 0; }} style={{ transform: `translate(${box.x}px, ${box.y}px) scale(${box.scale})` }}>
        <div class="tv__bg" aria-hidden="true" />
        {/* Content behind an overlay is inert: neither the remote, Tab nor a pointer can reach it (the intro and the
            setup sheets render inside the screen and trap focus as .tvoverlay themselves). */}
        <div class={`tv__stage${cur ? " is-transition" : ""}`} key={screenKey} inert={overlayOpen && !tvIntro.value && !tvPackPicker.value && !tvQuizShelf.value && !tvAdvanced.value}>{content}</div>
        {room && cur?.kind === "portal" && (
          <Portal key={`p${cur.id}`} id={cur.id} from={cur.from} first={cur.first} ready={cur.ready} hubRoot={hubRoot}
            onHandoff={() => { if (tr.current?.kind === "portal") { tr.current = { ...tr.current, handed: true }; force((x) => x + 1); } }}
            onDone={done} />
        )}
        {room && cur?.kind === "back" && (
          <PortalBack key={`b${cur.id}`} id={cur.id} hubRoot={hubRoot} onDone={done}
            to={() => canvasRect(canvas.current?.querySelector(".tvposter.is-focused")?.getBoundingClientRect() ?? null, canvas.current, tvScale.value)} />
        )}
        {room && cur?.kind === "entrance" && view.game && (
          <Entrance key={`e${view.game.n}`} id={cur.id} members={view.room.members} script={view.room.contentLocale} onDone={done} />
        )}
        {room && tvPaused.value && <PauseMenu view={view} />}
        {room && view.room.phase === "SETUP" && setup && tvPackPicker.value && <PackPicker setup={setup} />}
        {room && view.room.phase === "SETUP" && setup && isTriviaSetup(setup) && tvQuizShelf.value && <TvQuizShelf view={view} setup={setup} />}
        {room && view.room.phase === "SETUP" && setup && tvAdvanced.value && !tvPackPicker.value && <AdvancedSheet view={view} setup={setup} />}
        {room && tvCupOpen.value && <CupSheet view={view} />}
        {room && tvHubSettings.value && <HubSettings />}
        {room && rules && <RulesSheet id={rules.id} hub={rules.hub} phase={view.room.phase === "PLAYING" ? view.game?.phase ?? null : null} inGame={view.room.phase === "PLAYING"} />}
        {room && tvShop.value && !inRunningGame(view) && <TvShop view={view} entry={tvShop.value} />}
        {room && tvLangOpen.value && <LanguagePicker />}
        {room && <TvPicker />}
        {room && <TvDialog />}
        {ui.kind === "room" && <ConnStates view={view} />}
        <div class="tvtoasts" aria-live="polite">
          {view?.room.phase !== "HUB" && !tvShop.value && toast && <div key={toast.id} class={`tvtoast tvtoast--${toast.tone}`}>{toast.text}</div>}
        </div>
      </div>
    </div>
  );
}

