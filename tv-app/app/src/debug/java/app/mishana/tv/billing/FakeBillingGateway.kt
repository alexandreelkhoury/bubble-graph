package app.mishana.tv.billing

import android.app.Activity
import app.mishana.tv.protocol.FakePurchaseRequest
import app.mishana.tv.protocol.FakePurchaseResponse
import app.mishana.tv.protocol.ProtocolJson
import app.mishana.tv.settings.DebugPrefs
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * PAYMENTS-SPEC §4.8 (debug source set only): the server's test store. Active only while `DebugPrefs.fakeBilling` is on
 * and `GET /api/billing/catalog` answers `mode:"fake"` (`pnpm dev`); otherwise every call goes to [play] (so with a server
 * in Google mode the toggle is ignored, and DebugSettings says "Server is in Google mode").
 *
 * - [queryProducts]: synthetic products from the catalog, prices "$4.99" / "$29.99" / "$1.99", a 7-day trial on each plan;
 * - [launch]: shows the remote-friendly confirm dialog ([fakePrompt]); Approve / Pending call
 *   `POST /api/billing/fake/purchase` and emit a [PurchaseUpdate] with the fake token; the client then calls `/verify`
 *   exactly as in production;
 * - [queryOwned]: the tokens remembered in debug prefs.
 */
class FakeBillingGateway(
    private val play: BillingGateway,
    private val prefs: DebugPrefs,
    private val api: BillingApi,
    private val installId: () -> String,
    private val serverUrl: () -> String,
    private val scope: CoroutineScope,
    private val client: OkHttpClient = EntitlementApi.defaultClient,
) : BillingGateway, FakePurchasePrompt {

    private val _updates = MutableSharedFlow<PurchaseUpdate>(extraBufferCapacity = 16)
    override val purchaseUpdates: SharedFlow<PurchaseUpdate> = _updates.asSharedFlow()

    private val _request = MutableStateFlow<PurchasableOffer?>(null)
    override val request: StateFlow<PurchasableOffer?> = _request.asStateFlow()

    /** The server's catalog mode for [modeUrl], checked on connect. */
    @Volatile private var serverMode: String? = null
    @Volatile private var modeUrl: String? = null

    init {
        scope.launch { play.purchaseUpdates.collect { if (!active()) _updates.emit(it) } }
    }

    private fun active(): Boolean = prefs.fakeBilling && serverMode == "fake" && modeUrl == serverUrl()

    override val isFake: Boolean get() = active()
    override val fakePrompt: FakePurchasePrompt? get() = if (active()) this else null

    override suspend fun connect(): GatewayResult<Unit> {
        if (prefs.fakeBilling) {
            val url = serverUrl()
            if (modeUrl != url || serverMode == null) {
                serverMode = try {
                    api.catalog().mode
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    null
                }
                modeUrl = url
            }
            if (active()) return GatewayResult.Ok(Unit)
        }
        return play.connect()
    }

    override suspend fun queryProducts(subIds: List<String>, inappIds: List<String>): GatewayResult<ProductsSnapshot> {
        if (!active()) return play.queryProducts(subIds, inappIds)
        val subs = subIds.filter { it == Products.PREMIUM_PRODUCT_ID }.associateWith { id ->
            SubProductInfo(
                id,
                listOf(
                    plan(Products.BASE_PLAN_MONTHLY, null, "$4.99", "P1M"),
                    plan(Products.BASE_PLAN_MONTHLY, Products.TRIAL_OFFER_ID, "$4.99", "P1M"),
                    plan(Products.BASE_PLAN_YEARLY, null, "$29.99", "P1Y"),
                    plan(Products.BASE_PLAN_YEARLY, Products.TRIAL_OFFER_ID, "$29.99", "P1Y"),
                ),
            )
        }
        val inapp = inappIds.filter { Products.packIdFromProductId(it) != null }
            .associateWith { InappProductInfo(it, "$1.99", "fake:$it") }
        return GatewayResult.Ok(ProductsSnapshot(subs, inapp))
    }

    private fun plan(basePlan: String, offerId: String?, price: String, period: String): SubOfferInfo {
        val recurring = PricingPhaseInfo(price, 1_000_000L, period)
        val phases = if (offerId != null) listOf(PricingPhaseInfo("Free", 0L, "P7D"), recurring) else listOf(recurring)
        return SubOfferInfo(basePlan, offerId, "fake:$basePlan:${offerId ?: "base"}", phases)
    }

    override suspend fun queryOwned(): GatewayResult<List<OwnedPurchase>> {
        if (!active()) return play.queryOwned()
        // The fake store cannot read the server's state back, so a remembered PENDING purchase is reported as PURCHASED:
        // /verify then answers PENDING (nothing granted) until `POST /api/billing/fake/set` completes it, after which the
        // next forced refresh (Store opened, Restore purchases) grants it. Debug only.
        return GatewayResult.Ok(remembered().map { it.copy(state = OwnedState.PURCHASED) })
    }

    override fun launch(activity: Activity, offer: PurchasableOffer, obfuscatedAccountId: String): GatewayResult<Unit> {
        if (!active()) return play.launch(activity, offer, obfuscatedAccountId)
        _request.value = offer
        return GatewayResult.Ok(Unit)
    }

    override fun choose(choice: FakeChoice) {
        val offer = _request.value ?: return
        _request.value = null
        scope.launch {
            when (choice) {
                FakeChoice.CANCEL -> _updates.emit(PurchaseUpdate(ResponseCodes.USER_CANCELED, null, emptyList()))
                FakeChoice.ERROR -> _updates.emit(PurchaseUpdate(ResponseCodes.ERROR, null, emptyList()))
                FakeChoice.APPROVE, FakeChoice.PENDING -> {
                    val state = if (choice == FakeChoice.APPROVE) OwnedState.PURCHASED else OwnedState.PENDING
                    val token = try {
                        fakePurchase(offer, state)
                    } catch (e: CancellationException) {
                        throw e
                    } catch (e: Exception) {
                        _updates.emit(PurchaseUpdate(ResponseCodes.SERVICE_UNAVAILABLE, null, emptyList()))
                        return@launch
                    }
                    val owned = OwnedPurchase(offer.productId, token, state, suspended = false)
                    remember(owned)
                    _updates.emit(PurchaseUpdate(ResponseCodes.OK, null, listOf(owned)))
                }
            }
        }
    }

    private suspend fun fakePurchase(offer: PurchasableOffer, state: OwnedState): String = withContext(Dispatchers.IO) {
        val body = ProtocolJson.encoder.encodeToString(
            FakePurchaseRequest.serializer(),
            FakePurchaseRequest(
                installId = installId(),
                productId = offer.productId,
                basePlanId = offer.basePlanId,
                offerId = offer.offerId,
                outcome = if (state == OwnedState.PURCHASED) "PURCHASED" else "PENDING",
            ),
        )
        val request = Request.Builder()
            .url(serverUrl().trim().trimEnd('/') + "/api/billing/fake/purchase")
            .post(body.toRequestBody("application/json".toMediaType()))
            .build()
        client.newCall(request).execute().use { r ->
            val text = r.body.string()
            check(r.code == 200) { "fake purchase failed: ${r.code}" }
            ProtocolJson.decoder.decodeFromString(FakePurchaseResponse.serializer(), text).purchaseToken
        }
    }

    private fun remembered(): List<OwnedPurchase> = prefs.fakePurchases.lines().mapNotNull { line ->
        val parts = line.split('|')
        if (parts.size != 3) return@mapNotNull null
        val state = runCatching { OwnedState.valueOf(parts[1]) }.getOrNull() ?: return@mapNotNull null
        OwnedPurchase(parts[0], parts[2], state, suspended = false)
    }

    private fun remember(p: OwnedPurchase) {
        val kept = remembered().filterNot { it.purchaseToken == p.purchaseToken }
        prefs.fakePurchases = (kept + p).joinToString("\n") { "${it.productId}|${it.state.name}|${it.purchaseToken}" }
    }

    override fun end() = play.end()

    override fun onLifecycleStart() = play.onLifecycleStart()
}
