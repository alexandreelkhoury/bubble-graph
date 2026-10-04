// A deterministic 29 x 29 QR-looking module grid (decorative: finder patterns + seeded noise).
const N = 29;
const finder = (r: number, c: number) => {
  const inF = (r0: number, c0: number) => {
    const y = r - r0, x = c - c0;
    if (x < 0 || y < 0 || x > 6 || y > 6) return null;
    const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
    return ring !== 2;
  };
  return inF(0, 0) ?? inF(0, N - 7) ?? inF(N - 7, 0);
};
const nearFinder = (r: number, c: number) => (r < 8 && c < 8) || (r < 8 && c >= N - 8) || (r >= N - 8 && c < 8);

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

export const QR_N = N;
export const QR: boolean[][] = Array.from({length: N}, (_, r) =>
  Array.from({length: N}, (_, c) => {
    const f = finder(r, c);
    if (f !== null) return f;
    if (nearFinder(r, c)) return false;
    if (r === 6) return c % 2 === 0;
    if (c === 6) return r % 2 === 0;
    return rnd() > 0.52;
  }),
);
