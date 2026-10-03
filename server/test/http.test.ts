import { describe, expect, it } from "vitest";
import { CreateRoomResponse, Healthz } from "@mishana/shared/protocol";
import { createRoom, healthz } from "../src/http";
import type { CreateRoomDeps } from "../src/http";
import type { InitRoomArgs } from "../src/room-core";
import { randomBytes, sha256hex } from "../src/tokens";
import { fakeEnv } from "./support/env";

function deps(log: InitRoomArgs[] = []): CreateRoomDeps {
  return { getStub: async () => ({ initRoom: async (a: InitRoomArgs) => (log.push(a), { ok: true as const }) }), randomBytes, now: () => 42 };
}
const post = (body?: string, headers: Record<string, string> = {}): Request =>
  new Request("https://mish-ana.test/api/rooms", { method: "POST", body, headers });

describe("POST /api/rooms", () => {
  it("201 with no-store, a hashed token passed to the DO and the joinUrl", async () => {
    const log: InitRoomArgs[] = [];
    const res = await createRoom(post(JSON.stringify({ locale: "ar" }), { "Content-Type": "application/json; charset=utf-8" }), fakeEnv(), deps(log));
    expect(res.status).toBe(201);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = CreateRoomResponse.parse(await res.json());
    expect(body.joinUrl).toBe(`https://mish-ana.test/${body.code}`);
    expect(body.wsPath).toBe(`/parties/room/${body.code}`);
    expect(log[0]?.tvTokenHash).toBe(await sha256hex(body.tvToken));
    expect(log[0]?.locale).toBe("ar");
    expect(log[0]?.now).toBe(42);
  });
  it("empty body is OK (locale en); JOIN_BASE_URL overrides the origin", async () => {
    const log: InitRoomArgs[] = [];
    const res = await createRoom(post(), fakeEnv({ JOIN_BASE_URL: "https://mishana.app/" }), deps(log));
    expect(res.status).toBe(201);
    const body = CreateRoomResponse.parse(await res.json());
    expect(body.joinUrl).toBe(`https://mishana.app/${body.code}`);
    expect(log[0]?.locale).toBe("en");
  });
  it("body > 1 KB → 400", async () => {
    const big = JSON.stringify({ locale: "en", pad: "x".repeat(2000) });
    const res = await createRoom(post(big, { "Content-Type": "application/json" }), fakeEnv(), deps());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "BAD_MESSAGE" });
  });
  it("wrong content type → 400; bad JSON or unknown keys → 400", async () => {
    expect((await createRoom(post('{"locale":"en"}', { "Content-Type": "text/plain" }), fakeEnv(), deps())).status).toBe(400);
    expect((await createRoom(post("{nope", { "Content-Type": "application/json" }), fakeEnv(), deps())).status).toBe(400);
    expect((await createRoom(post('{"locale":"de"}', { "Content-Type": "application/json" }), fakeEnv(), deps())).status).toBe(400);
    expect((await createRoom(post('{"x":1}', { "Content-Type": "application/json" }), fakeEnv(), deps())).status).toBe(400);
  });
  it("foreign Origin → 403; same origin and allowlisted are fine", async () => {
    const res = await createRoom(post(undefined, { Origin: "https://evil.example" }), fakeEnv(), deps());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "BAD_MESSAGE" });
    expect((await createRoom(post(undefined, { Origin: "https://mish-ana.test" }), fakeEnv(), deps())).status).toBe(201);
    expect((await createRoom(post(undefined, { Origin: "http://localhost:5173" }), fakeEnv({ ALLOWED_ORIGINS: "http://localhost:5173" }), deps())).status).toBe(201);
  });
  it("rate limited → 429", async () => {
    const env = fakeEnv({ CREATE_ROOM_LIMITER: { limit: async () => ({ success: false }) } });
    const res = await createRoom(post(), env, deps());
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "RATE_LIMITED" });
  });
  it("DO failure → 503 INTERNAL", async () => {
    const res = await createRoom(post(), fakeEnv(), { getStub: async () => { throw new Error("boom"); }, randomBytes, now: () => 1 });
    expect(res.status).toBe(503);
  });
});

describe("GET /healthz", () => {
  it("returns the app slug and protocol version", async () => {
    const body = Healthz.parse(await healthz().json());
    expect(body).toEqual({ ok: true, app: "mish-ana", protocol: 1 });
  });
});
