// Timers from the server deadline and the clock offset (§8.5). Never local constants.
import { useEffect, useState } from "preact/hooks";
import type { DeadlineView } from "@mishana/shared/protocol";
import { clockOffset } from "../state/store";
import { fractionLeft, remainingMs, secondsLeft, timerTone } from "../lib/countdown";
import { fmtNum } from "../i18n/t";

/** Re-renders every `ms` while mounted; returns Date.now(). */
export function useNow(ms = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function useDeadline(deadline: DeadlineView | null): { secs: number; frac: number; ms: number } | null {
  const now = useNow(200);
  if (!deadline) return null;
  const off = clockOffset.value;
  return {
    secs: secondsLeft(deadline.at, now, off),
    frac: fractionLeft(deadline.at, deadline.durationMs, now, off),
    ms: remainingMs(deadline.at, now, off),
  };
}

/** Linear bar; depletes toward inline-start (mirrors in RTL). role=timer, aria-live off. */
export function TimerBar({ deadline, showSeconds = true, class: cls }: { deadline: DeadlineView | null; showSeconds?: boolean; class?: string }) {
  const d = useDeadline(deadline);
  if (!d) return null;
  const tone = timerTone(d.secs);
  return (
    <div class={`timerbar timerbar--${tone}${cls ? ` ${cls}` : ""}`} role="timer" aria-live="off">
      <span class="timerbar__track"><span class="timerbar__fill" style={{ transform: `scaleX(${d.frac})` }} /></span>
      {showSeconds && <span class="timerbar__secs timer">{fmtNum(d.secs)}</span>}
    </div>
  );
}
