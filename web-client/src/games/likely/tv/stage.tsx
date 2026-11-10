// The rooftop stage of Most Likely on /tv (GAME-LIKELY §12.1, DESIGN-JAMAA §7.8 LK-TV-01/02): the night sky with
// string lights and the city glow, the in-game top bar, the gold bulb arch, the card and the jury arc of characters.
import type { ComponentChildren } from "preact";
import type { Expression } from "@jamaa/shared/characters";
import { likelyJuryArc } from "@jamaa/shared/games/likely/meta";
import { dirOf, locale, t } from "../../../i18n/t";
import { Icon } from "../../../components/Icon";
import { Character, useReaction } from "../../../components/Character";
import { RoomCode, backHintOn } from "../../../tv-mock/tvParts";
import { openPause } from "../../../tv-mock/tvDialogs";
import { tvConn, tvPaused } from "../../../tv-mock/tvStore";
import { Rosette } from "../art";
import { CHAR, toCanvas } from "../model";
import type { LikelyModel, Seat } from "../model";
import { Question, k } from "../parts";

export const rtl = (): boolean => dirOf(locale.value) === "rtl";

/** String-light bulbs along a catenary (deterministic positions). */
function garland(y0: number, sag: number, n: number, x0 = -10, x1 = 970): { d: string; bulbs: { x: number; y: number }[] } {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push({ x: x0 + (x1 - x0) * u, y: y0 + sag * 4 * u * (1 - u) });
  }
  return { d: `M${x0} ${y0} Q ${(x0 + x1) / 2} ${y0 + sag * 2} ${x1} ${y0}`, bulbs: pts.slice(1, -1) };
}
const G1 = garland(-6, 46, 22), G2 = garland(10, 30, 16, 120, 980);
/** The city skyline (original silhouette: low blocks, a crane, water tanks), behind the jury. */
const SKYLINE = "M0 470 V430 h40 v-22 h26 v30 h30 v-48 h22 v-14 h10 v14 h18 v56 h34 v-36 h44 v-18 h8 v18 h30 v46 h26 v-70 h36 v70 h22 v-30 h40 v-26 h12 v26 h24 v44 h30 v-58 h20 v-10 h16 v10 h14 v58 h40 v-34 h36 v-20 h26 v54 h22 v-42 h34 v42 h40 v-64 h28 v64 h26 v-28 h40 v40 h28 v-24 h30 V540 H0z";

/** Night sky, string lights, skyline glow (decorative; reduced/calm motion stops the twinkle). */
export function World({ dim = false }: { dim?: boolean }) {
  return (
    <div class={`lkw${dim ? " is-dim" : ""}`} aria-hidden="true">
      <svg class="lkw__svg" viewBox="0 0 960 540" width="960" height="540" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lkw-city" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E2C3B" /><stop offset="1" stop-color="#05121A" /></linearGradient>
          <radialGradient id="lkw-haze" cx="50%" cy="100%" r="60%"><stop offset="0" stop-color="#29D3C2" stop-opacity=".18" /><stop offset="1" stop-color="#29D3C2" stop-opacity="0" /></radialGradient>
        </defs>
        <rect x="0" y="300" width="960" height="240" fill="url(#lkw-haze)" />
        {Array.from({ length: 34 }, (_, i) => <circle key={i} class="lkw__star" cx={(i * 283) % 960} cy={40 + ((i * 131) % 200)} r={i % 5 === 0 ? 1.4 : 0.8} style={{ "--d": `${(i % 7) * 0.6}s` }} />)}
        <path d={SKYLINE} fill="url(#lkw-city)" opacity=".85" />
        {Array.from({ length: 26 }, (_, i) => <rect key={i} class="lkw__win" x={20 + ((i * 97) % 920)} y={448 + ((i * 37) % 60)} width="5" height="7" rx="1" style={{ "--d": `${(i % 9) * 0.9}s` }} />)}
        <path d={G1.d} class="lkw__wire" /><path d={G2.d} class="lkw__wire" />
        {[...G1.bulbs, ...G2.bulbs].map((b, i) => <circle key={i} class="lkw__bulb" cx={b.x} cy={b.y + 6} r="4.2" style={{ "--d": `${(i % 6) * 0.35}s`, "--i": i % 12 }} />)}
      </svg>
    </div>
  );
}

/** The in-game top bar (the platform one is Mish Ana!-typed): title · card counter, code, back hint, pointer pause. */
export function LkTop({ m, label }: { m: LikelyModel; label?: string }) {
  const degraded = tvConn.value !== "open";
  const counter = t(k("card.counter"), { index: Math.min(m.pub.cardIndex + 1, m.pub.cardCount), count: m.pub.cardCount });
  return (
    <header class="tvtop lktop">
      <span class="tvtop__title lktop__title">{t(k("title"))}<span class="lktop__sep" aria-hidden="true">·</span>{label ?? <span class="tnum" dir="ltr">{counter}</span>}</span>
      <span class="tvtop__end">
        {degraded && <span class="tvchip tvchip--danger"><Icon name="wifi-off" size={20} /></span>}
        <RoomCode code={m.roomCode} />
        {backHintOn.value && !tvPaused.value && <span class="tvhint" role="note"><Icon name="arrow-back" size={18} class="flip-rtl" />{t("hint.backMenu")}</span>}
        {!tvPaused.value && <button type="button" class="tvmenu-btn" tabIndex={-1} aria-label={t("tv.pauseTitle")} onClick={openPause}><Icon name="pause" size={20} /></button>}
      </span>
    </header>
  );
}

/** The gold arch of bulbs behind the card; bulbs light from the centre outward when the card lands (§12.1). */
export function BulbArch({ lit = true }: { lit?: boolean }) {
  const n = 19;
  return (
    <svg class={`lkarch${lit ? " is-lit" : ""}`} viewBox="0 0 680 220" width="680" height="220" aria-hidden="true">
      <path d="M40 150 A300 130 0 0 1 640 150" class="lkarch__frame" />
      {Array.from({ length: n }, (_, i) => {
        const a = Math.PI * (i / (n - 1));
        const x = 340 - 300 * Math.cos(a), y = 150 - 130 * Math.sin(a);
        return <circle key={i} cx={x} cy={y} r="6" class="lkarch__bulb" style={{ "--o": Math.abs(i - (n - 1) / 2) }} />;
      })}
    </svg>
  );
}

/** The phrase's type size from its length (graphemes): long prompts step down so the card never reaches the jury. */
export function cardSize(prompt: string): "s" | "m" | "l" {
  const n = [...prompt].length;
  return n <= 26 ? "s" : n <= 44 ? "m" : "l";
}

/** LK-TV-01 card: header + phrase (§12.3: dealt from the golden deck, flips in Y, lands with a bounce). */
export function TvCard({ m, small = false, children }: { m: LikelyModel; small?: boolean; children?: ComponentChildren }) {
  const c = m.pub.card;
  if (!c) return null;
  return (
    <div class={`lkcard lkcard--${cardSize(c.prompt)}${small ? " is-small" : ""}`} key={c.id} data-card={c.id}>
      <div class="lkcard__flip">
        <div class="lkcard__back" aria-hidden="true"><Rosette size={72} /></div>
        <div class="lkcard__face">
          <Question prompt={c.prompt} class="lkcard__q" />
          <p class="lkcard__award"><Rosette size={22} />{c.award}</p>
          {c.rerun && <span class="lkcard__tag">{t(k("card.rerun"))}</span>}
          {c.spicy && <span class="lkcard__tag lkcard__tag--spicy">{t(k("spicy.tag"))}</span>}
          {children}
        </div>
      </div>
    </div>
  );
}

/** One character of the jury, with its live reaction burst. */
function JuryChar({ s, expression, size, look }: { s: Seat; expression: Expression; size: number; look?: "start" | "end" | null }) {
  const r = useReaction(s.reaction);
  return <Character color={s.color} size={size} expression={r ?? expression} burst={r} burstKey={s.reaction?.n} look={look ?? null} />;
}

/** LK-TV-01/02 jury arc: characters on the shared arc (feet at the arc point), names under them. */
export function Jury({ m, expressionOf, newIds = [], hideNames = false }: { m: LikelyModel; expressionOf(s: Seat): Expression; newIds?: readonly string[]; hideNames?: boolean }) {
  const pts = likelyJuryArc(m.seats.length, rtl()).map(toCanvas);
  const size = CHAR;
  return (
    <div class="lkjury">
      {m.seats.map((s, i) => {
        const p = pts[i]!;
        return (
          <div key={s.id} class={`lkjury__seat${s.left ? " is-left" : ""}`} data-seat={s.id} style={{ left: `${p.x - size / 2}px`, top: `${p.y - size}px`, "--i": i }}>
            <JuryChar s={s} expression={expressionOf(s)} size={size} />
            {!hideNames && <bdi class="lkjury__name">{s.name}</bdi>}
            {newIds.includes(s.id) && <span class="lkjury__new">{t(k("card.new"))}</span>}
          </div>
        );
      })}
    </div>
  );
}

export { JuryChar };
