// Bakes the hand-made SVG drawings (bake/art/*.js) into texture-atlas pages in public/atlas/ (committed, so `vite build`
// needs no browser). Usage: pnpm --filter @jamaa/pixi-bluff-proto bake  (needs a Chromium: PLAYWRIGHT_BROWSERS_PATH or
// the default Playwright cache; never runs `playwright install`).
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = join(root, "public", "atlas");
const TYPES = { ".html": "text/html", ".js": "text/javascript" };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/")).replace(/^(\.\.[/\\])+/, "");
  try {
    const body = await readFile(join(root, "bake", path));
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const addr = server.address();
const port = typeof addr === "object" && addr ? addr.port : 0;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("bake page error:", e.message));
  await page.goto(`http://127.0.0.1:${port}/bake.html`);
  await page.waitForFunction(() => globalThis.__bakeReady === true);
  const t0 = Date.now();
  const res = await page.evaluate(() =>
    globalThis.__bake({
      players: ["coral", "azure", "lemon", "jade", "grape", "rose"],
      exprs: ["idle", "happy", "smug", "laugh", "shock", "cheer", "sad"],
      pxPerUnit: 6,
    }),
  );
  await mkdir(outDir, { recursive: true });
  const dataOf = (url) => Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
  const manifest = { pages: [], meta: res.meta };
  for (const p of res.pages) {
    await writeFile(join(outDir, p.file), dataOf(p.dataUrl));
    const json = p.file.replace(/\.\w+$/, ".json");
    await writeFile(join(outDir, json), JSON.stringify(p.json));
    manifest.pages.push(json);
    console.log(`${p.file}  ${p.json.meta.size.w}x${p.json.meta.size.h}  ${Object.keys(p.json.frames).length} frames  ${(dataOf(p.dataUrl).length / 1024).toFixed(0)} KB`);
  }
  await writeFile(join(outDir, "room.webp"), dataOf(res.room));
  console.log(`room.webp  1920x1080  ${(dataOf(res.room).length / 1024).toFixed(0)} KB`);
  await writeFile(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 1));
  console.log(`baked in ${Date.now() - t0} ms -> ${outDir}`);
} finally {
  await browser.close();
  server.close();
}
