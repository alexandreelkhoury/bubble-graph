// Reduced motion (DESIGN §6.3, JAMAA-PLATFORM §3.8): the web media query OR the per-device "Calm animations"
// setting. Reduced motion also halves reveal times.
import { signal } from "@preact/signals";
import { KEYS, readRaw, writeRaw } from "./storage";

/** "Calm animations" (hub Settings on the TV): selects the reduced variant of every step list. */
export const calm = signal(readRaw(KEYS.calm) === "1");
export function setCalm(on: boolean): void {
  calm.value = on;
  writeRaw(KEYS.calm, on ? "1" : "0");
  if (typeof document !== "undefined") document.documentElement.toggleAttribute("data-calm", on);
}
if (typeof document !== "undefined") document.documentElement.toggleAttribute("data-calm", calm.value);

export function reduced(): boolean {
  return calm.value || (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
}
export function ms(n: number): number {
  return reduced() ? Math.round(n / 2) : n;
}
