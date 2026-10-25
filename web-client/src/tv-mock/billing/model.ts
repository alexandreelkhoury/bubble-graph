// PAYMENTS-SPEC §2.4 / §4.4 / §5.2: the TV mock store's pure model (refresh timer, row and card states, initial focus,
// what a pack bought from a locked row does to the lobby). No I/O; unit-tested in test/billing.test.ts.
import { PREMIUM_PRODUCT_ID } from "@mishana/shared/billing/products";
import type { CatalogPackBody, CatalogResponseBody, EntitlementBody } from "@mishana/shared/billing";
import type { Locale } from "@mishana/shared/constants";
import { languageOf } from "@mishana/shared/engine";
import type { Settings } from "@mishana/shared/engine";

const MIN = 60_000;
const HOUR = 60 * MIN;

/**
 * §2.4 rule 3 (the TV's `BillingRepository.nextRefreshAt`, ported):
 * max(now + 1 min, min(expiresAt − 1 h, premiumUntil − 30 min, now + 6 h)), nulls ignored.
 */
export function nextRefreshAt(body: Pick<EntitlementBody, "expiresAt" | "premiumUntil">, nowMs: number): number {
  const terms = [body.expiresAt - HOUR, nowMs + 6 * HOUR];
  if (body.premiumUntil !== null) terms.push(body.premiumUntil - 30 * MIN);
  return Math.max(nowMs + MIN, Math.min(...terms));
}

/** §2.4: "older than 1 h" always refers to the time the token was saved. */
export const TOKEN_STALE_MS = HOUR;
export function tokenStale(savedAtMs: number | null, nowMs: number): boolean {
  return savedAtMs === null || nowMs - savedAtMs > TOKEN_STALE_MS;
}

/** §4.3: a token is sent with POST /api/rooms only while it has more than 60 s to live. */
export function tokenForCreate(body: Pick<EntitlementBody, "token" | "expiresAt"> | null, nowMs: number): string | null {
  return body && body.expiresAt > nowMs + 60_000 ? body.token : null;
}

/** Synthetic prices of the fake store (the TV's debug FakeBillingGateway uses the same ones, §4.8). Never on a phone. */
export const FAKE_PRICES = { premium: "$7.99", pack: "$1.99" } as const;

/** §4.4 Premium card, one of: the unlock button, or "Premium is active" (lifetime, nothing to manage). */
export type PremiumCard = "unlock" | "premium";
export function premiumCard(body: Pick<EntitlementBody, "premium"> | null): PremiumCard {
  return body?.premium ? "premium" : "unlock";
}

/** §4.4 pack card trailing state, exactly one of. */
export type PackState = "owned" | "included" | "pending" | "buy";
export function packState(packId: string, productId: string, body: Pick<EntitlementBody, "premium" | "packs"> | null, pending: ReadonlySet<string>): PackState {
  if (body?.packs.includes(packId)) return "owned";
  if (body?.premium) return "included";
  if (pending.has(productId)) return "pending";
  return "buy";
}

/** §4.4 entry: what opened the Store and which product it should focus. */
export type StoreOrigin = "LOBBY_BUTTON" | "LOCKED_PACK" | "LOCKED_SETTING";
export interface StoreEntry { focusProductId: string | null; origin: StoreOrigin }

/** The store's state machine (§4.4); the mock has no Play client, so its only failure is the network one. */
export type StorePhase = { kind: "loading" } | { kind: "ready" } | { kind: "unavailable" } | { kind: "google" };

/** Focus targets, as `data-focus` ids on the store's controls. */
export type FocusId = "unlock" | `pack:${string}` | "restore" | "retry" | "ok";

/** §4.4 initial focus: "premium" → the unlock button (once Premium is active: the first pack, else Restore); a pack product → that card; null → like premium. */
export function initialFocus(entry: StoreEntry, phase: StorePhase, card: PremiumCard, packProductIds: readonly string[]): FocusId {
  if (phase.kind === "unavailable") return "retry";
  if (phase.kind === "google") return "ok";
  const f = entry.focusProductId;
  if (f && f !== PREMIUM_PRODUCT_ID && packProductIds.includes(f)) return `pack:${f}`;
  if (card === "unlock") return "unlock";
  return packProductIds[0] ? `pack:${packProductIds[0]}` : "restore";
}

/** §4.4 packs row: the room's word language first, then the others (after the "Other languages" divider). */
export function splitPacks(packs: readonly CatalogPackBody[], wordLocale: Locale): { mine: CatalogPackBody[]; other: CatalogPackBody[] } {
  const mine: CatalogPackBody[] = [];
  const other: CatalogPackBody[] = [];
  for (const p of packs) (languageOf(p.locale) === wordLocale ? mine : other).push(p);
  return { mine, other };
}

/** `store.premiumPitch` params: {count} premium packs, {pairs} their pairs rounded down to a multiple of 10. */
export function pitchParams(catalog: Pick<CatalogResponseBody, "packs">): { count: number; pairs: number } {
  const pairs = catalog.packs.reduce((n, p) => n + p.pairCount, 0);
  return { count: catalog.packs.length, pairs: Math.floor(pairs / 10) * 10 };
}

/**
 * §4.4 after a pack bought from a locked row: add it to a non-empty pack filter of the same language; for another
 * language only say how to play it; with "all packs" ([]) nothing changes (it is already in the pool).
 */
export type AfterPack = { kind: "add"; packIds: string[] } | { kind: "switch"; lang: Locale } | { kind: "none" };
export function afterPackPurchase(settings: Pick<Settings, "packIds" | "wordLocale">, inLobby: boolean, packId: string, packLocale: string): AfterPack {
  const lang = languageOf(packLocale);
  if (lang !== settings.wordLocale) return { kind: "switch", lang };
  if (!inLobby || settings.packIds.length === 0 || settings.packIds.includes(packId)) return { kind: "none" };
  return { kind: "add", packIds: [...settings.packIds, packId] };
}

/** §2.4 rule 1: the restore fingerprint; a change posts to /verify at once, else only a stale token refreshes. */
export function purchasesKey(purchases: readonly { productId: string; purchaseToken: string; state: string }[]): string {
  return purchases.map((p) => `${p.productId}|${p.purchaseToken}|${p.state}`).sort().join(",");
}

/** §4.4 billing toasts: shown at once only while the Store is open or in LOBBY/RESULTS, else the latest one waits. */
export class ToastGate<T> {
  private queued: T | null = null;
  constructor(private readonly show: (item: T) => void) {}
  offer(item: T, canShow: boolean): void {
    if (canShow) this.show(item);
    else this.queued = item;
  }
  flush(canShow: boolean): void {
    if (!canShow || this.queued === null) return;
    const q = this.queued;
    this.queued = null;
    this.show(q);
  }
  get pending(): T | null { return this.queued; }
}

/** §2.4 failure backoff: 1 s doubling, capped at 10 min. */
export function backoffMs(attempt: number): number {
  return Math.min(10 * MIN, 1000 * 2 ** Math.max(0, attempt));
}
