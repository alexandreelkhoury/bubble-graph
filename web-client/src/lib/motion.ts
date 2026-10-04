/** Reduced motion (DESIGN §6.3): web media query. Reduced motion also halves reveal times. */
export function reduced(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
export function ms(n: number): number {
  return reduced() ? Math.round(n / 2) : n;
}
