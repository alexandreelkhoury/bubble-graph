// Real-time benchmark in a local Chromium: plays the whole reveal with auto-advance (?auto=1) once per renderer and
// prints the `[pixi-bluff]` report. Desktop numbers are NOT TV numbers: run it on the TV (README) for the decision.
// Usage: node scripts/bench.mjs [url] [--renderers webgl,canvas,webgpu] [--size 1920x1080] [--extra "boil=0"]
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const url = args[0] && !args[0].startsWith("--") ? args[0] : "http://127.0.0.1:5174/";
const renderers = flag("--renderers", "webgl,canvas").split(",");
const [w, h] = flag("--size", "1920x1080").split("x").map(Number);
const extra = flag("--extra", "");

const browser = await chromium.launch({ args: ["--ignore-gpu-blocklist", "--enable-gpu-rasterization"] });
try {
  for (const r of renderers) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => console.error(`[${r}] page error:`, e.message));
    const sep = url.includes("?") ? "&" : "?";
    await page.goto(`${url}${sep}renderer=${r}&auto=1&hold=900${extra ? `&${extra}` : ""}`);
    await page.waitForFunction(() => globalThis.__pixiBluff?.reports.some((x) => !x.partial), null, { timeout: 180000 });
    const rep = await page.evaluate(() => globalThis.__pixiBluff.reports.find((x) => !x.partial));
    const s = rep.summary;
    console.log(`${r.padEnd(7)} → ${rep.renderer} ×${rep.res} on "${rep.gpu}"`);
    console.log(`         avg ${s.avgFps} fps · 1% low ${s.low1Fps} · 0.1% low ${s.low01Fps} · p50 ${s.p50Ms} ms · p95 ${s.p95Ms} ms · p99 ${s.p99Ms} ms · worst ${s.maxMs} ms`);
    console.log(`         frames ${s.frames} / ${s.seconds} s · >33 ms ${s.over33ms} · stutters ${s.stutters} · JS ${s.cpuAvgMs} ms/frame (p95 ${s.cpuP95Ms}) · heap ${s.heapMB} MB · first frame ${rep.loadMs} ms · ${JSON.stringify(rep.timings)}`);
    await page.close();
  }
} finally {
  await browser.close();
}
