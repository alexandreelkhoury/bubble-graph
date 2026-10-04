// Browser TV mock (/tv): a faithful 960 × 540 rendering of the DESIGN TV screens, with host controls,
// so the game is playable without Android TV. Arrow keys = D-pad, Enter = OK, Escape/Backspace = Back.
import "./tv.css";
import { useEffect, useRef, useState } from "preact/hooks";
import type { TvView } from "@mishana/shared/protocol";
import { dirOf, locale } from "../i18n/t";
import { toasts } from "../state/store";
import { tvCreateRoom, tvExit, tvLangOpen, tvPaused, tvScale, tvScreen, tvShop, tvStop, tvUi, tvView } from "./tvStore";
import { TvShop } from "./tvShop";
import { bootBilling, useBillingView, useBillingVisibility } from "./billingEffects";
import { TvLobby } from "./tvLobby";
import { TvSettings } from "./tvSettings";
import { TvClues, TvRoleReveal, TvVoting } from "./tvGame";
import { TvElimination } from "./tvElimination";
import { TvGuess, TvResults } from "./tvResults";
import { closeTopOverlay, LanguagePicker, openPause, PauseMenu, TvDialog, tvDialog } from "./tvDialogs";
import { Closed, ConnStates, Fatal, PhonesAsleep, Splash, usePresenceToasts } from "./tvStatus";
import { isBackKey, useDpad } from "./dpad";
import { useRemoteSounds } from "./sound/controller";

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
  const box = useCanvasBox();
  const canvas = useRef<HTMLDivElement>(null);
  const ui = tvUi.value;
  const view = tvView.value;
  usePresenceToasts(view);
  useBillingView(view);
  useBillingVisibility();
  useRemoteSounds(canvas, isBackKey);
  useEffect(() => {
    // PAYMENTS-SPEC §5.2: the catalog (mode) and a token first, so the room can be created with it.
    void bootBilling().then(() => tvCreateRoom());
    document.title = "Mish Ana! · TV";
    return () => tvStop();
  }, []);
  // Settings that come from PLAY_AGAIN → "Change settings" open only once the lobby arrives.
  useEffect(() => { if (view && view.phase !== "LOBBY" && view.phase !== "RESULTS" && tvScreen.value === "settings") tvScreen.value = "main"; }, [view?.phase]);
  // Back: close the innermost overlay; in a game (or on Results) open the pause menu; in the lobby exit the app
  // (DESIGN TV-02, no confirm). TV-03 Settings handles its own Back first.
  useDpad(canvas, () => {
    if (closeTopOverlay()) return;
    const v = tvView.value;
    if (!v || tvUi.value.kind !== "room") return;
    if (v.phase !== "LOBBY") openPause();
    else if (tvScreen.value === "main") tvExit();
  });
  const l = locale.value;
  let content;
  if (ui.kind === "creating" || ui.kind === "failed") content = <Splash failed={ui.kind === "failed" ? ui.error : null} />;
  else if (ui.kind === "fatal") content = <Fatal messageKey={ui.messageKey} />;
  else if (ui.kind === "closed") content = <Closed />;
  else if (!view) content = <Splash failed={null} />;
  else content = <Screen view={view} />;
  const room = ui.kind === "room" && view !== null;
  const lobbyMain = view?.phase === "LOBBY" && tvScreen.value === "main";
  const shop = room && view.phase === "LOBBY" ? tvShop.value : null;
  const overlay = room && (tvDialog.value !== null || tvPaused.value || tvLangOpen.value || shop !== null);
  const screenKey = view ? `${view.phase}:${view.round}:${view.gameNumber}:${tvScreen.value}` : ui.kind;
  const toast = toasts.value.at(-1);
  return (
    <div class="tv" lang={l} dir={dirOf(l)}>
      <div class="tv__canvas" ref={canvas} style={{ transform: `translate(${box.x}px, ${box.y}px) scale(${box.scale})` }}>
        <div class="tv__bg" aria-hidden="true" />
        {/* Content behind an overlay is inert: neither the remote, Tab nor a pointer can reach it. */}
        <div class="tv__stage" key={screenKey} inert={overlay}>{content}</div>
        {room && tvPaused.value && <PauseMenu view={view} />}
        {shop && <TvShop view={view!} entry={shop} />}
        {room && tvLangOpen.value && <LanguagePicker />}
        {room && <TvDialog />}
        {ui.kind === "room" && <ConnStates view={view} />}
        {view && <PhonesAsleep view={view} />}
        {/* In the lobby the toast sits in the player-grid header (TvLobby); in a game, newest only, in the top bar row. */}
        <div class={`tvtoasts${shop ? " tvtoasts--shop" : ""}`} aria-live="polite">
          {(!lobbyMain || shop) && toast && <div key={toast.id} class={`tvtoast tvtoast--${toast.tone}`}>{toast.text}</div>}
        </div>
      </div>
    </div>
  );
}
