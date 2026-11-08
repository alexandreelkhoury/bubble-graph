// JAMAA-PLATFORM §3.3 PHH-03 / DESIGN-JAMAA §2.5–§2.6: the game's title art on its world stage, the first-time how-to
// sheet (per phone: `jamaa:introSeen:<gameId>`, set on the last card or on Skip), then the setup summary. Everyone sees
// the rows read-only; the VIP edits them (≤ 4 + Advanced), starts the game (START_GAME) or goes back to the games.
import { useEffect, useRef, useState } from "preact/hooks";
import type { GameId } from "@jamaa/shared/games/ids";
import { GAME_META } from "@jamaa/shared/games/meta";
import type { PlayerRoomView } from "@jamaa/shared/protocol/v2";
import { locale, t } from "../i18n/t";
import { act } from "../state/session";
import { introSeen, markIntroSeen } from "../lib/storage";
import { blockerLine } from "../lib/gameSettings";
import { tvBusyHint } from "../lib/premium";
import { HowToCard, Dots, howToKeys } from "../components/HowTo";
import { TitleLockup, WORLD_OF } from "../components/Poster";
import { Button } from "../components/UI";
import { Icon } from "../components/Icon";
import { MemberCharacter } from "../components/Character";
import { ellipsizeName } from "../lib/names";
import { SettingsList } from "./SettingsList";
import { ReactionsBar } from "./Reactions";

/** The swipeable how-to sheet (scene 280 × 160, dots, Skip top-end, "Got it" at the bottom). */
export function IntroSheet({ id, onDone }: { id: GameId; onDone(): void }) {
  const n = howToKeys(id).length;
  const [i, setI] = useState(0);
  const touch = useRef<number | null>(null);
  const rtl = locale.value === "ar";
  const last = i === n - 1;
  useEffect(() => { if (last) markIntroSeen(id); }, [last]);
  const go = (d: 1 | -1): void => setI((x) => Math.max(0, Math.min(n - 1, x + d)));
  const skip = (): void => { markIntroSeen(id); onDone(); };
  return (
    <div class="sheet-root">
      <div class="scrim" />
      <div class="sheet introsheet" data-world={WORLD_OF[id]} role="dialog" aria-modal="true" aria-label={t("howto.title")}
        onTouchStart={(e) => { touch.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => {
          const s = touch.current, x = e.changedTouches[0]?.clientX;
          touch.current = null;
          if (s === null || x === undefined || Math.abs(x - s) < 40) return;
          go((x < s) !== rtl ? 1 : -1);
        }}>
        <header class="introsheet__head">
          <span class="sheet__handle" aria-hidden="true" />
          <h2 class="introsheet__title">{t("howto.title")}</h2>
          {!last && <button type="button" class="chipbtn introsheet__skip" onClick={skip}>{t("setup.skip")}</button>}
        </header>
        <HowToCard id={id} index={i} size={64} class="howto__card--phone" />
        <Dots n={n} i={i} />
        <div class="introsheet__actions">
          {last ? <Button onClick={() => { markIntroSeen(id); onDone(); }}>{t("setup.gotIt")}</Button>
            : <Button kind="secondary" onClick={() => go(1)}>{t("setup.next")}<Icon name="arrow-forward" size={20} class="flip-rtl" /></Button>}
        </div>
      </div>
    </div>
  );
}

export function Setup({ view }: { view: PlayerRoomView }) {
  const room = view.room;
  const setup = room.setup;
  const id = room.setupGameId ?? setup?.gameId ?? "mishana";
  const myId = view.me?.id ?? null;
  const vip = myId !== null && room.hostPlayerId === myId;
  const [intro, setIntro] = useState(() => !introSeen(id));
  const meta = GAME_META[id];
  const active = room.members.filter((m) => !m.left);
  const missing = Math.max(0, meta.minPlayers - active.length);
  const blocker = setup ? blockerLine(setup, active.length, meta.minPlayers) : null;
  return (
    <>
      <main class="screen screen--setup" data-world={WORLD_OF[id]}>
        <div class="setupph__stage" aria-hidden="true" />
        <div class="setupph__title">
          <TitleLockup id={id} script={room.contentLocale} class="setupph__lockup" />
          <button type="button" class="chipbtn setupph__howto" onClick={() => setIntro(true)}><Icon name="play" size={16} />{t("howto.title")}</button>
        </div>
        <section class="setupph__gang" aria-label={t("setup.gang")}>
          <ul class="setupph__cast">
            {active.map((m) => (
              <li key={m.id} class={m.id === myId ? "is-you" : undefined}>
                <MemberCharacter m={m} size={48} crown={m.isHost} base="happy" />
                <bdi>{ellipsizeName(m.name, 8)}</bdi>
              </li>
            ))}
            {Array.from({ length: missing }, (_, k) => <li key={`g${k}`} class="setupph__ghost" aria-hidden="true"><span /></li>)}
          </ul>
          {missing > 0 && <p class="setupph__need">{t("setup.needMore", { count: missing })}</p>}
        </section>
        {!vip && <p class="setupph__wait"><Icon name="settings" size={18} />{t("setup.readOnly")}</p>}
        {setup && <SettingsList room={room} setup={setup} edit={vip} />}
        <ReactionsBar />
      </main>
      {vip && setup && (
        <footer class="actionbar">
          {blocker && <p class="inline-error" role="status"><Icon name="info" size={18} />{blocker}</p>}
          {tvBusyHint(room, vip) && <p class="inline-hint" role="status"><Icon name="tv" size={18} />{t("error.tvBusy")}</p>}
          <Button disabled={!setup.canStart} onClick={() => act({ type: "START_GAME" })}>{t("setup.start")}</Button>
          <Button kind="ghost" onClick={() => act({ type: "CLOSE_GAME" })}><Icon name="chevron-back" size={20} class="flip-rtl" />{t("hub.title")}</Button>
        </footer>
      )}
      {intro && <IntroSheet id={id} onDone={() => setIntro(false)} />}
    </>
  );
}
