// LK-TV-01 CARD, LK-TV-02 VOTING and HOLD on /tv (GAME-LIKELY §8.2). The TV never shows a target before REVEAL:
// characters who voted switch to `done` (public `votedIds` only).
import type { Expression } from "@jamaa/shared/characters";
import { fmtNum, t } from "../../../i18n/t";
import { Icon } from "../../../components/Icon";
import { Character } from "../../../components/Character";
import { RoomCode, TimerRing } from "../../../tv-mock/tvParts";
import { Qr } from "../../../tv-mock/Qr";
import { activeSeats, deadlineOf } from "../model";
import type { LikelyModel, Seat } from "../model";
import { k } from "../parts";
import { BulbArch, Jury, LkTop, TvCard, World } from "./stage";
import { ScoreRail } from "./rail";

function juryExpression(m: LikelyModel, s: Seat): Expression {
  if (!s.connected) return "away";
  if (m.pub.card?.namedPlayerId === s.id) return "shy";
  if (m.pub.phase === "VOTING") return m.pub.votedIds.includes(s.id) ? "done" : "think";
  return "idle";
}

export function TvPlay({ m }: { m: LikelyModel }) {
  const voting = m.pub.phase === "VOTING";
  const voters = activeSeats(m).filter((s) => s.connected || m.pub.votedIds.includes(s.id)).length;
  const dl = deadlineOf(m);
  return (
    <div data-world="rooftop" class={`tvscreen lkplay lkplay--${voting ? "voting" : "card"}`} data-phase={m.pub.phase}>
      <World />
      <LkTop m={m} />
      <div class="lkplay__arch"><BulbArch /></div>
      <TvCard m={m} />
      <div class="lkplay__timer">
        {voting ? <TimerRing deadline={dl} size={88} stroke={7} /> : (
          <span class="lkready"><span class="lkready__dot" />{t(k("card.getReady"))}</span>
        )}
      </div>
      <Jury m={m} expressionOf={(s) => juryExpression(m, s)} newIds={m.pub.newIds} />
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
