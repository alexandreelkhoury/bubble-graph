// Routes (§8.3) and the phone screen-by-phase switch (§8.5).
import { useEffect, useState } from "preact/hooks";
import type { ComponentType } from "preact";
import { route } from "./router";
import { conn, fatalCode, me, menuOpen, resuming, view } from "./state/store";
import { leave, startSession, stopSession } from "./state/session";
import { goHome } from "./router";
import { t } from "./i18n/t";
import { ConnBanner } from "./components/ConnBanner";
import { MenuSheet } from "./components/LangSwitch";
import { LiveRegions, Toasts, TopBar } from "./components/UI";
import { Icon } from "./components/Icon";
import { avatarState } from "./components/PlayerChip";
import { Home } from "./screens/Home";
import { Join } from "./screens/Join";
import { Lobby } from "./screens/Lobby";
import { Reveal } from "./screens/Reveal";
import { Clues } from "./screens/Clues";
import { Vote } from "./screens/Vote";
import { Elimination } from "./screens/Elimination";
import { Guess } from "./screens/Guess";
import { Results } from "./screens/Results";
import { Kicked } from "./screens/Kicked";
import { RoomGone } from "./screens/RoomGone";
import { Replaced } from "./screens/Replaced";

function Loading() {
  return (
    <main class="screen screen--loading" aria-busy="true">
      <img src="/brand/mark.svg" alt="" width={72} height={72} class="loading__mark" />
      <p class="loading__text"><Icon name="refresh" size={20} class="spin" />{resuming.value ? t("join.resuming") : conn.value === "reconnecting" ? t("conn.reconnecting") : t("conn.connecting")}</p>
    </main>
  );
}

function Room({ code }: { code: string }) {
  useEffect(() => {
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
    content = fc === 4006 ? <Kicked /> : fc === 4005 ? <Replaced /> : <RoomGone closeCode={fc} code={code} />;
  } else if (!v) {
    key = "loading";
    content = <Loading />;
  } else if (!m) {
    key = `join:${v.phase === "LOBBY" ? "open" : "locked"}`;
    content = <Join view={v} />;
  } else {
    const p = v.players.find((x) => x.id === m.id);
    const turn = (v.phase === "CLUES" || v.phase === "TIE_BREAK") && v.currentSpeakerId === m.id;
    key = `${v.phase}:${v.gameNumber}:${v.round}:${turn ? "turn" : ""}:${p?.alive ? "" : "out"}:${m.myVote ? "voted" : ""}`;
    switch (v.phase) {
      case "LOBBY": content = <Lobby view={v} />; break;
      case "ROLE_REVEAL": content = <Reveal view={v} me={m} />; break;
      case "CLUES":
      case "TIE_BREAK": content = <Clues view={v} me={m} />; break;
      case "VOTING": content = <Vote view={v} me={m} />; break;
      case "ELIMINATION": content = <Elimination view={v} me={m} />; break;
      case "MR_WHITE_GUESS": content = <Guess view={v} me={m} />; break;
      case "RESULTS": content = <Results view={v} me={m} />; break;
    }
  }
  useEffect(() => { window.scrollTo(0, 0); }, [key]);
  const p = v && m ? v.players.find((x) => x.id === m.id) : undefined;
  const joined = !!p && fc === null;
  return (
    <div class="page">
      <TopBar
        code={fc === null ? code : null}
        name={joined ? p.name : undefined} color={joined ? p.color : undefined} host={joined && p.isHost}
        state={p ? avatarState(p) : "normal"} showLang={!joined}
        onLang={() => { menuOpen.value = true; }}
      />
      <div class="stage" key={key}>{content}</div>
      <ConnBanner />
      <Toasts />
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
