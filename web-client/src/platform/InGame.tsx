// JAMAA-PLATFORM §3.3 PHH-04 / PHH-05, DESIGN-JAMAA §2.5 / §3.2: the phone while PLAYING. The active game's screens
// come from its lazy `game-<id>` chunk; the platform adds the world flood on entry, first-round coach marks, the
// benched view, and after the outcome "Tonight's cup" plus the VIP's three buttons.
import { useEffect, useState } from "preact/hooks";
import type { PlayerRoomView } from "@jamaa/shared/protocol/v2";
import { t } from "../i18n/t";
import type { MessageKey } from "../i18n/t";
import { act, gameModules } from "../state/session";
import { coached, markCoached } from "../lib/storage";
import { reduced } from "../lib/motion";
import { TitleLockup, WORLD_OF } from "../components/Poster";
import { Button } from "../components/UI";
import { Icon } from "../components/Icon";
import { CupPanel } from "./Cup";
import { MembersStrip, ReactionsBar } from "./Reactions";

export const FLOOD_MS = 600;

const camel = (phase: string): string => phase.toLowerCase().replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());

/** Instances whose flood already played on this phone (the stage remounts on every phase change). */
const flooded = new Set<string>();

function Flood({ view }: { view: PlayerRoomView }) {
  const inst = view.game ? `${view.room.roomCode}:${view.game.gameId}:${view.game.n}` : "";
  const [on, setOn] = useState(() => {
    if (!inst || flooded.has(inst)) return false;
    flooded.add(inst);
    // A phone that resumes mid-game (or arrives after the first phase) skips the flood.
    return !reduced() && !view.game!.over;
  });
  useEffect(() => {
    if (!on) return;
    const id = setTimeout(() => setOn(false), FLOOD_MS + 300);
    return () => clearTimeout(id);
  }, []);
  const g = view.game;
  if (!on || !g) return null;
  return (
    <div class="phflood" data-world={WORLD_OF[g.gameId]} aria-hidden="true">
      <div class="phflood__fill" />
      <TitleLockup id={g.gameId} script={view.room.contentLocale} class="phflood__title" />
    </div>
  );
}

function Coach({ view }: { view: PlayerRoomView }) {
  const g = view.game!;
  const mod = gameModules.value[g.gameId];
  const first = mod?.firstRound ? mod.firstRound(view) : true;
  const [hidden, setHidden] = useState<string | null>(null);
  const seen = coached(g.gameId);
  useEffect(() => { if (!first || g.over) markCoached(g.gameId); }, [first, g.over]);
  const key = `game.${g.gameId}.coach.${camel(g.phase)}`;
  const text = t(key as MessageKey);
  if (seen || !first || g.over || hidden === g.phase || text === key) return null;
  return (
    <button type="button" class="coach" data-world={WORLD_OF[g.gameId]} onClick={() => setHidden(g.phase)}>
      <Icon name="info" size={16} /><span>{text}</span><Icon name="x" size={14} class="coach__x" />
    </button>
  );
}

/** Benched (joined while PLAYING): "You'll join the next game", the room's characters (who acted, never what) and reactions. */
function Benched({ view }: { view: PlayerRoomView }) {
  const g = view.game;
  return (
    <main class="screen screen--benched" data-world={g ? WORLD_OF[g.gameId] : undefined}>
      {g && <TitleLockup id={g.gameId} script={view.room.contentLocale} class="benched__lockup" />}
      <h1 class="h1 benched__title" tabIndex={-1}>{t("error.notInGame")}</h1>
      <p class="sub">{t("results.waitingHost")}</p>
      <MembersStrip members={view.room.members.filter((m) => !m.benched)} myId={null} status={g ? { doneIds: g.doneIds, awaitedIds: g.awaitedIds } : null} size={48} />
      <div class="benched__bottom"><ReactionsBar /></div>
    </main>
  );
}

function ResultsTail({ view }: { view: PlayerRoomView }) {
  const room = view.room;
  const myId = view.me?.id ?? null;
  const vip = myId !== null && room.hostPlayerId === myId;
  return (
    <>
      <div class="resultsTail">
        <CupPanel room={room} myId={myId} />
        <ReactionsBar />
      </div>
      <footer class="actionbar">
        {vip ? (
          <>
            <Button onClick={() => act({ type: "REPLAY" })}><Icon name="refresh" size={20} />{t("results.playAgain")}</Button>
            <div class="actionbar__row">
              <Button kind="secondary" onClick={() => act({ type: "BACK_TO_SETUP" })}>{t("results.changeSettings")}</Button>
              <Button kind="secondary" onClick={() => act({ type: "BACK_TO_HUB" })}>{t("cup.otherGames")}</Button>
            </div>
          </>
        ) : <p class="waitline"><Icon name="timer" size={18} />{t("results.waitingHost")}</p>}
      </footer>
    </>
  );
}

export function InGame({ view }: { view: PlayerRoomView }) {
  const g = view.game;
  const mod = g ? gameModules.value[g.gameId] : undefined;
  if (!g || view.me?.benched) return <><Benched view={view} /><Flood view={view} /></>;
  if (!mod) {
    return (
      <main class="screen screen--loading" aria-busy="true">
        <p class="loading__text"><Icon name="refresh" size={20} class="spin" />{t("common.loading")}</p>
        <Flood view={view} />
      </main>
    );
  }
  const Phone = mod.Phone;
  return (
    <div class="ingame" data-world={WORLD_OF[g.gameId]}>
      <Coach view={view} />
      <Phone view={view} />
      {g.over && <ResultsTail view={view} />}
      <Flood view={view} />
    </div>
  );
}
