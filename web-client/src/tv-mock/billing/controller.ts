// PAYMENTS-SPEC §5.2: the TV mock's billing client (fake billing only). It plays the TV app's BillingRepository with the
// server's FAKE store standing in for Google Play: install id, catalog, fake purchase → /verify → token → WS
// `entitlement`, the §2.4 refresh rules, the `storeOpen` busy signal and the billing toast queue. All I/O is injected.
import { signal } from "@preact/signals";
import { PREMIUM_PRODUCT_ID, SUPPORT_EMAIL, packIdFromProductId } from "@mishana/shared/billing/products";
import type { BasePlanId } from "@mishana/shared/billing/products";
import type {
  CatalogResponseBody, EntitlementBody, EntitlementResponseBody, FakePurchaseResponseBody, PurchaseResult, VerifyResponseBody,
} from "@mishana/shared/billing";
import { BRAND } from "@mishana/shared/brand";
import { MAX_PURCHASES_PER_VERIFY, PROTOCOL_VERSION } from "@mishana/shared/constants";
import type { EntitlementMsg, StoreOpenMsg } from "@mishana/shared/protocol";
import type { MessageKey, Params } from "../../i18n/t";
import { backoffMs, inflightKey, nextRefreshAt, planPurchaseRequest, purchasesKey, tokenForCreate, tokenStale, ToastGate, trialOffered } from "./model";

const P = BRAND.storagePrefix;
/**
 * §5.2 keys (installId, entToken); the rest are the mock's own (PAY-GAP: the spec names only those two; they mirror
 * the TV app's `ent_json` / `ent_saved_at` (§4.8 EntitlementStore) plus the fake store's own state).
 *
 * Trust: everything here is a UI cache on the viewer's own device. Only `entToken` ever leaves the browser (WS
 * `entitlement`, POST /api/rooms), and the server re-verifies its Ed25519 signature and expiry on every use (§3.11),
 * so editing `entBody` / `entVerified` / `trialUsed` changes this TV's Store screen at most, never what a room may play:
 * `premium` and `lockedPacks` in the server's state frames decide that. `fakePurchases` is the fake store's stand-in for
 * `queryPurchasesAsync` and is re-verified by the server on every /verify.
 */
export const BILLING_KEYS = {
  installId: `${P}:installId`,
  token: `${P}:entToken`,
  body: `${P}:entBody`,
  purchases: `${P}:fakePurchases`,
  verified: `${P}:entVerified`,
  /** The install id that already bought `premium` once (§1.1 trial eligibility: "never had this subscription"). */
  trialUsed: `${P}:trialUsed`,
} as const;

const INSTALL_ID_RE = /^[0-9a-f]{32}$/;
/** §4.3: the TV re-sends `storeOpen{open:true}` every 4 min while busy (the server lapses it after 5). */
export const STORE_OPEN_RESEND_MS = 4 * 60_000;
/** §4.4: a purchase button shows "Confirming…" for at most 15 s, then `store.verifyFailed`. */
export const CONFIRM_SLOW_MS = 15_000;

/** A purchase the mock remembers, standing in for `queryPurchasesAsync` (§4.8 queryOwned). */
export interface OwnedPurchase { productId: string; purchaseToken: string; state: "PURCHASED" | "PENDING" }
export interface BillingToast { key: MessageKey; params?: Params; tone: "info" | "success" | "error" }

export interface BillingDeps {
  fetch(url: string, init?: RequestInit): Promise<Response>;
  now(): number;
  /** Storage accessors that never throw (SPEC §8.6). */
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
  randomBytes(n: number): Uint8Array;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** What the room side gives the controller once a TV socket exists. */
export interface BillingRoomLink {
  /** Sends a frame on the TV socket; false when it is not OPEN (nothing is queued). */
  send(msg: EntitlementMsg | StoreOpenMsg): boolean;
  /** §4.4 toast rule: true while the Store is open or the phase is LOBBY/RESULTS. */
  canToast(): boolean;
  showToast(t: BillingToast): void;
}

type Json = Record<string, unknown>;
type HttpResult<T> = { ok: true; status: number; body: T } | { ok: false; status: number; error: string | null };

function isEntitlementBody(v: unknown): v is EntitlementBody {
  const b = v as Partial<EntitlementBody> | null;
  return typeof b === "object" && b !== null && typeof b.token === "string" && typeof b.expiresAt === "number"
    && typeof b.premium === "boolean" && Array.isArray(b.packs);
}

export class BillingController {
  /** "unknown" until the catalog answers; "error" when it could not be fetched. */
  readonly mode = signal<"unknown" | "google" | "fake" | "error">("unknown");
  readonly catalog = signal<CatalogResponseBody | null>(null);
  readonly ent = signal<EntitlementBody | null>(null);
  /** Product ids whose purchase is PENDING (no access, §4.4). */
  readonly pending = signal<ReadonlySet<string>>(new Set());
  /** The purchase in flight (fake purchase → /verify) as `inflightKey` (`premium:yearly`, `pack_en_food_01`), or null. */
  readonly inflight = signal<string | null>(null);
  /** This install already had the subscription once: no trial offer any more (§4.5 no-trial wording). */
  readonly trialUsed = signal(false);
  /** The in-flight purchase passed CONFIRM_SLOW_MS without an answer. */
  readonly confirmSlow = signal(false);
  readonly storeVisible = signal(false);

  private savedAt: number | null = null;
  private link: BillingRoomLink | null = null;
  private pendingToken: string | null = null;
  private busySent: boolean | null = null;
  private resendTimer: unknown = null;
  private refreshTimer: unknown = null;
  private retryTimer: unknown = null;
  private retryAttempt = 0;
  private refreshing: Promise<boolean> | null = null;
  private readonly toasts = new ToastGate<BillingToast>((t) => this.link?.showToast(t));

  constructor(private readonly d: BillingDeps) {
    const used = d.read(BILLING_KEYS.trialUsed);
    this.trialUsed.value = used !== null && used === d.read(BILLING_KEYS.installId);
    const raw = d.read(BILLING_KEYS.body);
    if (raw !== null) {
      try {
        const j = JSON.parse(raw) as { body?: unknown; savedAt?: unknown };
        if (isEntitlementBody(j.body) && typeof j.savedAt === "number") {
          this.ent.value = j.body;
          this.savedAt = j.savedAt;
        }
      } catch {
        /* corrupt: ignore */
      }
    }
  }

  // ------------------------------------------------------------------ identity and stored purchases

  /** §5.2: 32 hex from crypto.getRandomValues, kept in localStorage `mishana:installId`. */
  installId(): string {
    const v = this.d.read(BILLING_KEYS.installId);
    if (v !== null && INSTALL_ID_RE.test(v)) return v;
    const id = Array.from(this.d.randomBytes(16), (b) => b.toString(16).padStart(2, "0")).join("");
    this.d.write(BILLING_KEYS.installId, id);
    return id;
  }

  purchases(): OwnedPurchase[] {
    const raw = this.d.read(BILLING_KEYS.purchases);
    if (raw === null) return [];
    try {
      const list = JSON.parse(raw) as unknown;
      if (!Array.isArray(list)) return [];
      return list.filter((p): p is OwnedPurchase => typeof p === "object" && p !== null
        && typeof (p as OwnedPurchase).productId === "string" && typeof (p as OwnedPurchase).purchaseToken === "string"
        && ((p as OwnedPurchase).state === "PURCHASED" || (p as OwnedPurchase).state === "PENDING"));
    } catch {
      return [];
    }
  }

  private savePurchases(list: readonly OwnedPurchase[]): void {
    this.d.write(BILLING_KEYS.purchases, JSON.stringify(list));
  }

  private forget(purchaseToken: string): void {
    this.savePurchases(this.purchases().filter((p) => p.purchaseToken !== purchaseToken));
  }

  // ------------------------------------------------------------------ HTTP

  private async http<T>(path: string, body?: Json): Promise<HttpResult<T>> {
    try {
      const res = await this.d.fetch(path, body === undefined
        ? { method: "GET", cache: "no-store" }
        : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
      let json: unknown = null;
      if (res.status !== 204) {
        try { json = await res.json(); } catch { json = null; }
      }
      if (res.ok) return { ok: true, status: res.status, body: json as T };
      const err = (json as { error?: unknown } | null)?.error;
      return { ok: false, status: res.status, error: typeof err === "string" ? err : null };
    } catch {
      return { ok: false, status: 0, error: "NETWORK" };
    }
  }

  /** §5.2: GET /api/billing/catalog decides the mock's mode (google → no store, only `store.tvAppOnly`). */
  async loadCatalog(): Promise<boolean> {
    const r = await this.http<CatalogResponseBody>("/api/billing/catalog");
    if (!r.ok || (r.body?.mode !== "fake" && r.body?.mode !== "google")) {
      if (this.mode.value === "unknown") this.mode.value = "error";
      return false;
    }
    this.catalog.value = r.body;
    this.mode.value = r.body.mode;
    return true;
  }

  get fake(): boolean { return this.mode.value === "fake"; }

  /** §4.5: whether the plan buttons offer the free trial (badge, `legalTrialRenew` + `legalCancelTrial`). */
  get trialOffered(): boolean { return trialOffered(this.catalog.value, this.ent.value, this.trialUsed.value); }

  // ------------------------------------------------------------------ entitlement

  private apply(body: EntitlementBody, verifiedKey: string | null): void {
    const now = this.d.now();
    this.ent.value = body;
    this.savedAt = now;
    this.d.write(BILLING_KEYS.token, body.token);
    this.d.write(BILLING_KEYS.body, JSON.stringify({ body, savedAt: now }));
    if (verifiedKey !== null) this.d.write(BILLING_KEYS.verified, verifiedKey);
    this.retryAttempt = 0;
    if (this.retryTimer !== null) { this.d.clearTimeout(this.retryTimer); this.retryTimer = null; }
    this.sendEntitlement(body.token);
    this.scheduleRefresh();
  }

  /** §4.2: a refresh while in a room sends the token at once; while the socket is down, one token waits for it. */
  private sendEntitlement(token: string): void {
    if (!this.link) return;
    const msg: EntitlementMsg = { v: PROTOCOL_VERSION, t: "entitlement", token };
    this.pendingToken = this.link.send(msg) ? null : token;
  }

  private async verify(purchases: readonly OwnedPurchase[]): Promise<HttpResult<VerifyResponseBody>> {
    let last: HttpResult<VerifyResponseBody> = { ok: false, status: 0, error: "NETWORK" };
    const results: VerifyResponseBody["results"] = [];
    const installId = this.installId();
    for (let i = 0; i < purchases.length; i += MAX_PURCHASES_PER_VERIFY) {
      const chunk = purchases.slice(i, i + MAX_PURCHASES_PER_VERIFY).map((p) => ({ productId: p.productId, purchaseToken: p.purchaseToken }));
      last = await this.http<VerifyResponseBody>("/api/billing/verify", { installId, purchases: chunk });
      if (!last.ok) return last;
      if (!isEntitlementBody(last.body?.entitlement)) return { ok: false, status: last.status, error: "BAD_RESPONSE" };
      results.push(...(last.body.results ?? []));
    }
    return last.ok ? { ...last, body: { entitlement: last.body.entitlement, results } } : last;
  }

  private async entitlementOnly(): Promise<HttpResult<EntitlementResponseBody>> {
    const r = await this.http<EntitlementResponseBody>("/api/billing/entitlement", { installId: this.installId() });
    if (r.ok && !isEntitlementBody(r.body?.entitlement)) return { ok: false, status: r.status, error: "BAD_RESPONSE" };
    return r;
  }

  /**
   * §2.4 rule 1 (load, visible again), 3 (timer, `force`) and 4 (Store opens): post the remembered purchases to /verify
   * when they changed since the last successful verify, otherwise refresh only a token older than 1 h (`force` always
   * refreshes). Never fatal: a failure keeps the old token and retries with backoff.
   */
  refresh(force = false): Promise<boolean> {
    if (!this.fake) return Promise.resolve(false);
    this.refreshing ??= this.doRefresh(force).finally(() => { this.refreshing = null; });
    return this.refreshing;
  }

  private async doRefresh(force: boolean): Promise<boolean> {
    const purchases = this.purchases();
    const key = purchasesKey(purchases);
    const changed = key !== (this.d.read(BILLING_KEYS.verified) ?? "");
    if (!force && !changed && !tokenStale(this.savedAt, this.d.now()) && this.ent.value) return true;
    if (purchases.length > 0) {
      const r = await this.verify(purchases);
      if (!r.ok) return this.failed(r.error);
      this.applyResults(r.body.results);
      this.apply(r.body.entitlement, key);
      return true;
    }
    const r = await this.entitlementOnly();
    if (!r.ok) return this.failed(r.error);
    this.pending.value = new Set();
    this.apply(r.body.entitlement, key);
    return true;
  }

  private failed(error: string | null): boolean {
    if (error === "RATE_LIMITED") this.notify({ key: "error.rateLimited", tone: "error" });
    if (this.retryTimer === null) {
      this.retryTimer = this.d.setTimeout(() => { this.retryTimer = null; void this.refresh(true); }, backoffMs(this.retryAttempt++));
    }
    return false;
  }

  /** Keeps PENDING purchases visible as `store.pending` (no access); everything else clears its pending chip. */
  private applyResults(results: VerifyResponseBody["results"]): void {
    const pending = new Set<string>();
    for (const r of results) if (r.result === "PENDING") pending.add(r.productId);
    this.pending.value = pending;
  }

  // ------------------------------------------------------------------ purchases (fake store)

  /**
   * §5.2 plan and pack buttons: 1. POST /api/billing/fake/purchase, 2. POST /api/billing/verify, 3. keep the token in
   * memory and localStorage, 4. send `entitlement` on the TV socket. Returns this product's verify result.
   */
  async purchase(productId: string, plan?: BasePlanId): Promise<PurchaseResult | null> {
    if (!this.fake || this.inflight.value !== null) return null;
    const key = inflightKey(productId, plan);
    this.inflight.value = key;
    this.confirmSlow.value = false;
    this.updateBusy();
    const slow = this.d.setTimeout(() => {
      if (this.inflight.value === key) {
        this.confirmSlow.value = true;
        this.notify({ key: "store.verifyFailed", tone: "info" });
      }
    }, CONFIRM_SLOW_MS);
    try {
      const installId = this.installId();
      const req = plan ? planPurchaseRequest(installId, plan, this.trialOffered) : { installId, productId };
      const bought = await this.http<FakePurchaseResponseBody>("/api/billing/fake/purchase", req);
      if (!bought.ok || typeof bought.body?.purchaseToken !== "string") {
        this.notify({ key: !bought.ok && bought.error === "RATE_LIMITED" ? "error.rateLimited" : "store.errorGeneric", tone: "error" });
        return null;
      }
      const token = bought.body.purchaseToken;
      if (productId === PREMIUM_PRODUCT_ID) {
        this.d.write(BILLING_KEYS.trialUsed, installId);
        this.trialUsed.value = true;
      }
      this.savePurchases([...this.purchases().filter((p) => p.productId !== productId), { productId, purchaseToken: token, state: "PURCHASED" }]);
      const all = this.purchases();
      const r = await this.verify(all);
      if (!r.ok) {
        this.notify({ key: r.error === "RATE_LIMITED" ? "error.rateLimited" : "store.verifyFailed", tone: r.error === "RATE_LIMITED" ? "error" : "info" });
        this.failed(r.error);
        return "UPSTREAM_ERROR";
      }
      this.applyResults(r.body.results);
      this.apply(r.body.entitlement, purchasesKey(all));
      const result = r.body.results.find((x) => x.productId === productId)?.result ?? "UPSTREAM_ERROR";
      this.notifyResult(result);
      return result;
    } finally {
      this.d.clearTimeout(slow);
      this.inflight.value = null;
      this.confirmSlow.value = false;
      this.updateBusy();
    }
  }

  private notifyResult(result: PurchaseResult): void {
    switch (result) {
      case "OK": this.notify({ key: "store.unlocked", tone: "success" }); return;
      case "PENDING": return; // the chip and `store.pendingBody` say it
      case "UPSTREAM_ERROR": this.notify({ key: "store.verifyFailed", tone: "info" }); return;
      case "INSTALL_LIMIT":
        this.notify(SUPPORT_EMAIL ? { key: "store.installLimit", params: { email: SUPPORT_EMAIL }, tone: "error" } : { key: "store.installLimitNoHelp", tone: "error" });
        return;
      default: this.notify({ key: "store.errorGeneric", tone: "error" });
    }
  }

  /** Footer "Restore purchases": re-posts every remembered purchase. */
  async restore(): Promise<void> {
    if (this.purchases().length === 0) { this.notify({ key: "store.nothingToRestore", tone: "info" }); return; }
    if (await this.refresh(true)) this.notify({ key: "store.restored", tone: "success" });
    else this.notify({ key: "store.verifyFailed", tone: "info" });
  }

  /** §5.2 test control "Expire Premium now": fake/set EXPIRED, then /entitlement, then `entitlement`. */
  async testExpirePremium(): Promise<boolean> {
    const sub = this.purchases().filter((p) => p.productId === PREMIUM_PRODUCT_ID).at(-1);
    return sub ? this.testSet(sub.purchaseToken, "SUBSCRIPTION_STATE_EXPIRED") : false;
  }

  /** §5.2 test control "Refund pack": the most recently bought pack, fake/set REVOKED. */
  async testRefundPack(): Promise<boolean> {
    const pack = this.purchases().filter((p) => packIdFromProductId(p.productId) !== null).at(-1);
    return pack ? this.testSet(pack.purchaseToken, "REVOKED") : false;
  }

  private async testSet(purchaseToken: string, state: string): Promise<boolean> {
    if (!this.fake) return false;
    const r = await this.http<null>("/api/billing/fake/set", { purchaseToken, state });
    if (!r.ok) { this.notify({ key: "store.errorGeneric", tone: "error" }); return false; }
    // Play no longer lists an expired subscription or a refunded pack.
    this.forget(purchaseToken);
    const e = await this.entitlementOnly();
    if (!e.ok) return this.failed(e.error);
    this.apply(e.body.entitlement, purchasesKey(this.purchases()));
    return true;
  }

  hasTestTarget(kind: "premium" | "pack"): boolean {
    return this.purchases().some((p) => (kind === "premium" ? p.productId === PREMIUM_PRODUCT_ID : packIdFromProductId(p.productId) !== null));
  }

  // ------------------------------------------------------------------ room link

  /** §4.3: POST /api/rooms carries the token only while it has more than 60 s left. */
  tokenForCreate(): string | null {
    return tokenForCreate(this.ent.value, this.d.now());
  }

  /** §4.3: createRoom answered `entitlement`; INVALID → refresh (which then sends the new token). */
  roomCreated(status: string | undefined): void {
    if (status === "INVALID") void this.refresh(true);
  }

  attach(link: BillingRoomLink): void {
    this.link = link;
    this.busySent = null;
    this.scheduleRefresh();
  }

  detach(): void {
    this.link = null;
    this.pendingToken = null;
    this.busySent = null;
    this.storeVisible.value = false;
    this.stopResend();
    if (this.refreshTimer !== null) { this.d.clearTimeout(this.refreshTimer); this.refreshTimer = null; }
  }

  /** After every (re)connect's first state: the queued token, and the busy flag again (§4.3). */
  roomOpened(): void {
    if (!this.link) return;
    if (this.pendingToken !== null) this.sendEntitlement(this.pendingToken);
    this.busySent = null;
    this.updateBusy();
  }

  /** §2.4 rule 3: the in-room refresh timer. */
  private scheduleRefresh(): void {
    if (this.refreshTimer !== null) { this.d.clearTimeout(this.refreshTimer); this.refreshTimer = null; }
    const body = this.ent.value;
    if (!this.link || !body || !this.fake) return;
    const now = this.d.now();
    this.refreshTimer = this.d.setTimeout(() => { this.refreshTimer = null; void this.refresh(true); }, nextRefreshAt(body, now) - now);
  }

  // ------------------------------------------------------------------ storeOpen (host busy)

  setStoreVisible(open: boolean): void {
    this.storeVisible.value = open;
    this.updateBusy();
  }

  get busy(): boolean { return this.storeVisible.value || this.inflight.value !== null; }

  /** §3.11 / §4.3: `storeOpen{open}` on every change, every 4 min while true, and after a reconnect. */
  private updateBusy(): void {
    const busy = this.busy;
    if (!this.link) return;
    if (busy !== this.busySent) {
      const ok = this.link.send({ v: PROTOCOL_VERSION, t: "storeOpen", open: busy });
      this.busySent = ok ? busy : null;
    }
    if (busy && this.resendTimer === null) {
      const tick = (): void => {
        this.resendTimer = null;
        if (!this.busy || !this.link) return;
        this.link.send({ v: PROTOCOL_VERSION, t: "storeOpen", open: true });
        this.resendTimer = this.d.setTimeout(tick, STORE_OPEN_RESEND_MS);
      };
      this.resendTimer = this.d.setTimeout(tick, STORE_OPEN_RESEND_MS);
    } else if (!busy) {
      this.stopResend();
    }
  }

  private stopResend(): void {
    if (this.resendTimer !== null) this.d.clearTimeout(this.resendTimer);
    this.resendTimer = null;
  }

  // ------------------------------------------------------------------ toasts

  /** §4.4 billing toasts: now while the Store is open or in LOBBY/RESULTS; otherwise the latest one waits. */
  notify(t: BillingToast): void {
    this.toasts.offer(t, this.link?.canToast() ?? false);
  }

  flushToasts(): void {
    this.toasts.flush(this.link?.canToast() ?? false);
  }

  get queuedToast(): BillingToast | null { return this.toasts.pending; }
}
