// §8.8: request the wake lock on the Join tap (and once a seat is held, e.g. after a resume) and re-request
// when the page becomes visible or on the next tap.
import { signal } from "@preact/signals";

let sentinel: WakeLockSentinel | null = null;
let wanted = false;

export function wakeLockSupported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator && (typeof isSecureContext === "undefined" || isSecureContext);
}

/** True when the browser refused the lock (the Lobby then shows the keepScreenOn hint). */
export const wakeLockDenied = signal(false);

/** Marks the lock as wanted (a seat is held) without requesting it yet. */
export function wantWakeLock(): void { wanted = true; }

export async function requestWakeLock(): Promise<boolean> {
  wanted = true;
  if (!wakeLockSupported()) return false;
  if (sentinel && !sentinel.released) return true;
  try {
    sentinel = await navigator.wakeLock.request("screen");
    sentinel.addEventListener("release", () => { sentinel = null; });
    wakeLockDenied.value = false;
    return true;
  } catch {
    wakeLockDenied.value = true;
    return false;
  }
}

/** Called on visibilitychange → visible / pageshow / any tap. */
export function reacquireWakeLock(): void {
  if (!wanted || (sentinel && !sentinel.released)) return;
  if (typeof document === "undefined" || document.visibilityState === "visible") void requestWakeLock();
}

export function releaseWakeLock(): void {
  wanted = false;
  const s = sentinel;
  sentinel = null;
  if (s) void s.release().catch(() => undefined);
}
