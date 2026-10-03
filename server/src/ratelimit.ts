// Per-connection token bucket and per-IP join window (§7.5). Pure functions over plain data.
import { JOINS_PER_MIN_PER_IP, RATE_BURST, RATE_MSGS_PER_SEC } from "@mishana/shared/constants";

export interface Bucket { tokens: number; ts: number }

export const STRIKE_WINDOW_MS = 10_000;
export const STRIKES_TO_CLOSE = 3;
export const JOIN_WINDOW_MS = 60_000;

export function fullBucket(now: number): Bucket {
  return { tokens: RATE_BURST, ts: now };
}

/** Refills at RATE_MSGS_PER_SEC up to RATE_BURST, then tries to take one token. */
export function takeToken(b: Bucket, now: number): { ok: boolean; bucket: Bucket } {
  const elapsed = Math.max(0, now - b.ts);
  const tokens = Math.min(RATE_BURST, b.tokens + (elapsed * RATE_MSGS_PER_SEC) / 1000);
  if (tokens < 1) return { ok: false, bucket: { tokens, ts: now } };
  return { ok: true, bucket: { tokens: tokens - 1, ts: now } };
}

/** Adds a strike at `now`, keeping only the last STRIKE_WINDOW_MS. */
export function addStrike(strikes: readonly number[], now: number): number[] {
  return [...strikes.filter((t) => now - t < STRIKE_WINDOW_MS), now];
}

/** Sliding one-minute window of join attempts per ipKey (in memory; fine to lose on hibernation). */
export class JoinLimiter {
  #hits = new Map<string, number[]>();

  /** Records an attempt; false when the key already made JOINS_PER_MIN_PER_IP attempts in the last minute. */
  hit(key: string, now: number): boolean {
    const recent = (this.#hits.get(key) ?? []).filter((t) => now - t < JOIN_WINDOW_MS);
    if (recent.length >= JOINS_PER_MIN_PER_IP) {
      this.#hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.#hits.set(key, recent);
    return true;
  }
}
