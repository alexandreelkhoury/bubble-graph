// App-wide signals (§8.2): view, me, conn, lastError, locale (+ UI helpers: toasts, live region, clock).
import { computed, signal } from "@preact/signals";
import type { ErrorCode, ErrorMsg, PlayerView } from "@mishana/shared/protocol";
import type { ConnStatus } from "../net/connection";
import { ClockOffset } from "../lib/countdown";

export { locale } from "../i18n/t";

export const view = signal<PlayerView | null>(null);
export const me = computed(() => view.value?.me ?? null);
export const conn = signal<ConnStatus>("connecting");
export const lastError = signal<ErrorMsg | null>(null);
/** Fatal close code (§8.4), or null while the session is alive. */
export const fatalCode = signal<number | null>(null);
/** The last error code seen before a fatal close (picks the RoomGone text). */
export const fatalError = signal<ErrorCode | null>(null);
/** Error shown inline on the current screen (PH-14 "Inline" table). */
export const inlineError = signal<ErrorCode | null>(null);
/** True after a join was sent and until welcome/error. */
export const joinPending = signal(false);
/** True while the hello carried a resume token and no state has arrived yet. */
export const resuming = signal(false);

const clock = new ClockOffset();
export const clockOffset = signal(0);
export function sampleClock(serverNow: number, localNow = Date.now()): void {
  clockOffset.value = clock.add(serverNow, localNow);
}
export function resetClock(): void {
  clock.reset();
  clockOffset.value = 0;
}

export type ToastTone = "info" | "error" | "success";
export interface Toast { id: number; text: string; tone: ToastTone }
export const toasts = signal<Toast[]>([]);
let toastId = 0;
export function pushToast(text: string, tone: ToastTone = "info", ms = 3000): void {
  const id = ++toastId;
  toasts.value = [...toasts.value.slice(-1), { id, text, tone }]; // max 2 visible
  setTimeout(() => { toasts.value = toasts.value.filter((x) => x.id !== id); }, ms);
}

/** aria-live announcements (DESIGN §8 global rules). */
export const politeMsg = signal("");
export const assertiveMsg = signal("");
export function announce(text: string, assertive = false): void {
  const s = assertive ? assertiveMsg : politeMsg;
  s.value = "";
  queueMicrotask(() => { s.value = text; });
}

/** Menu sheet (PH-17) open state. */
export const menuOpen = signal(false);
