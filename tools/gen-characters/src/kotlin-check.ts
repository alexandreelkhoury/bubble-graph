// `pnpm --filter @jamaa/gen-characters run check:kotlin`: compiles the generated pure-Kotlin files (Choreo.kt,
// CharacterPaths.kt) with the Kotlin compiler from the Gradle cache and checks that the Kotlin sampler gives the same
// values as src/sampler.ts on every step (21 times × 2 stagger indexes). Uses lane A's modules when they exist, else
// the spec test model. Needs `java` and kotlin-compiler-embeddable in ~/.gradle (or KOTLIN_CP / KOTLIN_STDLIB).
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { SPEC_MODEL } from "../test/spec-fixture";
import { emitCharacterPaths, emitChoreo } from "./kotlin";
import { loadModel } from "./load";
import { ROOT } from "./main";
import { sample } from "./sampler";

const KOTLIN = "2.4.20"; // the TV build's Kotlin (docs/TV.md)

function findJar(dir: string, name: string): string | null {
  if (!existsSync(dir)) return null;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      const hit = findJar(p, name);
      if (hit) return hit;
    } else if (e === name) return p;
  }
  return null;
}

const CHECK_KT = `import app.jamaa.tv.motion.Choreo
import app.jamaa.tv.motion.ChoreoSampler
import app.jamaa.tv.ui.characters.CharacterPaths
import java.io.File
fun main(args: Array<String>) {
    var worst = 0.0
    var n = 0
    File(args[0]).readLines().forEach { line ->
        val p = line.split(" ")
        val got = ChoreoSampler.sample(Choreo.moments.getValue(p[0])[p[1].toInt()], p[2].toDouble(), p[3].toInt())
        worst = maxOf(worst, Math.abs(got - p[4].toDouble()))
        n++
    }
    println("$n \${worst} \${CharacterPaths.bodies.size} \${CharacterPaths.expressions.size}")
}
`;

async function main(): Promise<void> {
  const cache = join(homedir(), ".gradle/caches/modules-2/files-2.1");
  const jar = (n: string): string => {
    const p = findJar(join(cache, n.startsWith("kotlinx") ? "org.jetbrains.kotlinx" : n.startsWith("annotations") ? "org.jetbrains" : "org.jetbrains.kotlin"), n);
    if (!p) throw new Error(`${n} not found in ${cache} (set KOTLIN_CP and KOTLIN_STDLIB)`);
    return p;
  };
  const stdlib = process.env.KOTLIN_STDLIB ?? jar(`kotlin-stdlib-${KOTLIN}.jar`);
  const cp = process.env.KOTLIN_CP ?? [`kotlin-compiler-embeddable-${KOTLIN}.jar`, `kotlin-stdlib-${KOTLIN}.jar`, `kotlin-script-runtime-${KOTLIN}.jar`, `kotlin-daemon-embeddable-${KOTLIN}.jar`, "kotlinx-coroutines-core-jvm-1.8.0.jar", "annotations-13.0.jar"].map(jar).join(":");
  const { model } = await loadModel(ROOT);
  const m = model ?? SPEC_MODEL;
  const dir = mkdtempSync(join(tmpdir(), "gen-characters-kt-"));
  try {
    writeFileSync(join(dir, "Choreo.kt"), emitChoreo(m.choreo));
    writeFileSync(join(dir, "CharacterPaths.kt"), emitCharacterPaths(m.characters));
    writeFileSync(join(dir, "Check.kt"), CHECK_KT);
    const rows: string[] = [];
    for (const [id, steps] of Object.entries(m.choreo.moments)) {
      steps.forEach((s, i) => {
        for (let k = 0; k <= 20; k++) {
          for (const idx of [0, 2]) {
            const t = s.startMs - 30 + ((s.durationMs + 200) * k) / 20;
            rows.push(`${id} ${i} ${t} ${idx} ${sample(m.choreo.easings, s, t, idx)}`);
          }
        }
      });
    }
    writeFileSync(join(dir, "expected.txt"), rows.join("\n") + "\n");
    execFileSync("java", ["-cp", cp, "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-no-reflect", "-no-stdlib", "-nowarn", "-cp", stdlib, "-d", join(dir, "out"), ...["Choreo.kt", "CharacterPaths.kt", "Check.kt"].map((f) => join(dir, f))], { stdio: ["ignore", "inherit", "inherit"] });
    const [n, worst, shapes, exprs] = execFileSync("java", ["-cp", `${join(dir, "out")}:${stdlib}`, "CheckKt", join(dir, "expected.txt")], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split(" ");
    console.log(`check:kotlin (${model ? "lane A modules" : "spec test model"}): compiled with Kotlin ${KOTLIN}; ${n} samples, worst |Kotlin − TS| = ${worst}; ${shapes} shapes, ${exprs} expressions`);
    if (Number(worst) > 1e-9) process.exitCode = 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

await main();
