// shared/fixtures/v2/games/bluff/ stay generated from fixture-scenario.ts. Regenerate with
//   BLUFF_FIXTURES=write pnpm vitest run shared/test/games/bluff/fixtures.test.ts
// Every file also parses with the protocol v2 schemas (frames, room views and the Bluff game envelope).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ClientMessageV2Schema, ServerMessageV2Schema } from "../../../src/protocol/v2/messages";
import { generateBluffFixtures } from "./fixture-scenario";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "fixtures", "v2", "games", "bluff");
const files = generateBluffFixtures();

if (process.env.BLUFF_FIXTURES === "write") {
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of files) writeFileSync(join(dir, name), content);
}

describe("Bluff fixtures (shared/fixtures/v2/games/bluff)", () => {
  it("are up to date and nothing else lives in the folder", () => {
    const onDisk = readdirSync(dir).sort();
    expect(onDisk).toEqual([...files.keys()].sort());
    for (const [name, content] of files) expect(readFileSync(join(dir, name), "utf8"), name).toBe(content);
  });
  it("are deterministic", () => {
    expect([...generateBluffFixtures()]).toEqual([...files]);
  });
  it.each([...files.keys()].filter((n) => n.startsWith("c2s.")))("%s parses as a client frame", (name) => {
    expect(ClientMessageV2Schema.safeParse(JSON.parse(files.get(name) as string)).success).toBe(true);
  });
  it.each([...files.keys()].filter((n) => n.startsWith("s2c.")))("%s parses as a server frame", (name) => {
    const r = ServerMessageV2Schema.safeParse(JSON.parse(files.get(name) as string));
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true);
  });
  it("cover every Bluff phase on the TV", () => {
    for (const ph of ["round_intro", "writing", "voting", "reveal", "scores", "hold", "awards", "results"]) {
      expect(files.has(`s2c.state.tv.playing.bluff.${ph}.json`), ph).toBe(true);
    }
  });
  it("the TV fixtures never carry a `me`", () => {
    for (const [name, c] of files) if (name.startsWith("s2c.state.tv.")) expect((JSON.parse(c) as { view: { game: { me: unknown } | null } }).view.game?.me ?? null).toBeNull();
  });
});
