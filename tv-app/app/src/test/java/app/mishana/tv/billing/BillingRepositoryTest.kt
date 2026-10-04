package app.mishana.tv.billing

import android.app.Activity
import app.mishana.tv.net.ReconnectPolicy
import app.mishana.tv.protocol.EntitlementBody
import app.mishana.tv.protocol.SubscriptionInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** PAYMENTS-SPEC §2.4 / §4.2 / §4.4 / §4.9 BillingRepositoryTest, with a fake gateway, a fake API and virtual time. */
@OptIn(ExperimentalCoroutinesApi::class)
class BillingRepositoryTest {
    private val base = 1_790_000_000_000L
    private val sub = OwnedPurchase("premium", "sub-token-1", OwnedState.PURCHASED, suspended = false)
    private val pack = OwnedPurchase("pack_en_food_01", "pack-token-1", OwnedState.PURCHASED, suspended = false)
    private val pendingPack = OwnedPurchase("pack_fr_food_01", "pack-token-2", OwnedState.PENDING, suspended = false)

    private class Env(
        val repo: BillingRepository,
        val gateway: FakeGateway,
        val api: FakeApi,
        val store: MemoryStore,
        val events: MutableList<BillingEvent>,
    )

    private fun TestScope.env(
        gateway: FakeGateway = FakeGateway(),
        store: MemoryStore = MemoryStore(),
        configure: (FakeApi) -> Unit = {},
    ): Env {
        val clock = { base + testScheduler.currentTime }
        val api = FakeApi(clock).also(configure)
        // Not backgroundScope: advanceUntilIdle() does not run background work. Tests that start the endless in-room
        // timer use runCurrent()/advanceTimeBy() instead.
        val scope = CoroutineScope(StandardTestDispatcher(testScheduler) + SupervisorJob())
        val repo = BillingRepository(
            gateway = gateway,
            api = api,
            store = store,
            scope = scope,
            clock = clock,
            retryPolicy = ReconnectPolicy(random = { 0.5 }, baseMs = 1_000L, capMs = BillingRepository.RETRY_CAP_MS),
        )
        val events = mutableListOf<BillingEvent>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { repo.events.collect { events += it } }
        runCurrent()
        return Env(repo, gateway, api, store, events)
    }

    private fun Env.toasts() = events.filterIsInstance<BillingEvent.Toast>().map { it.key }
    private fun Env.tokens() = events.filterIsInstance<BillingEvent.Token>().map { it.token }

    @Test
    fun restoreOnStartPostsAllPurchasesAndSavesTheToken() = runTest {
        val e = env(FakeGateway().apply { owned = GatewayResult.Ok(listOf(sub, pack, pendingPack)) })
        e.repo.start()
        advanceUntilIdle()
        assertEquals(1, e.api.verifyCalls.size)
        assertEquals(listOf("premium" to "sub-token-1", "pack_en_food_01" to "pack-token-1"), e.api.verifyCalls[0].map { it.productId to it.purchaseToken })
        assertEquals("tok1", e.store.saved!!.body.token)
        assertEquals(base, e.store.saved!!.savedAt)
        assertEquals("tok1", e.repo.state.value.entitlement!!.token)
        assertEquals(listOf("tok1"), e.tokens())
        assertEquals(setOf("pack_fr_food_01"), e.repo.state.value.pending)
    }

    @Test
    fun pendingPurchasesAreNotPostedAsOwned() = runTest {
        val e = env(FakeGateway().apply { owned = GatewayResult.Ok(listOf(pendingPack)) })
        e.repo.start()
        advanceUntilIdle()
        assertTrue(e.api.verifyCalls.isEmpty())
        assertEquals(1, e.api.entitlementCalls) // no purchases: /entitlement (nothing stored yet)
        assertEquals(setOf("pack_fr_food_01"), e.repo.state.value.pending)
        assertTrue(e.repo.state.value.entitlement!!.packs.isEmpty())
    }

    @Test
    fun suspendedSubscriptionsArePostedAndFlagged() = runTest {
        val onHold = sub.copy(suspended = true)
        val e = env(FakeGateway().apply { owned = GatewayResult.Ok(listOf(onHold)) }) { it.results["premium"] = "NOT_OWNED" }
        e.repo.start()
        advanceUntilIdle()
        assertEquals(listOf("premium"), e.api.verifyCalls.single().map { it.productId })
        assertTrue(e.repo.state.value.subscriptionSuspended)
        assertEquals(PremiumCard.Suspended, StoreModel.premiumCard(e.repo.state.value, base))
    }

    @Test
    fun resumePostsOnlyChangedTuplesElseTheOneHourRule() = runTest {
        val gw = FakeGateway().apply { owned = GatewayResult.Ok(listOf(sub)) }
        val e = env(gw)
        e.repo.start()
        advanceUntilIdle()
        assertEquals(1, e.api.verifyCalls.size)
        e.repo.onResume()
        advanceUntilIdle()
        assertEquals("unchanged and fresh: no post", 1, e.api.verifyCalls.size)
        assertEquals(2, gw.ownedQueries) // but Play was read again
        advanceTimeBy(BillingRepository.STALE_MS + 1)
        e.repo.onResume()
        advanceUntilIdle()
        assertEquals("older than 1 h: post again", 2, e.api.verifyCalls.size)
        gw.owned = GatewayResult.Ok(listOf(sub, pack))
        e.repo.onResume()
        advanceUntilIdle()
        assertEquals("a new tuple: post at once", 3, e.api.verifyCalls.size)
        gw.owned = GatewayResult.Ok(listOf(sub, pack.copy(suspended = true)))
        e.repo.onResume()
        advanceUntilIdle()
        assertEquals("suspended flag changed: post", 4, e.api.verifyCalls.size)
    }

    @Test
    fun aRefreshInARoomEmitsTheTokenForSendEntitlement() = runTest {
        val e = env(FakeGateway().apply { owned = GatewayResult.Ok(listOf(sub)) })
        e.repo.start()
        advanceUntilIdle()
        assertEquals(listOf("tok1"), e.tokens())
        e.repo.setInRoom(true)
        runCurrent()
        val at = BillingRepository.nextRefreshAt(e.repo.state.value.entitlement, base + testScheduler.currentTime)
        advanceTimeBy(at - (base + testScheduler.currentTime) + 1)
        runCurrent() // not advanceUntilIdle: the in-room timer loops for as long as the room lives
        assertTrue(e.api.verifyCalls.size >= 2)
        assertEquals("tok2", e.tokens()[1])
        e.repo.setInRoom(false)
    }

    @Test
    fun aRefreshFailureKeepsTheOldTokenAndBacksOff() = runTest {
        val store = MemoryStore()
        val e = env(FakeGateway().apply { owned = GatewayResult.Ok(listOf(sub)) }, store)
        e.repo.start()
        advanceUntilIdle()
        val old = e.repo.state.value.entitlement!!
        e.api.fail = BillingApiException(503, "NOT_CONFIGURED")
        e.repo.onCreateRoomEntitlement("INVALID") // a forced background refresh
        runCurrent()
        assertEquals(2, e.api.verifyCalls.size)
        assertEquals(old, e.repo.state.value.entitlement)
        assertEquals(old, store.saved!!.body)
        // Backoff 1 s, then 2 s (jitter fixed at 1.0×).
        advanceTimeBy(999)
        runCurrent()
        assertEquals(2, e.api.verifyCalls.size)
        advanceTimeBy(2)
        runCurrent()
        assertEquals(3, e.api.verifyCalls.size)
        advanceTimeBy(1_998) // the first retry ran at t = 1 000; the next is due at t = 3 000
        runCurrent()
        assertEquals(3, e.api.verifyCalls.size)
        advanceTimeBy(2)
        runCurrent()
        assertEquals(4, e.api.verifyCalls.size)
        e.api.fail = null
        advanceTimeBy(4_001)
        runCurrent()
        assertEquals(5, e.api.verifyCalls.size)
        assertTrue(e.repo.state.value.entitlement!!.token != old.token)
        // Recovered: no further retries.
        advanceTimeBy(60_000)
        runCurrent()
        assertEquals(5, e.api.verifyCalls.size)
        assertEquals("a background refresh failure is silent", emptyList<String>(), e.toasts().filter { it == "store.verifyFailed" })
        e.repo.onStop()
    }

    @Test
    fun nextRefreshAtLandsBeforePremiumEnds() {
        val now = base
        val h = 3_600_000L
        val m = 60_000L
        fun body(exp: Long, pu: Long?, subExp: Long?) = EntitlementBody(
            "t", pu != null, pu, emptyList(), exp,
            subExp?.let { SubscriptionInfo("SUBSCRIPTION_STATE_ACTIVE", "monthly", true, false, it) },
        )
        // No entitlement: 6 h.
        assertEquals(now + 6 * h, BillingRepository.nextRefreshAt(null, now))
        // Fresh 8 h token, free: exp − 1 h = 7 h, capped at 6 h.
        assertEquals(now + 6 * h, BillingRepository.nextRefreshAt(body(now + 8 * h, null, null), now))
        // An older token: exp − 1 h.
        assertEquals(now + 2 * h, BillingRepository.nextRefreshAt(body(now + 3 * h, null, null), now))
        // Renewing subscriber whose Google expiry is in 2 h (premiumUntil = +6 h slack): sub.expiresAt + 10 min,
        // which is before premiumUntil − 30 min, so the refresh lands before the room loses premium.
        val r = BillingRepository.nextRefreshAt(body(now + 8 * h, now + 8 * h, now + 2 * h), now)
        assertEquals(now + 2 * h + 10 * m, r)
        assertTrue(r <= now + 8 * h - 30 * m)
        // premiumUntil − 30 min wins when it is earliest.
        assertEquals(now + 90 * m, BillingRepository.nextRefreshAt(body(now + 8 * h, now + 2 * h, null), now))
        // Never earlier than now + 1 min (expired token / past expiry).
        assertEquals(now + m, BillingRepository.nextRefreshAt(body(now - h, now - h, now - h), now))
        // Never later than now + 6 h.
        assertEquals(now + 6 * h, BillingRepository.nextRefreshAt(body(now + 100 * h, now + 100 * h, now + 100 * h), now))
    }

    @Test
    fun billingUnavailableIsTerminalUntilTheNextOnStart() = runTest {
        val gw = FakeGateway().apply { connectResult = GatewayResult.Err(ResponseCodes.BILLING_UNAVAILABLE, null) }
        val e = env(gw)
        e.repo.start()
        advanceUntilIdle()
        assertTrue(e.repo.state.value.billingUnavailable)
        e.repo.openStore(emptyList())
        advanceUntilIdle()
        assertEquals(StorePhase.Unavailable(UnavailableReason.BILLING_UNAVAILABLE), e.repo.state.value.phase)
        e.repo.closeStore()
        gw.connectResult = GatewayResult.Ok(Unit)
        e.repo.onLifecycleStart()
        advanceUntilIdle()
        assertEquals(1, gw.lifecycleStarts) // the gateway may try startConnection once more
        assertFalse(e.repo.state.value.billingUnavailable)
    }

    @Test
    fun connectGuardHasOneStartConnectionInFlightAndATerminalBillingUnavailable() = runTest {
        val callbacks = mutableListOf<(Int) -> Unit>()
        val guard = ConnectGuard(start = { callbacks += it }, delayMs = { 1_000L })
        val a = async { guard.connect() }
        val b = async { guard.connect() }
        val c = async { guard.connect() }
        runCurrent()
        assertEquals("concurrent callers share one startConnection", 1, callbacks.size)
        callbacks[0](ResponseCodes.BILLING_UNAVAILABLE)
        runCurrent()
        assertEquals(listOf(3, 3, 3), listOf(a.await(), b.await(), c.await()))
        assertTrue(guard.terminal)
        assertEquals(3, guard.connect())
        assertEquals("terminal: no new startConnection", 1, callbacks.size)
        guard.onLifecycleStart()
        val d = async { guard.connect() }
        runCurrent()
        assertEquals("the next ON_START tries once more", 2, callbacks.size)
        callbacks[1](ResponseCodes.OK)
        runCurrent()
        assertEquals(0, d.await())
        assertTrue(guard.ready)
        assertEquals(0, guard.connect())
        assertEquals(2, callbacks.size)
    }

    @Test
    fun connectGuardRetriesTransientSetupErrorsUpToFiveTimes() = runTest {
        var starts = 0
        val guard = ConnectGuard(start = { cb -> starts += 1; cb(ResponseCodes.SERVICE_UNAVAILABLE) }, delayMs = { 100L })
        val r = async { guard.connect() }
        advanceUntilIdle()
        assertEquals(ResponseCodes.SERVICE_UNAVAILABLE, r.await())
        assertEquals(6, starts) // the first try + 5 retries
        assertFalse(guard.terminal)
    }

    @Test
    fun storeOpenIsTrueWhileVisibleOrAPurchaseIsInFlight() = runTest {
        val gw = FakeGateway().apply { products = GatewayResult.Ok(PlayProducts.all("pack_en_food_01")) }
        val e = env(gw)
        assertFalse(e.repo.state.value.busy)
        e.repo.openStore(emptyList())
        advanceUntilIdle()
        assertTrue(e.repo.state.value.busy)
        assertEquals(StorePhase.Ready, e.repo.state.value.phase)
        e.repo.buy(Activity(), "pack_en_food_01", null, StoreOrigin.LOCKED_PACK)
        assertEquals("pack_en_food_01", e.repo.state.value.purchaseInFlight)
        assertEquals(PurchasableOffer("pack_en_food_01", "ot-pack_en_food_01"), gw.launched.single().first)
        assertEquals(InstallId.hash("5f2c8e1a9b0d4c3e7a6f1b2d3c4e5f60"), gw.launched.single().second) // obfuscatedAccountId
        e.repo.closeStore()
        assertTrue("the Play sheet is still up", e.repo.state.value.busy)
        gw.purchaseUpdates.emit(PurchaseUpdate(ResponseCodes.OK, null, listOf(pack)))
        advanceUntilIdle()
        assertNull(e.repo.state.value.purchaseInFlight)
        assertFalse(e.repo.state.value.busy)
        val granted = e.events.filterIsInstance<BillingEvent.Granted>().single()
        assertEquals(setOf("pack_en_food_01"), granted.productIds)
        assertEquals(mapOf("pack_en_food_01" to StoreOrigin.LOCKED_PACK), granted.origins)
        assertTrue("store.unlocked" in e.toasts())
        // The token went out before the grant (the room needs the entitlement before UPDATE_SETTINGS).
        assertTrue(e.events.indexOfFirst { it is BillingEvent.Token } < e.events.indexOfFirst { it is BillingEvent.Granted })
    }

    @Test
    fun premiumPurchaseUsesTheTrialOfferOfTheChosenPlan() = runTest {
        val gw = FakeGateway().apply { products = GatewayResult.Ok(PlayProducts.all()) }
        val e = env(gw)
        e.repo.openStore(emptyList())
        advanceUntilIdle()
        e.repo.buy(Activity(), "premium", "monthly", StoreOrigin.LOBBY_BUTTON)
        assertEquals(PurchasableOffer("premium", "m-trial", "monthly", "trial-7d"), gw.launched.single().first)
    }

    @Test
    fun cancelledAndFailedFlowsEndTheInFlightState() = runTest {
        val gw = FakeGateway().apply { products = GatewayResult.Ok(PlayProducts.all("pack_en_food_01")) }
        val e = env(gw)
        e.repo.openStore(emptyList())
        advanceUntilIdle()
        e.repo.buy(Activity(), "pack_en_food_01", null, StoreOrigin.LOBBY_BUTTON)
        gw.purchaseUpdates.emit(PurchaseUpdate(ResponseCodes.USER_CANCELED, null, emptyList()))
        advanceUntilIdle()
        assertNull(e.repo.state.value.purchaseInFlight)
        assertTrue("USER_CANCELED is silent", e.toasts().isEmpty())
        e.repo.buy(Activity(), "pack_en_food_01", null, StoreOrigin.LOBBY_BUTTON)
        gw.purchaseUpdates.emit(PurchaseUpdate(ResponseCodes.ITEM_ALREADY_OWNED, null, emptyList()))
        advanceUntilIdle()
        assertEquals(listOf("store.alreadyOwned"), e.toasts())
        assertTrue("ITEM_ALREADY_OWNED runs restore", gw.ownedQueries >= 2)
        gw.launchResult = GatewayResult.Err(ResponseCodes.BILLING_UNAVAILABLE, null)
        e.repo.buy(Activity(), "pack_en_food_01", null, StoreOrigin.LOBBY_BUTTON)
        assertEquals(StorePhase.Unavailable(UnavailableReason.BILLING_UNAVAILABLE), e.repo.state.value.phase)
        assertNull(e.repo.state.value.purchaseInFlight)
    }

    @Test
    fun pendingPurchaseShowsPendingAndGrantsNothing() = runTest {
        val gw = FakeGateway().apply { products = GatewayResult.Ok(PlayProducts.all("pack_fr_food_01")) }
        val e = env(gw)
        e.repo.openStore(emptyList())
        advanceUntilIdle()
        val verifiesBefore = e.api.verifyCalls.size
        e.repo.buy(Activity(), "pack_fr_food_01", null, StoreOrigin.LOBBY_BUTTON)
        gw.purchaseUpdates.emit(PurchaseUpdate(ResponseCodes.OK, null, listOf(pendingPack)))
        advanceUntilIdle()
        assertEquals(setOf("pack_fr_food_01"), e.repo.state.value.pending)
        assertNull(e.repo.state.value.purchaseInFlight)
        assertEquals(verifiesBefore, e.api.verifyCalls.size)
        val m = StoreModel.build(e.repo.state.value, "fr", emptyList(), base)
        assertEquals(PackTrailing.Pending, m.packs.first { it.productId == "pack_fr_food_01" }.trailing)
        assertTrue(m.pendingFooter)
    }

    @Test
    fun confirmationTakingOver15sShowsVerifyFailedAndKeepsRetrying() = runTest {
        val gw = FakeGateway().apply { products = GatewayResult.Ok(PlayProducts.all("pack_en_food_01")) }
        val e = env(gw)
        e.repo.openStore(emptyList())
        advanceUntilIdle()
        e.api.fail = BillingApiException(null, null)
        gw.owned = GatewayResult.Ok(listOf(pack)) // Play lists it (unacknowledged) until the server acks it
        e.repo.buy(Activity(), "pack_en_food_01", null, StoreOrigin.LOBBY_BUTTON)
        gw.purchaseUpdates.emit(PurchaseUpdate(ResponseCodes.OK, null, listOf(pack)))
        runCurrent()
        assertEquals("pack_en_food_01", e.repo.state.value.purchaseInFlight)
        assertEquals(listOf("store.verifyFailed"), e.toasts()) // once
        advanceTimeBy(BillingRepository.CONFIRM_TIMEOUT_MS + 1)
        runCurrent()
        assertNull(e.repo.state.value.purchaseInFlight)
        assertEquals("pack_en_food_01", e.repo.state.value.slowConfirm)
        assertEquals(listOf("store.verifyFailed"), e.toasts()) // still once
        e.api.fail = null
        advanceTimeBy(BillingRepository.RETRY_CAP_MS)
        runCurrent()
        assertNull(e.repo.state.value.slowConfirm)
        assertTrue("pack_en_food_01" in e.events.filterIsInstance<BillingEvent.Granted>().single().productIds)
        e.repo.onStop()
    }

    @Test
    fun installLimitShowsItsToast() = runTest {
        val e = env(FakeGateway().apply { owned = GatewayResult.Ok(listOf(pack)) }) { it.results["pack_en_food_01"] = "INSTALL_LIMIT" }
        e.repo.start()
        advanceUntilIdle()
        assertEquals(listOf("store.installLimitNoHelp"), e.toasts()) // SUPPORT_EMAIL is empty until the owner sets it
    }

    @Test
    fun userRestoreSaysRestoredOrNothingToRestore() = runTest {
        val gw = FakeGateway()
        val e = env(gw)
        e.repo.restorePurchases()
        advanceUntilIdle()
        assertEquals(listOf("store.nothingToRestore"), e.toasts())
        gw.owned = GatewayResult.Ok(listOf(pack))
        e.repo.restorePurchases()
        advanceUntilIdle()
        assertTrue("store.restored" in e.toasts())
    }

    @Test
    fun tokenForCreateNeedsAtLeastAMinuteLeft() = runTest {
        val e = env(FakeGateway().apply { owned = GatewayResult.Ok(listOf(sub)) })
        assertNull(e.repo.tokenForCreate())
        e.repo.start()
        advanceUntilIdle()
        assertEquals("tok1", e.repo.tokenForCreate())
        advanceTimeBy(8 * 3_600_000L - 60_000L)
        assertNull(e.repo.tokenForCreate())
        e.repo.onStop()
    }

    @Test
    fun createRoomInvalidTriggersARefresh() = runTest {
        val e = env(FakeGateway().apply { owned = GatewayResult.Ok(listOf(sub)) })
        e.repo.start()
        advanceUntilIdle()
        e.repo.onCreateRoomEntitlement("OK")
        advanceUntilIdle()
        assertEquals(1, e.api.verifyCalls.size)
        e.repo.onCreateRoomEntitlement("INVALID")
        advanceUntilIdle()
        assertEquals(2, e.api.verifyCalls.size)
    }

    @Test
    fun storeStateMachineNetworkAndPartialData() = runTest {
        val gw = FakeGateway().apply { products = GatewayResult.Err(ResponseCodes.SERVICE_UNAVAILABLE, null) }
        val e = env(gw) { it.catalogFail = BillingApiException(null, null) }
        e.repo.openStore(emptyList())
        assertEquals(StorePhase.Loading, e.repo.state.value.phase)
        advanceUntilIdle()
        assertEquals(StorePhase.Unavailable(UnavailableReason.NETWORK), e.repo.state.value.phase)
        // Catalog down, Play up: Ready, packs from view.lockedPacks (the INAPP query uses their product ids).
        gw.products = GatewayResult.Ok(PlayProducts.all("pack_test_en_prem_01"))
        val locked = listOf(app.mishana.tv.protocol.LockedPackInfo("test-en-prem-01", "en", app.mishana.tv.protocol.LocalizedTitle("P", "P", "P"), 10, "all", "pack_test_en_prem_01"))
        e.repo.openStore(locked)
        advanceUntilIdle()
        assertEquals(StorePhase.Ready, e.repo.state.value.phase)
        assertNull(e.repo.state.value.catalog)
        assertEquals(listOf("pack_test_en_prem_01"), gw.productQueries.last().second)
    }

    @Test
    fun storeTimesOutAfter10s() = runTest {
        val gw = object : BillingGateway by FakeGateway() {
            override suspend fun connect(): GatewayResult<Unit> {
                delay(60_000)
                return GatewayResult.Ok(Unit)
            }
        }
        val e = env(FakeGateway())
        val clock = { base + testScheduler.currentTime }
        val repo = BillingRepository(gw, FakeApi(clock), MemoryStore(), CoroutineScope(StandardTestDispatcher(testScheduler) + SupervisorJob()), clock)
        repo.openStore(emptyList())
        advanceTimeBy(BillingRepository.STORE_TIMEOUT_MS + 1)
        runCurrent()
        assertEquals(StorePhase.Unavailable(UnavailableReason.NETWORK), repo.state.value.phase)
        assertFalse(e.repo.state.value.busy)
    }
}
