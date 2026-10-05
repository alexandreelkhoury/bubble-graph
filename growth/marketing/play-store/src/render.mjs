// Renders every Play Store graphic into ../graphics/ (design-v3 D1-D3, D5).
//   node growth/marketing/play-store/src/render.mjs [icon|feature|banner|shots ...] [--placeholder-root=<dir>]
// Uses web-client's Playwright + the local Chrome. Non-icon PNGs are flattened to 24-bit RGB (Play rejects alpha);
// the icon is written as 32-bit RGBA. Screenshots come from ../frames.tsv: native captures in graphics/raw/<lang>/
// (D4). If a raw capture is missing and --placeholder-root is given, the browser-TV capture named in the
// placeholder_* columns is used instead and the output is named <name>-placeholder.jpg with a visible stamp.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "../../../..");
const gfx = path.resolve(here, "../graphics");
const require = createRequire(path.join(root, "web-client/package.json"));
const { chromium } = require("@playwright/test");

const args = process.argv.slice(2);
const phRoot = (args.find((a) => a.startsWith("--placeholder-root=")) || "").split("=")[1];
const want = args.filter((a) => !a.startsWith("--"));
const on = (k) => want.length === 0 || want.includes(k);
const url = (file, q = {}) => "file://" + path.join(here, file) + "?" + new URLSearchParams(q).toString();
const flatten = (f, bg = "#1D1036") => execFileSync("convert", [f, "-background", bg, "-alpha", "remove", "-alpha", "off", "PNG24:" + f]);

const jobs = [];
if (on("icon")) jobs.push({ src: url("icon.html"), out: "icon-512.png", w: 512, h: 512, alpha: true });
for (const lang of ["en", "fr", "ar"]) {
  if (on("feature")) jobs.push({ src: url("feature-graphic.html", { lang }), out: `feature-1024x500-${lang}.png`, w: 1024, h: 500 });
  if (on("banner")) jobs.push({ src: url("tv-banner.html", { lang }), out: `tv-banner-1280x720-${lang}.png`, w: 1280, h: 720 });
}
if (on("shots")) {
  const lines = fs.readFileSync(path.join(here, "../frames.tsv"), "utf8").split("\n").filter((l) => l && !l.startsWith("#"));
  const head = lines.shift().split("\t");
  for (const line of lines) {
    const r = Object.fromEntries(line.split("\t").map((v, i) => [head[i], v]));
    const real = (p) => p && path.join(gfx, p);
    const have = fs.existsSync(real(r.raw)) && [r.phone1, r.phone2].every((p) => !p || fs.existsSync(real(p)));
    let tv, p1, p2, ph = false;
    if (have) [tv, p1, p2] = [real(r.raw), real(r.phone1), real(r.phone2)];
    else if (phRoot) {
      [tv, p1, p2] = [r.placeholder_raw, r.placeholder_phone1, r.placeholder_phone2].map((p) => p && path.resolve(phRoot, p));
      ph = true;
    } else { console.warn("skip (no raw capture):", r.output); continue; }
    // Placeholders are JPEG (q90, accepted by Play) to keep the repo small; final screenshots are 24-bit PNG.
    const out = `screenshots/${r.output}${ph ? "-placeholder.jpg" : ".png"}`;
    if (r.type === "unaltered") { jobs.push({ copy: tv, out, jpg: ph }); continue; }
    const q = { img: "file://" + tv, h: r.headline, lang: r.lang };
    if (r.type === "composite") Object.assign(q, { p1: "file://" + p1, p2: "file://" + p2 });
    if (ph) q.ph = "1";
    jobs.push({ src: url("frame.html", q), out, w: 1920, h: 1080, jpg: ph });
  }
}

fs.mkdirSync(path.join(gfx, "screenshots"), { recursive: true });
const b = await chromium.launch({ executablePath: "/opt/google/chrome/chrome", args: ["--allow-file-access-from-files"] });
for (const j of jobs) {
  const out = path.join(gfx, j.out);
  if (j.copy) {
    // Unaltered (TV-G4): the capture exactly as taken, only re-encoded as 24-bit PNG.
    execFileSync("convert", [j.copy, "-alpha", "off", ...(j.jpg ? ["-quality", "90", out] : ["PNG24:" + out])]);
  } else {
    const c = await b.newContext({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: 1 });
    const p = await c.newPage();
    await p.goto(j.src);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForFunction(() => [...document.images].every((i) => i.complete));
    await p.waitForTimeout(200);
    await p.screenshot({ path: out, type: j.jpg ? "jpeg" : "png", quality: j.jpg ? 90 : undefined, omitBackground: !!j.alpha });
    await c.close();
    if (j.alpha) execFileSync("convert", [out, "PNG32:" + out]);
    else if (!j.jpg) flatten(out);
  }
  console.log(j.out);
}
await b.close();
