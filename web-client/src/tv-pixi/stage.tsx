// One Pixi Application for the whole /tv-pixi session (a WebGL context is expensive to create on a TV): its canvas is
// moved into whichever screen hosts it; a screen is a Scene (a Container + `set(view)` + per-frame `tick`). The fps
// overlay lives on the stage above every scene; ArrowUp held ≈ 0.8 s toggles it (or `?fps=1`, remembered).
import "pixi.js/unsafe-eval"; // the site CSP has no 'unsafe-eval'; pixi's default shader-sync codegen needs it
import { Application, Container } from "pixi.js";
import { useEffect, useRef } from "preact/hooks";
import type { TvRoomView } from "@jamaa/shared/protocol/v2";
import { FpsOverlay, H, SCALE, W } from "./kit";

export interface Scene {
  root: Container;
  set(view: TvRoomView): void;
  tick(dtMs: number): void;
  destroy(): void;
}

interface Pixi { app: Application; layer: Container; fps: FpsOverlay }
let booting: Promise<Pixi> | null = null;
let live: Pixi | null = null;

const FPS_KEY = "jamaa.pixi.fps";
function readFps(): boolean {
  try { return new URLSearchParams(location.search).get("fps") === "1" || localStorage.getItem(FPS_KEY) === "1"; } catch { return false; }
}

async function fontsReady(): Promise<void> {
  const loads = ["900 24px Cairo", "700 24px Cairo", "400 24px Cairo"].flatMap((f) => [document.fonts.load(f, "Abc123"), document.fonts.load(f, "مرحبا")]);
  await Promise.race([Promise.allSettled(loads), new Promise((r) => setTimeout(r, 2500))]);
}

function boot(): Promise<Pixi> {
  booting ??= (async () => {
    await fontsReady();
    const app = new Application();
    await app.init({
      width: W * SCALE, height: H * SCALE, resolution: 1, autoDensity: false, antialias: false, backgroundAlpha: 0,
      powerPreference: "high-performance",
    });
    const cv = app.canvas;
    cv.style.cssText = `position:absolute;inset:0;width:${W}px;height:${H}px;display:block;pointer-events:none`;
    const layer = new Container();
    layer.scale.set(SCALE);
    app.stage.addChild(layer);
    const fps = new FpsOverlay();
    fps.visible = readFps();
    const over = new Container();
    over.scale.set(SCALE);
    over.addChild(fps);
    app.stage.addChild(over);
    app.ticker.add((tk) => fps.frame(tk.deltaMS));
    let hold = 0;
    window.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowUp" || hold) return;
      hold = window.setTimeout(() => {
        fps.visible = !fps.visible;
        try { localStorage.setItem(FPS_KEY, fps.visible ? "1" : "0"); } catch { /* not persisted: fine */ }
      }, 800);
    });
    const release = (): void => { if (hold) { clearTimeout(hold); hold = 0; } };
    window.addEventListener("keyup", (e) => { if (e.key === "ArrowUp") release(); });
    window.addEventListener("blur", release);
    live = { app, layer, fps };
    return live;
  })();
  return booting;
}

/** Hosts a scene in the stage slot of the current screen. `make` runs once per mount, `view` feeds `scene.set`. */
export function PixiHost({ make, view, label, dep }: { make(): Scene; view: TvRoomView; label: string; dep?: unknown }) {
  const slot = useRef<HTMLDivElement>(null);
  const scene = useRef<Scene | null>(null);
  const latest = useRef(view);
  latest.current = view;
  useEffect(() => {
    let dead = false;
    let tick: ((tk: { deltaMS: number }) => void) | null = null;
    void boot().then((px) => {
      if (dead || !slot.current) return;
      slot.current.appendChild(px.app.canvas);
      const s = make();
      scene.current = s;
      px.layer.addChild(s.root);
      s.set(latest.current);
      px.fps.info = label;
      tick = (tk) => s.tick(tk.deltaMS);
      px.app.ticker.add(tick);
    });
    return () => {
      dead = true;
      const s = scene.current;
      scene.current = null;
      if (live && tick) live.app.ticker.remove(tick);
      if (s) { s.root.parent?.removeChild(s.root); s.destroy(); }
      if (live?.app.canvas.parentElement === slot.current) live.app.canvas.remove();
    };
  }, []);
  useEffect(() => { scene.current?.set(view); }, [view, dep]);
  return <div class="tvpixi" ref={slot} />;
}
