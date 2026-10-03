import { describe, expect, it } from "vitest";
import { ROOM_CODE_ALPHABET, ROOM_CODE_REGEX } from "@mishana/shared/constants";
import { generateRoomCode } from "../src/codes";
import { createRoom } from "../src/http";
import type { InitRoomArgs } from "../src/room-core";
import { randomBytes } from "../src/tokens";
import { fakeEnv } from "./support/env";

describe("room codes", () => {
  it("uses the 23-letter alphabet and length 4", () => {
    for (let i = 0; i < 500; i++) expect(generateRoomCode(randomBytes)).toMatch(ROOM_CODE_REGEX);
  });
  it("rejects bytes ≥ 230 (no modulo bias) and maps b % 23", () => {
    const feed = [255, 230, 0, 22, 229, 23, 240, 46];
    const code = generateRoomCode(() => new Uint8Array(feed));
    expect(code).toBe(ROOM_CODE_ALPHABET[0]! + ROOM_CODE_ALPHABET[22]! + ROOM_CODE_ALPHABET[229 % 23]! + ROOM_CODE_ALPHABET[0]!);
  });
  it("keeps drawing when a batch has too few accepted bytes", () => {
    let calls = 0;
    const code = generateRoomCode(() => (++calls === 1 ? new Uint8Array(8).fill(250) : new Uint8Array(8).fill(1)));
    expect(code).toBe("BBBB");
    expect(calls).toBe(2);
  });
  it("is roughly uniform (smoke test)", () => {
    const counts = new Map<string, number>();
    const N = 23_000;
    for (let i = 0; i < N / 4; i++) for (const ch of generateRoomCode(randomBytes)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    expect(counts.size).toBe(23);
    for (const c of counts.values()) {
      expect(c).toBeGreaterThan(700);
      expect(c).toBeLessThan(1300);
    }
  });
  it("retries on collision: initRoom returning EXISTS twice", async () => {
    const seen: string[] = [];
    let n = 0;
    const res = await createRoom(new Request("https://h.test/api/rooms", { method: "POST" }), fakeEnv(), {
      getStub: async (code) => ({
        initRoom: async (args: InitRoomArgs) => {
          seen.push(code);
          expect(args.joinUrl).toBe(`https://h.test/${code}`);
          expect(args.tvTokenHash).toMatch(/^[0-9a-f]{64}$/);
          return ++n <= 2 ? { ok: false, reason: "EXISTS" } : { ok: true };
        },
      }),
      randomBytes,
      now: () => 1,
    });
    expect(res.status).toBe(201);
    expect(seen).toHaveLength(3);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe(seen[2]);
  });
  it("gives up with 503 after 10 collisions", async () => {
    let n = 0;
    const res = await createRoom(new Request("https://h.test/api/rooms", { method: "POST" }), fakeEnv(), {
      getStub: async () => ({ initRoom: async () => (n++, { ok: false as const, reason: "EXISTS" as const }) }),
      randomBytes,
      now: () => 1,
    });
    expect(res.status).toBe(503);
    expect(n).toBe(10);
    expect(await res.json()).toEqual({ error: "INTERNAL" });
  });
});
