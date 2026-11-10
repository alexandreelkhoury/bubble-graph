// Boot: URL params, the Pixi application (960×540 logical, resolution capped), input from the TV remote, the perf
// overlay and the per-run log line.
//
// URL params: renderer=webgl|webgpu|canvas (default webgl) · res=<backing scale> (default min(2, screen/960)) ·
// overlay=0 · boil=0 (lite motion: boil off) · auto=1 (auto-advance; loops for benchmarking) · hold=<ms> ·
// capture=1 (no rAF; window.__advance(ms) drives frames: for video capture).
import { Application, Container } from "pixi.js";
import type { Renderer } from "pixi.js";
import { loadAll } from "./assets";
import { PerfOverlay, heapMB, summarize } from "./perf";
import type { RunSummary } from "./perf";
import { H, RevealScene, W } from "./scene";

const q = new URLSearchParams(location.search);
const t0 = (window as unknown as { __t0?: number }).__t0 ?? 0;
const capture = q.get("capture") === "1";
const autoplay = q.get("auto") === "1" || capture;
const holdMs = Number(q.get("hold") ?? (capture ? 1100 : 1600));
const pref = (q.get("renderer") ?? "webgl") as "webgl" | "webgpu" | "canvas";
const screenScale = Math.min((window.innerWidth * devicePixelRatio) / W, (window.innerHeight * devicePixelRatio) / H);
let res = Math.round(Number(q.get("res") ?? Math.min(2, Math.max(1, screenScale))) * 100) / 100;
let boil = q.get("boil") !== "0";
const RES_STEPS = [2, 1.5, 1, 0.75];

interface Report { renderer: string; gpu: string; res: number; boil: boolean; loadMs: number; timings: Record<string, number>; run: number; partial: boolean; ua: string; screen: string; summary: RunSummary }
const reports: Report[] = [];

async function main(): Promise<void> {
  const boot = document.getElementById("boot")!;
  const tStart = performance.now();
  const app = new Application();
  await app.init({
    width: W,
    height: H,
    resolution: res,
    autoDensity: false,
    antialias: false, // the art is pre-rasterised; MSAA would only cost fill rate on a TV GPU
    backgroundColor: 0x0d0718,
    preference: pref,
    powerPreference: "high-performance",
    autoStart: false,
    sharedTicker: false,
    eventMode: "none",
    hello: false,
    preferWebGLVersion: 2,
  });
  const tInit = performance.now();
  const canvas = app.canvas;
  document.body.appendChild(canvas);
  const fit = (): void => {
    const k = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = `${Math.round(W * k)}px`;
    canvas.style.height = `${Math.round(H * k)}px`;
  };
  fit();
  window.addEventListener("resize", fit);

  const base = import.meta.env.BASE_URL;
  const loaded = await loadAll(base);
  const r = app.renderer as Renderer;
  const rname = r.name === "webgl" ? `webgl${(r as unknown as { context: { webGLVersion: number } }).context.webGLVersion}` : r.name;
  const gpu = gpuName(r);

  // draw-call counter (WebGL only): wraps drawElements/drawArrays
  let draws = 0;
  if (r.name === "webgl") {
    const gl = (r as unknown as { gl: WebGLRenderingContext }).gl;
    const de = gl.drawElements.bind(gl), da = gl.drawArrays.bind(gl);
    gl.drawElements = (...a: Parameters<WebGLRenderingContext["drawElements"]>) => { draws++; de(...a); };
    gl.drawArrays = (...a: Parameters<WebGLRenderingContext["drawArrays"]>) => { draws++; da(...a); };
  }

  const overlay = new PerfOverlay(`${rname} ×${res}`);
  overlay.root.visible = q.get("overlay") !== "0";
  let frames: number[] = [];
  let cpu: number[] = []; // JS time per frame (scene update + render submission)
  let run = 0;
  let scene: RevealScene;
  let loadMs = 0;

  const report = (partial: boolean): string => {
    const summary = summarize(frames, cpu);
    const rep: Report = {
      renderer: rname, gpu, res, boil, loadMs: Math.round(loadMs), timings: Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, Math.round(v)])),
      run, partial, ua: navigator.userAgent, screen: `${window.innerWidth}x${window.innerHeight}@${devicePixelRatio}`, summary,
    };
    reports.push(rep);
    console.log(`[pixi-bluff] ${JSON.stringify(rep)}`);
    const s = summary;
    return [
      `${s.avgFps} fps average  ·  1% low ${s.low1Fps}  ·  load ${(loadMs / 1000).toFixed(2)} s`,
      `frames ${s.frames} in ${s.seconds} s · p95 ${s.p95Ms} ms · p99 ${s.p99Ms} ms · worst ${s.maxMs} ms`,
      `JS ${s.cpuAvgMs} ms/frame (p95 ${s.cpuP95Ms}) · >33 ms: ${s.over33ms} · stutters: ${s.stutters} · heap ${s.heapMB ?? "n/a"} MB · ${rname} ×${res} · boil ${boil ? "on" : "off"}`,
      gpu.slice(0, 70),
    ].join("\n");
  };

  const timings: Record<string, number> = { ...loaded.timings, initRenderer: tInit - tStart, script: tStart - t0 };
  const ui = new Container();
  const newScene = (): void => {
    scene = new RevealScene({ loaded, boil: () => boil, onRunEnd: () => report(false), autoplay, holdMs });
    app.stage.removeChildren();
    app.stage.addChild(scene.root, scene.hud, ui);
    frames = [];
    cpu = [];
    run++;
    scene.start();
  };
  ui.addChild(overlay.root);
  newScene();
  boot.remove();

  const restart = (): void => {
    if (!scene.finished && frames.length > 30) report(true);
    scene.destroy();
    newScene();
  };

  window.addEventListener("keydown", (e) => {
    const k = e.key, c = e.keyCode;
    if (k === "Enter" || k === " " || k === "NumpadEnter" || k === "ArrowRight" || c === 13 || c === 23) scene.ok();
    else if (k === "Escape" || k === "Backspace" || k === "GoBack" || k === "BrowserBack" || c === 27 || c === 8 || c === 4) restart();
    else if (k === "ArrowUp") overlay.root.visible = !overlay.root.visible;
    else if (k === "ArrowLeft") boil = !boil;
    else if (k === "ArrowDown") {
      res = RES_STEPS[(RES_STEPS.indexOf(res) + 1) % RES_STEPS.length] ?? 1;
      app.renderer.resize(W, H, res);
      overlay.label = `${rname} ×${res}`;
      restart();
    } else return;
    e.preventDefault();
  });

  let first = true;
  let endAt: number | undefined;
  /** dt drives the scene (capped at 100 ms by the ticker); realMs is the true frame interval for the statistics. */
  const tick = (dt: number, realMs = dt): void => {
    const c0 = performance.now();
    scene.update(dt);
    overlay.frame(realMs, `boil ${boil ? "on" : "off"} · confetti ${scene.confetti.count} · ${heapMB() ?? "-"} MB`);
    draws = 0;
    app.render();
    overlay.drawCalls = draws;
    if (!scene.finished) {
      frames.push(realMs);
      cpu.push(performance.now() - c0);
    }
    if (first) {
      first = false;
      loadMs = performance.now();
      console.log(`[pixi-bluff] first frame at ${Math.round(loadMs)} ms (since navigation start); ${JSON.stringify(timings)}`);
    }
    // auto=1 benchmark loop: replay 4 s after the finale
    if (autoplay && !capture && scene.finished) {
      endAt ??= scene.now;
      if (scene.now - endAt > 4000) {
        endAt = undefined;
        restart();
      }
    }
  };

  const api = { reports, get scene() { return scene; }, ok: () => scene.ok(), restart, get finished() { return scene.finished; } };
  (window as unknown as { __pixiBluff: typeof api }).__pixiBluff = api;
  if (capture) {
    (window as unknown as { __advance: (ms: number) => void }).__advance = (ms: number) => tick(ms);
    tick(0);
  } else {
    app.ticker.add((t) => tick(t.deltaMS, t.elapsedMS));
    app.ticker.start();
  }
}

function gpuName(r: Renderer): string {
  if (r.name !== "webgl") return r.name;
  const gl = (r as unknown as { gl: WebGLRenderingContext }).gl;
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
}

main().catch((e: unknown) => {
  const boot = document.getElementById("boot");
  if (boot) {
    boot.className = "err";
    boot.textContent = `Pixi prototype failed to start:\n${e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e)}`;
  }
  console.error("[pixi-bluff] boot failed", e);
});
