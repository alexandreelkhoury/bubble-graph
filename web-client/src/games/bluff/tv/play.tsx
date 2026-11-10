// BL-TV-01..03, 06 and HOLD on /tv (GAME-BLUFF §8.2, §12.3, DESIGN-JAMAA §7.6): the round card, writing at the café
// tables, the corkboard vote and the scoreboard race. Drawn from the TV projection only: no option is ever marked,
// counted or attributed before REVEAL, and characters react to public facts only (submitted, voted, Spot on).
import { useEffect, useMemo, useState } from "preact/hooks";
import { isolate, listOf, t } from "../../../i18n/t";
import { reduced } from "../../../lib/motion";
import { Character } from "../../../components/Character";
import { COLOR_BY_ID } from "../../../components/PlayerChip";
import { Icon } from "../../../components/Icon";
import { RoomCode } from "../../../tv-mock/tvParts";
import { clockOffset } from "../../../state/store";
import { now } from "../../../components/Timer";
import { Envelope, Odo } from "../art";
import { activeSeats, isFinal, letterOf, optionLetters, placeOf, ranked, roundIntroKey, roundNameKey } from "../model";
import { baseExpression, countedSeats, propOf } from "../tvModel";
import type { BluffModel, Seat } from "../model";
import { BfTop, Cafe, Seats, TvPrompt, tk } from "./stage";
import { HidePicker, hidePickerOpen } from "./hide";
import type { MessageKey } from "../../../i18n/t";

const serverNow = (): number => now.value + clockOffset.value;

// ---------------------------------------------------------------- BL-TV-01 round card

export function TvRoundIntro({ m }: { m: BluffModel }) {
  const fin = isFinal(m.pub);
  return (
    <div class={`tvscreen bf bf--intro${fin ? " is-final" : ""}`} data-world="hakawati-cafe" data-bf-phase="ROUND_INTRO" data-pid={m.pub.prompt?.id ?? ""}>
      <Cafe dim={fin} board={false} />
      <BfTop m={m} timer={false} />
      <div class="bfintro" key={`${m.pub.round}`}>
        <p class="bfintro__num">{fin ? tk("round.final") : tk("round.number", { round: m.pub.round })}</p>
        <h1 class="bfintro__name"><span class="bfneon">{t(roundNameKey(m.pub) as MessageKey)}</span></h1>
        <p class="bfintro__rule">{t(roundIntroKey(m.pub) as MessageKey)}</p>
        {m.pub.multiplier === 2 && <span class="bfintro__x2" dir="ltr">×2</span>}
      </div>
      <Seats m={m} o={{ expression: () => (fin ? "smug" : "happy") }} />
    </div>
  );
}

// ---------------------------------------------------------------- BL-TV-02 writing

export function TvWriting({ m }: { m: BluffModel }) {
  const p = m.pub.prompt;
  // Waiting late joiners are not on this prompt (lane A's awaitedIds): the box counts awaited + done players only.
  const players = countedSeats(m);
  const inCount = m.pub.submittedIds.filter((id) => players.some((s) => s.id === id)).length;
  const left = m.pub.deadline ? m.pub.deadline - serverNow() : Infinity;
  const late = left <= 10_000;
  const waiting = late ? players.filter((s) => !m.pub.submittedIds.includes(s.id)) : [];
  return (
    <div class={`tvscreen bf bf--writing${late ? " is-late" : ""}`} data-world="hakawati-cafe" data-bf-phase="WRITING" data-pid={m.pub.prompt?.id ?? ""}>
      <Cafe board={false} />
      <BfTop m={m} />
      {m.pub.notice === "tooFamous" && <p class="bfbanner" role="status" key={p?.id}>{tk("prompt.tooFamous")}</p>}
      {p && <div class="bfwrite"><TvPrompt prompt={p} final={isFinal(m.pub)} /></div>}
      <div class="bfbox" aria-label={`${inCount}/${players.length}`}>
        <div class="bfbox__slot" aria-hidden="true">{m.pub.submittedIds.slice(-3).map((id) => <span key={id} class="bfbox__env"><Envelope size={26} /></span>)}</div>
        <span class="bfbox__count tnum">{inCount}/{players.length}</span>
      </div>
      {waiting.length > 0 && <p class="bfwaiting">{tk("write.waitingFor")} <bdi>{listOf(waiting.map((s) => isolate(s.name)))}</bdi></p>}
      <Seats m={m} o={{ expression: (s) => baseExpression(m, s), prop: (s) => propOf(m, s), spotlight: (s) => late && waiting.includes(s) }} />
    </div>
  );
}

// ---------------------------------------------------------------- BL-TV-03 voting

/** Card tilt on the corkboard: deterministic per position (never per option id, which would be noise but no tell). */
const TILT = [-1.4, 0.9, -0.6, 1.3, -1.1, 0.5, 1.0, -0.8, 0.7, -1.3, 1.2, -0.4, 0.8];

export function TvVoting({ m }: { m: BluffModel }) {
  const opts = m.pub.options;
  const dense = opts.length > 6;
  const [knew, setKnew] = useState(() => m.pub.spotOnIds.length > 0 && !reduced());
  useEffect(() => {
    if (!knew) return;
    const id = setTimeout(() => setKnew(false), 1500);
    return () => clearTimeout(id);
  }, []);
  const names = listOf(m.pub.spotOnIds.map((id) => isolate(m.byId.get(id)?.name ?? "")));
  const letters = optionLetters(m);
  return (
    <div class="tvscreen bf bf--voting" data-world="hakawati-cafe" data-bf-phase="VOTING" data-pid={m.pub.prompt?.id ?? ""}>
      <Cafe />
      <BfTop m={m} />
      <div class="bfvote__head">
        <div class="bfvote__row">
          <p class="bfvote__title">{isFinal(m.pub) ? tk("vote.titleNoTruth") : tk("vote.title")}</p>
          {isFinal(m.pub) && <span class="bfchip bfchip--signal">{tk("noTruth.chip")}</span>}
          {opts.length === 2 && <span class="bfchip">{tk("vote.easyOne")}</span>}
        </div>
        {m.pub.prompt && <p class="bfvote__prompt" dir="auto" data-bf-vprompt>{m.pub.prompt.display ?? m.pub.prompt.original}</p>}
      </div>
      <ol class={`bfboard${dense ? " is-dense" : ""}`} data-count={opts.length}>
        {opts.map((o, i) => (
          <li key={o.id} class="bfnote" style={{ "--i": i, "--tilt": `${TILT[i % TILT.length]}deg` }} data-option={o.id}>
            <span class="bfnote__pin" aria-hidden="true" />
            <span class="bfnote__letter">{letters.get(o.id) ?? letterOf(i)}</span>
            <span class="bfnote__text" dir="auto">{o.text}</span>
          </li>
        ))}
      </ol>
      {knew && <div class="bfknew" role="status"><span class="bfknew__inner">{tk("vote.knewIt", { names })}</span></div>}
      <Seats m={m} o={{
        expression: (s) => baseExpression(m, s), prop: (s) => propOf(m, s),
        pin: (s) => (m.pub.spotOnIds.includes(s.id) ? tk("reveal.knewItPin") : null),
      }} />
      {hidePickerOpen.value && <HidePicker m={m} />}
    </div>
  );
}

// ---------------------------------------------------------------- HOLD

export function TvHold({ m }: { m: BluffModel }) {
  const n = activeSeats(m).filter((s) => s.connected).length;
  return (
    <div class="tvscreen bf bf--hold" data-world="hakawati-cafe" data-bf-phase="HOLD" data-pid={m.pub.prompt?.id ?? ""}>
      <Cafe dim />
      <BfTop m={m} timer={false} />
      <div class="bfhold">
        <p class="bfhold__title">{tk("hold.waiting", { count: Math.min(3, n) })}</p>
        <RoomCode code={m.roomCode} size="big" />
        <p class="bfhold__url" dir="ltr">{m.joinUrl.replace(/^https?:\/\//, "")}</p>
      </div>
      <Seats m={m} o={{ expression: (s) => (s.connected ? "think" : "away") }} />
    </div>
  );
}

// ---------------------------------------------------------------- BL-TV-06 scoreboard race (§12.3)

const ROW_H = 44;

export function TvScores({ m }: { m: BluffModel }) {
  const seats = useMemo(() => m.seats.filter((s) => !s.left || s.score > 0), [m.seats]);
  const before = useMemo(() => ranked(seats, "scoreBefore"), [seats]);
  const after = useMemo(() => ranked(seats, "score"), [seats]);
  const calm = reduced();
  // 0: bars at scoreBefore; 1: bars grow (1.2 s, odometers roll); 2: rows re-sort (spring), crown hops.
  const [stage, setStage] = useState(calm ? 2 : 0);
  useEffect(() => {
    if (calm) return;
    const a = setTimeout(() => setStage(1), 250);
    const b = setTimeout(() => setStage(2), 1650);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  const order = stage === 2 ? after : before;
  const max = Math.max(1, ...seats.map((s) => s.score));
  const leaderBefore = before[0];
  const leader = after[0];
  const newLeader = !!leader && leader.score > 0 && leader.id !== leaderBefore?.id && after.filter((s) => s.score === leader.score).length === 1;
  const last = after[after.length - 1];
  const comeback = !!last && !!leader && leader.score - last.score > 400 && after.length > 2;
  const tease = m.pub.promptIndex + 2 === m.pub.promptCount;
  const rows = Math.min(order.length, 12);
  const rowH = Math.min(ROW_H, Math.floor(400 / Math.max(1, rows)));
  const h = rows * rowH;
  return (
    <div class="tvscreen bf bf--scores" data-world="hakawati-cafe" data-bf-phase="SCORES" data-pid={m.pub.prompt?.id ?? ""}>
      <Cafe board={false} dim />
      <BfTop m={m} timer={false} />
      {m.pub.voided ? (
        <div class="bfvoided" role="status"><Icon name="arrow-forward" size={28} class="flip-rtl" />{tk("prompt.voided")}</div>
      ) : (
        <>
          <p class="bfscores__title">{tk("scores.title")}</p>
          <ol class={`bfrace${stage >= 1 ? " is-grown" : ""}`} style={{ height: `${h}px`, "--rows": rows }}>
            {seats.map((s) => {
              const rank = order.findIndex((x) => x.id === s.id);
              const up = stage === 2 && after.findIndex((x) => x.id === s.id) < before.findIndex((x) => x.id === s.id);
              // Bars grow from scoreBefore; the numbers already counted up on the reveal pills, so they start at the new
              // score with a +delta chip (never 700 → 550 → 700). SPEC-GAP vs GAME-BLUFF §12.3 (native to match).
              const v = stage >= 1 ? s.score : s.scoreBefore;
              return (
                <li key={s.id} class={`bfrace__row${up ? " is-up" : ""}${s.left ? " is-left" : ""}`} style={{ top: `${rank * rowH}px`, height: `${rowH - 4}px` }} data-race={s.id}>
                  <span class="bfrace__place tnum">{placeOf(stage === 2 ? after : before, s.id, stage === 2 ? "score" : "scoreBefore")}</span>
                  <Character color={s.color} size={rowH >= 44 ? 40 : 28} expression={stage === 2 && s.id === leader?.id && s.score > 0 ? "cheer" : s.score > s.scoreBefore && stage >= 1 ? "happy" : "idle"} crown={stage === 2 && s.id === leader?.id && s.score > 0} />
                  <bdi class="bfrace__name">{s.name}</bdi>
                  {s.isNew && <span class="bfchip">{tk("scores.new")}</span>}
                  <span class="bfrace__track"><span class="bfrace__bar" style={{ "--c": COLOR_BY_ID[s.color].hex, transform: `scaleX(${Math.max(0.015, v / max)})` }} /></span>
                  <span class="bfrace__score"><Odo value={s.score} max={s.score} /></span>
                  <span class="bfrace__delta tnum" dir="ltr">{stage >= 1 && s.score > s.scoreBefore ? `+${s.score - s.scoreBefore}` : ""}</span>
                </li>
              );
            })}
          </ol>
          <div class="bfscores__notes">
            {stage === 2 && newLeader && leader && <p class="bfbubble bfbubble--gold"><Character color={leader.color} size={28} expression="cheer" crown />{tk("scores.newLeader")}</p>}
            {stage === 2 && comeback && last && <p class="bfbubble"><bdi>{last.name}</bdi> · {tk("scores.comeback")}</p>}
            {tease && <p class="bfbubble bfbubble--red">{tk("scores.finalTease")}</p>}
          </div>
        </>
      )}
    </div>
  );
}

export type { Seat };
