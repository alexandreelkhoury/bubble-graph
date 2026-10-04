// Timers from the server deadline and the clock offset (§8.5). Never local constants.
// One shared 5 Hz clock signal ticks only while something reads it; a screen that only needs a boolean ("time's up")
// subscribes to a computed of it and re-renders when that boolean flips, not five times a second.
import { useMemo } from "preact/hooks";
import { computed, signal } from "@preact/signals";
import type { DeadlineView } from "@mishana/shared/protocol";
import { clockOffset } from "../state/store";
import { fractionLeft, remainingMs, secondsLeft, timerTone } from "../lib/countdown";
import { fmtNum } from "../i18n/t";

const TICK_MS = 200;
let ticker: ReturnType<typeof setInterval> | null = null;

/** Date.now(), refreshed every 200 ms while at least one component or computed reads it. */
export const now = signal(Date.now(), {
  watched() {
    queueMicrotask(() => { now.value = Date.now(); });
    ticker ??= setInterval(() => { now.value = Date.now(); }, TICK_MS);
  },
  unwatched() {
    if (ticker !== null) clearInterval(ticker);
    ticker = null;
  },
});

export interface Countdown { secs: number; frac: number; ms: number }

function countdown(deadline: DeadlineView, at: number, off: number): Countdown {
  return {
    secs: secondsLeft(deadline.at, at, off),
    frac: fractionLeft(deadline.at, deadline.durationMs, at, off),
    ms: remainingMs(deadline.at, at, off),
  };
}

/** The live countdown (re-renders the caller at 5 Hz while a deadline is set; never ticks without one). */
export function useDeadline(deadline: DeadlineView | null): Countdown | null {
  if (!deadline) return null;
  return countdown(deadline, now.value, clockOffset.value);
}

/**
 * A value derived from the countdown (e.g. `(c) => c.ms <= 0`): the caller re-renders only when it changes.
 * `select` must be pure; it is bound to the deadline it was created with.
 */
export function useDeadlineSelect<T>(deadline: DeadlineView | null, select: (c: Countdown) => T, fallback: T): T {
  const c = useMemo(
    () => computed(() => (deadline ? select(countdown(deadline, now.value, clockOffset.value)) : fallback)),
    [deadline?.at, deadline?.durationMs],
  );
  return c.value;
}

/** Linear bar; depletes toward inline-start (mirrors in RTL). role=timer, aria-live off. */
export function TimerBar({ deadline, showSeconds = true, class: cls, tone: fixedTone }: { deadline: DeadlineView | null; showSeconds?: boolean; class?: string; tone?: "neutral" }) {
  const d = useDeadline(deadline);
  if (!d) return null;
  // A wait the player can't act on (e.g. "Next round in…") never turns to warning colours.
  const tone = fixedTone ?? timerTone(d.secs);
  return (
    <div class={`timerbar timerbar--${tone}${cls ? ` ${cls}` : ""}`} role="timer" aria-live="off">
      <span class="timerbar__track"><span class="timerbar__fill" style={{ transform: `scaleX(${d.frac})` }} /></span>
      {showSeconds && <span class="timerbar__secs timer">{fmtNum(d.secs)}</span>}
    </div>
  );
}
