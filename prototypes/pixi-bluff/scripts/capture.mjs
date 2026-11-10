// Deterministic capture of the full reveal: drives the scene with fixed 1/30 s steps (?capture=1, no rAF), screenshots
// every frame, then encodes an MP4 with the system ffmpeg.
// Usage: node scripts/capture.mjs <url> <out.mp4> [--size 1280x720] [--fps 30] [--stills dir [--stills-only]] [--overlay]
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const url = args[0] ?? "http://127.0.0.1:5174/";
const out = args[1] ?? "reveal.mp4";
const [w, h] = (flag("--size", "1280x720")).split("x").map(Number);
const fps = Number(flag("--fps", "30"));
const stills = flag("--stills", null);
const stillsOnly = args.includes("--stills-only"); // iterate on the look: half-second stills, no video
const frameDir = join(tmpdir(), `pixi-bluff-frames-${process.pid}`);
await mkdir(frameDir, { recursive: true });
if (stills) await mkdir(stills, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on("console", (m) => { if (m.text().startsWith("[pixi-bluff]")) console.log(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  const sep = url.includes("?") ? "&" : "?";
  await page.goto(`${url}${sep}capture=1&res=${w / 960}${args.includes("--overlay") ? "" : "&overlay=0"}`);
  await page.waitForFunction(() => !!globalThis.__pixiBluff, null, { timeout: 60000 });
  const canvas = page.locator("canvas");
  const dt = 1000 / fps;
  let n = 0, tailFrames = -1;
  const maxFrames = fps * 90;
  while (n < maxFrames) {
    await page.evaluate((ms) => globalThis.__advance(ms), n === 0 ? 0 : dt);
    if (!stillsOnly) await canvas.screenshot({ path: join(frameDir, `f${String(n).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
    if (stills && n % Math.round(fps / 2) === 0) await canvas.screenshot({ path: join(stills, `t${String(Math.round((n * dt) / 100)).padStart(4, "0")}.png`) });
    n++;
    if (tailFrames < 0 && (await page.evaluate(() => globalThis.__pixiBluff.finished))) tailFrames = fps * 3;
    if (tailFrames >= 0 && tailFrames-- === 0) break;
  }
  if (stillsOnly) process.exit(0);
  console.log(`captured ${n} frames (${(n / fps).toFixed(1)} s of scene time)`);
  const r = spawnSync("ffmpeg", ["-loglevel", "error", "-y", "-framerate", String(fps), "-i", join(frameDir, "f%05d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", out], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("ffmpeg failed");
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
  await rm(frameDir, { recursive: true, force: true });
}
