// Routes (§8.3) and the phone platform shell (JAMAA-PLATFORM §3.3): Join, then the screen follows `room.phase`
// (HUB → PHH-02, SETUP → PHH-03, PLAYING → the game's lazy chunk, PHH-04/05). The ⓘ rules sheet is reachable from
// the top bar on every screen.
import { useEffect, useState } from "preact/hooks";
import type { ComponentType } from "preact";
import type { GameId } from "@jamaa/shared/games/ids";
import type { PlayerRoomView } from "@jamaa/shared/protocol/v2";
import { goHome, route } from "./router";
import { conn, fatalCode, me, meMember, menuOpen, resuming, rulesFor, shownCard, view } from "./state/store";
import { gameModules, leave, startSession, stopSession } from "./state/session";
import { loadBillingFlag } from "./lib/billingFlag";
import { CLOSE } from "./net/connection";
import { t } from "./i18n/t";
import { ConnBanner } from "./components/ConnBanner";
import { MenuSheet } from "./components/LangSwitch";
import { LiveRegions, Toasts, TopBar } from "./components/UI";
import { Icon } from "./components/Icon";
import { Home } from "./screens/Home";
import { Join } from "./screens/Join";
import { Kicked } from "./screens/Kicked";
import { RoomGone } from "./screens/RoomGone";
import { Replaced } from "./screens/Replaced";
import { Hub } from "./platform/Hub";
import { Setup } from "./platform/Setup";
import { InGame } from "./platform/InGame";
import { RulesSheet } from "./platform/RulesSheet";

function Loading() {
  return (
    <main class="screen screen--loading" aria-busy="true">
      <img src="/brand/mark.svg" alt="" width={72} height={72} class="loading__mark" />
      <p class="loading__text"><Icon name="refresh" size={20} class="spin" />{resuming.value ? t("join.resuming") : conn.value === "reconnecting" ? t("conn.reconnecting") : t("conn.connecting")}</p>
    </main>
  );
}

/** Which game the ⓘ shows, and the phase to highlight (§3.6). */
function rulesTarget(v: PlayerRoomView | null): { id: GameId; phase: string | null; hub: boolean } {
  const room = v?.room;
  if (room?.phase === "PLAYING" && v?.game) return { id: v.game.gameId, phase: v.game.phase, hub: false };
  if (room?.phase === "SETUP" && room.setupGameId) return { id: room.setupGameId, phase: null, hub: false };
  return { id: shownCard.value ?? room?.focusedGameId ?? "mishana", phase: null, hub: true };
}

/** The screen for this phone, and a key that changes when the screen should reset. */
function phoneScreen(v: PlayerRoomView): { key: string; content: preact.JSX.Element } {
  const room = v.room;
  if (room.phase === "HUB") return { key: "hub", content: <Hub view={v} /> };
  if (room.phase === "SETUP") return { key: `setup:${room.setupGameId}`, content: <Setup view={v} /> };
  const g = v.game;
  const mod = g ? gameModules.value[g.gameId] : undefined;
  const sub = g && mod && !v.me?.benched ? mod.screenKey(v) : v.me?.benched ? "benched" : "loading";
  return { key: `play:${g?.gameId}:${g?.n}:${sub}:${g?.over ? "over" : ""}`, content: <InGame view={v} /> };
}

function Room({ code }: { code: string }) {
  useEffect(() => {
    void loadBillingFlag();
    startSession(code);
    return () => stopSession();
  }, [code]);
  const v = view.value;
  const m = me.value;
  const fc = fatalCode.value;
  let key: string;
  let content;
  if (fc !== null) {
    key = `fatal:${fc}`;
    content = fc === CLOSE.KICKED ? <Kicked code={code} /> : fc === CLOSE.REPLACED ? <Replaced /> : <RoomGone closeCode={fc} code={code} />;
  } else if (!v) {
    key = "loading";
    content = <Loading />;
  } else if (!m) {
    key = "join";
    content = <Join view={v} />;
  } else {
    ({ key, content } = phoneScreen(v));
  }
  useEffect(() => { window.scrollTo(0, 0); }, [key]);
  const mm = meMember.value;
  const joined = !!mm && fc === null;
  const rules = rulesFor.value;
  const target = rulesTarget(v);
  const g = v?.game;
  const yourTurn = !!(v && g && rules && gameModules.value[g.gameId]?.needsMe?.(v));
  return (
    <div class="page" data-phase={v?.room.phase ?? "none"}>
      <TopBar
        code={fc === null ? code : null}
        name={joined ? mm.name : undefined} color={joined ? mm.color : undefined} host={joined && mm.isHost}
        state={mm && !mm.connected ? "away" : "normal"} showLang={!joined}
        onLang={() => { menuOpen.value = true; }}
        onRules={v && fc === null ? () => { rulesFor.value = target.id; } : undefined}
      />
      <div class="stage" key={key}>{content}</div>
      <ConnBanner />
      <Toasts />
      {rules && v && <RulesSheet id={target.hub ? rules : target.id} phase={target.phase} hub={target.hub} yourTurn={yourTurn} onClose={() => { rulesFor.value = null; }} />}
      <MenuSheet open={menuOpen.value} joined={joined} onClose={() => { menuOpen.value = false; }}
        onLeave={() => { leave(); menuOpen.value = false; setTimeout(() => goHome(), 200); }} />
      <LiveRegions />
    </div>
  );
}

function TvRoute() {
  const [Comp, setComp] = useState<ComponentType | null>(null);
  useEffect(() => {
    void import("./tv-mock/TvMock").then((m) => setComp(() => m.TvMock));
  }, []);
  return Comp ? <Comp /> : <div class="tv-loading" />;
}

export function App() {
  const r = route.value;
  if (r.kind === "tv") return <TvRoute />;
  if (r.kind === "home") {
    return (
      <>
        <Home prefill={r.prefill} onLang={() => { menuOpen.value = true; }} key={r.prefill} />
        <MenuSheet open={menuOpen.value} joined={false} onClose={() => { menuOpen.value = false; }} />
        <LiveRegions />
      </>
    );
  }
  return <Room code={r.code} key={r.code} />;
}
