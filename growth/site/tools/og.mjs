#!/usr/bin/env node
// Renders assets/img/og-{en,fr,ar}.png (1200×630) from tools/og.html with headless Chrome (Playwright from web-client).
//   node tools/og.mjs        (build.mjs picks og-<lang>.png up automatically)
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, '../../web-client/package.json'));
const { chromium } = require('@playwright/test');
const chrome = ['/opt/google/chrome/chrome'].find((p) => fs.existsSync(p));
const b = await chromium.launch({ ...(chrome ? { executablePath: chrome } : {}), args: ['--allow-file-access-from-files'] });
const page = await b.newPage({ viewport: { width: 1200, height: 630 } });
for (const lang of ['en', 'fr', 'ar']) {
  await page.goto(pathToFileURL(path.join(ROOT, 'tools/og.html')).href + '?lang=' + lang);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const out = path.join(ROOT, `assets/img/og-${lang}.png`);
  await page.screenshot({ path: out });
  console.log('✓', path.relative(ROOT, out));
}
await b.close();
