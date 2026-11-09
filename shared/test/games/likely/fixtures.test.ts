// shared/fixtures/v2/games/likely/ stay generated from fixture-scenario.ts. Regenerate with
//   LIKELY_FIXTURES=write pnpm vitest run shared/test/games/likely/fixtures.test.ts
// Every frame also parses with the protocol v2 schemas (frames, room views and the Likely game envelope), and the
// published views pass the leak oracles they were generated under.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ClientMessageV2Schema, ServerMessageV2Schema } from "../../../src/protocol/v2/messages";
import { LikelyMeSchema, LikelyPublicSchema } from "../../../src/games/likely/protocol";
import { generateLikelyFixtures } from "./fixture-scenario";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "fixtures", "v2", "games", "likely");
const files = generateLikelyFixtures();

if (process.env.LIKELY_FIXTURES === "write") {
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of files) writeFileSync(join(dir, name), content);
}

type Frame = { view: { kind: string; game: { gameId: string; phase: string; public: Record<string, unknown>; me: Record<string, unknown> | null } | null; room: { phase: string } } };
const frame = (name: string): Frame => JSON.parse(files.get(name) as string) as Frame;

describe("Likely fixtures (shared/fixtures/v2/games/likely)", () => {
  it("are up to date and nothing else lives in the folder", () => {
    const onDisk = readdirSync(dir).sort();
    expect(onDisk).toEqual([...files.keys()].sort());
    for (const [name, content] of files) expect(readFileSync(join(dir, name), "utf8"), name).toBe(content);
  });
  it("are deterministic", () => {
    expect([...generateLikelyFixtures()]).toEqual([...files]);
  });
  it.each([...files.keys()].filter((n) => n.startsWith("c2s.")))("%s parses as a strict client frame", (name) => {
    expect(ClientMessageV2Schema.safeParse(JSON.parse(files.get(name) as string)).success).toBe(true);
  });
  it.each([...files.keys()].filter((n) => n.startsWith("s2c.")))("%s parses as a server frame", (name) => {
    const r = ServerMessageV2Schema.safeParse(JSON.parse(files.get(name) as string));
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues.slice(0, 3))).toBe(true);
  });
  it("cover every Likely phase on the TV and on a phone, both reveal modes, the late joiner and the host", () => {
    for (const ph of ["card", "voting", "reveal", "hold", "awards", "results"]) {
      expect(files.has(`s2c.state.tv.playing.likely.${ph}.json`), ph).toBe(true);
      expect(files.has(`s2c.state.player.playing.likely.${ph}.json`), ph).toBe(true);
    }
    expect(frame("s2c.state.tv.playing.likely.reveal.secret.ar.json").view.game?.public.reveal).toMatchObject({ ballots: null, deltas: [] });
    expect(frame("s2c.state.tv.playing.likely.reveal.json").view.game?.public.reveal).toMatchObject({ ballots: expect.any(Array) });
    expect(frame("s2c.state.tv.playing.likely.reveal.chaos.json").view.game?.public.reveal).toMatchObject({ chaos: true, topIds: [] });
    expect(frame("s2c.state.tv.playing.likely.reveal.unanimous.json").view.game?.public.reveal).toMatchObject({ unanimous: true });
    expect(frame("s2c.state.tv.playing.likely.reveal.none.json").view.game?.public.reveal).toMatchObject({ none: true });
    expect((frame("s2c.state.tv.playing.likely.reveal.tie.json").view.game?.public.reveal as { topIds: string[] }).topIds.length).toBe(2);
    expect((frame("s2c.state.tv.playing.likely.reveal.again.json").view.game?.public.reveal as { againId: string | null }).againId).not.toBeNull();
    expect(frame("s2c.state.player.playing.likely.waiting.json").view.game?.me).toMatchObject({ waitingForNext: true });
    expect((frame("s2c.state.tv.playing.likely.card.new.json").view.game?.public.newIds as string[]).length).toBe(1);
    expect(frame("s2c.state.player.playing.likely.voting.voted.json").view.game?.me).toMatchObject({ myVote: expect.any(String) });
  });
  it("every game envelope parses with the Likely schemas; TV views never carry a `me`", () => {
    for (const [name, c] of files) {
      if (!name.startsWith("s2c.state.")) continue;
      const g = (JSON.parse(c) as Frame).view.game;
      if (!g) continue;
      expect(g.gameId).toBe("likely");
      expect(LikelyPublicSchema.safeParse(g.public).success, name).toBe(true);
      if (g.me) expect(LikelyMeSchema.safeParse(g.me).success, name).toBe(true);
      if (name.startsWith("s2c.state.tv.")) expect(g.me, name).toBeNull();
    }
  });
  it("secret-vote frames carry no ballot, delta, score or ballot award; no frame shows a vote before REVEAL", () => {
    for (const [name, c] of files) {
      if (!name.startsWith("s2c.state.")) continue;
      const g = (JSON.parse(c) as Frame).view.game;
      if (!g) continue;
      const pub = JSON.stringify(g.public);
      if (name.includes(".secret.")) {
        expect(pub, name).not.toMatch(/voterId|targetId|"selfAware"|"mindReader"|"reason"/);
        expect(pub, name).not.toMatch(/"score":[1-9]/);
      }
      if (g.phase !== "REVEAL") expect(pub, name).not.toMatch(/voterId|targetId/);
    }
  });
  it("layout.json mirrors the shared layout math (12 seats, curl after 6, RTL mirrored)", () => {
    const l = JSON.parse(files.get("layout.json") as string) as { arcs: Record<string, { ltr: { x: number }[]; rtl: { x: number }[] }>; conga: { left: { places: unknown[] } } };
    expect(l.arcs["12"]?.ltr).toHaveLength(12);
    expect(l.arcs["12"]?.rtl[0]?.x).toBe(l.arcs["12"]?.ltr[11]?.x);
    expect(l.conga.left.places).toHaveLength(11);
  });
});
