// PAYMENTS-SPEC §3.5: the `Billing` Durable Object, a single instance (`env.BILLING.getByName("global")`). A thin RPC
// adapter over BillingCore: SQLite storage, synchronous SQL inside `transactionSync`.
import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";
import { BillingCore, storeFromCore } from "./billing-core";
import type { ApplyInput, ApplyResult, BillingStore, BindResult, Entitlement, Grant, PendingAck, PurchaseRow } from "./billing-core";
import { billingPacks } from "./catalog-info";

export class Billing extends DurableObject<Env> implements BillingStore {
  readonly #s: BillingStore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const storage = ctx.storage;
    const core = new BillingCore({ sql: storage.sql, transactionSync: (fn) => storage.transactionSync(fn) }, billingPacks().premiumIds);
    this.#s = storeFromCore(core);
  }

  rateCheck(installHash: string, kind: "verify" | "entitlement", nowMs: number): Promise<boolean> { return this.#s.rateCheck(installHash, kind, nowMs); }
  googleBudget(n: number, nowMs: number): Promise<number> { return this.#s.googleBudget(n, nowMs); }
  ipReadCheck(ipKey: string, nowMs: number): Promise<boolean> { return this.#s.ipReadCheck(ipKey, nowMs); }
  installNetSeen(installHash: string, netKey: string, nowMs: number): Promise<number> { return this.#s.installNetSeen(installHash, netKey, nowMs); }
  lookup(tokenHash: string, kind: "sub" | "pack", nowMs: number): Promise<{ invalid: boolean; row: PurchaseRow | null }> { return this.#s.lookup(tokenHash, kind, nowMs); }
  markInvalid(tokenHash: string, kind: "sub" | "pack", nowMs: number): Promise<void> { return this.#s.markInvalid(tokenHash, kind, nowMs); }
  applyPurchase(i: ApplyInput): Promise<ApplyResult> { return this.#s.applyPurchase(i); }
  bindOnly(a: { tokenHash: string; callerInstallHash: string; nowMs: number }): Promise<BindResult> { return this.#s.bindOnly(a); }
  markAcked(tokenHash: string): Promise<void> { return this.#s.markAcked(tokenHash); }
  entitlementFor(installHash: string, nowMs: number): Promise<Entitlement> { return this.#s.entitlementFor(installHash, nowMs); }
  kindOf(tokenHash: string): Promise<"sub" | "pack" | null> { return this.#s.kindOf(tokenHash); }
  markRevoked(tokenHash: string, nowMs: number): Promise<void> { return this.#s.markRevoked(tokenHash, nowMs); }
  rtdnSeen(messageId: string): Promise<boolean> { return this.#s.rtdnSeen(messageId); }
  rtdnMark(messageId: string, nowMs: number): Promise<void> { return this.#s.rtdnMark(messageId, nowMs); }
  pendingAcks(nowMs: number): Promise<PendingAck[]> { return this.#s.pendingAcks(nowMs); }
  staleSubs(nowMs: number): Promise<number> { return this.#s.staleSubs(nowMs); }
  cursorGet(): Promise<number | null> { return this.#s.cursorGet(); }
  cursorSet(ms: number): Promise<void> { return this.#s.cursorSet(ms); }
  prune(nowMs: number): Promise<void> { return this.#s.prune(nowMs); }
  fakeGet(token: string): Promise<string | null> { return this.#s.fakeGet(token); }
  fakePut(token: string, json: string): Promise<void> { return this.#s.fakePut(token, json); }
  fakeNext(): Promise<number> { return this.#s.fakeNext(); }
  grantPut(g: Grant): Promise<void> { return this.#s.grantPut(g); }
  grantDelete(installHash: string): Promise<boolean> { return this.#s.grantDelete(installHash); }
  grantList(): Promise<Grant[]> { return this.#s.grantList(); }
}
