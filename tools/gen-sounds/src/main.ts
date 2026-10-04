// CLI: `pnpm gen:sounds` renders every cue (deterministic), masters it and encodes OGG Vorbis 48 kHz mono with
// ffmpeg (libvorbis) into the web TV mock (web-client/public/sounds) and the Android app (res/raw).
// `pnpm gen:sounds --check` only verifies that every cue file exists in both places and the set fits the budget.
// `--wav <dir>` also keeps the mastered WAVs (for listening).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CUES, fileName } from "./cues";
import { Buf, master, wav } from "./dsp";

export const BUDGET_BYTES = 400 * 1024;
export const OUT_DIRS = ["web-client/public/sounds", "tv-app/app/src/main/res/raw"] as const;

export function render(id: string): Buf {
  const def = CUES.find((c) => c.id === id);
  if (!def) throw new Error(`unknown cue ${id}`);
  const b = new Buf(def.seconds);
  def.render(b);
  master(b, def.targetDb);
  return b;
}

/** Problems with the generated files under `root` (missing, stray or over budget); empty when all is well. */
export function verify(root: string): string[] {
  const problems: string[] = [];
  const want = new Set(CUES.map((c) => `${fileName(c.id)}.ogg`));
  for (const rel of OUT_DIRS) {
    const dir = join(root, rel);
    const have = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".ogg")) : [];
    for (const f of want) if (!have.includes(f)) problems.push(`${rel}/${f} is missing (run pnpm gen:sounds)`);
    for (const f of have) if (!want.has(f)) problems.push(`${rel}/${f} is not a known cue`);
    const total = have.reduce((n, f) => n + statSync(join(dir, f)).size, 0);
    if (total > BUDGET_BYTES) problems.push(`${rel}: ${(total / 1024).toFixed(1)} KB exceeds the ${BUDGET_BYTES / 1024} KB budget`);
  }
  return problems;
}

function encode(wavPath: string, oggPath: string): void {
  // bitexact: no encoder tag and a fixed Ogg serial, so the same WAV always gives the same bytes.
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", wavPath, "-fflags", "+bitexact",
    "-map_metadata", "-1", "-ac", "1", "-ar", "48000", "-c:a", "libvorbis", "-q:a", "1", "-flags:a", "+bitexact", oggPath,
  ]);
}

function main(): void {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  if (args.includes("--check")) {
    const problems = verify(root);
    if (problems.length) {
      console.error(`gen-sounds --check:\n  ${problems.join("\n  ")}`);
      process.exitCode = 1;
    } else console.log(`gen-sounds --check: ${CUES.length} cues present, within budget`);
    return;
  }
  const wavIdx = args.indexOf("--wav");
  const keepWav = wavIdx >= 0 ? resolve(args[wavIdx + 1] ?? "sounds-wav") : null;
  const tmp = mkdtempSync(join(tmpdir(), "gen-sounds-"));
  try {
    for (const rel of OUT_DIRS) mkdirSync(join(root, rel), { recursive: true });
    if (keepWav) mkdirSync(keepWav, { recursive: true });
    for (const def of CUES) {
      const name = fileName(def.id);
      const w = wav(render(def.id));
      const wavPath = join(tmp, `${name}.wav`);
      writeFileSync(wavPath, w);
      if (keepWav) writeFileSync(join(keepWav, `${name}.wav`), w);
      const first = join(root, OUT_DIRS[0], `${name}.ogg`);
      encode(wavPath, first);
      for (const rel of OUT_DIRS.slice(1)) execFileSync("cp", [first, join(root, rel, `${name}.ogg`)]);
      console.log(`${name.padEnd(26)} ${def.seconds.toFixed(2)} s  ${(statSync(first).size / 1024).toFixed(1)} KB`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  const problems = verify(root);
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exitCode = 1;
  } else {
    const total = readdirSync(join(root, OUT_DIRS[0])).reduce((n, f) => n + statSync(join(root, OUT_DIRS[0], f)).size, 0);
    console.log(`${CUES.length} cues, ${(total / 1024).toFixed(1)} KB per copy (budget ${BUDGET_BYTES / 1024} KB)`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
