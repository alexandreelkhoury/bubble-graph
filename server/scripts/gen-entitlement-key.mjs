#!/usr/bin/env node
// PAYMENTS-SPEC §2.3: prints a new Ed25519 entitlement key as {"kid","x","d"} (Node WebCrypto). Usage:
//   pnpm --filter @mishana/server gen:entitlement-key [-- --kid k2]
// Add it to the ENTITLEMENT_KEYS secret ({"active":"<kid>","keys":[...]}). Never commit the output.
import { webcrypto } from "node:crypto";

const args = process.argv.slice(2).filter((a) => a !== "--");
const i = args.indexOf("--kid");
const kid = i >= 0 ? args[i + 1] : "k1";
if (!kid || !/^[a-z0-9]{1,16}$/.test(kid) || kid === "fake") {
  console.error("gen-entitlement-key: --kid must match ^[a-z0-9]{1,16}$ and must not be \"fake\"");
  process.exit(1);
}
const pair = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const jwk = await webcrypto.subtle.exportKey("jwk", pair.privateKey);
console.log(JSON.stringify({ kid, x: jwk.x, d: jwk.d }));
