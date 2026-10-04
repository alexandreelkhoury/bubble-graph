// D-pad emulation for the TV mock (DESIGN §7): arrows move focus by geometry (so RTL mirrors naturally), the topmost
// overlay traps focus, and something is always focused (the screen's [data-default-focus], else its action pill).
import { useEffect, useRef } from "preact/hooks";
import type { Ref, RefObject } from "preact";

const FOCUSABLE = "button:not([disabled]), [tabindex]";

export function isBackKey(e: KeyboardEvent): boolean {
  return e.key === "Escape" || e.key === "Backspace" || e.key === "GoBack" || e.key === "BrowserBack";
}

/** The topmost open overlay (dialogs, menus) traps the D-pad; otherwise the whole canvas. */
export function focusScope(root: HTMLElement): HTMLElement {
  const overlays = root.querySelectorAll<HTMLElement>(".tvoverlay");
  return overlays.length ? overlays[overlays.length - 1]! : root;
}

/** Remote-reachable controls: enabled, in the tab order (tabIndex ≥ 0; pointer-only buttons use -1), rendered, not inert. */
export function focusables(scope: HTMLElement): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (n) => n.tabIndex >= 0 && !n.closest("[inert]") && n.getClientRects().length > 0,
  );
}

/** The screen's default focus: an explicit [data-default-focus], else the action pill, else the first control. */
export function defaultFocus(scope: HTMLElement): HTMLElement | null {
  const list = focusables(scope);
  return list.find((n) => n.hasAttribute("data-default-focus")) ?? list.find((n) => n.hasAttribute("data-pill")) ?? list[0] ?? null;
}

export type Arrow = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";
export interface Rect { left: number; top: number; width: number; height: number }

/** Picks the nearest candidate in the arrow's direction: distance along the axis + 2.5 × the cross-axis offset. */
export function nearest<T>(from: Rect, candidates: readonly { el: T; rect: Rect }[], key: Arrow): T | null {
  const ax = from.left + from.width / 2, ay = from.top + from.height / 2;
  let best: T | null = null;
  let bestCost = Infinity;
  for (const { el, rect } of candidates) {
    const dx = rect.left + rect.width / 2 - ax, dy = rect.top + rect.height / 2 - ay;
    const [primary, secondary] = key === "ArrowRight" ? [dx, dy] : key === "ArrowLeft" ? [-dx, dy] : key === "ArrowDown" ? [dy, dx] : [-dy, dx];
    if (primary <= 4) continue;
    const cost = primary + 2.5 * Math.abs(secondary);
    if (cost < bestCost) { bestCost = cost; best = el; }
  }
  return best;
}

/**
 * A control scrolled out of its [data-scroll] box is reachable only from inside that box (where focus scrolls it into
 * view), so the D-pad enters a scrolling list on a visible row instead of jumping to one hidden past its edge.
 */
function scrolledAway(el: HTMLElement, from: HTMLElement): boolean {
  const box = el.closest<HTMLElement>("[data-scroll]");
  if (!box || box.contains(from)) return false;
  const b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
  return r.bottom <= b.top + 1 || r.top >= b.bottom - 1;
}

export function moveFocus(root: HTMLElement, key: string): boolean {
  if (key !== "ArrowUp" && key !== "ArrowDown" && key !== "ArrowLeft" && key !== "ArrowRight") return false;
  const scope = focusScope(root);
  const all = focusables(scope);
  if (all.length === 0) return false;
  const cur = document.activeElement as HTMLElement | null;
  if (!cur || !all.includes(cur)) { (defaultFocus(scope) ?? all[0]!).focus(); return true; }
  const best = nearest(cur.getBoundingClientRect(), all.filter((n) => n !== cur && !scrolledAway(n, cur)).map((el) => ({ el, rect: el.getBoundingClientRect() })), key);
  if (best) { best.focus(); best.scrollIntoView?.({ block: "nearest" }); return true; }
  return false;
}

/** Focuses `el` on the next frame if it is still on screen (focus restore after a dialog or menu closes). */
export function refocus(el: Element | null): void {
  if (!(el instanceof HTMLElement)) return;
  requestAnimationFrame(() => { if (el.isConnected && !el.closest("[inert]")) el.focus(); });
}

/**
 * Arrow keys → moveFocus; Back → `onBack`. A focus keeper puts focus back on the current scope's default whenever it
 * is lost (an element unmounted, a phase changed, an overlay opened or closed), on the next frame.
 */
export function useDpad(canvas: RefObject<HTMLElement>, onBack: (e: KeyboardEvent) => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const root = canvas.current;
      if (!root || e.defaultPrevented) return;
      if (e.key.startsWith("Arrow")) {
        if (moveFocus(root, e.key)) e.preventDefault();
        return;
      }
      if (isBackKey(e)) {
        const target = e.target as HTMLElement | null;
        if (target?.tagName === "INPUT") return;
        e.preventDefault();
        onBack(e);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const root = canvas.current;
    if (!root) return;
    let raf = 0;
    const check = (): void => {
      raf = 0;
      const scope = focusScope(root);
      const a = document.activeElement;
      if (a && a !== document.body && scope.contains(a) && !a.closest("[inert]")) return;
      defaultFocus(scope)?.focus();
    };
    const schedule = (): void => { if (!raf) raf = requestAnimationFrame(check); };
    const mo = new MutationObserver(schedule);
    mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["inert", "disabled"] });
    root.addEventListener("focusout", schedule);
    schedule();
    return () => {
      mo.disconnect();
      root.removeEventListener("focusout", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}

/** Focus `ref` on mount (and when `dep` changes): every TV screen and overlay has an initial focus. */
export function useInitialFocus<T extends HTMLElement>(dep: unknown = null): Ref<T> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const id = setTimeout(() => ref.current?.focus(), 30);
    return () => clearTimeout(id);
  }, [dep]);
  return ref;
}
