// TV building blocks: top bar, action pill (double-OK), timer ring, player tile, stamp, room code.
import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren, Ref } from "preact";
import type { DeadlineView, PublicPlayer, TvView } from "@mishana/shared/protocol";
import { fmtNum, t } from "../i18n/t";
import { PHASE_KEY } from "../state/session";
import { Avatar, avatarState } from "../components/PlayerChip";
import { useDeadline } from "../components/Timer";
import { timerTone } from "../lib/countdown";
import { Icon } from "../components/Icon";
import { tvConn, tvSend } from "./tvStore";

export const PRESS_AGAIN_MS = 3000;

/** Focus `ref` on mount (and when `dep` changes): every TV screen has an initial focus. */
export function useInitialFocus<T extends HTMLElement>(dep: unknown = null): Ref<T> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const id = setTimeout(() => {
      const a = document.activeElement;
      if (!a || a === document.body || !a.isConnected || !(a as HTMLElement).closest(".tv__canvas")) ref.current?.focus();
      else ref.current?.focus();
    }, 30);
    return () => clearTimeout(id);
  }, [dep]);
  return ref;
}

export function RoomCode({ code, size = "mini" }: { code: string; size?: "mini" | "big" }) {
  return <span class={`tvcode tvcode--${size}`} dir="ltr" aria-label={code.split("").join(" ")}>{code.split("").map((c, i) => <span key={i}>{c}</span>)}</span>;
}

export function TvTopBar({ view, title }: { view: TvView; title?: string }) {
  const alive = view.players.filter((p) => p.alive && !p.left).length;
  const label = title ?? (view.phase === "ROLE_REVEAL" ? t("game.label", { count: view.gameNumber }) : `${t("round.label", { count: view.round })} · ${t(PHASE_KEY[view.phase])}`);
  const degraded = tvConn.value !== "open";
  return (
    <header class="tvtop">
      <span class="tvtop__title">{label}</span>
      <span class="tvtop__end">
        {degraded && <span class="tvchip tvchip--danger"><Icon name="wifi-off" size={20} /></span>}
        <RoomCode code={view.roomCode} />
        {view.phase !== "RESULTS" && <><span class="tvtop__dot" aria-hidden="true">·</span><span class="num">{t("common.aliveCount", { count: alive })}</span></>}
      </span>
    </header>
  );
}

/** One ghost pill in the bottom-end action bar: first OK arms (or skips a running animation), second OK within 3 s sends HOST_ADVANCE. */
export function ActionPill({ label, onSkipAnimation, animating = false, pillRef, onAdvance }: { label: string; animating?: boolean; onSkipAnimation?(): void; pillRef?: Ref<HTMLButtonElement>; onAdvance?(): void }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const press = (): void => {
    if (animating && onSkipAnimation) { onSkipAnimation(); return; }
    if (armed) {
      if (timer.current) clearTimeout(timer.current);
      setArmed(false);
      if (onAdvance) onAdvance(); else tvSend({ type: "HOST_ADVANCE" });
      return;
    }
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), PRESS_AGAIN_MS);
  };
  return (
    <button type="button" ref={pillRef} class={`tvpill${armed ? " is-armed" : ""}`} onClick={press} data-pill="1">
      {armed ? t("tv.pressAgain") : label}
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
      {d && showNumber && <span class="ring__num num" role="timer">{fmtNum(d.secs)}</span>}
    </div>
  );
}

export function TimerChip({ deadline }: { deadline: DeadlineView | null }) {
  const d = useDeadline(deadline);
  if (!d) return null;
  return <span class={`tvtimerchip tvtimerchip--${timerTone(d.secs)} num`} role="timer"><Icon name="timer" size={24} />{fmtNum(d.secs)}</span>;
}

export function TvTimerBar({ deadline }: { deadline: DeadlineView | null }) {
  const d = useDeadline(deadline);
  if (!d) return null;
  return (
    <div class={`tvbar tvbar--${timerTone(d.secs)}`}>
      <span class="tvbar__track"><span class="tvbar__fill" style={{ transform: `scaleX(${d.frac})` }} /></span>
      <span class="tvbar__secs num">{fmtNum(d.secs)}</span>
    </div>
  );
}

export function Tile({ p, size = 56, check = false, focusable = false, onClick, class: cls, children, speaking = false }: { p: PublicPlayer; size?: number; check?: boolean; focusable?: boolean; onClick?(): void; class?: string; children?: ComponentChildren; speaking?: boolean }) {
  const inner = (
    <>
      <Avatar color={p.color} size={size} state={avatarState(p)} host={p.isHost} check={check} role={p.revealedRole} speaking={speaking} />
      <bdi class="tile__name">{p.name}</bdi>
      {children}
    </>
  );
  return focusable ? (
    <button type="button" class={`tile tile--btn${cls ? ` ${cls}` : ""}`} onClick={onClick} data-pid={p.id}>{inner}</button>
  ) : (
    <div class={`tile${cls ? ` ${cls}` : ""}`} data-pid={p.id}>{inner}</div>
  );
}

export function Stamp({ text, tone = "primary" }: { text: string; tone?: "primary" | "accent" | "muted" }) {
  return <span class={`stamp stamp--${tone}`}>{text}</span>;
}
