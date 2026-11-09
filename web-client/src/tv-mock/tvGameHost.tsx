// JAMAA-PLATFORM §3.2 HUB-04..06 on /tv: the active game's lazy `tv-mock-game-<id>` screens inside the platform canvas,
// the in-game "◁ Back: menu & rules" hint (round 1, and 3 s after each phase change), and HUB-05's platform part of the
// results: "Tonight's cup" (placement stars fly from the podium to the cup chip, §3.10 C/D, then the counters tick)
// and Play again · Change settings · Other games, focusable only after the choreography and INPUT_GUARD_MS.
import { useEffect, useRef, useState } from "preact/hooks";
import type { GameId } from "@jamaa/shared/games/ids";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { fmtNum, t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { TV_GAMES } from "../games/tvLoaders";
import type { TvGameModule } from "../games/types";
import { CHOREO, run } from "@jamaa/shared/motion";
import { reduced } from "../lib/motion";
import { billingEnabled } from "../lib/billingFlag";
import { Icon } from "../components/Icon";
import { Character } from "../components/Character";
import { cupStandings, starsOfLast } from "../platform/Cup";
import { backHintOn } from "./tvParts";
import { tvAct } from "./tvStore";
import { openRules } from "./tvDialogs";
import { armGuard, clearChoreo, resultsSettled, setChoreo } from "./tvPlatform";
import { soundCue } from "./sound/controller";

export const HINT_AFTER_PHASE_MS = 3000;
/** A game whose results screen never reports "settled" still gets its platform bar after this long. */
export const RESULTS_FALLBACK_MS = 4000;
/** §3.10 C: at most 24 coins (here: stars) on screen. */
export const MAX_FLIGHTS = 24;

const modules: Partial<Record<GameId, TvGameModule>> = {};
const pending = new Map<GameId, Promise<TvGameModule>>();

/** Loads a game's TV chunk once. */
export function loadTvGame(id: GameId): Promise<TvGameModule> {
  const m = modules[id];
  if (m) return Promise.resolve(m);
  let p = pending.get(id);
  if (!p) {
    p = TV_GAMES[id]().then((mod) => { modules[id] = mod; pending.delete(id); return mod; });
    pending.set(id, p);
  }
  return p;
}
export function tvGameModule(id: GameId): TvGameModule | undefined { return modules[id]; }

export function useTvGame(id: GameId | null): TvGameModule | null {
  const [mod, setMod] = useState<TvGameModule | null>(() => (id ? modules[id] ?? null : null));
  useEffect(() => {
    if (!id) { setMod(null); return; }
    if (modules[id]) { setMod(modules[id]!); return; }
    let alive = true;
    void loadTvGame(id).then((m) => { if (alive) setMod(m); });
    return () => { alive = false; };
  }, [id]);
  return mod;
}

/** The hint rule: on during round 1, and for 3 s after each phase change. */
function useBackHint(view: TvRoomView, mod: TvGameModule | null): void {
  const phase = view.game?.phase ?? null;
  const first = !!mod?.firstRound?.(view);
  const [recent, setRecent] = useState(true);
  useEffect(() => {
    setRecent(true);
    const id = setTimeout(() => setRecent(false), HINT_AFTER_PHASE_MS);
    return () => clearTimeout(id);
  }, [phase]);
  const on = !view.game?.over && (first || recent);
  useEffect(() => { backHintOn.value = on; }, [on]);
  useEffect(() => () => { backHintOn.value = false; }, []);
}

export function TvGameHost({ view }: { view: TvRoomView }) {
  const g = view.game;
  const mod = useTvGame(g?.gameId ?? null);
  const prev = useRef<TvRoomView | null>(null);
  useBackHint(view, mod);
  useEffect(() => {
    if (!mod) return;
    mod.onTvView?.(prev.current, view);
    prev.current = view;
  }, [view, mod]);
  if (!g) return <div class="tvscreen" />;
  if (!mod) return <div class="tvscreen tvloadinggame"><Icon name="refresh" size={32} class="spin" /></div>;
  const Tv = mod.Tv;
  return (
    <div class={`tvgamehost${g.over ? " is-over" : ""}`} data-game={g.gameId}>
      <div class="tvgamehost__screen" key={mod.screenKey(view)}><Tv view={view} /></div>
      {g.over && <ResultsBar view={view} />}
    </div>
  );
}

/** HUB-05 platform part. */
export function ResultsBar({ view }: { view: TvRoomView }) {
  const room = view.room;
  const game = view.game?.gameId ?? null;
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(false);
  const playRef = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const settled = resultsSettled.value;
  // The bar appears once the game's own results have settled (or after a fallback delay).
  useEffect(() => {
    if (settled) { setShown(true); return; }
    const id = setTimeout(() => setShown(true), RESULTS_FALLBACK_MS);
    return () => clearTimeout(id);
  }, [settled]);
  const earned = starsOfLast(room.cup);
  const flights = Object.entries(earned).flatMap(([pid, n]) => Array.from({ length: n }, () => pid)).slice(0, MAX_FLIGHTS);
  const rows = cupStandings(room);
  const before = (id: string): number => (room.cup.stars[id] ?? 0) - (earned[id] ?? 0);
  // The cup choreography: stars fly (450 ms each, 70 ms stagger) then the counters tick (600 ms). OK completes it.
  useEffect(() => {
    if (!shown) return;
    if (reduced() || flights.length === 0) { setReady(true); armGuard(); return; }
    const el = root.current;
    soundCue("coin_fly");
    const tickAt = setTimeout(() => soundCue("counter_tick"), 450 + 70 * (flights.length - 1));
    // §3.10 D: the stars fly (CHOREO.cup "star") and the counters tick with the points "counter" step.
    const r = run([...CHOREO.cup, ...CHOREO.points.filter((s) => s.id === "counter")], (p) => {
      el?.querySelectorAll<HTMLElement>(".tvflight").forEach((f, i) => f.style.setProperty("--p", String(p("star", i))));
      el?.style.setProperty("--tick", String(p("counter")));
      el?.querySelectorAll<HTMLElement>("[data-count]").forEach((c) => {
        const from = Number(c.dataset.from), to = Number(c.dataset.count);
        c.textContent = fmtNum(Math.round(from + (to - from) * p("counter")));
      });
    }, () => { clearChoreo(r); setReady(true); armGuard(); soundCue("cup_star"); }, flights.length);
    setChoreo(r);
    return () => { clearTimeout(tickAt); r.cancel(); clearChoreo(r); };
  }, [shown]);
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => playRef.current?.focus(), 410);
    return () => clearTimeout(id);
  }, [ready]);
  if (!shown) return null;
  const finished = room.cup.last?.n ?? 0;
  const hook = billingEnabled.value && !room.premium && finished >= 2;
  return (
    <div class={`tvresultsbar${ready ? " is-ready" : ""}`} ref={root} data-results-bar>
      <div class="tvresultsbar__cup" aria-label={t("cup.title")}>
        <span class="tvresultsbar__title"><Icon name="trophy" size={22} />{t("cup.title")}</span>
        <ol class="tvresultsbar__rows">
          {rows.slice(0, 3).map((r, i) => (
            <li key={r.id} class="tvresultsbar__row" style={{ "--rank": i }}>
              <Character color={r.color} size={40} expression={i === 0 && r.stars > 0 ? "cheer" : (earned[r.id] ?? 0) > 0 ? "happy" : "idle"} crown={i === 0 && r.stars > 0} />
              <span class="tvresultsbar__stars tnum"><Icon name="star" size={18} />
                <span data-count={r.stars} data-from={reduced() ? r.stars : before(r.id)}>{fmtNum(reduced() ? r.stars : before(r.id))}</span></span>
            </li>
          ))}
        </ol>
      </div>
      {!reduced() && !ready && flights.map((pid, i) => (
        <span key={i} class="tvflight" style={{ "--i": i, "--dx": `${(i % 5) * 18 - 36}px` }} aria-hidden="true"><Icon name="star" size={22} /></span>
      ))}
      {hook && <p class="tvt-caption tv-muted tvresultsbar__hook"><Icon name="gem" size={18} />{t("pass.resultsHook")}</p>}
      <div class="tvresultsbar__actions">
        <button type="button" ref={playRef} class="tvbtn tvbtn--primary" data-default-focus={ready ? true : undefined} data-replay tabIndex={ready ? 0 : -1}
          onClick={() => { if (ready) tvAct({ type: "REPLAY" }); }}><Icon name="refresh" />{t("results.playAgain")}</button>
        <button type="button" class="tvbtn" data-back-setup tabIndex={ready ? 0 : -1} onClick={() => { if (ready) tvAct({ type: "BACK_TO_SETUP" }); }}>{t("results.changeSettings")}</button>
        <button type="button" class="tvbtn" data-back-hub tabIndex={ready ? 0 : -1} onClick={() => { if (ready) tvAct({ type: "BACK_TO_HUB" }); }}>{t("cup.otherGames")}</button>
        {/* JAMAA-PLATFORM §1 "Rules access": the ⓘ is reachable on the results too (the row's end item). */}
        {game && (
          <button type="button" class="tvround" data-results-info aria-label={t("rules.open")} tabIndex={ready ? 0 : -1}
            onClick={() => { if (ready) openRules({ id: game, hub: false, fromPause: false }); }}><Icon name="info" size={24} /></button>
        )}
      </div>
    </div>
  );
}

export function gameTitle(id: GameId): string { return t(`game.${id}.title` as MessageKey); }
