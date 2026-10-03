// PH-04 Your word (ROLE_REVEAL): hold-to-reveal card, "Got it" enabled after the first reveal.
import { useState } from "preact/hooks";
import type { Me, PlayerView } from "@mishana/shared/protocol";
import { t } from "../i18n/t";
import { act } from "../state/session";
import { WordCard } from "../components/HoldToReveal";
import { Button, Heading } from "../components/UI";
import { Icon } from "../components/Icon";
import { TimerBar } from "../components/Timer";

const seenGames = new Set<string>();

export function Reveal({ view, me }: { view: PlayerView; me: Me }) {
  const gameKey = `${view.roomCode}:${view.gameNumber}`;
  const [seen, setSeen] = useState(() => seenGames.has(gameKey));
  const p = view.players.find((x) => x.id === me.id);
  const ready = p?.ready ?? false;
  const active = view.players.filter((x) => !x.left);
  const readyCount = active.filter((x) => x.ready).length;
  return (
    <>
      <main class="screen screen--reveal">
        <Heading eyebrow={t("game.label", { count: view.gameNumber })} title={t("reveal.yourWord")} />
        <WordCard
          word={me.word} isBlank={me.isBlank} role={me.role} color={p?.color ?? "coral"} wordLocale={view.settings.wordLocale}
          seenOnce={seen} onReveal={() => { seenGames.add(gameKey); setSeen(true); }}
        />
        <p class="hint hint--center"><Icon name="eye-off" size={18} />{t("reveal.privacy")}</p>
      </main>
      <footer class="actionbar">
        <TimerBar deadline={view.deadline} class="timerbar--slim" />
        {ready ? (
          <p class="waiting waiting--ok" role="status">
            <Icon name="check" size={20} />
            <span>{t("reveal.waitingOthers")} <span class="tnum">({t("reveal.readyCount", { ready: readyCount, total: active.length })})</span></span>
          </p>
        ) : (
          <Button disabled={!seen} onClick={() => act({ type: "READY" })}>{t("reveal.ready")}</Button>
        )}
      </footer>
    </>
  );
}
