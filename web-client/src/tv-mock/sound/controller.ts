// Wires the pure cue rules to the TV mock: view broadcasts, the running deadline, local reveal timelines and the
// remote's own feedback (focus move, OK, Back).
import { useEffect, useRef } from "preact/hooks";
import type { RefObject } from "preact";
import type { TvView } from "@mishana/shared/protocol";
import { remainingMs } from "../../lib/countdown";
import { clockOffset } from "../../state/store";
import { deadlineCue, RateLimiter, timelineCues, viewCues } from "./cues";
import type { CueId, TimelineMark } from "./cues";
import { play, playAll, stopAll, unlockAudio } from "./player";

let ticker: ReturnType<typeof setInterval> | null = null;
let current: TvView | null = null;
let lastRemaining: { at: number; ms: number } | null = null;

/** Every broadcast, in order (called from the TV store, whichever screen is showing). */
export function soundOnView(prev: TvView | null, next: TvView): void {
  current = next;
  playAll(viewCues(prev, next));
  if (!ticker) ticker = setInterval(tickDeadline, 100);
}

function tickDeadline(): void {
  const d = current?.deadline;
  if (!d) { lastRemaining = null; return; }
  const ms = remainingMs(d.at, Date.now(), clockOffset.value);
  const prev = lastRemaining?.at === d.at ? lastRemaining.ms : null;
  lastRemaining = { at: d.at, ms };
  const cue = deadlineCue(d.kind, prev, ms);
  if (cue) play({ cue });
}

export function soundReset(): void {
  if (ticker) clearInterval(ticker);
  ticker = null;
  current = null;
  lastRemaining = null;
  stopAll();
}

export function soundCue(cue: CueId): void {
  play({ cue });
}

const ARROWS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

/**
 * The first key press or click unlocks audio. Then: a focus change right after an arrow → `ui.move` (subtle,
 * rate-limited), OK on a control → `ui.select`, Back → `ui.back`.
 */
export function useRemoteSounds(canvas: RefObject<HTMLElement>, isBack: (e: KeyboardEvent) => boolean): void {
  useEffect(() => {
    const limiter = new RateLimiter(70);
    let arrowAt = -Infinity;
    const onKey = (e: KeyboardEvent): void => {
      unlockAudio();
      if (e.repeat && !ARROWS.has(e.key)) return;
      if (ARROWS.has(e.key)) arrowAt = performance.now();
      else if (e.key === "Enter" || e.key === " ") {
        if ((e.target as HTMLElement | null)?.closest?.("button, [tabindex]")) play({ cue: "ui.select" });
      } else if (isBack(e) && (e.target as HTMLElement | null)?.tagName !== "INPUT") play({ cue: "ui.back" });
    };
    const onPointer = (): void => unlockAudio();
    const onFocus = (): void => {
      const now = performance.now();
      if (now - arrowAt < 150 && limiter.allow(now)) play({ cue: "ui.move" });
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    const root = canvas.current;
    root?.addEventListener("focusin", onFocus);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
      root?.removeEventListener("focusin", onFocus);
    };
  }, []);
}

/**
 * Plays the marks a local animation clock crosses. `el` is the elapsed ms; a late mount (`startAt` > 0) or a skip
 * (a jump past a mark) stays silent, and a skip also cuts the cues still ringing (the drumroll).
 */
export function useTimelineSounds(marks: readonly TimelineMark[], el: number, startAt: number, end: number): void {
  const prev = useRef(startAt > 0 ? startAt : -1);
  useEffect(() => {
    const from = prev.current;
    prev.current = el;
    if (el <= from) return;
    for (const m of timelineCues(marks, from, el)) play({ cue: m.cue, rate: m.rate });
    if (el >= end && el - from > 250) stopAll();
  }, [el]);
}
