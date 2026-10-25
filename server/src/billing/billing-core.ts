// PAYMENTS-SPEC §3.5: runtime-agnostic Billing DO logic. Every write is synchronous SQL inside `transactionSync`
// (no await between a read and the write that depends on it). `billing-do.ts` adapts it to a Durable Object;
// tests drive it with a node:sqlite-backed SqlLike.
import {
  ACK_WINDOW_MS,
  ENTITLEMENT_TTL_S,
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
import { packIdFromProductId, PREMIUM_PRODUCT_ID, purchaseOwned } from "@mishana/shared/billing";
import type { PurchaseResult, PurchaseState } from "@mishana/shared/billing";
import type { NormalizedPurchase } from "./normalize";

// ------------------------------------------------------------------ storage abstraction

export type SqlValue = string | number | null;
export interface SqlCursorLike<T> { toArray(): T[] }
export interface SqlLike {
  exec<T extends Record<string, SqlValue>>(query: string, ...bindings: SqlValue[]): SqlCursorLike<T>;
}
export interface BillingStorage { sql: SqlLike; transactionSync<T>(fn: () => T): T }

/** Every row is a one-time Play product (`premium` or a `pack_*`); `kind` is always PRODUCT_KIND. */
export const PRODUCT_KIND = "product";

export interface PurchaseRow {
  token_hash: string; store: string; kind: string; product_id: string | null; state: string;
  acknowledged: number; ack_token: string | null; ack_window_start_ms: number | null; revoked: number; test: number;
  origin_install_hash: string | null; google_checked_ms: number; created_ms: number; updated_ms: number;
  [k: string]: SqlValue;
}

// The columns expiry_ms, auto_renew, base_plan_id, in_trial and superseded_by are unused leftovers of the dropped
// subscription design (nothing shipped with them); they stay at their defaults. `kind` is always 'product', and the
// negative cache keeps its `kind` key column with the same constant value.
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
  // Negative cache (24 h) of tokens Google's productsv2 answered 400/404/410 for. (Replaces the pre-release
  // `invalid_tokens` table; it held only 24 h cache entries.)
  `DROP TABLE IF EXISTS invalid_tokens`,
  `CREATE TABLE IF NOT EXISTS invalid_tokens_v2 (token_hash TEXT NOT NULL, kind TEXT NOT NULL, at_ms INTEGER NOT NULL,
    PRIMARY KEY (token_hash, kind))`,
  `CREATE TABLE IF NOT EXISTS rtdn_seen (message_id TEXT PRIMARY KEY, at_ms INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS fake_purchases (token TEXT PRIMARY KEY, json TEXT NOT NULL)`,
  // §3.12 admin grants (owner comps): one row per install, keyed by the install-id hash only (never the raw id).
  `CREATE TABLE IF NOT EXISTS grants (install_hash TEXT PRIMARY KEY, premium INTEGER NOT NULL DEFAULT 0, packs TEXT NOT NULL DEFAULT '[]',
    expires_ms INTEGER, note TEXT, created_ms INTEGER NOT NULL)`,
];

// ------------------------------------------------------------------ pure rules

const HEX64 = /^[0-9a-f]{64}$/;
const DAY_MS = 86_400_000;
export const RATE_WINDOW_MS = 10 * 60_000;
export const RETENTION_MS = 400 * DAY_MS;
export const RTDN_SEEN_TTL_MS = 30 * DAY_MS;
/** `ack_token` is kept until 4 days after the ack window opened (§3.5). */
// PAY-GAP: "dead" rows are cancelled purchases last updated > 400 days ago (revoked rows only shrink, never go).
export const ACK_TOKEN_KEEP_MS = 4 * DAY_MS;

/** Google says paid and the purchase is not yet acknowledged → acknowledge it. */
export function isAckEligible(state: string): boolean {
  return state === "PURCHASED";
}
export function isPendingState(state: string): boolean {
  return state === "PENDING";
}
/** §3.4 "Which purchases bind on /verify". */
export function isBindable(row: Pick<PurchaseRow, "state" | "revoked">): boolean {
  return row.state !== "CANCELLED" && row.revoked === 0;
}
/** A one-time purchase grants access while PURCHASED and never revoked (revoked is sticky). */
export function rowGrantsAccess(row: Pick<PurchaseRow, "state" | "revoked">): boolean {
  return purchaseOwned({ state: row.state as PurchaseState, revoked: row.revoked === 1 });
}

// ------------------------------------------------------------------ types

export interface ApplyInput {
  tokenHash: string;
  productId: string;
  n: NormalizedPurchase;
  callerInstallHash: string | null;
  /** The raw token, kept only while an ack is or may become due. */
  rawTokenForAck: string;
  nowMs: number;
  /** "fake" for FakeGoogleApi reads (§3.10); stored on insert only. */
  store?: "google" | "fake";
}
export interface ApplyResult { result: Exclude<PurchaseResult, "INVALID" | "UPSTREAM_ERROR">; ackDue: boolean }
export type BindResult = Exclude<PurchaseResult, "INVALID" | "UPSTREAM_ERROR">;
export interface Entitlement { premiumUntilMs: number | null; packs: string[] }
/** §3.12: an admin grant (premium and/or packs) for one install, outside Google and outside the install limit. */
export interface Grant { installHash: string; premium: boolean; packs: string[]; expiresAt: number | null; note: string | null; createdAt: number }
interface GrantRow { install_hash: string; premium: number; packs: string; expires_ms: number | null; note: string | null; created_ms: number; [k: string]: SqlValue }

function grantFromRow(r: GrantRow): Grant {
  let packs: string[] = [];
  try {
    const v: unknown = JSON.parse(r.packs);
    if (Array.isArray(v)) packs = v.filter((x): x is string => typeof x === "string");
  } catch {
    packs = [];
  }
  return { installHash: r.install_hash, premium: r.premium === 1, packs, expiresAt: r.expires_ms, note: r.note, createdAt: r.created_ms };
}

export interface PendingAck { tokenHash: string; productId: string; token: string; windowStartMs: number }

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

  lookup(tokenHash: string, nowMs: number): { invalid: boolean; row: PurchaseRow | null } {
    const inv = this.#q<{ at_ms: number }>("SELECT at_ms FROM invalid_tokens_v2 WHERE token_hash = ? AND kind = ?", tokenHash, PRODUCT_KIND)[0];
    return { invalid: inv !== undefined && inv.at_ms > nowMs - INVALID_TOKEN_TTL_MS, row: this.#row(tokenHash) };
  }

  /** Only for Google's own 400/404/410 (never a product mismatch, never an auth failure). */
  markInvalid(tokenHash: string, nowMs: number): void {
    this.#st.transactionSync(() => {
      if (this.#row(tokenHash)) return; // never for a hash that has a purchases row
      this.#q(
        "INSERT INTO invalid_tokens_v2 (token_hash, kind, at_ms) VALUES (?, ?, ?) ON CONFLICT(token_hash, kind) DO UPDATE SET at_ms = excluded.at_ms",
        tokenHash, PRODUCT_KIND, nowMs,
      );
    });
  }

  // ---------------------------------------------------------------- apply / bind

  applyPurchase(i: ApplyInput): ApplyResult {
    const n = i.n;
    return this.#st.transactionSync(() => {
      const eligible = isAckEligible(n.state);
      const ackToken = !n.acknowledged && (eligible || isPendingState(n.state)) ? i.rawTokenForAck : null;
      const windowStart = eligible ? (n.completedMs ?? n.checkedMs) : null;
      const origin = n.obfuscatedAccountId && HEX64.test(n.obfuscatedAccountId) ? n.obfuscatedAccountId : null;
      // A stale read (older than the stored one) changes nothing.
      this.#q(
        `INSERT INTO purchases (token_hash, store, kind, product_id, state, acknowledged, ack_token, ack_window_start_ms, revoked, test,
           origin_install_hash, google_checked_ms, created_ms, updated_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
         ON CONFLICT(token_hash) DO UPDATE SET
           state = excluded.state, test = excluded.test, origin_install_hash = excluded.origin_install_hash,
           product_id = COALESCE(purchases.product_id, excluded.product_id),
           acknowledged = MAX(purchases.acknowledged, excluded.acknowledged),
           ack_token = CASE WHEN MAX(purchases.acknowledged, excluded.acknowledged) = 1 THEN NULL ELSE excluded.ack_token END,
           revoked = MAX(purchases.revoked, excluded.revoked),
           ack_window_start_ms = COALESCE(purchases.ack_window_start_ms, excluded.ack_window_start_ms),
           google_checked_ms = excluded.google_checked_ms, updated_ms = excluded.updated_ms
         WHERE excluded.google_checked_ms >= purchases.google_checked_ms`,
        i.tokenHash, i.store ?? "google", PRODUCT_KIND, i.productId, n.state, n.acknowledged ? 1 : 0,
        ackToken, windowStart, n.test ? 1 : 0, origin, n.checkedMs, i.nowMs, i.nowMs,
      );
      // A purchase row now exists: the negative cache must not shadow it.
      this.#q("DELETE FROM invalid_tokens_v2 WHERE token_hash = ?", i.tokenHash);
      const row = this.#row(i.tokenHash) as PurchaseRow;
      const ackDue = isAckEligible(row.state) && row.acknowledged === 0;
      let result: BindResult;
      if (i.callerInstallHash !== null) {
        result = this.#bindAndResult(row, i.callerInstallHash, i.nowMs);
      } else {
        // No caller (RTDN, cron, fake set): the restricted origin-install hint binding (§3.4).
        if (isBindable(row) && row.origin_install_hash) this.#bindHint(i.tokenHash, row.origin_install_hash, i.nowMs);
        result = this.#resultOf(row);
      }
      return { result, ackDue };
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
    if (row.revoked === 1) return "REVOKED";
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
    return this.#resultOf(row);
  }

  #resultOf(row: PurchaseRow): BindResult {
    if (row.revoked === 1) return "REVOKED";
    if (rowGrantsAccess(row)) return "OK";
    if (isPendingState(row.state)) return "PENDING";
    return "NOT_OWNED";
  }

  /** The restricted RTDN-path binding (§3.4): only for a token with no binding at all, below the limit. */
  #bindHint(tokenHash: string, installHash: string, nowMs: number): void {
    const any = this.#q<{ n: number }>("SELECT COUNT(*) AS n FROM bindings WHERE token_hash = ?", tokenHash)[0]?.n ?? 0;
    if (any > 0 || this.#activeCount(tokenHash, nowMs) >= MAX_INSTALLS_PER_PURCHASE) return;
    this.#q("INSERT INTO bindings (token_hash, install_hash, first_seen_ms, last_seen_ms) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING", tokenHash, installHash, nowMs, nowMs);
  }

  markAcked(tokenHash: string): void {
    this.#st.transactionSync(() => {
      this.#q("UPDATE purchases SET acknowledged = 1, ack_token = NULL WHERE token_hash = ?", tokenHash);
    });
  }

  /** Refund / chargeback of `premium` or a pack; sticky; a tombstone when the token was never seen (§3.5). */
  markRevoked(tokenHash: string, nowMs: number): void {
    this.#st.transactionSync(() => {
      const row = this.#row(tokenHash);
      if (row) {
        this.#q("UPDATE purchases SET revoked = 1, updated_ms = ? WHERE token_hash = ?", nowMs, tokenHash);
        return;
      }
      this.#q(
        `INSERT INTO purchases (token_hash, store, kind, product_id, state, revoked, google_checked_ms, created_ms, updated_ms)
         VALUES (?, 'google', ?, NULL, 'CANCELLED', 1, 0, ?, ?)`,
        tokenHash, PRODUCT_KIND, nowMs, nowMs,
      );
      this.#q("DELETE FROM invalid_tokens_v2 WHERE token_hash = ?", tokenHash);
    });
  }

  // ---------------------------------------------------------------- entitlement

  /**
   * Read-only: never touches `last_seen_ms`. Lifetime premium (an actively bound, owned `premium` purchase) and an
   * open-ended admin grant both give premium for the token's own lifetime (`pu` = `exp`); the TV's refresh before
   * `exp` renews it, and a refund (revoked) stops it at the next refresh.
   */
  entitlementFor(installHash: string, nowMs: number): Entitlement {
    const rows = this.#q<PurchaseRow>(
      `SELECT p.* FROM purchases p JOIN bindings b ON b.token_hash = p.token_hash
       WHERE b.install_hash = ? AND b.last_seen_ms > ?`,
      installHash, nowMs - INSTALL_ACTIVE_WINDOW_MS,
    );
    const lifetimeUntil = nowMs + ENTITLEMENT_TTL_S * 1000;
    let premiumUntilMs: number | null = null;
    const packs = new Set<string>();
    for (const r of rows) {
      if (!r.product_id || !rowGrantsAccess(r)) continue;
      if (r.product_id === PREMIUM_PRODUCT_ID) {
        premiumUntilMs = lifetimeUntil;
        continue;
      }
      const id = packIdFromProductId(r.product_id);
      if (id && this.#premiumPackIds.has(id)) packs.add(id);
    }
    // §3.12: an unexpired admin grant adds premium and/or packs. A grant without an end date gives premium for the
    // token's own lifetime (`pu` = `exp`); the TV's refresh before `exp` renews it.
    const g = this.grantFor(installHash);
    if (g && (g.expiresAt === null || g.expiresAt > nowMs)) {
      if (g.premium) {
        const until = g.expiresAt ?? lifetimeUntil;
        if (premiumUntilMs === null || until > premiumUntilMs) premiumUntilMs = until;
      }
      for (const id of g.packs) if (this.#premiumPackIds.has(id)) packs.add(id);
    }
    return { premiumUntilMs, packs: [...packs].sort().slice(0, MAX_TOKEN_PACKS) };
  }

  // ---------------------------------------------------------------- admin grants (§3.12)

  /** Inserts or replaces the grant of `g.installHash` (a sha256 hex, never a raw install id). */
  grantPut(g: Grant): void {
    if (!HEX64.test(g.installHash)) throw new Error("grantPut: installHash must be a sha256 hex");
    this.#q(
      `INSERT INTO grants (install_hash, premium, packs, expires_ms, note, created_ms) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(install_hash) DO UPDATE SET premium = excluded.premium, packs = excluded.packs, expires_ms = excluded.expires_ms,
         note = excluded.note, created_ms = excluded.created_ms`,
      g.installHash, g.premium ? 1 : 0, JSON.stringify([...new Set(g.packs)].sort()), g.expiresAt, g.note, g.createdAt,
    );
  }

  /** true when a grant was removed. */
  grantDelete(installHash: string): boolean {
    return this.#st.transactionSync(() => {
      const had = this.grantFor(installHash) !== null;
      if (had) this.#q("DELETE FROM grants WHERE install_hash = ?", installHash);
      return had;
    });
  }

  grantFor(installHash: string): Grant | null {
    const r = this.#q<GrantRow>("SELECT * FROM grants WHERE install_hash = ?", installHash)[0];
    return r ? grantFromRow(r) : null;
  }

  /** Every grant, newest first (expired ones included; they grant nothing). */
  grantList(): Grant[] {
    return this.#q<GrantRow>("SELECT * FROM grants ORDER BY created_ms DESC, install_hash").map(grantFromRow);
  }

  // ---------------------------------------------------------------- RTDN dedupe, cron helpers

  rtdnSeen(messageId: string): boolean {
    return this.#q("SELECT 1 AS x FROM rtdn_seen WHERE message_id = ?", messageId).length > 0;
  }
  rtdnMark(messageId: string, nowMs: number): void {
    this.#q("INSERT INTO rtdn_seen (message_id, at_ms) VALUES (?, ?) ON CONFLICT DO NOTHING", messageId, nowMs);
  }

  /**
   * Rows the hourly cron retries. The window start is `max(ack_window_start_ms, created_ms)`: `created_ms` (our first
   * sight of the token) keeps the retry alive for the 3-day ack window when Google reports an older completion time.
   */
  pendingAcks(nowMs: number): PendingAck[] {
    return this.#q<{ token_hash: string; product_id: string; ack_token: string; ack_window_start_ms: number }>(
      `SELECT token_hash, product_id, ack_token, ack_window_start_ms FROM purchases
       WHERE ack_token IS NOT NULL AND acknowledged = 0 AND ack_window_start_ms IS NOT NULL AND product_id IS NOT NULL
         AND MAX(ack_window_start_ms, created_ms) > ?`,
      nowMs - ACK_WINDOW_MS,
    ).map((r) => ({ tokenHash: r.token_hash, productId: r.product_id, token: r.ack_token, windowStartMs: r.ack_window_start_ms }));
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
      this.#q("UPDATE purchases SET ack_token = NULL WHERE ack_token IS NOT NULL AND (acknowledged = 1 OR state = 'CANCELLED')");
      this.#q("DELETE FROM bindings WHERE last_seen_ms < ?", nowMs - RETENTION_MS);
      // "Dead": a cancelled purchase last updated more than 400 days ago. Plain `?` placeholders only.
      const cut = nowMs - RETENTION_MS;
      // Revoked rows are never deleted: they shrink to a tombstone so a refunded token can never be re-granted.
      this.#q("UPDATE purchases SET origin_install_hash = NULL, ack_token = NULL WHERE revoked = 1 AND updated_ms < ?", cut);
      const dead = "revoked = 0 AND state = 'CANCELLED' AND updated_ms < ?";
      this.#q(`DELETE FROM bindings WHERE token_hash IN (SELECT token_hash FROM purchases WHERE ${dead})`, cut);
      this.#q(`DELETE FROM purchases WHERE ${dead}`, cut);
    });
  }

  // ---------------------------------------------------------------- fake store (§3.10)

  fakeGet(token: string): string | null {
    return this.#q<{ json: string }>("SELECT json FROM fake_purchases WHERE token = ?", token)[0]?.json ?? null;
  }
  fakePut(token: string, json: string): void {
    this.#q("INSERT INTO fake_purchases (token, json) VALUES (?, ?) ON CONFLICT(token) DO UPDATE SET json = excluded.json", token, json);
  }
  /** Per-DO counter for deterministic fake tokens (`fake.<productId>.<n>`). */
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
  lookup(tokenHash: string, nowMs: number): Promise<{ invalid: boolean; row: PurchaseRow | null }>;
  markInvalid(tokenHash: string, nowMs: number): Promise<void>;
  applyPurchase(i: ApplyInput): Promise<ApplyResult>;
  bindOnly(a: { tokenHash: string; callerInstallHash: string; nowMs: number }): Promise<BindResult>;
  markAcked(tokenHash: string): Promise<void>;
  entitlementFor(installHash: string, nowMs: number): Promise<Entitlement>;
  markRevoked(tokenHash: string, nowMs: number): Promise<void>;
  rtdnSeen(messageId: string): Promise<boolean>;
  rtdnMark(messageId: string, nowMs: number): Promise<void>;
  pendingAcks(nowMs: number): Promise<PendingAck[]>;
  cursorGet(): Promise<number | null>;
  cursorSet(ms: number): Promise<void>;
  prune(nowMs: number): Promise<void>;
  fakeGet(token: string): Promise<string | null>;
  fakePut(token: string, json: string): Promise<void>;
  fakeNext(): Promise<number>;
  grantPut(g: Grant): Promise<void>;
  grantDelete(installHash: string): Promise<boolean>;
  grantList(): Promise<Grant[]>;
}

export function storeFromCore(core: BillingCore): BillingStore {
  return {
    rateCheck: async (h, k, now) => core.rateCheck(h, k, now),
    googleBudget: async (n, now) => core.googleBudget(n, now),
    ipReadCheck: async (k, now) => core.ipReadCheck(k, now),
    installNetSeen: async (h, k, now) => core.installNetSeen(h, k, now),
    lookup: async (h, now) => core.lookup(h, now),
    markInvalid: async (h, now) => core.markInvalid(h, now),
    applyPurchase: async (i) => core.applyPurchase(i),
    bindOnly: async (a) => core.bindOnly(a),
    markAcked: async (h) => core.markAcked(h),
    entitlementFor: async (h, now) => core.entitlementFor(h, now),
    markRevoked: async (h, now) => core.markRevoked(h, now),
    rtdnSeen: async (id) => core.rtdnSeen(id),
    rtdnMark: async (id, now) => core.rtdnMark(id, now),
    pendingAcks: async (now) => core.pendingAcks(now),
    cursorGet: async () => core.cursorGet(),
    cursorSet: async (ms) => core.cursorSet(ms),
    prune: async (now) => core.prune(now),
    fakeGet: async (t) => core.fakeGet(t),
    fakePut: async (t, j) => core.fakePut(t, j),
    fakeNext: async () => core.fakeNext(),
    grantPut: async (g) => core.grantPut(g),
    grantDelete: async (h) => core.grantDelete(h),
    grantList: async () => core.grantList(),
  };
}
