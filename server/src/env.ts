import type { Room } from "./room";
export interface Env {
  Room: DurableObjectNamespace<Room>;
  ASSETS: Fetcher;
  CREATE_ROOM_LIMITER: RateLimit;
  CONNECT_LIMITER: RateLimit;
  JOIN_BASE_URL: string;
  ALLOWED_ORIGINS: string;
  DEBUG_INVARIANTS: string;
}
