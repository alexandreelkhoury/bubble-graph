// PAYMENTS-SPEC §2.3 / §7.2: entitlement token sign/verify.
import { describe, expect, it } from "vitest";
import { ENTITLEMENT_TTL_S } from "@mishana/shared/constants";
import {
  b64urlDecode, b64urlEncode, buildClaims, importFakeSigner, importSigner, importVerifyKeys, parseKeyring, signEntitlementToken,
  verifyEntitlementToken,
} from "../../src/billing/token";
import type { EntitlementClaims, Signer } from "../../src/billing/token";

const NOW = 1_790_000_000_000;
const SUB = "ab".repeat(32);
const PREMIUM = new Set(["en-food-01", "lb-food-01", "fr-food-01"]);
const enc = new TextEncoder();
const seg = (o: unknown): string => b64urlEncode(enc.encode(typeof o === "string" ? o : JSON.stringify(o)));

async function newKey(kid: string): Promise<{ kid: string; x: string; d: string }> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  return { kid, x: jwk.x as string, d: jwk.d as string };
}

async function setup() {
  const k1 = await newKey("k1");
  const ring = parseKeyring(JSON.stringify({ active: "k1", keys: [k1] }));
  if (!ring) throw new Error("ring");
  const signer = await importSigner(ring);
  const keys = await importVerifyKeys(ring);
  return { k1, ring, signer, keys };
}

/** Signs arbitrary header/payload text (to build malformed-but-signed tokens). */
async function signRaw(signer: Signer, header: string, payload: string): Promise<string> {
  const h = seg(header);
  const p = seg(payload);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, signer.key, enc.encode(`${h}.${p}`)));
  return `${h}.${p}.${b64urlEncode(sig)}`;
}
const goodClaims = (over: Partial<EntitlementClaims> = {}): EntitlementClaims => ({ ...buildClaims(SUB, NOW, NOW + 86_400_000, ["en-food-01"], "google"), ...over });
const payloadText = (c: EntitlementClaims): string => JSON.stringify({ iss: c.iss, v: c.v, sub: c.sub, iat: c.iat, exp: c.exp, pu: c.pu, packs: c.packs, mode: c.mode });
const HEADER = JSON.stringify({ alg: "EdDSA", typ: "JWT", kid: "k1" });

describe("entitlement token", () => {
  it("sign → verify round trip (ms output, unknown packs dropped)", async () => {
    const { signer, keys } = await setup();
    const t = await signEntitlementToken(buildClaims(SUB, NOW, NOW + 86_400_000, ["lb-food-01", "en-food-01", "gone-01"], "google"), signer);
    const e = await verifyEntitlementToken(t, keys, NOW, false, PREMIUM);
    expect(e).toEqual({ sub: SUB, iatMs: Math.floor(NOW / 1000) * 1000, expMs: (Math.floor(NOW / 1000) + ENTITLEMENT_TTL_S) * 1000, premiumUntilMs: NOW + 86_400_000, packs: ["en-food-01", "lb-food-01"], mode: "google" });
    expect(t.length).toBeLessThan(3000);
  });

  it("rejects wrong kid, alg or typ, and extra header claims", async () => {
    const { signer, keys } = await setup();
    const p = payloadText(goodClaims());
    for (const h of [
      JSON.stringify({ alg: "EdDSA", typ: "JWT", kid: "k9" }),
      JSON.stringify({ alg: "ES256", typ: "JWT", kid: "k1" }),
      JSON.stringify({ alg: "EdDSA", typ: "JWS", kid: "k1" }),
      JSON.stringify({ alg: "EdDSA", typ: "JWT", kid: "k1", x: 1 }),
      JSON.stringify({ typ: "JWT", alg: "EdDSA", kid: "k1" }),
    ]) {
      expect(await verifyEntitlementToken(await signRaw(signer, h, p), keys, NOW, false, PREMIUM), h).toBeNull();
    }
    expect(await verifyEntitlementToken(await signRaw(signer, HEADER, p), keys, NOW, false, PREMIUM)).not.toBeNull();
  });

  it("rejects extra, duplicate or reordered payload claims and bad types", async () => {
    const { signer, keys } = await setup();
    const c = goodClaims();
    const good = payloadText(c);
    const bad = [
      good.replace('"mode":"google"', '"mode":"google","x":1'),
      good.replace('"iss":"mish-ana"', '"iss":"mish-ana","iss":"mish-ana"'),
      JSON.stringify({ v: c.v, iss: c.iss, sub: c.sub, iat: c.iat, exp: c.exp, pu: c.pu, packs: c.packs, mode: c.mode }),
      good.replace(`"pu":${c.pu}`, `"pu":"${c.pu}"`),
      good.replace(`"pu":${c.pu}`, `"pu":${c.pu}.5`),
      payloadText(goodClaims({ exp: c.iat + ENTITLEMENT_TTL_S + 1 })),
      payloadText(goodClaims({ exp: c.iat })),
      payloadText(goodClaims({ packs: ["lb-food-01", "en-food-01"] })),
      payloadText(goodClaims({ packs: ["en-food-01", "en-food-01"] })),
      payloadText(goodClaims({ packs: Array.from({ length: 65 }, (_, i) => `p-${String(i).padStart(3, "0")}`) })),
      payloadText(goodClaims({ sub: "XY".repeat(32) })),
    ];
    for (const p of bad) expect(await verifyEntitlementToken(await signRaw(signer, HEADER, p), keys, NOW, false, PREMIUM), p).toBeNull();
  });

  it("rejects non-canonical base64url (padding, +/, trailing bits) and tampering", async () => {
    const { signer, keys } = await setup();
    const t = await signEntitlementToken(goodClaims(), signer);
    const [h, p, s] = t.split(".") as [string, string, string];
    expect(await verifyEntitlementToken(`${h}=.${p}.${s}`, keys, NOW, false, PREMIUM)).toBeNull();
    expect(await verifyEntitlementToken(`${h}.${p}.${s.replace(/-/g, "+").replace(/_/g, "/")}x`, keys, NOW, false, PREMIUM)).toBeNull();
    // Same bytes, different last char (non-zero trailing bits): decodes to the same signature, still rejected.
    const last = s[s.length - 1] as string;
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const alt = alphabet[alphabet.indexOf(last) + 1] as string;
    expect(b64urlDecode(s.slice(0, -1) + alt)).toBeNull();
    expect(await verifyEntitlementToken(`${h}.${p}.${s.slice(0, -1)}${alt}`, keys, NOW, false, PREMIUM)).toBeNull();
    const tamperedPayload = seg(payloadText(goodClaims({ pu: (goodClaims().pu as number) + 1 })));
    expect(await verifyEntitlementToken(`${h}.${tamperedPayload}.${s}`, keys, NOW, false, PREMIUM)).toBeNull();
    const sigBytes = b64urlDecode(s) as Uint8Array;
    sigBytes[0] = (sigBytes[0] as number) ^ 1;
    expect(await verifyEntitlementToken(`${h}.${p}.${b64urlEncode(sigBytes)}`, keys, NOW, false, PREMIUM)).toBeNull();
    expect(await verifyEntitlementToken(`${h}.${p}`, keys, NOW, false, PREMIUM)).toBeNull();
  });

  it("time rules: exp past, iat more than 300 s in the future; length > 3000", async () => {
    const { signer, keys } = await setup();
    const t = await signEntitlementToken(goodClaims(), signer);
    expect(await verifyEntitlementToken(t, keys, NOW + ENTITLEMENT_TTL_S * 1000 + 1000, false, PREMIUM)).toBeNull();
    expect(await verifyEntitlementToken(t, keys, NOW - 299_000, false, PREMIUM)).not.toBeNull();
    expect(await verifyEntitlementToken(t, keys, NOW - 302_000, false, PREMIUM)).toBeNull();
    expect(await verifyEntitlementToken("a".repeat(3001), keys, NOW, false, PREMIUM)).toBeNull();
  });

  it("kid fake / mode fake only in fake mode; the real kid with mode fake is rejected", async () => {
    const { signer, keys } = await setup();
    const fake = await importFakeSigner();
    const ft = await signEntitlementToken(buildClaims(SUB, NOW, NOW + 1000_000, [], "fake"), fake);
    expect(await verifyEntitlementToken(ft, keys, NOW, false, PREMIUM)).toBeNull();
    expect((await verifyEntitlementToken(ft, keys, NOW, true, PREMIUM))?.mode).toBe("fake");
    const mixed = await signEntitlementToken(buildClaims(SUB, NOW, null, [], "fake"), signer);
    expect(await verifyEntitlementToken(mixed, keys, NOW, true, PREMIUM)).toBeNull();
    const fakeKidGoogleMode = await signEntitlementToken(buildClaims(SUB, NOW, null, [], "google"), fake);
    expect(await verifyEntitlementToken(fakeKidGoogleMode, keys, NOW, true, PREMIUM)).toBeNull();
  });

  it("keyring: non-Ed25519 JWKs, duplicate or reserved kids, and an active key without d are rejected at parse time", async () => {
    const k = await newKey("k1");
    expect(parseKeyring(JSON.stringify({ active: "k1", keys: [{ ...k, kty: "RSA" }] }))).toBeNull();
    expect(parseKeyring(JSON.stringify({ active: "k1", keys: [{ ...k, kty: "EC", crv: "P-256" }] }))).toBeNull();
    expect(parseKeyring(JSON.stringify({ active: "k1", keys: [{ kid: "k1", kty: "RSA", n: "abc", e: "AQAB" }] }))).toBeNull();
    expect(parseKeyring(JSON.stringify({ active: "k1", keys: [{ ...k, kty: "OKP", crv: "X25519" }] }))).toBeNull();
    expect(parseKeyring(JSON.stringify({ active: "k1", keys: [{ ...k, kty: "OKP", crv: "Ed25519" }] }))).not.toBeNull();
    expect(parseKeyring(JSON.stringify({ active: "k1", keys: [k, k] }))).toBeNull();
    expect(parseKeyring(JSON.stringify({ active: "fake", keys: [{ ...k, kid: "fake" }] }))).toBeNull();
    expect(parseKeyring(JSON.stringify({ active: "k1", keys: [{ kid: "k1", x: k.x }] }))).toBeNull();
    expect(parseKeyring("not json")).toBeNull();
    expect(parseKeyring(undefined)).toBeNull();
    const pub = parseKeyring(JSON.stringify({ active: "k1", keys: [k] }), { publicOnly: true });
    expect(pub?.keys).toEqual([{ kid: "k1", x: k.x }]);
  });

  it("rotation: verify the old kid without d, sign with the new one", async () => {
    const k1 = await newKey("k1");
    const k2 = await newKey("k2");
    const oldRing = parseKeyring(JSON.stringify({ active: "k1", keys: [k1] }));
    const oldToken = await signEntitlementToken(goodClaims(), await importSigner(oldRing!));
    const ring = parseKeyring(JSON.stringify({ active: "k2", keys: [{ kid: "k1", x: k1.x }, k2] }));
    expect(ring).not.toBeNull();
    const keys = await importVerifyKeys(ring);
    expect(await verifyEntitlementToken(oldToken, keys, NOW, false, PREMIUM)).not.toBeNull();
    const signer = await importSigner(ring!);
    expect(signer.kid).toBe("k2");
    const newToken = await signEntitlementToken(goodClaims(), signer);
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(newToken.split(".")[0] as string)!))).toEqual({ alg: "EdDSA", typ: "JWT", kid: "k2" });
    expect(await verifyEntitlementToken(newToken, keys, NOW, false, PREMIUM)).not.toBeNull();
  });
});
