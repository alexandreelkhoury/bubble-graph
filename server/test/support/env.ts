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
    BILLING_ENABLED: "1", // the billing tests exercise billing on; config.test.ts covers off
    BILLING: {} as Env["BILLING"],
    BILLING_LIMITER: ok,
    RTDN_LIMITER: ok,
    BILLING_MODE: "google",
    ALLOW_FAKE_BILLING: "0",
    PLAY_PACKAGE_NAME: "app.mishana.tv",
    RTDN_AUDIENCE: "",
    RTDN_SA_EMAIL: "",
    RTDN_SUBSCRIPTION: "",
    ...over,
  };
}
