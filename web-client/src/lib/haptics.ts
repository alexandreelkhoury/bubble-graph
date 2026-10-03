// DESIGN §6.5 haptics. Feature-checked; silently skipped where unsupported (iOS).
import { loadVibration, saveVibration } from "./storage";

export const HAPTIC = {
  reveal: 10,
  yourTurn: [30, 60, 30],
  nextUp: 15,
  voteLocked: 20,
  eliminated: [80, 40, 80],
  guessSent: 20,
  win: [20, 40, 20, 40, 60],
  error: [40, 30, 40],
  tick: 10,
  unlocked: 30,
} as const;

let enabled = loadVibration();

export function vibrationEnabled(): boolean { return enabled; }
export function setVibration(on: boolean): void {
  enabled = on;
  saveVibration(on);
}

export function haptic(pattern: number | readonly number[]): void {
  if (!enabled) return;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(typeof pattern === "number" ? pattern : [...pattern]);
    }
  } catch {
    /* ignore */
  }
}
