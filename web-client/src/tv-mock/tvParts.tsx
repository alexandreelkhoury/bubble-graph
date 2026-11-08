// TV building blocks: top bar (with the in-game "◁ Back: menu & rules" hint), the in-game OK hook, timer ring, player
// tile, stamp, room code. JAMAA-PLATFORM §3.2 HUB-06: in game the TV shows no focusable buttons; host actions live in
// the pause menu, and OK only completes a local reveal choreography (§3.10 E).
import { useEffect, useRef } from "preact/hooks";
import { signal } from "@preact/signals";
import type { ComponentChildren, Ref } from "preact";
import type { DeadlineView, PublicPlayer, TvView } from "../games/mishana/view";
import { fmtNum, t } from "../i18n/t";
import { PHASE_KEY } from "../lib/keys";
import { Avatar, avatarState, colorVars } from "../components/PlayerChip";
import { useDeadline } from "../components/Timer";
import { timerTone } from "../lib/countdown";
import { Icon } from "../components/Icon";
import { tvConn, tvPaused } from "./tvStore";
import { openPause } from "./tvDialogs";
import { ellipsizeName } from "../lib/names";

/** §3.2 HUB-06 discoverability: the top bar's end corner shows "◁ Back: menu & rules" (round 1, 3 s after each phase). */
export const backHintOn = signal(false);

/** The current in-game OK handler (a running reveal registers "complete it"), or null: OK then does nothing. */
let okHandler: (() => void) | null = null;
/** Called by the platform on OK in game; true when a local choreography consumed it. */
export function inGameOk(): boolean {
  const h = okHandler;
  if (!h) return false;
  h();
  return true;
}
/** Registers `onOk` while `active` (a reveal that OK completes locally). */
export function useInGameOk(active: boolean, onOk: (() => void) | undefined): void {
  const ref = useRef(onOk);
  ref.current = onOk;
  useEffect(() => {
    if (!active || !onOk) return;
    const h = (): void => ref.current?.();
    okHandler = h;
    return () => { if (okHandler === h) okHandler = null; };
  }, [active, !!onOk]);
}

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
  const label = title ?? (view.phase === "ROLE_REVEAL" ? t("game.mishana.title") : `${t("round.label", { count: view.round })} · ${t(PHASE_KEY[view.phase])}`);
  const degraded = tvConn.value !== "open";
  return (
    <header class="tvtop">
      <span class="tvtop__title">{label}</span>
      <span class="tvtop__end">
        {degraded && <span class="tvchip tvchip--danger"><Icon name="wifi-off" size={20} /></span>}
        <RoomCode code={view.roomCode} />
        {view.phase !== "RESULTS" && <><span class="tvtop__dot" aria-hidden="true">·</span><span class="tnum">{t("common.aliveCount", { count: alive })}</span></>}
        {backHintOn.value && !tvPaused.value && <span class="tvhint" role="note"><Icon name="arrow-back" size={18} class="flip-rtl" />{t("hint.backMenu")}</span>}
        {!tvPaused.value && (
          <button type="button" class="tvmenu-btn" tabIndex={-1} aria-label={t("tv.pauseTitle")} onClick={openPause}><Icon name="pause" size={20} /></button>
        )}
      </span>
    </header>
  );
}

/**
 * Formerly the double-OK action pill. JAMAA-PLATFORM §3.2 HUB-06: in game the TV has no focusable buttons ("Skip" is a
 * pause-menu item now), so this renders nothing; a running animation registers OK = "skip it" (§3.10 E rule 5).
 */
export function ActionPill({ animating = false, onSkipAnimation }: { label: string; animating?: boolean; onSkipAnimation?(): void; pillRef?: Ref<HTMLButtonElement>; onAdvance?(): void }) {
  useInGameOk(animating, onSkipAnimation);
  return null;
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
