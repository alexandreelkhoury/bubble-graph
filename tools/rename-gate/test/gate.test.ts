// JAMAA-PLATFORM §1.7 item 2: the rename gate's matching, allowlist parsing and repo walk.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GATE_PATTERN, globToRegExp, isBinary, isExcluded, parseAllowlist, runGate, scanText } from "../src/gate.mjs";

const here = dirname(fileURLToPath(import.meta.url));

describe("GATE_PATTERN (case-insensitive, like rg -i)", () => {
  it.each(["Mish Ana!", "MISH ANA", "mish-ana", "mishana", "MISHANA_WS_URL", "mish_bg", "MishColors", "Theme.MishAna", "@mishana/shared", "app.mishana.tv"])(
    "matches %s",
    (s) => expect(GATE_PATTERN.test(s)).toBe(true),
  );
  it.each(["JAMAA", "jamaa_prefs", "@jamaa/shared", "Mis Ana", "dish ana"])("does not match %s", (s) => expect(GATE_PATTERN.test(s)).toBe(false));
});

describe("globToRegExp", () => {
  it("handles **, *, ? and braces", () => {
    expect(globToRegExp("shared/src/games/mishana/**").test("shared/src/games/mishana/meta.ts")).toBe(true);
    expect(globToRegExp("shared/src/games/mishana/**").test("shared/src/games/bluff/meta.ts")).toBe(false);
    expect(globToRegExp("tv-app/**/games/mishana/**").test("tv-app/app/src/main/java/app/jamaa/tv/games/mishana/X.kt")).toBe(true);
    expect(globToRegExp("docs/GAME-*.md").test("docs/GAME-BLUFF.md")).toBe(true);
    expect(globToRegExp("docs/GAME-*.md").test("docs/sub/GAME-BLUFF.md")).toBe(false);
    expect(globToRegExp("growth/site/{CRO-AUDIT,SEO-REPORT}.md").test("growth/site/SEO-REPORT.md")).toBe(true);
    expect(globToRegExp("growth/site/{CRO-AUDIT,SEO-REPORT}.md").test("growth/site/GEO-PLAN.md")).toBe(false);
    expect(globToRegExp("a?.txt").test("ab.txt")).toBe(true);
    expect(globToRegExp("*.lock").test("deep/dir/x.lock")).toBe(true);
  });
});

describe("scanText and the allowlist", () => {
  const allow = parseAllowlist("# comment\n\nshared/src/games/mishana/**\nline: game\\.mishana\\.\nline: \"mishana\"\n");
  it("reports hits outside the allowlist with line numbers", () => {
    expect(scanText("server/src/x.ts", 'ok\nconst a = "mish-ana";\n', allow)).toEqual([{ path: "server/src/x.ts", line: 2, text: 'const a = "mish-ana";' }]);
  });
  it("skips allowed paths and allowed lines", () => {
    expect(scanText("shared/src/games/mishana/meta.ts", "Mish Ana!", allow)).toEqual([]);
    expect(scanText("shared/i18n/en.json", '"game.mishana.title": "Mish Ana!",\nconst id = "mishana";', allow)).toEqual([]);
  });
  it("excludes .git and the lockfile; detects binaries", () => {
    expect(isExcluded(".git/config")).toBe(true);
    expect(isExcluded("pnpm-lock.yaml")).toBe(true);
    expect(isExcluded("server/src/a.ts")).toBe(false);
    expect(isBinary(new Uint8Array([65, 0, 66]))).toBe(true);
    expect(isBinary(new TextEncoder().encode("mishana"))).toBe(false);
  });
  it("the shipped allowlist parses", () => {
    const a = parseAllowlist(readFileSync(join(here, "..", "allowlist.txt"), "utf8"));
    expect(a.globs.length).toBeGreaterThan(5);
    expect(a.lines.length).toBeGreaterThan(0);
  });
});

describe("runGate over a git repo", () => {
  it("walks tracked and untracked files, honours .gitignore, skips binaries", () => {
    const root = mkdtempSync(join(tmpdir(), "rename-gate-"));
    execFileSync("git", ["init", "-q"], { cwd: root });
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, ".gitignore"), "ignored/\n");
    mkdirSync(join(root, "ignored"));
    writeFileSync(join(root, "ignored", "a.txt"), "mishana");
    writeFileSync(join(root, "src", "a.ts"), "export const x = 'MishColors';\n");
    writeFileSync(join(root, "src", "ok.ts"), "export const x = 'JAMAA';\n");
    writeFileSync(join(root, "bin.dat"), Buffer.from([0x6d, 0x69, 0x73, 0x68, 0x61, 0x6e, 0x61, 0]));
    writeFileSync(join(root, "pnpm-lock.yaml"), "'@mishana/shared': link\n");
    expect(runGate(root, "")).toEqual([{ path: "src/a.ts", line: 1, text: "export const x = 'MishColors';" }]);
    expect(runGate(root, "src/**")).toEqual([]);
  });
});
