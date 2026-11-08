export interface Rng { state: number; next(): number; int(n: number): number }   // int: 0..n-1
export function createRng(state: number): Rng {
  const r: Rng = {
    state: state >>> 0,
    next() {
      r.state = (r.state + 0x6D2B79F5) >>> 0;
      let t = r.state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(n) { return Math.floor(r.next() * n); },
  };
  return r;
}
