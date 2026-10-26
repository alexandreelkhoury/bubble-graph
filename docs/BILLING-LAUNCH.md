# Billing launch runbook: production from `prod-rules-v2` to `main`

Production (`https://play.mishana.workers.dev`, Worker `play`) runs the branch `prod-rules-v2`, which has no billing code. `main` adds Play Billing ([PAYMENTS-SPEC.md](PAYMENTS-SPEC.md)) behind one switch, the `BILLING_ENABLED` var (`server/wrangler.jsonc`, default `"0"`). The plan is: **deploy `main` with billing switched off first** (it behaves like today's production), then switch billing on once Play Console is ready.

Everything below is run by the owner. Agents never deploy, set secrets or touch Play Console.

## What deploying `main` changes (once, cannot be undone)

| Change | Effect |
|---|---|
| DO migration `v2` (`new_sqlite_classes: ["Billing"]`) | Creates the `Billing` Durable Object class (purchases, bindings, grants). **This is permanent.** From now on every deployed version must export `Billing` with the same binding. Removing it needs a `deleted_classes` migration, which deletes all purchase data. |
| Rate limits `BILLING_LIMITER` (`1003`), `RTDN_LIMITER` (`1004`) | New namespaces. Keep them unique in the account (1001 and 1002 are already in use by this Worker). |
| Crons `23 * * * *`, `17 3 * * *` | Ack retries, voided purchases, pruning. They do nothing while `BILLING_ENABLED` is `"0"`. |
| Billing secrets `PLAY_SERVICE_ACCOUNT_JSON`, `ENTITLEMENT_KEYS` | Not needed while billing is off. With `BILLING_ENABLED` `"1"`, `check-deploy.mjs` refuses to deploy until both exist (it checks `wrangler secret list`, names only). |
| `GET /api/config` → `{"billing":false}` | Every client (TV 1.0.0, phone, `/tv`) hides premium UI while it is false. |

Live rooms: the deploy restarts the Room DOs. Stored room state is compatible (the new fields are optional on disk), but deploy at a quiet hour anyway.

## Phase 1: deploy `main` dark (`BILLING_ENABLED` "0")

No prerequisites: with billing off, no secret is needed.

```sh
cd ~/bubble-graph && git checkout main && git pull --rebase --autostash && pnpm install
pnpm typecheck && pnpm lint && pnpm test                     # all green before a deploy

# Deploy (always `pnpm run deploy`, never bare `pnpm deploy`)
pnpm run deploy        # build + pack-lint --release + check-deploy + wrangler deploy

# Smoke test
curl -s https://play.mishana.workers.dev/healthz             # {"ok":true,…}
curl -s https://play.mishana.workers.dev/api/config          # {"billing":false}
```

Then play one game with the TV app and two phones. Every pack is playable and no premium UI is shown.

## Phase 2: Play Console and Google Cloud (while the closed test runs)

1. Upload the AAB (versionCode 3, 1.0.0) to Internal or Closed testing. Products can only be created after a build that contains the Billing library has been uploaded.
2. **Products** ([PAYMENTS-SPEC §8.B.5–6](PAYMENTS-SPEC.md#8-owner-setup-checklist-exact-steps)). Use exactly these ids, because the code depends on them:
   **Every product is a one-time in-app product** (Monetize → Products → **One-time products**). There is **no subscription**: do not create one.
   - `premium`: lifetime Premium (non-consumable, one purchase option, "Buy"). Recommended price **$7.99**. Launch promo **$5.99**: set it as a sale / temporary price change in Play Console (no code involved), then end it to return to $7.99. **Activate** it.
   - one one-time product per pack row of `pnpm --silent --filter @mishana/server billing:products` (19 packs today, Spanish included: `pack_en_food_01` … `pack_lb_life_01`), each with one purchase option. Recommended **$1.99**, **$2.99** for the big packs (the script prints the suggestion). **Activate** each one.
   - Prices are yours to set and can change at any time in Play Console (use per-country pricing; about 40% lower in Lebanon/ME). The code never contains a price.
3. **License testing:** Settings → License testing → add your own Gmail and every tester's Gmail (see the release checklist).
4. **Service account:** Users and permissions → invite `play-api@<project>.iam.gserviceaccount.com` with **View app information** and **View financial data** only.
5. **RTDN** ([§8.C](PAYMENTS-SPEC.md#8-owner-setup-checklist-exact-steps)): create the `play-rtdn` topic, the `rtdn-push` service account, and the push subscription to `https://play.mishana.workers.dev/api/billing/rtdn`. Then fill the three vars in `server/wrangler.jsonc`:
   `RTDN_AUDIENCE` = `https://play.mishana.workers.dev/api/billing/rtdn`, `RTDN_SA_EMAIL` = `rtdn-push@<project>.iam.gserviceaccount.com`, `RTDN_SUBSCRIPTION` = `projects/<project>/subscriptions/play-rtdn-push`.
6. **Secrets** (`secret put` on the live Worker is harmless while billing is off):
   ```sh
   pnpm --filter @mishana/server gen:entitlement-key            # prints {"kid":"k1","x":"…","d":"…"}
   cd server
   npx wrangler secret put ENTITLEMENT_KEYS                     # paste {"active":"k1","keys":[ <that object> ]}
   npx wrangler secret put PLAY_SERVICE_ACCOUNT_JSON < ../play-api.json   # key from §8.C; then delete play-api.json
   openssl rand -hex 32 | tee /dev/tty | npx wrangler secret put ADMIN_TOKEN   # for owner grants
   npx wrangler secret list                                     # the three names
   ```
   Save `ENTITLEMENT_KEYS` and `ADMIN_TOKEN` in your password manager.
7. `SUPPORT_EMAIL` is set to `alexkhoury@hotmail.com` in `shared/src/billing/products.ts` **and** `tv-app/.../billing/Products.kt` (the Store's help line). Use the same address as the Play listing; change both together.

## Phase 3: switch billing on

```sh
# in server/wrangler.jsonc: "BILLING_ENABLED": "1" (plus the RTDN vars from phase 2); commit it on main, then:
pnpm run deploy        # check-deploy fails if a billing secret is missing; warns if the RTDN vars are empty
curl -s https://play.mishana.workers.dev/api/config          # {"billing":true}
```

1. Play Console → Monetization setup → Real-time developer notifications → topic `projects/<project>/topics/play-rtdn` → **Send test message**. The Worker logs show `{"code":"RTDN_TEST"}`.
2. **Owner access** (right after the switch): see [DEV.md → Owner: free Premium on every device](DEV.md#owner-free-premium--every-pack-on-every-device). The install id only appears in Settings → About once billing is on.
3. Run the end-to-end test in [PAYMENTS-SPEC §8.E](PAYMENTS-SPEC.md#8-owner-setup-checklist-exact-steps) with a license-tester account (premium, pack, pending, refund, restore).
4. Set up alerts on `BILLING_ACK_OVERDUE`, `BILLING_ACK_REJECTED`, `BILLING_AUTH`, `BILLING_BUDGET`, `RTDN_AUTH` and `RTDN_UNEXPECTED` (a subscription notification: there should be none) (§8.D).

Note: `BILLING_ENABLED` covers the whole Worker. Once it is `"1"`, every free room (the browser `/tv` and sideloaded TVs included) plays only the starter packs. The browser `/tv` shows "TV app only" in its store.

## Rollback

- **Normal rollback (recommended): switch billing off.** Set `"BILLING_ENABLED": "0"`, then run `pnpm run deploy`. Every room plays the whole catalog again, the store disappears, and purchases and grants stay stored in the Billing DO, so switching back on later restores them. Editing the var in the dashboard works too, but the next `pnpm run deploy` overwrites it with the value in `wrangler.jsonc`.
- **Previous `main` version:** `cd server && npx wrangler deployments list`, then `npx wrangler rollback <version-id>`. This is fine between versions that all contain the Billing class.
- **Back to `prod-rules-v2` code: do not deploy that branch as it is.** Its `wrangler.jsonc` has no `Billing` class, and Cloudflare refuses a version that drops a class that existing Durable Objects depend on [VERIFY the exact error; `wrangler rollback` across the v2 migration is probably refused for the same reason]. If you ever need the old code, build a hotfix branch from `prod-rules-v2` that keeps `main`'s `durable_objects`, `migrations` and the `Billing` export. In practice, `BILLING_ENABLED` "0" on `main` already gives the old behaviour.
- **Key leak:** a leaked `ENTITLEMENT_KEYS` means you rotate it (DEV.md → Secrets). A leaked `ADMIN_TOKEN` means you run `npx wrangler secret put ADMIN_TOKEN` with a new value (or `secret delete`), then `pnpm grant list` and revoke anything unknown.
