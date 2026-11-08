// JAMAA-PLATFORM §2.1: every client-safe `@jamaa/shared` entry is zod-free and engine-free. Walks the runtime import
// graph of each entry in isolation (`import type` / `export type` erase at build time and are skipped) and fails if it
// reaches `zod`, a game engine, the registry, a definition or a content adapter.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import pkg from "../../package.json";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const exportsMap = pkg.exports as Record<string, string>;

/** Client-safe entries (§2.1). `./games/*\/meta` is expanded to every game folder. */
const GAMES = ["mishana", "bluff", "likely", "trivia"];
const CLIENT_SAFE = ["./games/ids", "./games/meta", "./games/types", "./worlds", "./constants", "./brand", "./billing/products", ...GAMES.map((g) => `./games/${g}/meta`)];

function entryFile(key: string): string {
  const direct = exportsMap[key];
  if (direct) return join(root, direct);
  const g = /^\.\/games\/([a-z]+)\/meta$/.exec(key);
  if (g && exportsMap["./games/*/meta"]) return join(root, exportsMap["./games/*/meta"].replace("*", g[1] as string));
  throw new Error(`no export ${key}`);
}

/** Runtime (non-type) module specifiers of a TS source. */
function runtimeImports(src: string): string[] {
  const out: string[] = [];
  const re = /^\s*(import|export)\s+(type\s+)?([^;]*?)\s*from\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']/gm;
  for (const m of src.matchAll(re)) {
    if (m[5]) { out.push(m[5]); continue; }
    if (m[2]) continue;                                   // import type … / export type …
    const clause = (m[3] ?? "").trim();
    // `import { type A, type B } from` is type-only too
    const inner = /^\{([^}]*)\}$/.exec(clause);
    if (inner && (inner[1] as string).split(",").map((s) => s.trim()).filter(Boolean).every((s) => s.startsWith("type "))) continue;
    out.push(m[4] as string);
  }
  return out;
}

function resolveRel(from: string, spec: string): string {
  const base = resolve(dirname(from), spec);
  for (const c of [base, `${base}.ts`, join(base, "index.ts")]) if (existsSync(c) && c.endsWith(".ts")) return c;
  if (spec.endsWith(".json") && existsSync(base)) return base;
  throw new Error(`cannot resolve ${spec} from ${from}`);
}

/** Every module reachable at runtime from `file`: relative files and bare package names. */
function graph(file: string): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const stack = [file];
  while (stack.length) {
    const f = stack.pop() as string;
    if (files.has(f)) continue;
    files.add(f);
    if (f.endsWith(".json")) continue;
    for (const spec of runtimeImports(readFileSync(f, "utf8"))) {
      if (spec.startsWith(".")) stack.push(resolveRel(f, spec));
      else packages.add(spec);
    }
  }
  return { files, packages };
}

const FORBIDDEN_PATH = [/\/engine\//, /\/games\/registry\.ts$/, /\/definition\.ts$/, /\/adapter\.ts$/, /\/content\.ts$/, /\/protocol\.ts$/, /\/room\//];

describe("zod-free client entries (§2.1)", () => {
  it.each(CLIENT_SAFE)("%s pulls in no zod and no engine at runtime", (key) => {
    const { files, packages } = graph(entryFile(key));
    expect([...packages].filter((p) => p === "zod" || p.startsWith("zod/"))).toEqual([]);
    const bad = [...files].map((f) => f.slice(root.length)).filter((f) => FORBIDDEN_PATH.some((re) => re.test(f)));
    expect(bad).toEqual([]);
  });
  it("the walker does see zod where it is (sanity check)", () => {
    expect(graph(entryFile("./games/protocol")).packages.has("zod")).toBe(true);
    expect([...graph(entryFile("./games/registry")).files].some((f) => f.includes("/engine/"))).toBe(true);
  });
  it("the exports map has the §2.1 entries", () => {
    for (const k of ["./room", "./games/ids", "./games/meta", "./games/types", "./games/registry", "./games/protocol", "./games/*/meta", "./worlds", "./content", "./protocol/v2"]) {
      expect(exportsMap[k], k).toBeTypeOf("string");
      expect(existsSync(join(root, (exportsMap[k] as string).replace("*", "mishana"))), k).toBe(true);
    }
  });
});
