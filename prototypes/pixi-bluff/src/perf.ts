// Frame statistics + the on-screen overlay. Frame times come from the ticker (rAF timestamps). A "run" is one pass of
// the reveal (start → finale); its summary is logged as one `[pixi-bluff]` console line (logcat in the debug TV app).
import { Container, Graphics } from "pixi.js";
import type { BitmapText } from "pixi.js";
import { text } from "./draw";

export interface RunSummary {
  frames: number;
  seconds: number;
  avgFps: number;
  low1Fps: number;
  low01Fps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  over33ms: number;
  over50ms: number;
  stutters: number;
  heapMB: number | null;
}

interface ChromeMemory { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number }
export function heapMB(): number | null {
  const m = (performance as unknown as { memory?: ChromeMemory }).memory;
  return m ? Math.round((m.usedJSHeapSize / 1048576) * 10) / 10 : null;
}

const pct = (sorted: number[], p: number): number => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] ?? 0;
const r1 = (v: number): number => Math.round(v * 10) / 10;

export function summarize(frames: number[]): RunSummary {
  const n = frames.length;
  const total = frames.reduce((a, b) => a + b, 0);
  const sorted = [...frames].sort((a, b) => a - b);
  const desc = [...sorted].reverse();
  const worst = (k: number): number => {
    const c = Math.max(1, Math.floor(n * k));
    let s = 0;
    for (let i = 0; i < c; i++) s += desc[i] ?? 0;
    return 1000 / (s / c);
  };
  const median = pct(sorted, 0.5);
  return {
    frames: n,
    seconds: r1(total / 1000),
    avgFps: r1(n ? (n * 1000) / total : 0),
    low1Fps: r1(n ? worst(0.01) : 0),
    low01Fps: r1(n ? worst(0.001) : 0),
    p50Ms: r1(median),
    p95Ms: r1(pct(sorted, 0.95)),
    p99Ms: r1(pct(sorted, 0.99)),
    maxMs: r1(sorted[n - 1] ?? 0),
    over33ms: frames.filter((f) => f > 33.4).length,
    over50ms: frames.filter((f) => f > 50).length,
    // a stutter = a frame that took ≥ 2× the median (a visibly skipped frame at 60 Hz)
    stutters: frames.filter((f) => f >= median * 1.9 && f > 20).length,
    heapMB: heapMB(),
  };
}

export class PerfOverlay {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly line1: BitmapText;
  private readonly line2: BitmapText;
  private readonly hist: number[] = [];
  private acc = 0;
  private accFrames = 0;
  private sinceDraw = 0;
  drawCalls = 0;

  constructor(public label: string) {
    this.root.addChild(this.g);
    this.line1 = text("", 13, 0xfff1dc, { anchorX: 0, anchorY: 0, align: "left" });
    this.line2 = text("", 11, 0xc9bfff, { anchorX: 0, anchorY: 0, align: "left" });
    this.line1.position.set(8, 4);
    this.line2.position.set(8, 22);
    this.root.addChild(this.line1, this.line2);
    this.root.position.set(6, 6);
  }

  frame(dtMs: number, extra: string): void {
    this.hist.push(dtMs);
    if (this.hist.length > 120) this.hist.shift();
    this.acc += dtMs;
    this.accFrames++;
    this.sinceDraw += dtMs;
    if (this.sinceDraw < 250 || !this.root.visible) return;
    const fps = (this.accFrames * 1000) / this.acc;
    const worst = Math.max(...this.hist);
    this.line1.text = `${fps.toFixed(1)} fps  ${(this.acc / this.accFrames).toFixed(1)} ms  worst ${worst.toFixed(0)} ms`;
    this.line2.text = `${this.label}  draws ${this.drawCalls || "n/a"}  ${extra}`;
    this.acc = this.accFrames = this.sinceDraw = 0;
    // frame-time graph: 120 bars, 16.7 ms and 33 ms guides
    const g = this.g;
    g.clear();
    const W = 250, H = 36, top = 40;
    g.roundRect(0, 0, W + 12, top + H + 8, 6).fill({ color: 0x0d0718, alpha: 0.72 });
    const y = (ms: number): number => top + H - Math.min(H, (ms / 50) * H);
    g.moveTo(6, y(16.7)).lineTo(6 + W, y(16.7)).stroke({ width: 1, color: 0x3ddc97, alpha: 0.6 });
    g.moveTo(6, y(33.3)).lineTo(6 + W, y(33.3)).stroke({ width: 1, color: 0xff5a5f, alpha: 0.6 });
    const bw = W / 120;
    this.hist.forEach((ms, i) => {
      g.rect(6 + i * bw, y(ms), Math.max(1, bw - 0.4), top + H - y(ms)).fill({ color: ms > 33.4 ? 0xff5a5f : ms > 20 ? 0xffc94d : 0x3ddc97 });
    });
  }
}
