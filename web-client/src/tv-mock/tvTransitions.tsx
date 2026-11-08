// JAMAA-PLATFORM §3.10 A/B, DESIGN-JAMAA §3: the "enter the game" transitions on /tv, driven by the shared
// choreography sampler through the rAF runner (no Motion/GSAP). OK completes a running choreography (§3.10 E).
//  A. The Bab portal (hub → setup): the focused poster becomes a doorway arch (an SVG <clipPath> whose path follows the
//     sampled progress) that grows to cover the canvas with the world revealed through it (two-layer parallax); the
//     other posters slide out; at the hand-off the real setup screen takes over (title lands, panes stagger in).
//     1 100 ms the first time a game opens in this session, 700 ms afterwards (× 0.64). Back plays it reversed (600 ms).
//  B. The world entrance (setup → game, ≤ 2 000 ms): darken → the world's door → title → characters run in → settle.
// Calm/reduced motion: a 150 ms crossfade.
import { useEffect, useRef } from "preact/hooks";
import type { GameId } from "@jamaa/shared/games/ids";
import type { MemberPublic } from "@jamaa/shared/protocol/v2";
import type { Locale } from "@jamaa/shared/constants";
import { ENTRANCE, PORTAL, PORTAL_BACK, scaled, variant } from "../motion/choreo";
import { run } from "../motion/runner";
import { reduced } from "../lib/motion";
import { Character } from "../components/Character";
import { PosterArt, TitleLockup, WORLD_OF } from "../components/Poster";
import { setChoreo, armGuard } from "./tvPlatform";

export interface Box { x: number; y: number; w: number; h: number }
const SCREEN: Box = { x: 0, y: 0, w: 960, h: 540 };
/** The arch box that covers the whole canvas (the mask "exceeds the screen"). */
const COVER: Box = { x: -720, y: -760, w: 2400, h: 1800 };
export const PORTAL_REPEAT_SCALE = 0.64;

const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;
export function lerpBox(a: Box, b: Box, p: number): Box {
  return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p) };
}
/** The bab (flat-bottomed arch) path in a box: a half-round top, straight sides. */
export function archPath(b: Box): string {
  const r = Math.min(b.w / 2, b.h);
  return `M${b.x} ${b.y + b.h}V${b.y + r}A${r} ${r} 0 0 1 ${b.x + b.w} ${b.y + r}V${b.y + b.h}Z`;
}

function useChoreo(steps: ReturnType<typeof variant>, frame: Parameters<typeof run>[1], onDone: () => void, count = 1): void {
  useEffect(() => {
    if (steps.length === 0) { onDone(); armGuard(); return; }
    const r = run(steps, frame, () => { setChoreo(null); armGuard(); onDone(); }, count);
    setChoreo(r);
    return () => { r.cancel(); setChoreo(null); };
  }, []);
}

/** A. Portal forward. `onHandoff` swaps the hub for the setup screen underneath; `onDone` removes the overlay. */
export function Portal({ id, from, first, onHandoff, onDone, hubRoot }: { id: GameId; from: Box | null; first: boolean; onHandoff(): void; onDone(): void; hubRoot: () => HTMLElement | null }) {
  const pathRef = useRef<SVGPathElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const handed = useRef(false);
  const calm = reduced();
  const src = from ?? { x: 72, y: 82, w: 227, h: 313 };
  const steps = calm ? variant(PORTAL, { reduced: true }) : first ? [...PORTAL] : scaled(PORTAL, PORTAL_REPEAT_SCALE);
  const handoff = (): void => { if (!handed.current) { handed.current = true; onHandoff(); } };
  useChoreo(steps, (p) => {
    const el = root.current;
    if (!el) return;
    if (calm) { el.style.opacity = String(1 - p("fade")); handoff(); return; }
    const arch = p("arch");
    const box = lerpBox(src, COVER, arch);
    pathRef.current?.setAttribute("d", archPath(box));
    el.style.setProperty("--dark", String(0.4 * arch));
    // Parallax: the world background moves at 0.6× the mask growth, the props at 1.0×.
    el.style.setProperty("--bg", String(0.6 * p("parallax")));
    el.style.setProperty("--fg", String(p("parallax")));
    el.style.setProperty("--handoff", String(p("handoff")));
    const hub = hubRoot();
    if (hub) {
      hub.style.setProperty("--out", String(p("others")));
      hub.style.setProperty("--press", String(p("press")));
    }
    if (p("handoff") > 0) handoff();
  }, () => { handoff(); onDone(); });
  return (
    <div class={`tvportal${calm ? " is-calm" : ""}`} ref={root} data-world={WORLD_OF[id]} aria-hidden="true">
      <div class="tvportal__dark" />
      <svg class="tvportal__svg" width="0" height="0" aria-hidden="true">
        <defs><clipPath id="tvbab" clipPathUnits="userSpaceOnUse"><path ref={pathRef} d={archPath(src)} /></clipPath></defs>
      </svg>
      <div class="tvportal__world" style={calm ? undefined : { clipPath: "url(#tvbab)" }}>
        <div class="tvportal__bg" />
        <div class="tvportal__props"><PosterArt id={id} size={120} /></div>
      </div>
    </div>
  );
}

/** A. Portal reversed (setup → hub, 600 ms): the world shrinks back into the focused poster's arch. */
export function PortalBack({ id, to, onDone, hubRoot }: { id: GameId; to: () => Box | null; onDone(): void; hubRoot: () => HTMLElement | null }) {
  const pathRef = useRef<SVGPathElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const calm = reduced();
  const steps = calm ? variant(PORTAL_BACK, { reduced: true }) : [...PORTAL_BACK];
  useChoreo(steps, (p) => {
    const el = root.current;
    if (!el) return;
    if (calm) { el.style.opacity = String(1 - p("fade")); return; }
    const target = to() ?? { x: 72, y: 82, w: 227, h: 313 };
    const a = p("arch");
    pathRef.current?.setAttribute("d", archPath(lerpBox(COVER, target, a)));
    el.style.setProperty("--dark", String(0.4 * (1 - a)));
    el.style.opacity = a >= 1 ? "0" : "1";
    const hub = hubRoot();
    if (hub) hub.style.setProperty("--out", String(1 - p("others")));
  }, () => { const hub = hubRoot(); hub?.style.removeProperty("--out"); onDone(); });
  return (
    <div class={`tvportal tvportal--back${calm ? " is-calm" : ""}`} ref={root} data-world={WORLD_OF[id]} aria-hidden="true">
      <div class="tvportal__dark" />
      <svg class="tvportal__svg" width="0" height="0" aria-hidden="true">
        <defs><clipPath id="tvbabback" clipPathUnits="userSpaceOnUse"><path ref={pathRef} d={archPath(COVER)} /></clipPath></defs>
      </svg>
      <div class="tvportal__world" style={calm ? undefined : { clipPath: "url(#tvbabback)" }}>
        <div class="tvportal__bg" />
      </div>
    </div>
  );
}

/** B. World entrance overlay over the live game screen. */
export function Entrance({ id, members, script, onDone }: { id: GameId; members: readonly MemberPublic[]; script: Locale; onDone(): void }) {
  const root = useRef<HTMLDivElement>(null);
  const calm = reduced();
  const cast = members.filter((m) => !m.left && !m.benched).slice(0, 12);
  const steps = calm ? variant(ENTRANCE, { reduced: true }) : [...ENTRANCE];
  useChoreo(steps, (p) => {
    const el = root.current;
    if (!el) return;
    if (calm) { el.style.opacity = String(1 - p("fade")); return; }
    el.style.setProperty("--darken", String(p("darken")));
    el.style.setProperty("--door", String(p("door")));
    el.style.setProperty("--title", String(p("title")));
    el.style.setProperty("--settle", String(p("settle")));
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
