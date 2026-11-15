// The on-screen keyboard and the action bar. Mobile browsers (iOS Safari, Android Chrome ≥ 108) lay the keyboard OVER
// the page: only the visual viewport shrinks, so a `position: sticky; bottom: 0` bar stays at the bottom of the layout
// viewport, under the keyboard. On Join that hid "Let me in!" while the name field had focus; a tap on a character
// moved the keyboard just long enough to flash it. `--kb-inset` is the keyboard's height over the layout viewport,
// and `.actionbar { bottom: var(--kb-inset) }` keeps every action bar right above the keyboard.

/** Pixels of the layout viewport hidden under the keyboard (0 when there is none; small toolbar shifts ignored). */
export function keyboardInset(layoutHeight: number, vv: { height: number; offsetTop: number }): number {
  const h = Math.round(layoutHeight - vv.height - vv.offsetTop);
  return h > 40 ? h : 0;
}

type VV = { height: number; offsetTop: number; addEventListener(t: string, f: () => void): void };

/** Keeps `--kb-inset` on `root` (the <html> element) in step with the visual viewport. The layout viewport's height is
 *  `root.clientHeight` (iOS reports `innerHeight` as the visual viewport, so it cannot be used). */
export function watchKeyboard(win: { visualViewport?: VV | null }, root: { clientHeight: number; style: { setProperty(k: string, v: string): void } }): void {
  const vv = win.visualViewport;
  if (!vv) return;
  let last = -1;
  const sync = (): void => {
    const h = keyboardInset(root.clientHeight, vv);
    if (h !== last) root.style.setProperty("--kb-inset", `${(last = h)}px`);
  };
  vv.addEventListener("resize", sync);
  vv.addEventListener("scroll", sync);
  sync();
}

/** Keeps `--actionbar-h` on <html> equal to the fixed action bar's height (0 when there is none), so `.stage` can
 *  reserve that room. Bars come and go with screens, hence the MutationObserver. */
export function watchActionBar(doc: Document): void {
  if (typeof ResizeObserver === "undefined") return;
  let bar: Element | null = null;
  const set = (): void => doc.documentElement.style.setProperty("--actionbar-h", `${bar ? Math.ceil(bar.getBoundingClientRect().height) : 0}px`);
  const ro = new ResizeObserver(set);
  const find = (): void => {
    const next = doc.querySelector(".actionbar");
    if (next === bar) return;
    if (bar) ro.unobserve(bar);
    bar = next;
    if (bar) ro.observe(bar);
    set();
  };
  new MutationObserver(find).observe(doc.body, { childList: true, subtree: true });
  find();
}
