// TV building blocks: top bar, action pill (double-OK), timer ring, player tile, stamp, room code.
import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren, Ref } from "preact";
import type { DeadlineView, PublicPlayer, TvView } from "@mishana/shared/protocol";
import { fmtNum, t } from "../i18n/t";
import { PHASE_KEY } from "../lib/keys";
import { Avatar, avatarState, colorVars } from "../components/PlayerChip";
import { useDeadline } from "../components/Timer";
import { timerTone } from "../lib/countdown";
import { Icon } from "../components/Icon";
import { tvAct, tvConn, tvPaused } from "./tvStore";
import { openPause } from "./tvDialogs";
import { pushToast } from "../state/store";
import { ellipsizeName } from "../lib/names";

export const PRESS_AGAIN_MS = 3000;
/** DESIGN TV-06/07: names on vote tiles are cut to 12 graphemes. */
export const VOTE_NAME_MAX = 12;

export function RoomCode({ code, size = "mini" }: { code: string; size?: "mini" | "big" }) {
  return <span class={`tvcode tvcode--${size}`} dir="ltr" aria-label={code.split("").join(" ")}>{code.split("").map((c, i) => <span key={i}>{c}</span>)}</span>;
}

/**
 * The in-game top bar. `stillAlive` keeps a just-voted-out player counted until their card flips (the count must not
 * spoil the TV-07/TV-09 suspense). The pause button is for pointer remotes only (tabIndex -1: never a D-pad stop).
 */
export function TvTopBar({ view, title, stillAlive = null }: { view: TvView; title?: string; stillAlive?: string | null }) {
  const alive = view.players.filter((p) => (p.alive || p.id === stillAlive) && !p.left).length;
  const label = title ?? (view.phase === "ROLE_REVEAL" ? t("game.label", { count: view.gameNumber }) : `${t("round.label", { count: view.round })} · ${t(PHASE_KEY[view.phase])}`);
  const degraded = tvConn.value !== "open";
  return (
    <header class="tvtop">
      <span class="tvtop__title">{label}</span>
      <span class="tvtop__end">
        {degraded && <span class="tvchip tvchip--danger"><Icon name="wifi-off" size={20} /></span>}
        <RoomCode code={view.roomCode} />
        {view.phase !== "RESULTS" && <><span class="tvtop__dot" aria-hidden="true">·</span><span class="tnum">{t("common.aliveCount", { count: alive })}</span></>}
        {!tvPaused.value && (
          <button type="button" class="tvmenu-btn" tabIndex={-1} aria-label={t("tv.pauseTitle")} onClick={openPause}><Icon name="pause" size={20} /></button>
        )}
      </span>
    </header>
  );
}

/**
 * One ghost pill in the bottom-end action bar: first OK arms (or skips a running animation), second OK within 3 s sends
 * HOST_ADVANCE. Both labels share one grid cell, so arming never reflows the bar (Kotlin reserveText). While the socket
 * is down (TV-13a) a press is not dropped silently: it says "Reconnecting…" and does not arm.
 */
export function ActionPill({ label, onSkipAnimation, animating = false, pillRef, onAdvance }: { label: string; animating?: boolean; onSkipAnimation?(): void; pillRef?: Ref<HTMLButtonElement>; onAdvance?(): void }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const press = (): void => {
    if (animating && onSkipAnimation) { onSkipAnimation(); return; }
    if (tvConn.value !== "open") { pushToast(t("conn.tvReconnecting"), "error"); return; }
    if (armed) {
      if (timer.current) clearTimeout(timer.current);
      setArmed(false);
      if (onAdvance) onAdvance(); else tvAct({ type: "HOST_ADVANCE" });
      return;
    }
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), PRESS_AGAIN_MS);
  };
  return (
    <button type="button" ref={pillRef} class={`tvpill${armed ? " is-armed" : ""}`} onClick={press} data-pill="1">
      <span class="tvpill__label" aria-hidden={armed}>{label}</span>
      <span class="tvpill__label tvpill__label--armed" aria-hidden={!armed}>{t("tv.pressAgain")}</span>
    </button>
  );
}

/** Ring depletes clockwise from 12 o'clock in every locale; text → accent (≤10 s) → danger + pulse (≤5 s). */
export function TimerRing({ deadline, size = 216, stroke = 8, children, showNumber = true }: { deadline: DeadlineView | null; size?: number; stroke?: number; children?: ComponentChildren; showNumber?: boolean }) {
  const d = useDeadline(deadline);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = d ? timerTone(d.secs) : "normal";
  return (
    <div class={`ring ring--${tone}`} style={{ width: `${size}px`, height: `${size}px` }}>
      {d && (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} class="ring__svg" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} class="ring__track" stroke-width={stroke} fill="none" />
          <circle cx={size / 2} cy={size / 2} r={r} class="ring__fill" stroke-width={stroke} fill="none"
            stroke-dasharray={`${c} ${c}`} stroke-dashoffset={`${c * (1 - d.frac)}`} stroke-linecap="round"
            transform={`translate(${size} 0) scale(-1 1) rotate(-90 ${size / 2} ${size / 2})`} />
        </svg>
      )}
      <div class="ring__content">{children}</div>
      {d && showNumber && <span class="ring__num" role="timer"><bdi class="num">{fmtNum(d.secs)}</bdi></span>}
    </div>
  );
}

export function TimerChip({ deadline }: { deadline: DeadlineView | null }) {
  const d = useDeadline(deadline);
  if (!d) return null;
  return <span class={`tvtimerchip tvtimerchip--${timerTone(d.secs)}`} role="timer"><Icon name="timer" size={24} /><bdi class="num">{fmtNum(d.secs)}</bdi></span>;
}

export function TvTimerBar({ deadline }: { deadline: DeadlineView | null }) {
  const d = useDeadline(deadline);
  if (!d) return null;
  return (
    <div class={`tvbar tvbar--${timerTone(d.secs)}`}>
      <span class="tvbar__track"><span class="tvbar__fill" style={{ transform: `scaleX(${d.frac})` }} /></span>
      <span class="tvbar__secs"><bdi class="num">{fmtNum(d.secs)}</bdi></span>
    </div>
  );
}

/** A player tile; `nameMax` cuts the name to that many graphemes (DESIGN: 12 on vote tiles) before CSS ellipsis. */
export function Tile({ p, size = 56, check = false, focusable = false, onClick, class: cls, children, speaking = false, index, nameMax }: { p: PublicPlayer; size?: number; check?: boolean; focusable?: boolean; onClick?(): void; class?: string; children?: ComponentChildren; speaking?: boolean; index?: number; nameMax?: number }) {
  const inner = (
    <>
      <Avatar color={p.color} size={size} state={avatarState(p)} host={p.isHost} check={check} role={p.revealedRole} speaking={speaking} />
      <bdi class="tile__name">{nameMax ? ellipsizeName(p.name, nameMax) : p.name}</bdi>
      {children}
    </>
  );
  return focusable ? (
    <button type="button" class={`tile tile--btn${cls ? ` ${cls}` : ""}`} style={colorVars(p.color)} onClick={onClick} data-pid={p.id} data-index={index}>{inner}</button>
  ) : (
    <div class={`tile${cls ? ` ${cls}` : ""}`} style={colorVars(p.color)} data-pid={p.id}>{inner}</div>
  );
}

export function Stamp({ text, tone = "primary" }: { text: string; tone?: "primary" | "accent" | "muted" }) {
  return <span class={`stamp stamp--${tone}`}>{text}</span>;
}
