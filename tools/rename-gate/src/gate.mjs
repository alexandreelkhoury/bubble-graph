// JAMAA-PLATFORM §1.7 item 2: the case-insensitive rename gate. It reproduces
//   rg -i --hidden -g '!.git' -g '!pnpm-lock.yaml' -n 'mish[-_ ]?ana|mish_(bg|primary|accent)|\bMish[A-Z]'
// in plain Node (no ripgrep needed): the files are the ones git tracks plus untracked, non-ignored files (what rg
// walks when it honours .gitignore), binary files are skipped like rg does, and every hit not covered by
// allowlist.txt is reported.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The §1.7 pattern; the `i` flag applies to the whole pattern, as `rg -i` does. */
export const GATE_PATTERN = /mish[-_ ]?ana|mish_(bg|primary|accent)|\bMish[A-Z]/i;

/** Paths rg is told to skip (`-g '!.git' -g '!pnpm-lock.yaml'`). */
const EXCLUDED = [/^\.git(\/|$)/, /(^|\/)pnpm-lock\.yaml$/];

/**
 * Glob → RegExp over repo-relative POSIX paths. `**` matches any number of path segments (including none),
 * `*` and `?` stay inside one segment, `{a,b}` is an alternation. A glob with no `/` matches the base name
 * anywhere (gitignore style).
 */
export function globToRegExp(glob) {
  let re = "";
  let inBraces = 0;
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        const slashAfter = glob[i + 2] === "/";
        re += slashAfter ? "(?:.*/)?" : ".*";
        i += slashAfter ? 2 : 1;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (c === "{") {
      inBraces++;
      re += "(?:";
    } else if (c === "}" && inBraces > 0) {
      inBraces--;
      re += ")";
    } else if (c === "," && inBraces > 0) re += "|";
    else re += c.replace(/[.+^$()|[\]\\]/g, "\\$&");
  }
  const anchored = glob.includes("/") ? `^${re}$` : `(?:^|/)${re}$`;
  return new RegExp(anchored);
}

/**
 * allowlist.txt: one entry per line; blank lines and lines starting with `#` are ignored.
 * - `<glob>`: every hit in a file whose repo-relative path matches is allowed.
 * - `line: <regexp>`: every hit on a line matching the (case-sensitive) regexp is allowed, in any file.
 */
export function parseAllowlist(text) {
  const globs = [];
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const entry = raw.trim();
    if (entry === "" || entry.startsWith("#")) continue;
    if (entry.startsWith("line:")) lines.push(new RegExp(entry.slice(5).trim()));
    else globs.push(globToRegExp(entry));
  }
  return { globs, lines };
}

export function isExcluded(path) {
  return EXCLUDED.some((re) => re.test(path));
}

export function pathAllowed(path, allow) {
  return allow.globs.some((re) => re.test(path));
}

/** Hits of the gate pattern in one file's text that the allowlist does not cover. */
export function scanText(path, text, allow) {
  if (pathAllowed(path, allow)) return [];
  const hits = [];
  const rows = text.split("\n");
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!GATE_PATTERN.test(row)) continue;
    if (allow.lines.some((re) => re.test(row))) continue;
    hits.push({ path, line: i + 1, text: row.trim().slice(0, 200) });
  }
  return hits;
}

/** rg treats a file with a NUL byte in its first 8 KiB as binary and skips it. */
export function isBinary(buf) {
  return buf.subarray(0, 8192).includes(0);
}

/** Tracked files plus untracked files that .gitignore does not exclude. */
export function listFiles(root) {
  const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    maxBuffer: 256 * 1024 * 1024,
  }).toString("utf8");
  return [...new Set(out.split("\0").filter((p) => p !== ""))].filter((p) => !isExcluded(p)).sort();
}

export function runGate(root, allowlistText) {
  const allow = parseAllowlist(allowlistText);
  const hits = [];
  for (const path of listFiles(root)) {
    if (pathAllowed(path, allow)) continue;
    let buf;
    try {
      buf = readFileSync(join(root, path));
    } catch {
      continue; // deleted in the working tree but still in the index
    }
    if (isBinary(buf)) continue;
    hits.push(...scanText(path, buf.toString("utf8"), allow));
  }
  return hits;
}
