// The Liars' Café on /tv (GAME-BLUFF §12.1, DESIGN-JAMAA §7.6): a late-night café, warm pendant lamps, a corkboard
// wall, marble tables, the neon BLUFF! sign; the in-game top bar; the prompt card; the café row of characters with
// their props, name plates and score pills (coins fly into those pills during the reveal). Original art only.
import type { ComponentChildren } from "preact";
import type { Expression } from "@jamaa/shared/characters";
import { dirOf, locale, t } from "../../../i18n/t";
import type { MessageKey } from "../../../i18n/t";
import { Icon } from "../../../components/Icon";
import { Character, useReaction } from "../../../components/Character";
import { TimerRing, RoomCode, backHintOn } from "../../../tv-mock/tvParts";
import { openPause } from "../../../tv-mock/tvDialogs";
import { tvConn, tvPaused } from "../../../tv-mock/tvStore";
import { clockOffset } from "../../../state/store";
import { now } from "../../../components/Timer";
import { Ballot, Envelope, Odo, Pencil } from "../art";
import { deadlineOf, hintKey, isFinal, k, promptLines, typeKey } from "../model";
import { isWaiting } from "../tvModel";
import type { BluffModel, Prompt, Seat } from "../model";
import { NAME_Y, PILL_Y, SEAT_Y, seatChar, seatX } from "../choreo";

export const rtl = (): boolean => dirOf(locale.value) === "rtl";
export const tk = (s: string, p?: Record<string, string | number>): string => t(k(s) as MessageKey, p);

/** Pendant lamps, corkboard, wainscot, window with the city at night, neon sign (decorative). */
export function Cafe({ dim = false, board = true, neon = true }: { dim?: boolean; board?: boolean; neon?: boolean }) {
  return (
    <div class={`bfw${dim ? " is-dim" : ""}`} aria-hidden="true">
      <svg class="bfw__svg" viewBox="0 0 960 540" width="960" height="540" preserveAspectRatio="none">
        <defs>
          <linearGradient id="bfw-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E1D0E" /><stop offset=".62" stop-color="#1C1209" /><stop offset="1" stop-color="#140C06" /></linearGradient>
          <radialGradient id="bfw-lamp" cx="50%" cy="0%" r="70%"><stop offset="0" stop-color="#FFE3A3" stop-opacity=".34" /><stop offset="1" stop-color="#FFE3A3" stop-opacity="0" /></radialGradient>
          <linearGradient id="bfw-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A2E14" /><stop offset="1" stop-color="#2A190B" /></linearGradient>
          <pattern id="bfw-tile" width="32" height="32" patternUnits="userSpaceOnUse">
            <rect width="32" height="32" fill="#22150A" /><path d="M16 2l14 14-14 14L2 16z" fill="#2B1B0D" /><circle cx="16" cy="16" r="3" fill="#3A2512" />
          </pattern>
          <linearGradient id="bfw-cork" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7A5530" /><stop offset="1" stop-color="#5E3F22" /></linearGradient>
        </defs>
        <rect width="960" height="540" fill="url(#bfw-wall)" />
        {/* vertical wallpaper stripes */}
        {Array.from({ length: 24 }, (_, i) => <rect key={i} x={i * 40 + 18} y="0" width="2" height="360" fill="#3A2614" opacity=".35" />)}
        {/* arched window with the city at night (start side) */}
        <g class="bfw__window" transform="translate(40 96)">
          <path d="M0 150V60A60 60 0 0 1 120 60V150z" fill="#0B1424" stroke="#5B3A1E" stroke-width="6" />
          <path d="M6 150V118h14v-20h12v26h16v-40h10v40h14V96h18v32h12v-18h12v40z" fill="#16233A" />
          {[[22, 112], [40, 104], [72, 108], [96, 122], [58, 128]].map(([x, y], i) => <rect key={i} class="bfw__win" x={x} y={y} width="4" height="5" fill="#FFC94D" style={{ "--d": `${i * 0.7}s` }} />)}
          <path d="M60 0V150M0 84H120" stroke="#5B3A1E" stroke-width="4" />
          <circle cx="92" cy="40" r="9" fill="#FFF1C9" opacity=".8" />
        </g>
        {/* the corkboard wall */}
        {board && <g class="bfw__board"><rect x="196" y="86" width="568" height="268" rx="10" fill="url(#bfw-cork)" stroke="#3A2512" stroke-width="8" />
          {Array.from({ length: 40 }, (_, i) => <circle key={i} cx={210 + ((i * 137) % 540)} cy={100 + ((i * 71) % 240)} r="1.6" fill="#4A321A" opacity=".6" />)}</g>}
        {/* shelf with cups (end side) */}
        <g transform="translate(818 150)">
          <rect x="0" y="40" width="112" height="8" rx="2" fill="#5B3A1E" />
          {[8, 34, 60, 86].map((x, i) => <g key={i} transform={`translate(${x} ${i % 2 ? 20 : 16})`}><rect width="18" height={i % 2 ? 20 : 24} rx="3" fill={["#E9A23B", "#F2E6D0", "#C8362F", "#2F7A6A"][i]} /></g>)}
          <rect x="0" y="100" width="112" height="8" rx="2" fill="#5B3A1E" />
          <path d="M20 100v-22h18v22M58 100V70h10v30M80 100V82h16v18" fill="#3A2512" />
        </g>
        {/* wainscot + floor */}
        <rect x="0" y="360" width="960" height="40" fill="url(#bfw-wood)" />
        <rect x="0" y="360" width="960" height="4" fill="#6B4420" />
        <rect x="0" y="400" width="960" height="140" fill="url(#bfw-tile)" />
        <rect x="0" y="400" width="960" height="140" fill="#000" opacity=".25" />
        {/* pendant lamps + warm cones */}
        {[180, 480, 780].map((x, i) => (
          <g key={x} class="bfw__lamp" style={{ "--i": i }}>
            <path d={`M${x} 0V40`} stroke="#120A1F" stroke-width="2" />
            <path d={`M${x - 26} 62Q${x} 30 ${x + 26} 62z`} fill="#B07A2A" />
            <ellipse cx={x} cy="62" rx="26" ry="5" fill="#FFE3A3" />
            <path class="bfw__cone" d={`M${x - 24} 64L${x - 170} 420H${x + 170}L${x + 24} 64z`} fill="url(#bfw-lamp)" />
          </g>
        ))}
      </svg>
      {neon && <span class="bfw__neon" dir="ltr">BLUFF<span class="bfw__bang">!</span></span>}
    </div>
  );
}

/** The in-game top bar: Bluff! · Round n · counter, timer ring, code, back hint, pointer pause button. */
export function BfTop({ m, label, timer = true }: { m: BluffModel; label?: string; timer?: boolean }) {
  const degraded = tvConn.value !== "open";
  const p = m.pub;
  const round = isFinal(p) ? tk("round.final") : tk("round.number", { round: p.round });
  const counter = tk("prompt.counter", { index: Math.min(p.promptIndex + 1, p.promptCount), count: p.promptCount });
  // First sight of a deadline reads the wall clock (the shared `now` signal can be seconds stale when nothing watched it).
  const dl = timer ? deadlineOf(p, Date.now() + clockOffset.value) : null;
  const live = p.phase === "WRITING" || p.phase === "VOTING";
  return (
    <header class="tvtop bftop">
      <span class="tvtop__title bftop__title">
        <span class="bftop__game">{tk("title")}</span><span class="bftop__sep" aria-hidden="true">·</span>
        <span>{label ?? round}</span><span class="bftop__sep" aria-hidden="true">·</span><span class="tnum">{counter}</span>
        {p.multiplier === 2 && <span class="bftop__x2" dir="ltr">×2</span>}
      </span>
      <span class="tvtop__end">
        {degraded && <span class="tvchip tvchip--danger"><Icon name="wifi-off" size={20} /></span>}
        {dl && live && <span class="bftop__ring"><TimerRing deadline={dl} size={40} stroke={4} showNumber={false}><span class="bftop__secs tnum"><Secs at={dl.at} /></span></TimerRing></span>}
        <RoomCode code={m.roomCode} />
        {backHintOn.value && !tvPaused.value && <span class="tvhint" role="note"><Icon name="arrow-back" size={18} class="flip-rtl" />{t("hint.backMenu")}</span>}
        {!tvPaused.value && <button type="button" class="tvmenu-btn" tabIndex={-1} aria-label={t("tv.pauseTitle")} onClick={openPause}><Icon name="pause" size={20} /></button>}
      </span>
    </header>
  );
}

function Secs({ at }: { at: number }) {
  return <>{Math.ceil(Math.max(0, at - (now.value + clockOffset.value)) / 1000)}</>;
}

/** The prompt card (WRITING big, VOTING small): type chip, prompt, translit, translation, length hint, final chip. */
export function TvPrompt({ prompt, final, small = false, children }: { prompt: Prompt; final: boolean; small?: boolean; children?: ComponentChildren }) {
  const lines = promptLines(prompt);
  return (
    <div class={`bfprompt${small ? " is-small" : ""}${final ? " is-final" : ""}`} key={prompt.id} data-prompt={prompt.id}>
      <div class="bfprompt__chips">
        <span class="bfchip bfchip--type">{t(typeKey(prompt.type) as MessageKey)}</span>
        {final && <span class="bfchip bfchip--signal">{tk("noTruth.chip")}</span>}
        {prompt.rerun && <span class="bfchip">{tk("prompt.rerun")}</span>}
      </div>
      <p class="bfprompt__text" dir="auto">{lines.main}</p>
      {lines.translit && !small && <p class="bfprompt__translit" dir="ltr">{lines.translit}</p>}
      {lines.sub && <p class="bfprompt__display" dir="auto">{lines.sub}</p>}
      {!small && <p class="bfprompt__hint"><Icon name="info" size={18} />{t(hintKey(prompt.lengthHint) as MessageKey)}</p>}
      {children}
    </div>
  );
}

/** One seated character with its live reaction burst. */
export function SeatChar({ s, expression, size = 72, crown = false }: { s: Seat; expression: Expression; size?: number; crown?: boolean }) {
  const r = useReaction(s.reaction);
  return <Character color={s.color} size={size} expression={!s.connected ? "away" : r ?? expression} burst={r} burstKey={s.reaction?.n} crown={crown} />;
}

export interface SeatOpts {
  expression(s: Seat): Expression;
  prop?(s: Seat): "pencil" | "envelope" | "ballot" | null;
  /** Show the score pill (an odometer the reveal drives through `data-odo`). */
  pills?: boolean;
  pillValue?(s: Seat): number;
  spotlight?(s: Seat): boolean;
  pin?(s: Seat): string | null;
  /** Characters lifted out of their seat by a choreography (hidden here while they are elsewhere). */
  away?(s: Seat): boolean;
  crown?(s: Seat): boolean;
}

/** The café row: marble tables, characters (props, pins), name plates and optional score pills. */
export function Seats({ m, o }: { m: BluffModel; o: SeatOpts }) {
  const seats = m.seats.filter((s) => !s.left || s.score > 0);
  const isRtl = rtl();
  const size = seatChar(seats.length);
  return (
    <div class={`bfseats${size < 72 ? " is-small" : ""}`} style={{ "--seat": `${size}px` }}>
      {seats.map((s, i) => {
        const x = seatX(seats.length, i, isRtl);
        const prop = o.prop?.(s) ?? null;
        const pin = o.pin?.(s) ?? null;
        return (
          <div key={s.id} class={`bfseat${s.left ? " is-left" : ""}${o.spotlight?.(s) ? " is-spot" : ""}${o.away?.(s) ? " is-away" : ""}`} data-seat={s.id}
            style={{ left: `${x}px`, "--i": i }}>
            <span class="bfseat__table" aria-hidden="true" style={{ top: `${SEAT_Y - 8}px` }} />
            <span class="bfseat__char" style={{ top: `${SEAT_Y - size}px` }}>
              <SeatChar s={s} expression={o.expression(s)} size={size} crown={o.crown?.(s) ?? false} />
              {prop && <span class={`bfseat__prop bfseat__prop--${prop}`} key={prop}>{prop === "pencil" ? <Pencil size={20} /> : prop === "envelope" ? <Envelope size={22} /> : <Ballot size={20} />}</span>}
              {pin && <span class="bfseat__pin">{pin}</span>}
              {s.isNew && <span class="bfseat__new">{tk("scores.new")}</span>}
              {isWaiting(m, s) && <span class="bfseat__next" aria-hidden="true"><Icon name="timer" size={14} /></span>}
            </span>
            <bdi class="bfseat__name" style={{ top: `${NAME_Y}px` }}>{s.name}</bdi>
            {o.pills && <span class="bfseat__pill" style={{ top: `${PILL_Y - 12}px` }}><Odo value={o.pillValue ? o.pillValue(s) : s.score} odoKey={s.id} max={Math.max(s.score, 999)} /></span>}
          </div>
        );
      })}
    </div>
  );
}
