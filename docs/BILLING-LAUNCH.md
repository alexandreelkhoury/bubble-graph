# Billing launch runbook: production from `prod-rules-v2` to `main`

Production (`https://play.jamaa.workers.dev`, Worker `play`) runs the branch `prod-rules-v2`, which has no billing code. `main` is the **JAMAA platform** (hub, protocol v2, [JAMAA-PLATFORM.md](JAMAA-PLATFORM.md)) and adds Play Billing ([PAYMENTS-SPEC.md](PAYMENTS-SPEC.md) revision 4: the **JAMAA Pass** subscription plus one-time packs) behind one switch, the `BILLING_ENABLED` var (`server/wrangler.jsonc`, default `"0"`). A second var, `GAMES_ENABLED` (default `"mishana"`), lists the live games. The plan is: **deploy `main` with billing switched off first** (only Mish Ana!, every pack free, like today's production), then switch billing on once Play Console is ready, then add games one by one.

> JAMAA rename (docs/JAMAA-PLATFORM.md §1.6): the URLs below assume owner step O1 (the account's workers.dev subdomain renamed to `jamaa`) is done; until then the live Worker answers on the old subdomain. The Play app is the new `app.jamaa.tv` app (step O4), so products, license testers, service-account access and RTDN are set up for it.

Everything below is run by the owner. Agents never deploy, set secrets or touch Play Console.

## What deploying `main` changes (once, cannot be undone)

| Change | Effect |
|---|---|
| DO migration `v2` (`new_sqlite_classes: ["Billing"]`) | Creates the `Billing` Durable Object class (purchases, bindings, grants). **This is permanent.** From now on every deployed version must export `Billing` with the same binding. Removing it needs a `deleted_classes` migration, which deletes all purchase data. |
| Rate limits `BILLING_LIMITER` (`1003`), `RTDN_LIMITER` (`1004`) | New namespaces. Keep them unique in the account (1001 and 1002 are already in use by this Worker). |
| Crons `23 * * * *`, `17 3 * * *` | Ack retries, voided purchases, pruning. They do nothing while `BILLING_ENABLED` is `"0"`. |
| Billing secrets `PLAY_SERVICE_ACCOUNT_JSON`, `ENTITLEMENT_KEYS` | Not needed while billing is off. With `BILLING_ENABLED` `"1"`, `check-deploy.mjs` refuses to deploy until both exist (it checks `wrangler secret list`, names only). |
| `GET /api/config` → `{"billing":false,"games":["mishana"]}` | Every client (TV, phone, `/tv`) hides the Pass UI while `billing` is false, and offers only the listed games. |
| Protocol v2 (`/healthz` → `"protocol":2`) | A clean break: only a JAMAA TV build (its `hello` declares `games`) can connect; an older TV app gets close 4002 and must be updated. The phone page is served by the Worker, so phones update with the deploy. |
| Room storage v2 | Rooms stored by `prod-rules-v2` (no `schema: 2`) are **expired** on their next wake-up (sockets get 4010, the TV creates a new room). Deploy at a quiet hour. |

## Phase 1: deploy `main` dark (`BILLING_ENABLED` "0")

No prerequisites: with billing off, no secret is needed.

```sh
cd ~/bubble-graph && git checkout main && git pull --rebase --autostash && pnpm install
pnpm typecheck && pnpm lint && pnpm test                     # all green before a deploy

# Deploy (always `pnpm run deploy`, never bare `pnpm deploy`)
pnpm run deploy        # content emit + build + size checks + content-lint --release + check-deploy + wrangler deploy

# Smoke test
curl -s https://play.jamaa.workers.dev/healthz             # {"ok":true,"app":"jamaa","protocol":2}
curl -s https://play.jamaa.workers.dev/api/config          # {"billing":false,"games":["mishana"]}
```

`content-lint --release` refuses the deploy while a free starter pack is `status: "draft"` (today the four `*-everyday-01` packs): mark them reviewed after the owner's (and the native reviewers') pass first.

Then play one game with the JAMAA TV app and two phones: hub → Mish Ana! → play → Play again → back to the hub. Every pack is playable and no Pass UI is shown.

## Phase 2: Play Console and Google Cloud (while the closed test runs)

1. Upload the AAB (versionCode 3, 1.0.0) to Internal or Closed testing. Products can only be created after a build that contains the Billing library has been uploaded.
2. **Products** ([PAYMENTS-SPEC §8.B.5–6](PAYMENTS-SPEC.md#8-owner-setup-checklist-exact-steps), JAMAA-PLATFORM §4.1). Use exactly these ids, because the code depends on them. `pnpm --silent --filter @jamaa/server billing:products` prints the full list as CSV (`productId,type,gameId,family,locales,titleEn,titleFr,titleAr,titleEs`):
   - **Subscription** (Monetize → Products → **Subscriptions**): `jamaa_pass`, title **"JAMAA Pass"**.
     - Base plan `monthly`: auto-renewing, billing period 1 month (P1M).
     - Base plan `yearly`: auto-renewing, billing period 1 year (P1Y).
     - On **each** base plan, an offer `trial-7d`: one free-trial phase of 7 days, eligibility "New customer acquisition → Never had this subscription".
     - Grace period and account hold: leave the defaults. Pause: off. Resubscribe: allowed. **Activate** both base plans and both offers.
     - Recommended starting prices (MONETIZATION.md): about **US$4.99/month** and **US$29.99/year**, roughly 40 % lower in Lebanon and the Middle East. The TV computes "Save n %" from the two prices and shows "7 days free" only when Play returns an eligible `trial-7d` offer.
   - **One-time products** (Monetize → Products → **One-time products**): one per `one-time` row of the CSV, id `pack_<family>` (one product per content family: translations share it; today the premium Mish Ana! word packs, `pack_ar_home_01` … `pack_lb_life_01`, ids unchanged), title "JAMAA – <pack title>", one purchase option `buy`, non-consumable. Recommended **$1.99** ($2.99 for the big packs). **Activate** each one.
   - Do **not** create a lifetime `premium` product on the new app (JAMAA-PLATFORM §4.6). If one was created on the old app's draft, leave it there.
   - Prices are yours to set and can change at any time in Play Console (use per-country pricing). The code never contains a price.
3. **License testing:** Settings → License testing → add your own Gmail and every tester's Gmail (see the release checklist).
4. **Service account:** Users and permissions → invite `play-api@<project>.iam.gserviceaccount.com` with **View app information** and **View financial data** only.
5. **RTDN** ([§8.C](PAYMENTS-SPEC.md#8-owner-setup-checklist-exact-steps)): create the `play-rtdn` topic, the `rtdn-push` service account, and the push subscription to `https://play.jamaa.workers.dev/api/billing/rtdn`. Then fill the three vars in `server/wrangler.jsonc`:
   `RTDN_AUDIENCE` = `https://play.jamaa.workers.dev/api/billing/rtdn`, `RTDN_SA_EMAIL` = `rtdn-push@<project>.iam.gserviceaccount.com`, `RTDN_SUBSCRIPTION` = `projects/<project>/subscriptions/play-rtdn-push`.
6. **Secrets** (`secret put` on the live Worker is harmless while billing is off):
   ```sh
   pnpm --filter @jamaa/server gen:entitlement-key            # prints {"kid":"k1","x":"…","d":"…"}
   cd server
   npx wrangler secret put ENTITLEMENT_KEYS                     # paste {"active":"k1","keys":[ <that object> ]}
   npx wrangler secret put PLAY_SERVICE_ACCOUNT_JSON < ../play-api.json   # key from §8.C; then delete play-api.json
   openssl rand -hex 32 | tee /dev/tty | npx wrangler secret put ADMIN_TOKEN   # for owner grants
   npx wrangler secret list                                     # the three names
   ```
   Save `ENTITLEMENT_KEYS` and `ADMIN_TOKEN` in your password manager.
7. `SUPPORT_EMAIL` (the Store's help line) is `alexkhoury@hotmail.com` in `shared/src/billing/products.ts`; `tv-app/.../billing/Products.kt` must carry the same value (empty hides the help line). Use the same address as the Play listing; change both together.

## Phase 3: switch billing on

```sh
# in server/wrangler.jsonc: "BILLING_ENABLED": "1" (plus the RTDN vars from phase 2); commit it on main, then:
pnpm run deploy        # check-deploy fails if a billing secret is missing; warns if the RTDN vars are empty
curl -s https://play.jamaa.workers.dev/api/config          # {"billing":true,"games":["mishana"]}
```

1. Play Console → Monetization setup → Real-time developer notifications → topic `projects/<project>/topics/play-rtdn` → **Send test message**. The Worker logs show `{"code":"RTDN_TEST"}`.
2. **Owner access** (right after the switch): see [DEV.md → Owner: free JAMAA Pass on every device](DEV.md#owner-free-jamaa-pass--every-pack-on-every-device). The install id only appears in Settings → About once billing is on.
3. Run the end-to-end test in [PAYMENTS-SPEC §8.E](PAYMENTS-SPEC.md#8-owner-setup-checklist-exact-steps) with a license-tester account: the Pass (monthly with the trial, then yearly), a pack, a pending purchase, cancel and expiry (license-tester renewals take minutes), fix payment / account hold, refund, restore.
4. Set up alerts on `BILLING_ACK_OVERDUE`, `BILLING_ACK_REJECTED`, `BILLING_AUTH`, `BILLING_BUDGET`, `BILLING_SUB_STALE` and `RTDN_AUTH` (§8.D).

Note: `BILLING_ENABLED` covers the whole Worker. Once it is `"1"`, every free room (the browser `/tv` and sideloaded TVs included) plays only the free starter content of each game. The browser `/tv` shows "TV app only" in its store.

## Phase 4: turn on a new game

When a game's G milestone is accepted (owner order: `bluff`, then `likely`, then `trivia`) and its free starter content passes `content-lint --release`:

```sh
# in server/wrangler.jsonc: "GAMES_ENABLED": "mishana,bluff"; commit it on main, then:
pnpm run deploy        # check-deploy refuses an unknown id
curl -s https://play.jamaa.workers.dev/api/config          # {"billing":…,"games":["mishana","bluff"]}
```

TVs whose build cannot draw the game (an older Play build) simply do not offer it (their `hello` does not declare it). Removing a game again: an instance already being played finishes normally; a room on its setup screen goes back to the hub.

## Rollback

- **Normal rollback (recommended): switch billing off.** Set `"BILLING_ENABLED": "0"`, then run `pnpm run deploy`. Every room plays the whole catalog again, the Pass UI disappears, and purchases (subscriptions included; Google keeps billing active subscribers, so switch off only briefly) and grants stay stored in the Billing DO, so switching back on later restores them. Editing the var in the dashboard works too, but the next `pnpm run deploy` overwrites it with the value in `wrangler.jsonc`.
- **Previous `main` version:** `cd server && npx wrangler deployments list`, then `npx wrangler rollback <version-id>`. This is fine between versions that all contain the Billing class.
- **Back to `prod-rules-v2` code: do not deploy that branch as it is.** Its `wrangler.jsonc` has no `Billing` class, and Cloudflare refuses a version that drops a class that existing Durable Objects depend on [VERIFY the exact error; `wrangler rollback` across the v2 migration is probably refused for the same reason]. If you ever need the old code, build a hotfix branch from `prod-rules-v2` that keeps `main`'s `durable_objects`, `migrations` and the `Billing` export. In practice, `BILLING_ENABLED` "0" on `main` already gives the old behaviour.
- **Key leak:** a leaked `ENTITLEMENT_KEYS` means you rotate it (DEV.md → Secrets). A leaked `ADMIN_TOKEN` means you run `npx wrangler secret put ADMIN_TOKEN` with a new value (or `secret delete`), then `pnpm grant list` and revoke anything unknown.
