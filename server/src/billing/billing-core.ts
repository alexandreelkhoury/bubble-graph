// PAYMENTS-SPEC §3.5: runtime-agnostic Billing DO logic. Every write is synchronous SQL inside `transactionSync`
// (no await between a read and the write that depends on it). `billing-do.ts` adapts it to a Durable Object;
// tests drive it with a node:sqlite-backed SqlLike.
import {
  ACK_WINDOW_MS,
  GOOGLE_VERIFY_BUCKET,
  GOOGLE_READS_PER_IP_PER_MIN,
  INSTALL_ACTIVE_WINDOW_MS,
  INSTALL_ENTITLEMENT_PER_10MIN,
  INSTALL_PREFIXES_PER_DAY,
  INSTALL_VERIFY_PER_10MIN,
  INVALID_TOKEN_TTL_MS,
  MAX_INSTALLS_PER_PURCHASE,
  MAX_TOKEN_PACKS,
  PENDING_ACK_TOKEN_MAX_MS,
  RATE_MAP_MAX_ENTRIES,
} from "@mishana/shared/constants";
import { packIdFromProductId, packOwned, subscriptionAccessUntil } from "@mishana/shared/billing";
import type { PackState, PurchaseResult, SubscriptionInfo, SubState } from "@mishana/shared/billing";
import { sha256hex } from "../tokens";
import { billingLog } from "./log";
import type { NormalizedPurchase } from "./normalize";

// ------------------------------------------------------------------ storage abstraction

export type SqlValue = string | number | null;
export interface SqlCursorLike<T> { toArray(): T[] }
export interface SqlLike {
  exec<T extends Record<string, SqlValue>>(query: string, ...bindings: SqlValue[]): SqlCursorLike<T>;
}
export interface BillingStorage { sql: SqlLike; transactionSync<T>(fn: () => T): T }

export interface PurchaseRow {
  token_hash: string; store: string; kind: "sub" | "pack"; product_id: string | null; state: string;
  expiry_ms: number | null; auto_renew: number; base_plan_id: string | null; in_trial: number;
  acknowledged: number; ack_token: string | null; ack_window_start_ms: number | null; revoked: number; test: number;
  origin_install_hash: string | null; superseded_by: string | null; google_checked_ms: number; created_ms: number; updated_ms: number;
  [k: string]: SqlValue;
}

export const SCHEMA: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS purchases (
    token_hash TEXT PRIMARY KEY, store TEXT NOT NULL DEFAULT 'google', kind TEXT NOT NULL, product_id TEXT, state TEXT NOT NULL,
    expiry_ms INTEGER, auto_renew INTEGER NOT NULL DEFAULT 0, base_plan_id TEXT, in_trial INTEGER NOT NULL DEFAULT 0,
    acknowledged INTEGER NOT NULL DEFAULT 0, ack_token TEXT, ack_window_start_ms INTEGER, revoked INTEGER NOT NULL DEFAULT 0,
    test INTEGER NOT NULL DEFAULT 0, origin_install_hash TEXT, superseded_by TEXT, google_checked_ms INTEGER NOT NULL,
    created_ms INTEGER NOT NULL, updated_ms INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS bindings (token_hash TEXT NOT NULL, install_hash TEXT NOT NULL, first_seen_ms INTEGER NOT NULL,
    last_seen_ms INTEGER NOT NULL, PRIMARY KEY (token_hash, install_hash))`,
  `CREATE INDEX IF NOT EXISTS bindings_install ON bindings(install_hash)`,
  // Negative cache keyed by (token hash, kind): a token posted under the wrong kind must not poison it for its owner.
  // (Replaces the pre-release `invalid_tokens` table keyed by hash alone; it held only 24 h cache entries.)
  `DROP TABLE IF EXISTS invalid_tokens`,
  `CREATE TABLE IF NOT EXISTS invalid_tokens_v2 (token_hash TEXT NOT NULL, kind TEXT NOT NULL, at_ms INTEGER NOT NULL,
    PRIMARY KEY (token_hash, kind))`,
  `CREATE TABLE IF NOT EXISTS rtdn_seen (message_id TEXT PRIMARY KEY, at_ms INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS fake_purchases (token TEXT PRIMARY KEY, json TEXT NOT NULL)`,
];

// ------------------------------------------------------------------ pure rules

// [VERIFY] that Google accepts acknowledging a CANCELED-but-unexpired subscription; on a 4xx, ackPurchase's re-read settles it.
const SUB_ACK_ELIGIBLE: ReadonlySet<string> = new Set(["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"]);
const SUB_LIVE: ReadonlySet<string> = new Set([
  "SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED", "SUBSCRIPTION_STATE_ON_HOLD", "SUBSCRIPTION_STATE_PAUSED",
]);
const SUB_SUSPENDED: ReadonlySet<string> = new Set(["SUBSCRIPTION_STATE_ON_HOLD", "SUBSCRIPTION_STATE_PAUSED", "SUBSCRIPTION_STATE_PENDING"]);
const HEX64 = /^[0-9a-f]{64}$/;
const DAY_MS = 86_400_000;
export const RATE_WINDOW_MS = 10 * 60_000;
export const RETENTION_MS = 400 * DAY_MS;
export const RTDN_SEEN_TTL_MS = 30 * DAY_MS;
/** `ack_token` is kept until 4 days after the ack window opened (§3.5). */
// PAY-GAP: §3.5 says "dead" rows are those superseded or expired > 400 days ago; the supersession time is taken as
// `updated_ms`, and cancelled packs older than 400 days count as dead too (revoked rows only shrink, never go).
export const ACK_TOKEN_KEEP_MS = 4 * DAY_MS;

export function isAckEligible(kind: "sub" | "pack", state: string): boolean {
  return kind === "pack" ? state === "PURCHASED" : SUB_ACK_ELIGIBLE.has(state);
}
export function isPendingState(kind: "sub" | "pack", state: string): boolean {
  return kind === "pack" ? state === "PENDING" : state === "SUBSCRIPTION_STATE_PENDING";
}
/** §3.4 "Which purchases bind on /verify". */
export function isBindable(row: Pick<PurchaseRow, "kind" | "state" | "revoked">): boolean {
  if (row.kind === "pack") return row.state !== "CANCELLED" && row.revoked === 0;
  return row.state !== "SUBSCRIPTION_STATE_EXPIRED" && row.state !== "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED";
}
export function rowAccessUntil(row: PurchaseRow, nowMs: number): number | null {
  if (row.kind !== "sub") return null;
  return subscriptionAccessUntil({ state: row.state as SubState, expiryMs: row.expiry_ms, autoRenew: row.auto_renew === 1 }, nowMs);
}
export function rowGrantsAccess(row: PurchaseRow, nowMs: number): boolean {
  if (row.kind === "sub") return rowAccessUntil(row, nowMs) !== null;
  return packOwned({ state: row.state as PackState, revoked: row.revoked === 1 });
}

// ------------------------------------------------------------------ types

export interface ApplyInput {
  tokenHash: string;
  kind: "sub" | "pack";
  productId: string;
  n: NormalizedPurchase;
  callerInstallHash: string | null;
  /** The raw token to keep while an ack is or may become due; null for a linked (old) token, which is never stored. */
  rawTokenForAck: string | null;
  nowMs: number;
  /** "fake" for FakeGoogleApi reads (§3.10); stored on insert only. */
  store?: "google" | "fake";
}
export interface ApplyResult { result: Exclude<PurchaseResult, "INVALID" | "UPSTREAM_ERROR">; ackDue: boolean; refreshLinked: boolean }
export type BindResult = Exclude<PurchaseResult, "INVALID" | "UPSTREAM_ERROR">;
export interface Entitlement { premiumUntilMs: number | null; packs: string[]; subscription: SubscriptionInfo | null }
export interface PendingAck { tokenHash: string; kind: "sub" | "pack"; productId: string; token: string; windowStartMs: number }

type RateKind = "verify" | "entitlement";
const RATE_LIMITS: Record<RateKind, number> = { verify: INSTALL_VERIFY_PER_10MIN, entitlement: INSTALL_ENTITLEMENT_PER_10MIN };

// ------------------------------------------------------------------ core

export class BillingCore {
  readonly #st: BillingStorage;
  readonly #premiumPackIds: ReadonlySet<string>;
  /** LRU (Map insertion order) of sliding windows, keyed `${kind}:${installHash}`. In memory only. */
  readonly #rate = new Map<string, number[]>();
  /** LRU of per-IP Google-read windows, keyed by a truncated IP hash (the IP itself never reaches the DO). */
  readonly #ipReads = new Map<string, number[]>();
  /** LRU: installHash → (network-prefix hash → last seen ms), last 24 h. In memory only. */
  readonly #installNets = new Map<string, Map<string, number>>();
  #bucket: { tokens: number; at: number } | null = null;

  constructor(storage: BillingStorage, premiumPackIds: ReadonlySet<string>) {
    this.#st = storage;
    this.#premiumPackIds = premiumPackIds;
    for (const q of SCHEMA) storage.sql.exec(q);
  }

  #q<T extends Record<string, SqlValue>>(query: string, ...b: SqlValue[]): T[] {
    return this.#st.sql.exec<T>(query, ...b).toArray();
  }
  #row(tokenHash: string): PurchaseRow | null {
    return this.#q<PurchaseRow>("SELECT * FROM purchases WHERE token_hash = ?", tokenHash)[0] ?? null;
  }

  // ---------------------------------------------------------------- in-memory limits

  rateCheck(installHash: string, kind: RateKind, nowMs: number): boolean {
    const key = `${kind}:${installHash}`;
    const hits = (this.#rate.get(key) ?? []).filter((t) => t > nowMs - RATE_WINDOW_MS);
    this.#rate.delete(key);
    const ok = hits.length < RATE_LIMITS[kind];
    if (ok) hits.push(nowMs);
    this.#rate.set(key, hits);
    lruTrim(this.#rate);
    return ok;
  }

  /**
   * PAY-GAP (§6.1 "API abuse"): takes one verify-path Google read from the per-IP window (GOOGLE_READS_PER_IP_PER_MIN
   * per minute). `ipKey` is a truncated hash of the client IP computed in the Worker. false → over budget.
   */
  ipReadCheck(ipKey: string, nowMs: number): boolean {
    const hits = (this.#ipReads.get(ipKey) ?? []).filter((t) => t > nowMs - 60_000);
    this.#ipReads.delete(ipKey);
    const ok = hits.length < GOOGLE_READS_PER_IP_PER_MIN;
    if (ok) hits.push(nowMs);
    this.#ipReads.set(ipKey, hits);
    lruTrim(this.#ipReads);
    return ok;
  }

  /**
   * PAY-GAP (§6.1 "installId sharing"): records that `installHash` was used from network prefix `netKey` (a truncated
   * hash) and returns how many distinct prefixes used it in the last 24 h (capped at INSTALL_PREFIXES_PER_DAY + 1).
   */
  installNetSeen(installHash: string, netKey: string, nowMs: number): number {
    const m = this.#installNets.get(installHash) ?? new Map<string, number>();
    this.#installNets.delete(installHash);
    for (const [k, at] of m) if (at <= nowMs - DAY_MS) m.delete(k);
    if (m.has(netKey) || m.size <= INSTALL_PREFIXES_PER_DAY) {
      m.delete(netKey);
      m.set(netKey, nowMs);
    }
    this.#installNets.set(installHash, m);
    lruTrim(this.#installNets);
    return m.size;
  }

  /** Test introspection: number of tracked rate windows. */
  rateMapSize(): number {
    return this.#rate.size;
  }

  /**
   * Global token bucket for verify-path Google calls (RTDN and cron never take from it). 60/min ≈ 86 400/day.
   * [VERIFY] the project's Play Developer API quota in Cloud Console; lower `refillPerMin` if it is smaller.
   */
  googleBudget(n: number, nowMs: number): number {
    const { capacity, refillPerMin } = GOOGLE_VERIFY_BUCKET;
    const b = this.#bucket ?? { tokens: capacity, at: nowMs };
    const tokens = Math.min(capacity, b.tokens + (Math.max(0, nowMs - b.at) * refillPerMin) / 60_000);
    const granted = Math.max(0, Math.min(n, Math.floor(tokens)));
    this.#bucket = { tokens: tokens - granted, at: nowMs };
    return granted;
  }

  // ---------------------------------------------------------------- lookups and caches

  /** `invalid` is the negative cache for this (hash, kind) only: Google's 404 for one resource type says nothing of the other. */
  lookup(tokenHash: string, kind: "sub" | "pack", nowMs: number): { invalid: boolean; row: PurchaseRow | null } {
    const inv = this.#q<{ at_ms: number }>("SELECT at_ms FROM invalid_tokens_v2 WHERE token_hash = ? AND kind = ?", tokenHash, kind)[0];
    return { invalid: inv !== undefined && inv.at_ms > nowMs - INVALID_TOKEN_TTL_MS, row: this.#row(tokenHash) };
  }

  /** Only for Google's own 400/404/410 on the `kind` resource (never a product mismatch, never an auth failure). */
  markInvalid(tokenHash: string, kind: "sub" | "pack", nowMs: number): void {
    this.#st.transactionSync(() => {
      if (this.#row(tokenHash)) return; // never for a hash that has a purchases row
      this.#q(
        "INSERT INTO invalid_tokens_v2 (token_hash, kind, at_ms) VALUES (?, ?, ?) ON CONFLICT(token_hash, kind) DO UPDATE SET at_ms = excluded.at_ms",
        tokenHash, kind, nowMs,
      );
    });
  }

  kindOf(tokenHash: string): "sub" | "pack" | null {
    return this.#row(tokenHash)?.kind ?? null;
  }

  // ---------------------------------------------------------------- apply / bind

  async applyPurchase(i: ApplyInput): Promise<ApplyResult> {
    const n = i.n;
    // Hashes are computed before the transaction (WebCrypto is async); the raw linked tokens are never stored.
    const linkedHash = n.linkedPurchaseToken ? await sha256hex(n.linkedPurchaseToken) : null;
    const expiredHash = n.outOfAppExpiredPurchaseToken ? await sha256hex(n.outOfAppExpiredPurchaseToken) : null;
    return this.#st.transactionSync(() => {
      const prev = this.#row(i.tokenHash);
      const applied = prev === null || n.checkedMs >= prev.google_checked_ms;
      const eligible = isAckEligible(i.kind, n.state);
      const pending = isPendingState(i.kind, n.state);
      const ackToken = !n.acknowledged && (eligible || pending) ? i.rawTokenForAck : null;
      const windowStart = eligible ? (n.completedMs ?? n.checkedMs) : null;
      const origin = n.obfuscatedAccountId && HEX64.test(n.obfuscatedAccountId) ? n.obfuscatedAccountId : null;
      this.#q(
        `INSERT INTO purchases (token_hash, store, kind, product_id, state, expiry_ms, auto_renew, base_plan_id, in_trial, acknowledged,
           ack_token, ack_window_start_ms, revoked, test, origin_install_hash, superseded_by, google_checked_ms, created_ms, updated_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, ?, ?, ?)
         ON CONFLICT(token_hash) DO UPDATE SET
           state = excluded.state, expiry_ms = excluded.expiry_ms, auto_renew = excluded.auto_renew, base_plan_id = excluded.base_plan_id,
           in_trial = excluded.in_trial, test = excluded.test, origin_install_hash = excluded.origin_install_hash,
           product_id = COALESCE(purchases.product_id, excluded.product_id),
           acknowledged = MAX(purchases.acknowledged, excluded.acknowledged),
           ack_token = CASE WHEN MAX(purchases.acknowledged, excluded.acknowledged) = 1 THEN NULL ELSE excluded.ack_token END,
           revoked = MAX(purchases.revoked, excluded.revoked),
           ack_window_start_ms = COALESCE(purchases.ack_window_start_ms, excluded.ack_window_start_ms),
           google_checked_ms = excluded.google_checked_ms, updated_ms = excluded.updated_ms
         WHERE excluded.google_checked_ms >= purchases.google_checked_ms`,
        i.tokenHash, i.store ?? "google", i.kind, i.productId, n.state, n.expiryMs, n.autoRenew ? 1 : 0, n.basePlanId, n.inTrial ? 1 : 0, n.acknowledged ? 1 : 0,
        ackToken, windowStart, n.test ? 1 : 0, origin, n.checkedMs, i.nowMs, i.nowMs,
      );
      // A purchase row now exists: the negative cache must not shadow it.
      this.#q("DELETE FROM invalid_tokens_v2 WHERE token_hash = ?", i.tokenHash);

      // The caller binds BEFORE any link copy, so copied bindings of old tokens can never push the actual purchaser's
      // TV over MAX_INSTALLS_PER_PURCHASE on its own new purchase (§3.5 step 4 runs on the row as stored below).
      // Link handling below only touches other rows and bindings, so this row's columns are final here.
      const callerResult = i.callerInstallHash === null ? null : this.#bindAndResult(this.#row(i.tokenHash) as PurchaseRow, i.callerInstallHash, i.nowMs);

      // 2. Link handling (only for the read that was stored; a stale read carries stale links).
      let refreshLinked = false;
      if (applied && i.kind === "sub") {
        if (linkedHash && linkedHash !== i.tokenHash && this.#row(linkedHash)) {
          if (SUB_LIVE.has(n.state)) {
            this.#q("UPDATE purchases SET superseded_by = ?, updated_ms = ? WHERE token_hash = ?", i.tokenHash, i.nowMs, linkedHash);
            this.#copyBindings(linkedHash, i.tokenHash, i.nowMs);
          } else if (n.state === "SUBSCRIPTION_STATE_PENDING") {
            this.#copyBindings(linkedHash, i.tokenHash, i.nowMs);
          } else if (n.state === "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED") {
            refreshLinked = true;
          }
        }
        if (expiredHash && expiredHash !== i.tokenHash) {
          this.#copyBindings(expiredHash, i.tokenHash, i.nowMs);
        }
      }

      // 3. Everything else is computed from the row as stored.
      const row = this.#row(i.tokenHash) as PurchaseRow;
      if (applied && i.kind === "sub" && isBindable(row)) {
        const hint = n.outOfAppExpiredObfuscatedAccountId;
        // The caller (bound above) does not count as "a binding" here, so the hint behaves as if it ran first.
        if (hint && HEX64.test(hint)) this.#bindHint(i.tokenHash, hint, i.nowMs, i.callerInstallHash);
      }
      const ackDue = isAckEligible(row.kind, row.state) && row.acknowledged === 0;
      // 4–5.
      let result: BindResult;
      if (callerResult !== null) {
        result = callerResult;
      } else {
        if (isBindable(row) && row.origin_install_hash) this.#bindHint(i.tokenHash, row.origin_install_hash, i.nowMs);
        result = this.#resultOf(row, i.nowMs);
      }
      return { result, ackDue, refreshLinked };
    });
  }

  bindOnly(a: { tokenHash: string; callerInstallHash: string; nowMs: number }): BindResult {
    return this.#st.transactionSync(() => {
      const row = this.#row(a.tokenHash);
      if (!row) return "NOT_OWNED";
      return this.#bindAndResult(row, a.callerInstallHash, a.nowMs);
    });
  }

  #activeCount(tokenHash: string, nowMs: number, exceptInstall: string | null = null): number {
    const r = this.#q<{ n: number }>(
      "SELECT COUNT(*) AS n FROM bindings WHERE token_hash = ? AND last_seen_ms > ? AND install_hash IS NOT ?",
      tokenHash, nowMs - INSTALL_ACTIVE_WINDOW_MS, exceptInstall,
    );
    return r[0]?.n ?? 0;
  }

  /** Caller binding (§3.5 step 4) and the result (step 5). */
  #bindAndResult(row: PurchaseRow, installHash: string, nowMs: number): BindResult {
    if (row.kind === "pack" && row.revoked === 1) return "REVOKED";
    if (isBindable(row)) {
      const mine = this.#q<{ last_seen_ms: number }>("SELECT last_seen_ms FROM bindings WHERE token_hash = ? AND install_hash = ?", row.token_hash, installHash)[0];
      const activeMine = mine !== undefined && mine.last_seen_ms > nowMs - INSTALL_ACTIVE_WINDOW_MS;
      if (!activeMine && this.#activeCount(row.token_hash, nowMs, installHash) >= MAX_INSTALLS_PER_PURCHASE) return "INSTALL_LIMIT";
      this.#q(
        `INSERT INTO bindings (token_hash, install_hash, first_seen_ms, last_seen_ms) VALUES (?, ?, ?, ?)
         ON CONFLICT(token_hash, install_hash) DO UPDATE SET last_seen_ms = MAX(bindings.last_seen_ms, excluded.last_seen_ms)`,
        row.token_hash, installHash, nowMs, nowMs,
      );
    }
    return this.#resultOf(row, nowMs);
  }

  #resultOf(row: PurchaseRow, nowMs: number): BindResult {
    if (row.kind === "pack" && row.revoked === 1) return "REVOKED";
    if (rowGrantsAccess(row, nowMs)) return "OK";
    if (isPendingState(row.kind, row.state)) return "PENDING";
    return "NOT_OWNED";
  }

  /** The restricted RTDN-path binding (§3.4): only for a token with no binding at all, below the limit. */
  #bindHint(tokenHash: string, installHash: string, nowMs: number, ignoreInstall: string | null = null): void {
    const any = this.#q<{ n: number }>("SELECT COUNT(*) AS n FROM bindings WHERE token_hash = ? AND install_hash IS NOT ?", tokenHash, ignoreInstall)[0]?.n ?? 0;
    if (any > 0 || this.#activeCount(tokenHash, nowMs) >= MAX_INSTALLS_PER_PURCHASE) return;
    this.#q("INSERT INTO bindings (token_hash, install_hash, first_seen_ms, last_seen_ms) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING", tokenHash, installHash, nowMs, nowMs);
  }

  /**
   * Copies the old token's ACTIVE bindings (most recently seen first) to the new token, only while the new token stays
   * under MAX_INSTALLS_PER_PURCHASE active bindings. Bindings already on the new token are refreshed, never counted twice.
   */
  #copyBindings(from: string, to: string, nowMs: number): void {
    const src = this.#q<{ install_hash: string; first_seen_ms: number; last_seen_ms: number }>(
      "SELECT install_hash, first_seen_ms, last_seen_ms FROM bindings WHERE token_hash = ? AND last_seen_ms > ? ORDER BY last_seen_ms DESC",
      from, nowMs - INSTALL_ACTIVE_WINDOW_MS,
    );
    for (const b of src) {
      const has = this.#q("SELECT 1 AS x FROM bindings WHERE token_hash = ? AND install_hash = ?", to, b.install_hash).length > 0;
      if (!has && this.#activeCount(to, nowMs) >= MAX_INSTALLS_PER_PURCHASE) break;
      this.#q(
        `INSERT INTO bindings (token_hash, install_hash, first_seen_ms, last_seen_ms) VALUES (?, ?, ?, ?)
         ON CONFLICT(token_hash, install_hash) DO UPDATE SET last_seen_ms = MAX(bindings.last_seen_ms, excluded.last_seen_ms)`,
        to, b.install_hash, b.first_seen_ms, b.last_seen_ms,
      );
    }
  }

  markAcked(tokenHash: string): void {
    this.#st.transactionSync(() => {
      this.#q("UPDATE purchases SET acknowledged = 1, ack_token = NULL WHERE token_hash = ?", tokenHash);
    });
  }

  /** Packs only; sticky; a tombstone when the token was never seen (§3.5). */
  markRevoked(tokenHash: string, nowMs: number): void {
    this.#st.transactionSync(() => {
      const row = this.#row(tokenHash);
      if (row && row.kind === "sub") {
        billingLog("BILLING_REVOKE_SUB_IGNORED");
        return;
      }
      if (row) {
        this.#q("UPDATE purchases SET revoked = 1, updated_ms = ? WHERE token_hash = ?", nowMs, tokenHash);
        return;
      }
      this.#q(
        `INSERT INTO purchases (token_hash, store, kind, product_id, state, revoked, google_checked_ms, created_ms, updated_ms)
         VALUES (?, 'google', 'pack', NULL, 'CANCELLED', 1, 0, ?, ?)`,
        tokenHash, nowMs, nowMs,
      );
      this.#q("DELETE FROM invalid_tokens_v2 WHERE token_hash = ?", tokenHash);
    });
  }

  // ---------------------------------------------------------------- entitlement

  /** Read-only: never touches `last_seen_ms`. */
  entitlementFor(installHash: string, nowMs: number): Entitlement {
    const rows = this.#q<PurchaseRow>(
      `SELECT p.* FROM purchases p JOIN bindings b ON b.token_hash = p.token_hash
       WHERE b.install_hash = ? AND b.last_seen_ms > ? AND p.superseded_by IS NULL`,
      installHash, nowMs - INSTALL_ACTIVE_WINDOW_MS,
    );
    let premiumUntilMs: number | null = null;
    const packs = new Set<string>();
    const subs: PurchaseRow[] = [];
    for (const r of rows) {
      if (r.kind === "sub") {
        subs.push(r);
        const until = rowAccessUntil(r, nowMs);
        if (until !== null && (premiumUntilMs === null || until > premiumUntilMs)) premiumUntilMs = until;
      } else if (r.state === "PURCHASED" && r.revoked === 0 && r.product_id) {
        const id = packIdFromProductId(r.product_id);
        if (id && this.#premiumPackIds.has(id)) packs.add(id);
      }
    }
    return { premiumUntilMs, packs: [...packs].sort().slice(0, MAX_TOKEN_PACKS), subscription: pickSubscription(subs, nowMs) };
  }

  // ---------------------------------------------------------------- RTDN dedupe, cron helpers

  rtdnSeen(messageId: string): boolean {
    return this.#q("SELECT 1 AS x FROM rtdn_seen WHERE message_id = ?", messageId).length > 0;
  }
  rtdnMark(messageId: string, nowMs: number): void {
    this.#q("INSERT INTO rtdn_seen (message_id, at_ms) VALUES (?, ?) ON CONFLICT DO NOTHING", messageId, nowMs);
  }

  /**
   * Rows the hourly cron retries. The window start is `max(ack_window_start_ms, created_ms)`: [VERIFY] (§3.5) whether
   * `SubscriptionPurchaseV2.startTime` is the new token's purchase time for an upgrade, re-signup or out-of-app
   * resubscribe; if Google carries over the original grant time, `created_ms` (our first sight of the token) still
   * keeps the retry alive for the 3-day ack window.
   */
  pendingAcks(nowMs: number): PendingAck[] {
    return this.#q<{ token_hash: string; kind: "sub" | "pack"; product_id: string; ack_token: string; ack_window_start_ms: number }>(
      `SELECT token_hash, kind, product_id, ack_token, ack_window_start_ms FROM purchases
       WHERE ack_token IS NOT NULL AND acknowledged = 0 AND ack_window_start_ms IS NOT NULL AND product_id IS NOT NULL
         AND MAX(ack_window_start_ms, created_ms) > ?`,
      nowMs - ACK_WINDOW_MS,
    ).map((r) => ({ tokenHash: r.token_hash, kind: r.kind, productId: r.product_id, token: r.ack_token, windowStartMs: r.ack_window_start_ms }));
  }

  staleSubs(nowMs: number): number {
    return this.#q<{ n: number }>(
      `SELECT COUNT(*) AS n FROM purchases WHERE kind = 'sub' AND expiry_ms > ? AND expiry_ms < ?
       AND state IN ('SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') AND google_checked_ms < expiry_ms`,
      nowMs - 3 * DAY_MS, nowMs - 3_600_000,
    )[0]?.n ?? 0;
  }

  cursorGet(): number | null {
    const v = this.#q<{ v: string }>("SELECT v FROM kv WHERE k = 'voided_cursor_ms'")[0]?.v;
    return v === undefined ? null : Number(v);
  }
  cursorSet(ms: number): void {
    this.#q("INSERT INTO kv (k, v) VALUES ('voided_cursor_ms', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", String(ms));
  }

  prune(nowMs: number): void {
    this.#st.transactionSync(() => {
      this.#q("DELETE FROM rtdn_seen WHERE at_ms < ?", nowMs - RTDN_SEEN_TTL_MS);
      this.#q("DELETE FROM invalid_tokens_v2 WHERE at_ms < ?", nowMs - INVALID_TOKEN_TTL_MS);
      // ack_token retention (§3.5 / §6.3).
      this.#q("UPDATE purchases SET ack_token = NULL WHERE ack_token IS NOT NULL AND ack_window_start_ms IS NOT NULL AND ack_window_start_ms < ?", nowMs - ACK_TOKEN_KEEP_MS);
      this.#q("UPDATE purchases SET ack_token = NULL WHERE ack_token IS NOT NULL AND ack_window_start_ms IS NULL AND created_ms < ?", nowMs - PENDING_ACK_TOKEN_MAX_MS);
      this.#q(
        `UPDATE purchases SET ack_token = NULL WHERE ack_token IS NOT NULL AND (acknowledged = 1 OR state IN
          ('CANCELLED', 'SUBSCRIPTION_STATE_EXPIRED', 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED', 'SUBSCRIPTION_STATE_UNSPECIFIED'))`,
      );
      this.#q("DELETE FROM bindings WHERE last_seen_ms < ?", nowMs - RETENTION_MS);
      // "Dead": superseded or expired, or a cancelled pack, more than 400 days ago. Plain `?` placeholders only.
      const cut = nowMs - RETENTION_MS;
      const dead = `((superseded_by IS NOT NULL AND updated_ms < ?) OR (expiry_ms IS NOT NULL AND expiry_ms < ?)
        OR (kind = 'pack' AND state = 'CANCELLED' AND updated_ms < ?))`;
      // Revoked rows are never deleted: they shrink to a tombstone so a refunded token can never be re-granted.
      this.#q(
        `UPDATE purchases SET expiry_ms = NULL, base_plan_id = NULL, origin_install_hash = NULL, ack_token = NULL
         WHERE revoked = 1 AND (${dead} OR updated_ms < ?)`,
        cut, cut, cut, cut,
      );
      this.#q(`DELETE FROM bindings WHERE token_hash IN (SELECT token_hash FROM purchases WHERE revoked = 0 AND ${dead})`, cut, cut, cut);
      this.#q(`DELETE FROM purchases WHERE revoked = 0 AND ${dead}`, cut, cut, cut);
    });
  }

  // ---------------------------------------------------------------- fake store (§3.10)

  fakeGet(token: string): string | null {
    return this.#q<{ json: string }>("SELECT json FROM fake_purchases WHERE token = ?", token)[0]?.json ?? null;
  }
  fakePut(token: string, json: string): void {
    this.#q("INSERT INTO fake_purchases (token, json) VALUES (?, ?) ON CONFLICT(token) DO UPDATE SET json = excluded.json", token, json);
  }
  /** Per-DO counter for deterministic fake tokens (`fake.<kind>.<productId>.<n>`). */
  fakeNext(): number {
    return this.#st.transactionSync(() => {
      const cur = Number(this.#q<{ v: string }>("SELECT v FROM kv WHERE k = 'fake_counter'")[0]?.v ?? "0") + 1;
      this.#q("INSERT INTO kv (k, v) VALUES ('fake_counter', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", String(cur));
      return cur;
    });
  }

  /** Test/introspection helper. */
  rowFor(tokenHash: string): PurchaseRow | null {
    return this.#row(tokenHash);
  }
  bindingsFor(tokenHash: string): { install_hash: string; first_seen_ms: number; last_seen_ms: number }[] {
    return this.#q("SELECT install_hash, first_seen_ms, last_seen_ms FROM bindings WHERE token_hash = ? ORDER BY install_hash", tokenHash);
  }
}

/** §3.4 `EntitlementBody.subscription` selection over actively bound, non-superseded subscription rows. */
export function pickSubscription(subs: readonly PurchaseRow[], nowMs: number): SubscriptionInfo | null {
  let pick: PurchaseRow | undefined;
  let best = -Infinity;
  for (const r of subs) {
    const until = rowAccessUntil(r, nowMs);
    if (until !== null && until > best) {
      best = until;
      pick = r;
    }
  }
  if (!pick) {
    best = -Infinity;
    for (const r of subs) {
      if (SUB_SUSPENDED.has(r.state) && r.updated_ms > best) {
        best = r.updated_ms;
        pick = r;
      }
    }
  }
  if (!pick) {
    best = -Infinity;
    for (const r of subs) {
      const e = r.expiry_ms ?? -Infinity;
      if (e > best) {
        best = e;
        pick = r;
      }
    }
    if (!pick && subs.length > 0) pick = subs[0];
  }
  if (!pick) return null;
  return {
    state: pick.state as SubState, basePlanId: pick.base_plan_id, autoRenewing: pick.auto_renew === 1,
    inTrial: pick.in_trial === 1, expiresAt: pick.expiry_ms,
  };
}

function lruTrim(m: Map<string, unknown>): void {
  while (m.size > RATE_MAP_MAX_ENTRIES) {
    const oldest = m.keys().next().value as string;
    m.delete(oldest);
  }
}

// ------------------------------------------------------------------ async facade (the Billing DO's RPC surface)

/** What the Worker's billing code calls: the Billing DO stub in production, `storeFromCore(core)` in tests. */
export interface BillingStore {
  rateCheck(installHash: string, kind: "verify" | "entitlement", nowMs: number): Promise<boolean>;
  googleBudget(n: number, nowMs: number): Promise<number>;
  ipReadCheck(ipKey: string, nowMs: number): Promise<boolean>;
  installNetSeen(installHash: string, netKey: string, nowMs: number): Promise<number>;
  lookup(tokenHash: string, kind: "sub" | "pack", nowMs: number): Promise<{ invalid: boolean; row: PurchaseRow | null }>;
  markInvalid(tokenHash: string, kind: "sub" | "pack", nowMs: number): Promise<void>;
  applyPurchase(i: ApplyInput): Promise<ApplyResult>;
  bindOnly(a: { tokenHash: string; callerInstallHash: string; nowMs: number }): Promise<BindResult>;
  markAcked(tokenHash: string): Promise<void>;
  entitlementFor(installHash: string, nowMs: number): Promise<Entitlement>;
  kindOf(tokenHash: string): Promise<"sub" | "pack" | null>;
  markRevoked(tokenHash: string, nowMs: number): Promise<void>;
  rtdnSeen(messageId: string): Promise<boolean>;
  rtdnMark(messageId: string, nowMs: number): Promise<void>;
  pendingAcks(nowMs: number): Promise<PendingAck[]>;
  staleSubs(nowMs: number): Promise<number>;
  cursorGet(): Promise<number | null>;
  cursorSet(ms: number): Promise<void>;
  prune(nowMs: number): Promise<void>;
  fakeGet(token: string): Promise<string | null>;
  fakePut(token: string, json: string): Promise<void>;
  fakeNext(): Promise<number>;
}

export function storeFromCore(core: BillingCore): BillingStore {
  return {
    rateCheck: async (h, k, now) => core.rateCheck(h, k, now),
    googleBudget: async (n, now) => core.googleBudget(n, now),
    ipReadCheck: async (k, now) => core.ipReadCheck(k, now),
    installNetSeen: async (h, k, now) => core.installNetSeen(h, k, now),
    lookup: async (h, kind, now) => core.lookup(h, kind, now),
    markInvalid: async (h, kind, now) => core.markInvalid(h, kind, now),
    applyPurchase: (i) => core.applyPurchase(i),
    bindOnly: async (a) => core.bindOnly(a),
    markAcked: async (h) => core.markAcked(h),
    entitlementFor: async (h, now) => core.entitlementFor(h, now),
    kindOf: async (h) => core.kindOf(h),
    markRevoked: async (h, now) => core.markRevoked(h, now),
    rtdnSeen: async (id) => core.rtdnSeen(id),
    rtdnMark: async (id, now) => core.rtdnMark(id, now),
    pendingAcks: async (now) => core.pendingAcks(now),
    staleSubs: async (now) => core.staleSubs(now),
    cursorGet: async () => core.cursorGet(),
    cursorSet: async (ms) => core.cursorSet(ms),
    prune: async (now) => core.prune(now),
    fakeGet: async (t) => core.fakeGet(t),
    fakePut: async (t, j) => core.fakePut(t, j),
    fakeNext: async () => core.fakeNext(),
  };
}
