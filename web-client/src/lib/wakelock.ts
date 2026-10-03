// §8.8: request the wake lock on the Join tap and re-request when the page becomes visible.
let sentinel: WakeLockSentinel | null = null;
let wanted = false;

export function wakeLockSupported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator && (typeof isSecureContext === "undefined" || isSecureContext);
}

export async function requestWakeLock(): Promise<boolean> {
  wanted = true;
  if (!wakeLockSupported()) return false;
  if (sentinel && !sentinel.released) return true;
  try {
    sentinel = await navigator.wakeLock.request("screen");
    sentinel.addEventListener("release", () => { sentinel = null; });
    return true;
  } catch {
    return false;
  }
}

/** Called on visibilitychange → visible / pageshow. */
export function reacquireWakeLock(): void {
  if (wanted && document.visibilityState === "visible") void requestWakeLock();
}

export function releaseWakeLock(): void {
  wanted = false;
  const s = sentinel;
  sentinel = null;
  if (s) void s.release().catch(() => undefined);
}
