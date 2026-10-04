// PAYMENTS-SPEC §2.3: the entitlement token, a compact Ed25519 JWS. Signed only by the Worker's billing routes,
// verified by the Worker (createRoom) and the Room DO (WS `entitlement`). Clients never parse it.
import * as z from "zod";
import { ENTITLEMENT_TOKEN_MAX_CHARS, ENTITLEMENT_TTL_S, MAX_TOKEN_PACKS } from "@mishana/shared/constants";
import { FAKE_ENTITLEMENT_KEY } from "./fake-key";

/** The verified claims, in milliseconds (what a room stores as `meta.entitlement`). */
export interface RoomEntitlement { sub: string; iatMs: number; expMs: number; premiumUntilMs: number | null; packs: string[]; mode: "google" | "fake" }

/** The claims the signer writes (JWT time claims in seconds). */
export interface EntitlementClaims { iss: "mish-ana"; v: 1; sub: string; iat: number; exp: number; pu: number | null; packs: string[]; mode: "google" | "fake" }

export const ENTITLEMENT_ISSUER = "mish-ana";
export const KID_REGEX = /^[a-z0-9]{1,16}$/;
export const FAKE_KID = "fake";
/** Future `iat` tolerated (§2.3 step 6). */
export const IAT_SKEW_S = 300;

// ------------------------------------------------------------------ base64url (no padding, canonical)

const B64URL_RE = /^[A-Za-z0-9_-]+$/;

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Strict decode: only the URL alphabet, no padding, and the re-encoding must equal the input (no stray trailing bits). */
export function b64urlDecode(s: string): Uint8Array | null {
  if (!B64URL_RE.test(s) || s.length % 4 === 1) return null;
  let bin: string;
  try {
    bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  } catch {
    return null;
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return b64urlEncode(out) === s ? out : null;
}

const utf8 = new TextEncoder();
function decodeJsonSegment(seg: string): { text: string; value: unknown } | null {
  const bytes = b64urlDecode(seg);
  if (!bytes) return null;
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
    return { text, value: JSON.parse(text) as unknown };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ keyring (ENTITLEMENT_KEYS)

export interface KeyEntry { kid: string; x: string; d?: string }
export interface Keyring { active: string; keys: KeyEntry[] }

const Ed25519Part = z.string().regex(/^[A-Za-z0-9_-]{43}$/); // 32 bytes, base64url without padding
const KeyEntrySchema = z.object({
  kid: z.string().regex(KID_REGEX),
  kty: z.literal("OKP").optional(),
  crv: z.literal("Ed25519").optional(),
  x: Ed25519Part,
  d: Ed25519Part.optional(),
});
const KeyringSchema = z.object({ active: z.string().regex(KID_REGEX), keys: z.array(KeyEntrySchema).min(1).max(16) });

/**
 * Parses the ENTITLEMENT_KEYS secret. Every entry must be an Ed25519 OKP key (`kty`/`crv`, when given, must say so;
 * an RSA or EC JWK is rejected here), kids are unique and never "fake", and the active kid has its private half.
 */
export function parseKeyring(json: string | undefined, opts: { publicOnly?: boolean } = {}): Keyring | null {
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const r = KeyringSchema.safeParse(raw);
  if (!r.success) return null;
  const kids = new Set<string>();
  for (const k of r.data.keys) {
    if (k.kid === FAKE_KID || kids.has(k.kid)) return null;
    if (b64urlDecode(k.x)?.length !== 32 || (k.d !== undefined && b64urlDecode(k.d)?.length !== 32)) return null;
    kids.add(k.kid);
  }
  const active = r.data.keys.find((k) => k.kid === r.data.active);
  if (!active || active.d === undefined) return null;
  // publicOnly: the verify-only view (Room DO, createRoom): every private half is dropped here.
  if (opts.publicOnly) return { active: r.data.active, keys: r.data.keys.map((k) => ({ kid: k.kid, x: k.x })) };
  return { active: r.data.active, keys: r.data.keys.map((k) => (k.d === undefined ? { kid: k.kid, x: k.x } : { kid: k.kid, x: k.x, d: k.d })) };
}

// Verify keys per isolate, keyed by the secret's value (rotation = a new deploy with a new value).
let verifyCache: { json: string; keys: Promise<Map<string, CryptoKey>> } | null = null;
/** Public Ed25519 verify keys from ENTITLEMENT_KEYS (empty map when unset or invalid: every token is then invalid). */
export function verifyKeysFromSecret(json: string | undefined): Promise<Map<string, CryptoKey>> {
  const j = json ?? "";
  if (verifyCache?.json === j) return verifyCache.keys;
  verifyCache = { json: j, keys: importVerifyKeys(parseKeyring(j, { publicOnly: true })) };
  return verifyCache.keys;
}

/** Public verify keys only (every `d` is dropped): what the Room DO receives. */
export async function importVerifyKeys(ring: Keyring | null): Promise<Map<string, CryptoKey>> {
  const out = new Map<string, CryptoKey>();
  if (!ring) return out;
  for (const k of ring.keys) {
    out.set(k.kid, await crypto.subtle.importKey("jwk", { kty: "OKP", crv: "Ed25519", x: k.x }, { name: "Ed25519" }, false, ["verify"]));
  }
  return out;
}

export interface Signer { kid: string; key: CryptoKey; mode: "google" | "fake" }

export async function importSigner(ring: Keyring): Promise<Signer> {
  const k = ring.keys.find((e) => e.kid === ring.active) as KeyEntry;
  const key = await crypto.subtle.importKey("jwk", { kty: "OKP", crv: "Ed25519", x: k.x, d: k.d }, { name: "Ed25519" }, false, ["sign"]);
  return { kid: k.kid, key, mode: "google" };
}

let fakeSigner: Promise<Signer> | null = null;
let fakeVerifier: Promise<CryptoKey> | null = null;
/** The public dev key (kid "fake"); only fake mode signs with it. */
export function importFakeSigner(): Promise<Signer> {
  return (fakeSigner ??= crypto.subtle
    .importKey("jwk", { kty: "OKP", crv: "Ed25519", x: FAKE_ENTITLEMENT_KEY.x, d: FAKE_ENTITLEMENT_KEY.d }, { name: "Ed25519" }, false, ["sign"])
    .then((key) => ({ kid: FAKE_KID, key, mode: "fake" as const })));
}
function fakeVerifyKey(): Promise<CryptoKey> {
  return (fakeVerifier ??= crypto.subtle.importKey("jwk", { kty: "OKP", crv: "Ed25519", x: FAKE_ENTITLEMENT_KEY.x }, { name: "Ed25519" }, false, ["verify"]));
}

// ------------------------------------------------------------------ sign

/** Canonical serialisations: the signer always writes exactly these, and the verifier requires byte equality. */
function headerJson(kid: string): string {
  return JSON.stringify({ alg: "EdDSA", typ: "JWT", kid });
}
function payloadJson(c: EntitlementClaims): string {
  return JSON.stringify({ iss: c.iss, v: c.v, sub: c.sub, iat: c.iat, exp: c.exp, pu: c.pu, packs: c.packs, mode: c.mode });
}

/** Builds the claims for an install at `nowMs` (packs sorted, unique, capped). */
export function buildClaims(sub: string, nowMs: number, premiumUntilMs: number | null, packs: readonly string[], mode: "google" | "fake"): EntitlementClaims {
  const iat = Math.floor(nowMs / 1000);
  const sorted = [...new Set(packs)].sort().slice(0, MAX_TOKEN_PACKS);
  // `pu` is floored to seconds; a value already ≤ now never reaches here (premiumUntil is null then).
  return { iss: ENTITLEMENT_ISSUER, v: 1, sub, iat, exp: iat + ENTITLEMENT_TTL_S, pu: premiumUntilMs === null ? null : Math.floor(premiumUntilMs / 1000), packs: sorted, mode };
}

export async function signEntitlementToken(claims: EntitlementClaims, signer: Signer): Promise<string> {
  const head = b64urlEncode(utf8.encode(headerJson(signer.kid)));
  const body = b64urlEncode(utf8.encode(payloadJson(claims)));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, signer.key, utf8.encode(`${head}.${body}`)));
  return `${head}.${body}.${b64urlEncode(sig)}`;
}

// ------------------------------------------------------------------ verify

const HeaderSchema = z.strictObject({ alg: z.literal("EdDSA"), typ: z.literal("JWT"), kid: z.string().regex(KID_REGEX) });
const SafeInt = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const EntitlementClaimsSchema = z.strictObject({
  iss: z.literal(ENTITLEMENT_ISSUER), v: z.literal(1), sub: z.string().regex(/^[0-9a-f]{64}$/),
  iat: SafeInt, exp: SafeInt, pu: SafeInt.nullable(),
  packs: z.array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(64)).max(MAX_TOKEN_PACKS),
  mode: z.enum(["google", "fake"]),
});

/**
 * §2.3 verification. Returns null for anything invalid (never throws). `premiumPackIds` drops unknown pack ids
 * (step 7); `fakeActive` is true only when this request/room runs in fake mode (§3.10).
 */
export async function verifyEntitlementToken(
  token: string,
  keys: ReadonlyMap<string, CryptoKey>,
  nowMs: number,
  fakeActive: boolean,
  premiumPackIds: ReadonlySet<string>,
): Promise<RoomEntitlement | null> {
  if (typeof token !== "string" || token.length > ENTITLEMENT_TOKEN_MAX_CHARS) return null;
  const segs = token.split(".");
  if (segs.length !== 3) return null;
  const [h, p, s] = segs as [string, string, string];
  const head = decodeJsonSegment(h);
  if (!head) return null;
  const hr = HeaderSchema.safeParse(head.value);
  if (!hr.success || headerJson(hr.data.kid) !== head.text) return null;
  const kid = hr.data.kid;
  let key: CryptoKey | undefined;
  if (kid === FAKE_KID) key = fakeActive ? await fakeVerifyKey() : undefined;
  else key = keys.get(kid);
  if (!key) return null;
  const sig = b64urlDecode(s);
  if (!sig || sig.length !== 64) return null;
  let ok: boolean;
  try {
    ok = await crypto.subtle.verify({ name: "Ed25519" }, key, sig, utf8.encode(`${h}.${p}`));
  } catch {
    ok = false;
  }
  if (!ok) return null;
  const body = decodeJsonSegment(p);
  if (!body) return null;
  const cr = EntitlementClaimsSchema.safeParse(body.value);
  if (!cr.success) return null;
  const c = cr.data as EntitlementClaims;
  if (payloadJson(c) !== body.text) return null; // duplicate, reordered or extra claims
  if (!(c.exp > c.iat && c.exp - c.iat <= ENTITLEMENT_TTL_S)) return null;
  if (!c.packs.every((x, i) => i === 0 || (c.packs[i - 1] as string) < x)) return null;
  const nowS = nowMs / 1000;
  if (c.iat > nowS + IAT_SKEW_S || c.exp <= nowS) return null;
  // Mode rules: kid "fake" ⇔ mode "fake", and both only in fake mode.
  if ((kid === FAKE_KID) !== (c.mode === "fake")) return null;
  if (c.mode === "fake" && !fakeActive) return null;
  return {
    sub: c.sub, iatMs: c.iat * 1000, expMs: c.exp * 1000, premiumUntilMs: c.pu === null ? null : c.pu * 1000,
    packs: c.packs.filter((id) => premiumPackIds.has(id)), mode: c.mode,
  };
}
