// Quiz Night /tv building blocks (GAME-TRIVIA §12.1 "The Studio", DESIGN-JAMAA §7.9): the studio backdrop, the top
// bar, podiums, characters, the question card, the answer tiles, the leaderboard tower and the odometer. No focusable
// controls in game (JAMAA-PLATFORM §3.2 HUB-06): host actions are pause-menu items; OK only completes a reveal.
import type { ComponentChildren, Ref } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { dirOf, fmtNum, locale, t } from "../../../i18n/t";
import type { MessageKey } from "../../../i18n/t";
import { Character, useReaction } from "../../../components/Character";
import { Icon } from "../../../components/Icon";
import { now } from "../../../components/Timer";
import { clockOffset } from "../../../state/store";
import { ellipsizeName } from "../../../lib/names";
import { RoomCode, backHintOn } from "../../../tv-mock/tvParts";
import { openPause } from "../../../tv-mock/tvDialogs";
import { tvConn, tvPaused } from "../../../tv-mock/tvStore";
import { play } from "../../../tv-mock/sound/player";
import type { Player, Trivia, TriviaPub } from "../model";
import { expressionFor, flameLevel, leftMs, letterOf, questionNumber, standings, tokensOf } from "../model";
import { Flame, Star, TOKEN_HEX, TOKEN_KEY, TokenShape } from "../tokens";
import { answerTickCue } from "../cues";
import { PODIUM_CHAR, bulbs, bulbsLit, cardRect, podiumSlots, tileRect, towerRect, towerRowH } from "../layout";
import type { Rect } from "../layout";

export const K = "game.trivia";
export const tk = (k: string, p?: Record<string, string | number>): string => t(`${K}.${k}` as MessageKey, p);
export const isRtl = (): boolean => dirOf(locale.value) === "rtl";
export const box = (r: Rect): Record<string, string> => ({ left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
export const topicLabel = (id: string): string => t(`content.topic.${id}` as MessageKey);

/** The server-clock countdown of the current phase, re-read at 5 Hz (the shared `now` clock). */
export function useLeft(pub: TriviaPub): { ms: number; frac: number } {
  const ms = leftMs(pub.deadline, now.value, clockOffset.value);
  return { ms, frac: pub.durationMs ? Math.min(1, ms / pub.durationMs) : 0 };
}

/** §12.1 The Studio: night navy stage, a light-bulb arch that chases, two sweeping spotlights, a curved stage; for the
 *  Lebanon quiz a stylised coast-and-mountains sunset behind it (no flags, no symbols). `heat` = FINAL_INTRO lights. */
export function Studio({ coast, heat = false, dim = false }: { coast: boolean; heat?: boolean; dim?: boolean }) {
  const arch = Array.from({ length: 27 }, (_, i) => {
    const a = Math.PI * (0.06 + (0.88 * i) / 26);
    return { x: 480 - 452 * Math.cos(a), y: 70 - 54 * Math.sin(a) };
  });
  return (
    <div class={`tqs${heat ? " is-heat" : ""}${dim ? " is-dim" : ""}`} aria-hidden="true">
      {coast && (
        <svg class="tqs__coast" viewBox="0 0 960 540" preserveAspectRatio="none">
          <circle cx="640" cy="356" r="74" fill="url(#tq-sun)" />
          <path d="M0 360 L90 300 L160 334 L250 262 L330 318 L420 276 L520 330 L600 296 L700 344 L800 286 L880 322 L960 300 L960 420 L0 420Z" fill="#141C52" />
          <path d="M0 384 L120 344 L210 372 L320 330 L440 374 L560 350 L680 380 L820 340 L960 368 L960 430 L0 430Z" fill="#10184A" />
          <g stroke="#FFD84D" stroke-opacity=".22" stroke-width="2" stroke-linecap="round"><path d="M560 404h160M590 414h100M612 424h56" /></g>
          <defs><radialGradient id="tq-sun"><stop offset="0" stop-color="#FFB066" stop-opacity=".7" /><stop offset="1" stop-color="#FF7A1F" stop-opacity="0" /></radialGradient></defs>
        </svg>
      )}
      <span class="tqs__spot tqs__spot--a" /><span class="tqs__spot tqs__spot--b" />
      <svg class="tqs__arch" viewBox="0 0 960 90">
        <path d="M28 70 Q480 -38 932 70" fill="none" stroke="#222B63" stroke-width="10" stroke-linecap="round" />
        {arch.map((p, i) => <circle key={i} class="tqs__bulb" cx={p.x} cy={p.y} r="5.5" style={{ "--i": i }} />)}
      </svg>
      <div class="tqs__floor" />
    </div>
  );
}

const TOP_LABEL: Partial<Record<TriviaPub["phase"], string>> = {
  LEADERBOARD: "leaderboard.title", FINAL_INTRO: "phase.finalIntro", RESULTS: "results.title", HOLD: "phase.hold",
};

/** The in-game top bar: what we are on, the room code, the platform "◁ Back: menu & rules" hint, the pointer pause. */
export function TopBar({ tr, code }: { tr: Trivia; code: string }) {
  const pub = tr.pub;
  const q = questionNumber(pub);
  const key = TOP_LABEL[pub.phase];
  const label = pub.phase === "QUIZ_INTRO" ? t(`${K}.title` as MessageKey)
    : key ? tk(key)
      : `${tk("read.questionOf", { index: q.index, total: q.total })}${pub.question ? ` · ${topicLabel(pub.question.topic)}` : ""}`;
  return (
    <header class="tqtop">
      <span class="tqtop__title"><span>{label}</span>{pub.isFinal && pub.phase !== "FINAL_INTRO" && pub.phase !== "RESULTS" && <b class="tqx2">{tk("final.stamp")}</b>}</span>
      <span class="tqtop__end">
        {tvConn.value !== "open" && <span class="tvchip tvchip--danger"><Icon name="wifi-off" size={20} /></span>}
        <RoomCode code={code} />
        {backHintOn.value && !tvPaused.value && <span class="tvhint" role="note"><Icon name="arrow-back" size={18} class="flip-rtl" />{t("hint.backMenu")}</span>}
        {!tvPaused.value && <button type="button" class="tvmenu-btn" tabIndex={-1} aria-label={t("tv.pauseTitle")} onClick={openPause}><Icon name="pause" size={20} /></button>}
      </span>
    </header>
  );
}

/** A player's character with the platform reaction burst, the Trivia expression and the streak flame overlay. */
export function Actor({ tr, p, size, cls, style, elRef, expression, flame = true, crown }: {
  tr: Trivia; p: Player; size: number; cls?: string; style?: Record<string, string>; elRef?: Ref<HTMLDivElement>;
  expression?: ReturnType<typeof expressionFor>; flame?: boolean; crown?: boolean;
}) {
  const r = useReaction(p.reaction);
  const e = r ?? expression ?? expressionFor(tr, p);
  const lvl = flame ? flameLevel(p.row.streak) : 0;
  return (
    <div class={`tqa${cls ? ` ${cls}` : ""}`} style={style} ref={elRef} data-player={p.id}>
      {lvl > 0 && <span class={`tqa__flame tqa__flame--${lvl}`}><Flame size={size * 0.9} level={lvl} /></span>}
      <Character color={p.color} size={size} expression={e} burst={r} burstKey={p.reaction?.n} crown={crown} />
    </div>
  );
}

/** The podium row (§12.1): every active player behind a podium with its name plate; the podium light ring turns on
 *  (white) once the player answered — no colour, no shape, no position: nothing hints at the choice (§8.1). */
export function PodiumRow({ tr, players, actors = true, lit }: { tr: Trivia; players: Player[]; actors?: boolean; lit?: (p: Player) => boolean }) {
  const slots = podiumSlots(players.length, isRtl());
  const w = Math.min(104, (slots[1]?.x ?? 200) - (slots[0]?.x ?? 0) - 8 || 104);
  return (
    <div class="tqpods">
      {players.map((p, i) => {
        const s = slots[i]!;
        return (
          <div key={p.id} class={`tqpod${lit?.(p) ? " is-lit" : ""}${p.connected ? "" : " is-away"}`} style={{ left: `${s.x - Math.abs(w) / 2}px`, width: `${Math.abs(w)}px` }}>
            {actors && <Actor tr={tr} p={p} size={PODIUM_CHAR} cls="tqpod__actor" />}
            <span class="tqpod__box"><span class="tqpod__ring" /><span class="tqpod__name"><bdi>{ellipsizeName(p.name, 10)}</bdi></span></span>
            {p.isNew && <span class="tqpod__new">{tk("pad.newRibbon")}</span>}
          </div>
        );
      })}
    </div>
  );
}

/** The question card with its topic chip; `bulbsOn` draws the ANSWER timer as a ring of 20 bulbs around its edge. */
export function QuestionCard({ pub, mode }: { pub: TriviaPub; mode: "read" | "answer" | "reveal" }) {
  const rtl = isRtl();
  const r = cardRect(rtl);
  const text = pub.question?.text ?? "";
  const long = text.length > 90 ? " is-long" : text.length > 60 ? " is-mid" : "";
  return (
    <div class={`tqcard tqcard--${mode}${long}`} style={box(r)}>
      <p class="tqcard__text" dir="auto">{text}</p>
      {mode === "answer" && <BulbRing pub={pub} rect={{ x: 0, y: 0, w: r.w, h: r.h }} />}
      {mode === "read" && <ReadyBar pub={pub} />}
    </div>
  );
}

function ReadyBar({ pub }: { pub: TriviaPub }) {
  const { frac } = useLeft(pub);
  return <span class="tqready"><span style={{ transform: `scaleX(${1 - frac})` }} /></span>;
}

/** §12.2 / DESIGN-JAMAA §5.4: 20 bulbs going dark one by one clockwise with the server deadline; the last 5 s pulse
 *  amber with a tick (the pulse is removed in calm motion; the bulbs still go dark). */
function BulbRing({ pub, rect }: { pub: TriviaPub; rect: Rect }) {
  const { ms } = useLeft(pub);
  const lit = bulbsLit(ms, pub.durationMs ?? 0);
  const prev = useRef<{ at: number | null; ms: number | null }>({ at: null, ms: null });
  useEffect(() => {
    const p = prev.current.at === pub.deadline ? prev.current.ms : null;
    prev.current = { at: pub.deadline, ms };
    const cue = answerTickCue(p, ms);
    if (cue) play({ cue });
  }, [ms]);
  const pts = bulbs(rect);
  const low = ms > 0 && ms <= 5000;
  return (
    <span class={`tqbulbs${low ? " is-low" : ""}`} role="timer" aria-label={String(Math.ceil(ms / 1000))}>
      {pts.map((b, i) => <i key={i} class={i < lit ? "is-on" : undefined} style={{ left: `${b.x}px`, top: `${b.y}px` }} />)}
      <b class="tqbulbs__num num">{fmtNum(Math.ceil(ms / 1000))}</b>
    </span>
  );
}

/** The answer tiles (§8.2, fixed positions, never mirrored). `ghost` = READ's empty outlines so nothing jumps at ANSWER. */
export function Tiles({ pub, mode, children }: { pub: TriviaPub; mode: "ghost" | "answer" | "reveal"; children?: (i: number) => ComponentChildren }) {
  const type = pub.question?.type ?? "mc4";
  const ids = tokensOf(type);
  const rtl = isRtl();
  const correct = pub.reveal?.correct ?? -1;
  return (
    <div class={`tqtiles tqtiles--${mode} tqtiles--${type}`}>
      {ids.map((id, i) => {
        const letter = letterOf(id);
        const label = pub.options[i] || (id === "true" ? tk("tf.true") : id === "false" ? tk("tf.false") : "");
        return (
          <div key={id} class={`tqtile tqtile--${id}${mode === "reveal" ? (i === correct ? " is-right" : " is-wrong") : ""}`} style={{ ...box(tileRect(i, type, rtl)), "--tile": TOKEN_HEX[id], "--i": i }}
            aria-label={mode === "ghost" ? undefined : `${letter ?? ""} ${t(TOKEN_KEY[id])}: ${label}`}>
            {mode !== "ghost" && (
              <>
                {letter && <span class="tqtile__letter">{letter}</span>}
                <span class="tqtile__shape"><TokenShape id={id} size={type === "tf" ? 76 : 46} /></span>
                <span class="tqtile__text" dir="auto">{id === "false" ? <span class="tqtile__strip">{label}</span> : label}</span>
                {mode === "reveal" && i === correct && <span class="tqtile__ok" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" /></svg></span>}
              </>
            )}
            {mode === "ghost" && <span class="tqtile__ghost"><TokenShape id={id} size={36} color="currentColor" /></span>}
            {children?.(i)}
          </div>
        );
      })}
    </div>
  );
}

/** The digits of a score as rolling columns (DESIGN-JAMAA §5.1 odometer): columns that do not change stay still.
 *  Western digits, LTR, tabular, in every locale; the transition length comes from `--odo-ms`. */
export function Odo({ value, cls }: { value: number; cls?: string }) {
  const s = fmtNum(value);
  const chars = [...s];
  return (
    <span class={`odo num${cls ? ` ${cls}` : ""}`} aria-label={s} role="img">
      {chars.map((ch, i) => {
        const pos = chars.length - i;
        return /\d/.test(ch)
          ? <span key={`d${pos}`} class="odo__col" aria-hidden="true"><span class="odo__strip" style={{ transform: `translateY(${-Number(ch) * 10}%)` }}>{"0123456789".split("").map((d) => <span key={d}>{d}</span>)}</span></span>
          : <span key={`s${pos}`} class="odo__sep" aria-hidden="true">{ch}</span>;
      })}
    </span>
  );
}

/** The leaderboard tower beside the board (READ / ANSWER; REVEAL drives its own copy). Compact rows above 8 players. */
export function Tower({ players, order, scoreOf, rankOf }: {
  players: Player[]; order?: Player[]; scoreOf?: (p: Player) => number; rankOf?: (p: Player) => number | null;
}) {
  const rows = order ?? standings(players);
  const rtl = isRtl();
  const { h, gap } = towerRowH(rows.length);
  return (
    <aside class={`tqtower${rows.length > 8 ? " is-compact" : ""}`} style={box(towerRect(rtl))} aria-label={tk("leaderboard.title")}>
      <p class="tqtower__head">{tk("leaderboard.title")}</p>
      <ol class="tqtower__rows">
        {rows.map((p, i) => (
          <li key={p.id} class={`tqrow${p.row.left ? " is-left" : ""}`} style={{ top: `${i * (h + gap)}px`, height: `${h}px` }}>
            <span class="tqrow__rank tnum">{p.row.left ? "–" : fmtNum((rankOf ? rankOf(p) : p.row.rank) ?? 0)}</span>
            <Character color={p.color} size={rows.length > 8 ? 18 : 26} expression={p.connected ? "idle" : "away"} />
            <span class="tqrow__name"><bdi>{ellipsizeName(p.name, rows.length > 8 ? 9 : 10)}</bdi></span>
            {p.row.streak >= 3 && !p.row.left && <span class="tqrow__fire"><Flame size={rows.length > 8 ? 10 : 13} /></span>}
            <span class="tqrow__score"><Odo value={scoreOf ? scoreOf(p) : p.row.score} /></span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

/** Stars filled one by one (QUIZ_INTRO, §12 / DESIGN-JAMAA §5.4) + the difficulty word for accessibility. */
export function Stars({ n, size }: { n: number; size: number }) {
  return (
    <span class="tqstars">
      <span class="tqstars__row" role="img" aria-label={tk(`diff.${n}`)}>{[1, 2, 3].map((i) => <Star key={i} size={size} on={i <= n} />)}</span>
      <span class="tqstars__word">{tk(`diff.${n}`)}</span>
    </span>
  );
}
