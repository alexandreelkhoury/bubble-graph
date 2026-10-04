package app.mishana.tv.billing

import android.app.Activity
import app.mishana.tv.Constants
import app.mishana.tv.net.ReconnectPolicy
import app.mishana.tv.protocol.EntitlementBody
import app.mishana.tv.protocol.LockedPackInfo
import app.mishana.tv.protocol.PurchaseRef
import app.mishana.tv.protocol.PurchaseResultEntry
import app.mishana.tv.protocol.PurchaseResults
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.math.max
import kotlin.math.min

/** One-shot billing outputs for the room (GameViewModel). Delivered in order on one flow. */
sealed interface BillingEvent {
    /** A refresh saved a new entitlement token: send `EntitlementMsg` (queued while the socket is not OPEN). */
    data class Token(val token: String) : BillingEvent

    /** A billing toast (§4.4 rules: shown now only in the Store or LOBBY/RESULTS, else the latest one is queued). */
    data class Toast(val key: String, val arg: String? = null) : BillingEvent

    /** Products newly granted by the last refresh; [origins] says which ones were bought from where (§4.4 locked row). */
    data class Granted(val productIds: Set<String>, val origins: Map<String, StoreOrigin>) : BillingEvent
}

/** What a room needs from billing (GameViewModel's view of [BillingRepository]; tests may fake it). */
interface RoomBilling {
    val state: StateFlow<StoreUiState>
    val events: SharedFlow<BillingEvent>

    /** §4.3: the stored token, only while it is valid for at least another 60 s. */
    fun tokenForCreate(): String?

    /** §4.3: `CreateRoomResponse.entitlement`; INVALID triggers a refresh. */
    fun onCreateRoomEntitlement(status: String?)

    /** §2.4 rule 3: the in-room refresh timer runs while this is true. */
    fun setInRoom(inRoom: Boolean)
    fun openStore(lockedPacks: List<LockedPackInfo>)
    fun closeStore()
    fun buy(activity: Activity, productId: String, basePlanId: String?, origin: StoreOrigin)
    fun restorePurchases()

    /** §4.8: the debug fake store's purchase dialog while it is active; null with Google Play. */
    val fakePrompt: FakePurchasePrompt? get() = null
}

/**
 * PAYMENTS-SPEC §2.4 / §4.2 / §4.4 orchestration, process-wide (owned by ProductionDeps, survives rooms and activity
 * recreation). The server acknowledges purchases; this class only reads Play, posts tokens to `/verify`, keeps the
 * signed entitlement, and drives the Store state machine. All state changes happen on [scope] (main thread in the app).
 */
class BillingRepository(
    private val gateway: BillingGateway,
    private val api: BillingApi,
    private val store: EntitlementStore,
    private val scope: CoroutineScope,
    private val clock: () -> Long = { System.currentTimeMillis() },
    /** §2.4 / §4.2: refresh retries back off 1 s → 10 min. */
    private val retryPolicy: ReconnectPolicy = ReconnectPolicy(baseMs = 1_000L, capMs = RETRY_CAP_MS),
    private val supportEmail: String = Products.SUPPORT_EMAIL,
    /** Debug builds pass `Log.w`; release passes nothing (§4.6). Never receives tokens or ids. */
    private val warn: (String) -> Unit = {},
) : RoomBilling {

    private val saved = store.load()
    private var savedAt: Long = saved?.savedAt ?: 0L
    private val _state = MutableStateFlow(StoreUiState(entitlement = saved?.body))
    override val state: StateFlow<StoreUiState> = _state.asStateFlow()

    private val _events = MutableSharedFlow<BillingEvent>(extraBufferCapacity = 64)
    override val events: SharedFlow<BillingEvent> = _events.asSharedFlow()

    private val installId: String by lazy { store.installId() }

    /** The `(token, state, suspended)` tuples of the last successful verify (§2.4 rule 1); null = never verified. */
    private var lastVerified: Set<Triple<String, OwnedState, Boolean>>? = null

    private val refreshMutex = Mutex()
    private var restoreJob: Job? = null
    private var storeJob: Job? = null
    private var roomJob: Job? = null
    private var retryJob: Job? = null
    private var confirmJob: Job? = null
    private var retryAttempt = 0
    private var verifyFailedShown = false
    private var foreground = true
    private val origins = mutableMapOf<String, StoreOrigin>()

    init {
        scope.launch { gateway.purchaseUpdates.collect { onPurchaseUpdate(it) } }
    }

    // ---------------------------------------------------------------- lifecycle (§2.4 rule 1, §4.2)

    /** App start (`MainActivity.onCreate`): connect and restore. */
    fun start() = launchRestore(force = false, user = false)

    /** `ON_START`: a BILLING_UNAVAILABLE from before may be gone (signed in, left the kids profile): try once more. */
    fun onLifecycleStart() {
        foreground = true
        gateway.onLifecycleStart()
        if (_state.value.billingUnavailable) _state.update { it.copy(billingUnavailable = false) }
        launchRestore(force = false, user = false)
    }

    /** `ON_RESUME`: catches PENDING → PURCHASED and out-of-app purchases. Coalesced with an ON_START restore in flight. */
    fun onResume() = launchRestore(force = false, user = false)

    /** `ON_STOP`: background retries stop (they resume on the next start). */
    fun onStop() {
        foreground = false
        retryJob?.cancel()
        retryJob = null
    }

    /** `MainActivity.onDestroy` when finishing. */
    fun end() {
        gateway.end()
    }

    // ---------------------------------------------------------------- RoomBilling

    override fun tokenForCreate(): String? {
        val e = _state.value.entitlement ?: return null
        return e.token.takeIf { e.expiresAt > clock() + CREATE_TOKEN_MIN_LIFE_MS && it.length <= Constants.ENTITLEMENT_TOKEN_MAX_CHARS }
    }

    override fun onCreateRoomEntitlement(status: String?) {
        if (status == "INVALID") launchRestore(force = true, user = false)
    }

    override fun setInRoom(inRoom: Boolean) {
        roomJob?.cancel()
        roomJob = null
        if (!inRoom) return
        roomJob = scope.launch {
            _state.map { it.entitlement }.distinctUntilChanged().collectLatest { e ->
                while (true) {
                    val now = clock()
                    delay(nextRefreshAt(e, now) - now)
                    // A separate job: the save it causes re-emits the entitlement, which restarts this block.
                    launchRestore(force = true, user = false)
                    delay(MIN_REFRESH_GAP_MS)
                }
            }
        }
    }

    override fun openStore(lockedPacks: List<LockedPackInfo>) {
        _state.update { it.copy(storeVisible = true, phase = StorePhase.Loading, products = null, fake = gateway.isFake) }
        storeJob?.cancel()
        storeJob = scope.launch { loadStore(lockedPacks) }
        launchRestore(force = true, user = false) // §2.4 rule 4
    }

    override fun closeStore() {
        storeJob?.cancel()
        storeJob = null
        _state.update { it.copy(storeVisible = false) }
    }

    override fun buy(activity: Activity, productId: String, basePlanId: String?, origin: StoreOrigin) {
        val s = _state.value
        if (s.purchaseInFlight != null) return
        val products = s.products ?: return
        val offer = if (productId == Products.PREMIUM_PRODUCT_ID) {
            OfferSelection.planFor(products.subs[Products.PREMIUM_PRODUCT_ID], basePlanId ?: Products.BASE_PLAN_YEARLY)
                ?.let { PurchasableOffer(productId, it.offerToken, it.basePlanId, it.offerId) }
        } else {
            OfferSelection.packOffer(products.inapp[productId])
        }
        if (offer == null) {
            toast(BillingErrors.ITEM_UNAVAILABLE)
            return
        }
        when (val r = gateway.launch(activity, offer, InstallId.hash(installId))) {
            is GatewayResult.Ok -> {
                origins[productId] = origin
                _state.update { it.copy(purchaseInFlight = productId, slowConfirm = null) }
            }
            is GatewayResult.Err -> onPlayError(r.code)
        }
    }

    override fun restorePurchases() = launchRestore(force = true, user = true)

    override val fakePrompt: FakePurchasePrompt? get() = gateway.fakePrompt

    // ---------------------------------------------------------------- Store loading (§4.4 state machine)

    private suspend fun loadStore(lockedPacks: List<LockedPackInfo>) {
        val outcome = withTimeoutOrNull(STORE_TIMEOUT_MS) {
            coroutineScope {
                val catalog = async { runCatchingApi { api.catalog() } }
                val subs = async {
                    when (val c = gateway.connect()) {
                        is GatewayResult.Err -> c
                        is GatewayResult.Ok -> gateway.queryProducts(listOf(Products.PREMIUM_PRODUCT_ID), emptyList())
                    }
                }
                val cat = catalog.await()
                val subsResult = subs.await()
                // PAY-GAP: the INAPP ids come from the catalog, so that query starts once the catalog answered
                // (or from view.lockedPacks when it failed) instead of strictly in parallel.
                val inappIds = cat?.packs?.map { it.productId } ?: lockedPacks.map { it.productId }
                val inappResult = if (subsResult is GatewayResult.Ok && inappIds.isNotEmpty()) {
                    gateway.queryProducts(emptyList(), inappIds)
                } else {
                    subsResult
                }
                Triple(cat, subsResult, inappResult)
            }
        }
        if (outcome == null) {
            _state.update { it.copy(phase = StorePhase.Unavailable(UnavailableReason.NETWORK)) }
            return
        }
        val (catalog, subs, inapp) = outcome
        val playErr = (subs as? GatewayResult.Err) ?: (inapp as? GatewayResult.Err)
        when {
            playErr?.code == ResponseCodes.BILLING_UNAVAILABLE -> _state.update {
                it.copy(phase = StorePhase.Unavailable(UnavailableReason.BILLING_UNAVAILABLE), billingUnavailable = true, catalog = catalog)
            }
            // PAY-GAP: §4.4 names NETWORK for "catalog and Play both failed". When only Play failed nothing can be bought,
            // and every pack would read "Included with Premium": the conservative choice is NETWORK (Try again) too.
            playErr != null -> {
                warn("billing: product query failed code=${playErr.code}")
                _state.update { it.copy(phase = StorePhase.Unavailable(UnavailableReason.NETWORK), catalog = catalog) }
            }
            else -> {
                val a = (subs as GatewayResult.Ok).value
                val b = (inapp as GatewayResult.Ok).value
                val merged = ProductsSnapshot(a.subs + b.subs, a.inapp + b.inapp, a.unfetched + b.unfetched)
                _state.update { it.copy(phase = StorePhase.Ready, catalog = catalog, products = merged, fake = gateway.isFake) }
            }
        }
    }

    // ---------------------------------------------------------------- restore + refresh (§2.4)

    private fun launchRestore(force: Boolean, user: Boolean) {
        if (restoreJob?.isActive == true && !user) {
            if (!force) return
        }
        val previous = restoreJob
        restoreJob = scope.launch {
            previous?.join()
            restore(force, user)
        }
    }

    private suspend fun restore(force: Boolean, user: Boolean) {
        val owned = when (val c = gateway.connect()) {
            is GatewayResult.Err -> c
            is GatewayResult.Ok -> gateway.queryOwned()
        }
        if (owned is GatewayResult.Err) {
            if (owned.code == ResponseCodes.BILLING_UNAVAILABLE) {
                _state.update { it.copy(billingUnavailable = true) }
            } else {
                warn("billing: restore failed code=${owned.code}")
            }
            if (user) onPlayError(owned.code)
            // Play is unreachable: the server still knows this TV's bound purchases.
            if (force || stale()) refreshEntitlement()
            return
        }
        val list = (owned as GatewayResult.Ok).value
        val pendingIds = list.filter { it.state == OwnedState.PENDING }.map { it.productId }.toSet()
        val suspended = list.any { it.suspended && it.productId == Products.PREMIUM_PRODUCT_ID }
        _state.update { it.copy(pending = pendingIds, subscriptionSuspended = suspended, billingUnavailable = false) }
        // Pending purchases grant nothing and are not posted as owned; suspended subscriptions are (§4.2).
        val postable = list.filter { it.state == OwnedState.PURCHASED }
        val tuples = postable.map { Triple(it.purchaseToken, it.state, it.suspended) }.toSet()
        val changed = tuples != (lastVerified ?: emptySet<Triple<String, OwnedState, Boolean>>())
        if (postable.isNotEmpty()) {
            if (force || changed || stale()) {
                val ok = verify(postable, announce = user)
                if (ok && user) toast("store.restored")
            } else if (user) {
                toast("store.restored")
            }
        } else {
            if (force || stale() || changed) {
                refreshEntitlement()
                lastVerified = emptySet()
            }
            if (user) toast(if (pendingIds.isEmpty()) "store.nothingToRestore" else "store.pendingBody")
        }
    }

    /** Posts [postable] in chunks of 20. Returns true when every chunk answered (per-purchase results may still differ). */
    private suspend fun verify(postable: List<OwnedPurchase>, announce: Boolean): Boolean = refreshMutex.withLock {
        var body: EntitlementBody? = null
        val results = mutableListOf<PurchaseResultEntry>()
        try {
            for (chunk in postable.chunked(Constants.MAX_PURCHASES_PER_VERIFY)) {
                val r = api.verify(installId, chunk.map { PurchaseRef(it.productId, it.purchaseToken) })
                body = r.entitlement
                results += r.results
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: BillingApiException) {
            onRefreshFailure(e, announce || _state.value.purchaseInFlight != null)
            return false
        }
        onSaved(body ?: return false)
        // The purchase being confirmed is answered (granted, pending, not owned…) unless Google was unreachable.
        val answered = postable.zip(results).filter { (_, r) -> r.result != PurchaseResults.UPSTREAM_ERROR }.map { it.first.productId }.toSet()
        val inFlight = _state.value.purchaseInFlight
        if (inFlight != null && inFlight in answered) {
            confirmJob?.cancel()
            _state.update { it.copy(purchaseInFlight = null, slowConfirm = null) }
        }
        val upstream = results.any { it.result == PurchaseResults.UPSTREAM_ERROR }
        if (results.any { it.result == PurchaseResults.INSTALL_LIMIT }) {
            val t = BillingErrors.installLimit(supportEmail)
            toast(t.key, t.arg)
        }
        if (upstream) {
            // The purchases stay in Play's list (not acknowledged yet): retry with backoff, say so once.
            if (announce || _state.value.purchaseInFlight != null) announceVerifyFailed()
            scheduleRetry()
        } else {
            lastVerified = postable.map { Triple(it.purchaseToken, it.state, it.suspended) }.toSet()
            retryAttempt = 0
            verifyFailedShown = false
        }
        true
    }

    private suspend fun refreshEntitlement(): Boolean = refreshMutex.withLock {
        val body = try {
            api.entitlement(installId)
        } catch (e: CancellationException) {
            throw e
        } catch (e: BillingApiException) {
            onRefreshFailure(e, announce = false)
            return false
        }
        onSaved(body)
        retryAttempt = 0
        true
    }

    private fun onSaved(body: EntitlementBody) {
        val now = clock()
        val before = _state.value.entitlement
        store.save(body, now)
        savedAt = now
        val inFlight = _state.value.purchaseInFlight
        val granted = newlyGranted(before, body, now)
        _state.update {
            it.copy(
                entitlement = body,
                // The purchase being confirmed is done once the server grants it (or reports anything but an outage).
                purchaseInFlight = if (inFlight != null && (inFlight in granted || owns(body, inFlight, now))) null else it.purchaseInFlight,
                slowConfirm = if (it.slowConfirm != null && owns(body, it.slowConfirm, now)) null else it.slowConfirm,
            )
        }
        if (_state.value.purchaseInFlight == null) confirmJob?.cancel()
        _events.tryEmit(BillingEvent.Token(body.token))
        if (granted.isNotEmpty()) {
            val o = granted.mapNotNull { id -> origins.remove(id)?.let { id to it } }.toMap()
            _events.tryEmit(BillingEvent.Granted(granted, o))
            toast("store.unlocked")
        }
    }

    private fun onRefreshFailure(e: BillingApiException, announce: Boolean) {
        warn("billing: refresh failed status=${e.httpStatus} error=${e.errorCode}")
        when (val ui = BillingErrors.forHttpFailure(e.httpStatus, e.errorCode)) {
            is BillingErrorUi.Toast -> if (ui.key == BillingErrors.RATE_LIMITED) {
                if (announce) toast(ui.key)
            } else if (announce) {
                announceVerifyFailed()
            }
            else -> Unit
        }
        scheduleRetry()
    }

    private fun announceVerifyFailed() {
        if (verifyFailedShown) return
        verifyFailedShown = true
        toast(BillingErrors.VERIFY_FAILED)
    }

    /** One retry pending at a time, foreground only; the old token is kept meanwhile (§2.4). */
    private fun scheduleRetry() {
        if (!foreground || retryJob?.isActive == true) return
        val wait = min(retryPolicy.delayMs(retryAttempt), RETRY_CAP_MS)
        retryAttempt += 1
        retryJob = scope.launch {
            delay(wait)
            launchRestore(force = true, user = false)
        }
    }

    private fun stale(): Boolean = _state.value.entitlement == null || clock() - savedAt > STALE_MS

    // ---------------------------------------------------------------- purchases (§4.2 onPurchasesUpdated)

    private fun onPurchaseUpdate(u: PurchaseUpdate) {
        when (u.code) {
            ResponseCodes.OK -> {
                val pending = u.purchases.filter { it.state == OwnedState.PENDING }
                val purchased = u.purchases.filter { it.state == OwnedState.PURCHASED }
                val inFlight = _state.value.purchaseInFlight
                if (pending.isNotEmpty()) {
                    val ids = pending.map { it.productId }.toSet()
                    _state.update { it.copy(pending = it.pending + ids, purchaseInFlight = if (inFlight in ids) null else it.purchaseInFlight) }
                }
                if (purchased.isNotEmpty()) {
                    val ids = purchased.map { it.productId }.toSet()
                    _state.update { it.copy(pending = it.pending - ids) }
                    if (inFlight != null && inFlight in ids) startConfirmTimer(inFlight)
                    scope.launch { verify(purchased, announce = true) }
                } else if (pending.isEmpty()) {
                    _state.update { it.copy(purchaseInFlight = null) }
                }
            }
            ResponseCodes.USER_CANCELED -> _state.update { it.copy(purchaseInFlight = null) }
            else -> {
                _state.update { it.copy(purchaseInFlight = null) }
                onPlayError(u.code)
            }
        }
    }

    /** §4.4: the button shows `store.confirming` for at most 15 s, then `store.verifyFailed` while retries continue. */
    private fun startConfirmTimer(productId: String) {
        confirmJob?.cancel()
        confirmJob = scope.launch {
            delay(CONFIRM_TIMEOUT_MS)
            if (_state.value.purchaseInFlight == productId) {
                _state.update { it.copy(purchaseInFlight = null, slowConfirm = productId) }
            }
        }
    }

    private fun onPlayError(code: Int) {
        if (BillingErrors.isDeveloperSide(code)) warn("billing: play response code=$code")
        when (val ui = BillingErrors.forPlayCode(code)) {
            BillingErrorUi.None -> Unit
            is BillingErrorUi.Toast -> toast(ui.key, ui.arg)
            BillingErrorUi.PlayUnavailable -> _state.update {
                it.copy(
                    billingUnavailable = true,
                    phase = if (it.storeVisible) StorePhase.Unavailable(UnavailableReason.BILLING_UNAVAILABLE) else it.phase,
                )
            }
            BillingErrorUi.AlreadyOwnedRestore -> {
                toast(BillingErrors.ALREADY_OWNED)
                launchRestore(force = true, user = false)
            }
        }
    }

    private fun toast(key: String, arg: String? = null) {
        _events.tryEmit(BillingEvent.Toast(key, arg))
    }

    companion object {
        const val STALE_MS = 60 * 60_000L
        const val STORE_TIMEOUT_MS = 10_000L
        const val CONFIRM_TIMEOUT_MS = 15_000L
        const val RETRY_CAP_MS = 10 * 60_000L
        const val CREATE_TOKEN_MIN_LIFE_MS = 60_000L
        private const val MIN_REFRESH_GAP_MS = 60_000L
        private const val MINUTE = 60_000L
        private const val HOUR = 60 * MINUTE

        /**
         * §2.4 rule 3: `max(now + 1 min, min(expiresAt − 1 h, subscription.expiresAt + 10 min, premiumUntil − 30 min,
         * now + 6 h))`, ignoring null terms. Lands before the room loses premium, never earlier than a minute away.
         */
        fun nextRefreshAt(body: EntitlementBody?, nowMs: Long): Long {
            var m = nowMs + 6 * HOUR
            if (body != null) {
                m = min(m, body.expiresAt - HOUR)
                body.subscription?.expiresAt?.let { m = min(m, it + 10 * MINUTE) }
                body.premiumUntil?.let { m = min(m, it - 30 * MINUTE) }
            }
            return max(nowMs + MINUTE, m)
        }

        /** "premium" when premium turned on, plus the product ids of packs that were not owned before. */
        fun newlyGranted(before: EntitlementBody?, after: EntitlementBody, nowMs: Long): Set<String> {
            val out = mutableSetOf<String>()
            if (!StoreModel.premiumActive(before, nowMs) && StoreModel.premiumActive(after, nowMs)) out += Products.PREMIUM_PRODUCT_ID
            val had = before?.packs?.toSet() ?: emptySet()
            for (p in after.packs) if (p !in had) out += Products.packProductId(p)
            return out
        }

        private fun owns(body: EntitlementBody, productId: String, nowMs: Long): Boolean =
            if (productId == Products.PREMIUM_PRODUCT_ID) {
                StoreModel.premiumActive(body, nowMs)
            } else {
                Products.packIdFromProductId(productId)?.let { it in body.packs } ?: false
            }

        private suspend fun <T> runCatchingApi(block: suspend () -> T): T? = try {
            block()
        } catch (e: CancellationException) {
            throw e
        } catch (e: BillingApiException) {
            null
        }
    }
}
