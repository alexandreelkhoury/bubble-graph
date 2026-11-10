// LK-TV-01 CARD, LK-TV-02 VOTING and HOLD on /tv (GAME-LIKELY §8.2). The TV never shows a target before REVEAL:
// characters who voted switch to `done` (public `votedIds` only).
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { Expression } from "@jamaa/shared/characters";
import { fmtNum, t } from "../../../i18n/t";
import { Icon } from "../../../components/Icon";
import { Character } from "../../../components/Character";
import { RoomCode, TimerRing } from "../../../tv-mock/tvParts";
import { Qr } from "../../../tv-mock/Qr";
import { tvPaused } from "../../../tv-mock/tvStore";
import { reduced } from "../../../lib/motion";
import { activeSeats, deadlineOf } from "../model";
import type { LikelyModel, Seat } from "../model";
import { k } from "../parts";
import { BulbArch, Jury, LkTop, TvCard, World } from "./stage";
import { ScoreRail } from "./rail";
import { sfx } from "./sfx";

function juryExpression(m: LikelyModel, s: Seat): Expression {
  if (!s.connected) return "away";
  if (m.pub.card?.namedPlayerId === s.id) return "shy";
  if (m.pub.phase === "VOTING") return m.pub.votedIds.includes(s.id) ? "done" : "think";
  return "idle";
}

/**
 * GAME-LIKELY §4 / §12.1: the first card is never dealt under the platform world entrance (its deadline carries
 * ENTRANCE_GRACE_MS for that). While the [data-entrance] overlay is up, the deal waits and the jury runs in from the
 * sides straight to its arc seats, in step with the entrance's own "characters" beat (read from the overlay's --run, so a
 * lazily loaded chunk joins mid-entrance in sync); the overlay's own row of runners is hidden for this world (tv.css).
 * Returns [gate open (overlay up), the jury ran in this mount (sticky: the seats' rise-in never replays)].
 */
function useEntranceGate(first: boolean, jury: { current: HTMLDivElement | null }): [boolean, boolean] {
  const [gate, setGate] = useState(false);
  const [ranIn, setRanIn] = useState(false);
  useLayoutEffect(() => {
    if (!first) return;
    const overlay = document.querySelector<HTMLElement>("[data-entrance]");
    if (!overlay) return;
    const runIn = !reduced() && !overlay.classList.contains("is-calm");
    setGate(true);
    if (runIn) setRanIn(true);
    let id = 0;
    const frame = (): void => {
      if (!overlay.isConnected) {
        jury.current?.querySelectorAll<HTMLElement>("[data-seat]").forEach((c) => { c.style.transform = ""; c.style.opacity = ""; });
        setGate(false);
        sfx("deal");
        return;
      }
      if (runIn && jury.current) {
        const runs = [...overlay.querySelectorAll<HTMLElement>(".tventr__ch")].map((c) => Number.parseFloat(c.style.getPropertyValue("--run")) || 0);
        jury.current.querySelectorAll<HTMLElement>("[data-seat]").forEach((c, i) => {
          const q = Math.max(0, Math.min(1.1, runs.length ? runs[Math.min(i, runs.length - 1)]! : 1));
          const from = c.offsetLeft + c.offsetWidth / 2 < 480 ? -1 : 1;
          c.style.transform = `translateX(${((1 - q) * from * 620).toFixed(1)}px)`;
          c.style.opacity = String(Math.min(1, q * 3));
        });
      }
      id = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(id);
  }, []);
  return [gate, ranIn];
}

export function TvPlay({ m }: { m: LikelyModel }) {
  const voting = m.pub.phase === "VOTING";
  const voters = activeSeats(m).filter((s) => s.connected || m.pub.votedIds.includes(s.id)).length;
  const dl = deadlineOf(m);
  const jury = useRef<HTMLDivElement>(null);
  const [gate, ranIn] = useEntranceGate(m.pub.cardIndex === 0 && m.pub.phase === "CARD", jury);
  // While paused the whole stage stays under the pause menu (no raised run-in layer).
  const entering = gate && !tvPaused.value;
  return (
    <div data-world="rooftop" class={`tvscreen lkplay lkplay--${voting ? "voting" : "card"}${entering ? " is-entering" : ""}${gate ? " is-gated" : ""}${ranIn ? " is-ran-in" : ""}`} data-phase={m.pub.phase} data-gated={gate ? "1" : undefined}>
      <World />
      <LkTop m={m} />
      <div class="lkplay__arch"><BulbArch lit={!gate} /></div>
      {!gate && <TvCard m={m} />}
      <div class="lkplay__timer">
        {voting ? <TimerRing deadline={dl} size={88} stroke={7} /> : (
          <span class="lkready"><span class="lkready__dot" />{t(k("card.getReady"))}</span>
        )}
      </div>
      <div ref={jury} class="lkplay__jury"><Jury m={m} expressionOf={(s) => juryExpression(m, s)} newIds={m.pub.newIds} /></div>
      {voting && (
        <p class="lkvoted tnum" aria-live="polite"><Icon name="check" size={22} />{t(k("vote.progress"), { count: m.pub.votedIds.length, total: voters })}</p>
      )}
      <ScoreRail m={m} />
    </div>
  );
}

export function TvHold({ m }: { m: LikelyModel }) {
  const n = activeSeats(m).filter((s) => s.connected).length;
  return (
    <div data-world="rooftop" class="tvscreen lkhold">
      <World dim />
      <LkTop m={m} />
      <div class="lkhold__body">
        <div class="lkhold__row">{activeSeats(m).map((s) => <Character key={s.id} color={s.color} size={72} expression={s.connected ? "think" : "away"} />)}</div>
        <h1 class="tvt-displayM lkhold__title">{t(k("hold.waiting"), { count: n })}</h1>
        <p class="tvt-body tv-secondary">{t(k("coach.hold"))}</p>
        <div class="lkhold__join">
          <Qr url={m.joinUrl} panel={150} />
          <span class="lkhold__code"><RoomCode code={m.roomCode} size="big" /></span>
        </div>
      </div>
      <span class="lkhold__count tnum" aria-hidden="true">{fmtNum(n)}/3</span>
    </div>
  );
}
