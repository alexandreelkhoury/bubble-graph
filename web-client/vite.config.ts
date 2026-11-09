import { defineConfig } from "vite";
import type { Plugin } from "vite";
import preact from "@preact/preset-vite";
import { WORLD_IDS, worldColor } from "../shared/src/worlds/index";
import { worldCss } from "./src/lib/worlds";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { splitCatalog } from "./src/lib/i18nSplit";

/** JAMAA-PLATFORM §3.4: `virtual:jamaa-worlds.css` = the shared world palettes as CSS (build time, zero phone JS). */
function worlds(): Plugin {
  const id = "virtual:jamaa-worlds.css";
  return {
    name: "jamaa-worlds",
    resolveId: (s) => (s === id ? `\0${id}` : null),
    load: (s) => (s === `\0${id}` ? worldCss(WORLD_IDS, worldColor) : null),
  };
}

/** §3.8: `virtual:jamaa-i18n/<l>` = the phone part of shared/i18n/<l>.json, `virtual:jamaa-i18n-tv/<l>` = its TV part. */
export function i18nSplit(): Plugin {
  const re = /^virtual:jamaa-i18n(-tv)?\/(en|fr|ar|es)$/;
  return {
    name: "jamaa-i18n-split",
    resolveId: (s) => (re.test(s) ? `\0${s}` : null),
    load(s) {
      const m = re.exec(s.startsWith("\0") ? s.slice(1) : "");
      if (!m) return null;
      const file = fileURLToPath(new URL(`../shared/i18n/${m[2]}.json`, import.meta.url));
      this.addWatchFile(file);
      return `export default ${JSON.stringify(splitCatalog(JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>, !!m[1]))};`;
    },
  };
}

// JAMAA-PLATFORM §3.8: chunk names the budget script (scripts/check-size.mjs) understands.
//   game-<id>[-shared]       a game's phone screens (lazy; counted per game, ≤ 14 KB gz)
//   tv-mock*                 the /tv browser TV and its per-game screens (excluded from the phone budget)
//   i18n-<id>-<locale>       one game's strings in one locale (lazy; the largest counts)
//   <locale>                 the EN/FR/AR/ES root catalogs, phone part (lazy; one per player, the largest counts)
//   tv-mock-i18n-<locale>    the TV part of a root catalog (src/lib/i18nSplit.ts; the /tv mock only)
const norm = (p: string | null | undefined): string => (p ?? "").replace(/\\/g, "/");
function chunkName(facade: string, modules: readonly string[]): string | null {
  const f = norm(facade);
  const v = /virtual:jamaa-i18n(-tv)?\/([a-z]{2})$/.exec(f);
  if (v) return v[1] ? `tv-mock-i18n-${v[2]}` : v[2]!;
  let m = /\/src\/games\/([a-z]+)\/phone\.tsx$/.exec(f);
  if (m) return `game-${m[1]}`;
  m = /\/src\/games\/([a-z]+)\/tv\.tsx$/.exec(f);
  if (m) return `tv-mock-game-${m[1]}`;
  m = /\/i18n\/games\/([a-z]+)\/([a-z]{2})\.json$/.exec(f);
  if (m) return `i18n-${m[1]}-${m[2]}`;
  if (/\/src\/tv-mock\//.test(f)) return "tv-mock";
  const mods = modules.map(norm);
  if (mods.length > 0) {
    const g = /\/src\/games\/([a-z]+)\//.exec(mods[0]!);
    if (g && mods.every((x) => x.includes(`/src/games/${g[1]}/`) && !x.includes("/tv/") && !x.endsWith("/tv.tsx"))) return `game-${g[1]}-shared`;
    // The phone never imports /tv code, so any chunk holding a tv-mock module (or a game's TV screens) is TV-only.
    if (mods.some((x) => x.includes("/src/tv-mock/") || /\/src\/games\/[a-z]+\/(tv\/|tv\.tsx)/.test(x))) return "tv-mock-shared";
  }
  return null;
}

export default defineConfig({
  plugins: [worlds(), i18nSplit(), preact()],
  server: { host: true, port: 5173, strictPort: true,
    proxy: { "/api": "http://127.0.0.1:8787", "/healthz": "http://127.0.0.1:8787",
             "/parties": { target: "ws://127.0.0.1:8787", ws: true } } },
  build: {
    outDir: "dist", target: "es2022",
    rollupOptions: {
      output: {
        // One "core" chunk for every module the phone shell needs (one gzip stream instead of a dozen tiny shared
        // chunks, ~1–2 KB gz less). TV-only and per-game modules stay out so phones never download them.
        codeSplitting: {
          groups: [{
            name: "core",
            test: (id: string) => {
              const f = norm(id);
              if (!/(\/web-client\/src\/|\/shared\/src\/|\/node_modules\/)/.test(f)) return false;
              return !/\/tv-mock\/|\/src\/games\/[a-z]+\/|\/motion\/|iconsTv|qrcode|\.json$|\/shared\/src\/games\/(meta|registry|[a-z]+\/)|\/shared\/src\/(billing|room|content|projection|protocol\/)|\/src\/games\/tvLoaders/.test(f);
            },
          }],
        },
        chunkFileNames: (chunk) => `assets/${chunkName(chunk.facadeModuleId ?? "", chunk.moduleIds ?? []) ?? "[name]"}-[hash].js`,
      },
    },
  },
});
