import type { Env } from "../../src/env";

export function fakeEnv(over: Partial<Env> = {}): Env {
  const ok = { limit: async () => ({ success: true }) };
  return {
    Room: {} as Env["Room"],
    ASSETS: {} as Env["ASSETS"],
    CREATE_ROOM_LIMITER: ok,
    CONNECT_LIMITER: ok,
    JOIN_BASE_URL: "",
    ALLOWED_ORIGINS: "",
    DEBUG_INVARIANTS: "0",
    ...over,
  };
}
