// JAMAA-PLATFORM §3.10 A/B, DESIGN-JAMAA §3: the "enter the game" transitions on /tv, driven by the shared
// choreography sampler through the rAF runner (no Motion/GSAP). OK completes a running choreography (§3.10 E).
//  A. The Bab portal (hub → setup): the focused poster becomes a doorway arch (a composited arch mask moved and scaled
//     by transforms only, see archTransform) that grows to cover the canvas with the world revealed through it (two-layer parallax); the
//     other posters slide out; at the hand-off the real setup screen takes over (title lands, panes stagger in).
//     1 100 ms the first time a game opens in this session, 700 ms afterwards (× 0.64). Back plays it reversed (600 ms).
//  B. The world entrance (setup → game, ≤ 2 000 ms): darken → the world's door → title → characters run in → settle.
// Calm/reduced motion: a 150 ms crossfade.
import { useEffect, useRef, useState } from "preact/hooks";
import type { GameId } from "@jamaa/shared/games/ids";
import type { MemberPublic } from "@jamaa/shared/protocol/v2";
import type { Locale } from "@jamaa/shared/constants";
import { CHOREO, PORTAL_REPEAT_SCALE, run, scaled, variant } from "@jamaa/shared/motion";
import type { Run, RunnerClock } from "@jamaa/shared/motion";
import { reduced } from "../lib/motion";
import { Character } from "../components/Character";
import { PosterArt, TitleLockup, WORLD_OF } from "../components/Poster";
import { armGuard, clearChoreo, setChoreo } from "./tvPlatform";

export interface Box { x: number; y: number; w: number; h: number }
const SCREEN: Box = { x: 0, y: 0, w: 960, h: 540 };
/** The arch box that covers the whole canvas (the mask "exceeds the screen"). */
const COVER: Box = { x: -720, y: -760, w: 2400, h: 1800 };

const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;
export function lerpBox(a: Box, b: Box, p: number): Box {
  return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p) };
}
/** The bab (flat-bottomed arch) path in a box: a half-round top, straight sides. */
export function archPath(b: Box): string {
  const r = Math.min(b.w / 2, b.h);
  return `M${b.x} ${b.y + b.h}V${b.y + r}A${r} ${r} 0 0 1 ${b.x + b.w} ${b.y + r}V${b.y + b.h}Z`;
}

/**
 * The arch as a composited mask (no re-raster per frame, §3.10 A perf): a fixed arch element the size of `base` with a
 * half-round top, moved and scaled onto `box`, and the world inside it counter-transformed so it stays put at canvas
 * coordinates. Only transforms change per frame, so the compositor scales the already-rasterized layers instead of
 * repainting a clip-path over the whole canvas.
 */
export function archTransform(base: Box, box: Box): { outer: string; inner: string } {
  const sx = box.w / base.w, sy = box.h / base.h;
  const outer = `translate(${box.x - base.x}px, ${box.y - base.y}px) scale(${sx}, ${sy})`;
  const inner = `translate(${base.x - box.x / sx}px, ${base.y - box.y / sy}px) scale(${1 / sx}, ${1 / sy})`;
  return { outer, inner };
}
function archStyle(base: Box, calm: boolean): Record<string, string | number> {
  if (calm) return { left: 0, top: 0, width: "960px", height: "540px" };
  const r = Math.min(base.w / 2, base.h);
  return { left: `${base.x}px`, top: `${base.y}px`, width: `${base.w}px`, height: `${base.h}px`, borderRadius: `${r}px ${r}px 0 0` };
}
function worldStyle(base: Box, calm: boolean): Record<string, string> {
  return calm ? { left: "0px", top: "0px" } : { left: `${-base.x}px`, top: `${-base.y}px` };
}
function placeArch(arch: HTMLElement | null, world: HTMLElement | null, base: Box, box: Box): void {
  if (!arch || !world) return;
  const t = archTransform(base, box);
  arch.style.transform = t.outer;
  world.style.transform = t.inner;
}

function useChoreo(steps: ReturnType<typeof variant>, frame: Parameters<typeof run>[1], onDone: () => void, count = 1, hold?: Hold): void {
  useEffect(() => {
    if (steps.length === 0) { onDone(); armGuard(); return; }
    let reg: Run | null = null;
    const r = run(steps, frame, () => { if (reg) clearChoreo(reg); armGuard(); onDone(); }, count, hold ? hold.clock : undefined);
    // OK completes a running choreography, but a held one (the server has not answered yet) only skips to the hold.
    reg = hold ? { complete: () => { if (hold.ready()) r.complete(); else hold.skip(); }, cancel: () => r.cancel(), get running() { return r.running; } } : r;
    setChoreo(reg);
    return () => { r.cancel(); if (reg) clearChoreo(reg); };
  }, []);
}

/**
 * A rAF clock whose time stops at `holdAt` until `ready()` (the optimistic portal: the press dip, the others sliding
 * out and the arch run at once on OK; the hand-off waits for the server's SETUP). Time resumes from the hold, so the
 * steps after it play in full.
 */
export interface Hold { clock: RunnerClock; ready(): boolean; skip(): void }
export function holdClock(holdAt: number, ready: () => boolean, raf: RunnerClock | null = browserClock()): Hold {
  let v = 0;
  let last = -1;
  const advance = (now: number): number => {
    if (last >= 0) v += now - last;
    last = now;
    if (!ready()) v = Math.min(v, holdAt);
    return v;
  };
  return {
    clock: { request: (cb) => (raf ? raf.request((now) => cb(advance(now))) : 0), cancel: (h) => raf?.cancel(h) },
    ready,
    skip: () => { v = Math.max(v, holdAt); },
  };
}
function browserClock(): RunnerClock | null {
  return typeof requestAnimationFrame === "function" ? { request: (cb) => requestAnimationFrame(cb), cancel: (h) => cancelAnimationFrame(h) } : null;
}

/**
 * A. Portal forward. `onHandoff` swaps the hub for the setup screen underneath; `onDone` removes the overlay.
 * `ready` is false while the portal runs optimistically (started locally on OK, §3.10 A): the choreography holds at the
 * hand-off until the room's SETUP arrives.
 */
export function Portal({ id, from, first, ready, onHandoff, onDone, hubRoot }: { id: GameId; from: Box | null; first: boolean; ready: boolean; onHandoff(): void; onDone(): void; hubRoot: () => HTMLElement | null }) {
  const archRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const handed = useRef(false);
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const calm = reduced();
  const src = from ?? { x: 72, y: 82, w: 227, h: 313 };
  const steps = calm ? variant(CHOREO.portal, { reduced: true }) : first ? [...CHOREO.portal] : scaled(CHOREO.portal, PORTAL_REPEAT_SCALE);
  const holdAt = calm ? 0 : steps.find((s) => s.id === "handoff")?.startMs ?? 0;
  const [hold] = useState(() => holdClock(holdAt, () => readyRef.current));
  const handoff = (): void => { if (!handed.current && readyRef.current) { handed.current = true; onHandoff(); } };
  useChoreo(steps, (p) => {
    const el = root.current;
    if (!el) return;
    if (calm) { el.style.opacity = String(1 - p("fade")); handoff(); return; }
    const arch = p("arch");
    placeArch(archRef.current, worldRef.current, src, lerpBox(src, COVER, arch));
    el.style.setProperty("--dark", String(0.4 * arch));
    // Parallax: the world background moves at 0.6× the mask growth, the props at 1.0×.
    el.style.setProperty("--bg", String(0.6 * p("parallax")));
    el.style.setProperty("--fg", String(p("parallax")));
    el.style.setProperty("--handoff", String(p("handoff")));
    const hub = hubRoot();
    if (hub) {
      hub.style.setProperty("--out", String(p("othersOut")));
      hub.style.setProperty("--press", String(p("press")));
    }
    if (p("handoff") > 0) handoff();
  }, () => { handoff(); onDone(); }, 1, hold);
  // Calm: the crossfade holds at its start and hands off as soon as the server answers.
  useEffect(() => { if (ready && calm) handoff(); }, [ready]);
  return (
    <div class={`tvportal${calm ? " is-calm" : ""}`} ref={root} data-world={WORLD_OF[id]} data-portal-ready={ready ? "" : undefined} aria-hidden="true">
      <div class="tvportal__dark" />
      <div class="tvportal__arch" ref={archRef} style={archStyle(src, calm)}>
        <div class="tvportal__world" ref={worldRef} style={worldStyle(src, calm)}>
          <div class="tvportal__bg" />
          <div class="tvportal__props"><PosterArt id={id} size={120} /></div>
        </div>
      </div>
    </div>
  );
}

/** A. Portal reversed (setup → hub, 600 ms): the world shrinks back into the focused poster's arch. */
export function PortalBack({ id, to, onDone, hubRoot }: { id: GameId; to: () => Box | null; onDone(): void; hubRoot: () => HTMLElement | null }) {
  const archRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const [base] = useState<Box>(() => to() ?? { x: 72, y: 82, w: 227, h: 313 });
  const root = useRef<HTMLDivElement>(null);
  const calm = reduced();
  const steps = calm ? variant(CHOREO.portalBack, { reduced: true }) : [...CHOREO.portalBack];
  useChoreo(steps, (p) => {
    const el = root.current;
    if (!el) return;
    if (calm) { el.style.opacity = String(1 - p("fade")); return; }
    const target = to() ?? base;
    const a = p("arch");
    placeArch(archRef.current, worldRef.current, base, lerpBox(COVER, target, a));
    el.style.setProperty("--dark", String(0.4 * (1 - a)));
    el.style.opacity = a >= 1 ? "0" : "1";
    const hub = hubRoot();
    if (hub) hub.style.setProperty("--out", String(1 - p("othersIn")));
  }, () => { const hub = hubRoot(); hub?.style.removeProperty("--out"); hub?.style.removeProperty("--press"); onDone(); });
  return (
    <div class={`tvportal tvportal--back${calm ? " is-calm" : ""}`} ref={root} data-world={WORLD_OF[id]} aria-hidden="true">
      <div class="tvportal__dark" />
      <div class="tvportal__arch" ref={archRef} style={{ ...archStyle(base, calm), ...(calm ? {} : { transform: archTransform(base, COVER).outer }) }}>
        <div class="tvportal__world" ref={worldRef} style={{ ...worldStyle(base, calm), ...(calm ? {} : { transform: archTransform(base, COVER).inner }) }}>
          <div class="tvportal__bg" />
        </div>
      </div>
    </div>
  );
}

/** B. World entrance overlay over the live game screen. */
export function Entrance({ id, members, script, onDone }: { id: GameId; members: readonly MemberPublic[]; script: Locale; onDone(): void }) {
  const root = useRef<HTMLDivElement>(null);
  const calm = reduced();
  const cast = members.filter((m) => !m.left && !m.benched).slice(0, 12);
  const steps = calm ? variant(CHOREO.entrance, { reduced: true }) : [...CHOREO.entrance];
  useChoreo(steps, (p) => {
    const el = root.current;
    if (!el) return;
    if (calm) { el.style.opacity = String(1 - p("fade")); return; }
    el.style.setProperty("--darken", String(p("darken")));
    el.style.setProperty("--door", String(p("door")));
    el.style.setProperty("--title", String(p("title")));
    el.style.setProperty("--settle", String(p("titleSettle")));
    el.querySelectorAll<HTMLElement>(".tventr__ch").forEach((c, i) => c.style.setProperty("--run", String(p("characters", i))));
  }, onDone, cast.length);
  const half = Math.ceil(cast.length / 2);
  return (
    <div class={`tventr${calm ? " is-calm" : ""}`} ref={root} data-world={WORLD_OF[id]} data-entrance aria-hidden="true">
      <div class="tventr__dark" />
      <div class={`tventr__door tventr__door--${WORLD_OF[id]}`}>
        <span class="tventr__d1" /><span class="tventr__d2" /><span class="tventr__d3" /><span class="tventr__d4" />
      </div>
      <div class="tventr__title"><TitleLockup id={id} script={script} /></div>
      <ul class="tventr__cast">
        {cast.map((m, i) => (
          <li key={m.id} class="tventr__ch" style={{ "--from": i < half ? -1 : 1, "--i": i }}>
            <Character color={m.color} size={56} expression="happy" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export { SCREEN };
