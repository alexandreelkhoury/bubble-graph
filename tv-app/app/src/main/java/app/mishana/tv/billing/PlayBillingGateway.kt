package app.mishana.tv.billing

import android.app.Activity
import android.content.Context
import app.mishana.tv.net.ReconnectPolicy
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * PAYMENTS-SPEC §4.2: Google Play Billing Library 9.1.0, wrapped by hand with `suspendCancellableCoroutine` (no
 * billing-ktx). One client per process (owned by BillingRuntime). The TV never acknowledges or consumes: the server
 * acknowledges, and an unacknowledged purchase stays in `queryPurchasesAsync` so the next start re-posts it.
 *
 * ✔ Every PBL API used here exists with these signatures on the developer.android.com reference (pages dated
 * 2026-05-19, re-checked 2026-10-04): `enableAutoServiceReconnection` (8.0), `QueryProductDetailsResult`,
 * `UnfetchedProduct.getStatusCode`, `getOneTimePurchaseOfferDetailsList` (null unless several offers),
 * `OneTimePurchaseOfferDetails.getOfferToken/getOfferId/getPurchaseOptionId`, `includeSuspendedSubscriptions` and
 * `Purchase.isSuspended` (8.1), `FeatureType.INCLUDE_SUSPENDED_SUBSCRIPTIONS`, the `BillingResponseCode` values.
 * [VERIFY] dependency resolution and compilation against the real `com.android.billingclient:billing:9.1.0` need a
 * Gradle build with Google Maven (blocked where this was written; type-checked against hand-written stubs only).
 */
class PlayBillingGateway(context: Context) : BillingGateway {

    private val _updates = MutableSharedFlow<PurchaseUpdate>(extraBufferCapacity = 16)
    override val purchaseUpdates: SharedFlow<PurchaseUpdate> = _updates.asSharedFlow()

    private val listener = PurchasesUpdatedListener { result, purchases ->
        // PAY-GAP: the PBL 8 sub-response code is not read (v1 maps every non-OK code by itself, §4.6), so no
        // unverified accessor is needed; `sub` stays null.
        _updates.tryEmit(PurchaseUpdate(result.responseCode, null, purchases.orEmpty().flatMap(::toOwned)))
    }

    private val client: BillingClient = BillingClient.newBuilder(context.applicationContext)
        .setListener(listener)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .enableAutoServiceReconnection()
        .build()

    private val guard = ConnectGuard(
        start = { onResult ->
            client.startConnection(object : BillingClientStateListener {
                override fun onBillingSetupFinished(billingResult: BillingResult) {
                    onResult(billingResult.responseCode)
                }

                // State only: auto-reconnect re-establishes the connection when an API is next called.
                override fun onBillingServiceDisconnected() {
                    guardDisconnected()
                }
            })
        },
        delayMs = ReconnectPolicy()::delayMs,
    )

    private fun guardDisconnected() {
        guard.onDisconnected()
    }

    /** The ProductDetails of the latest query (one Store opening); `launchBillingFlow` needs the real objects. */
    @Volatile private var details: Map<String, ProductDetails> = emptyMap()

    override suspend fun connect(): GatewayResult<Unit> {
        val code = guard.connect()
        return if (code == BillingClient.BillingResponseCode.OK) GatewayResult.Ok(Unit) else GatewayResult.Err(code, null)
    }

    override fun onLifecycleStart() = guard.onLifecycleStart()

    override suspend fun queryProducts(subIds: List<String>, inappIds: List<String>): GatewayResult<ProductsSnapshot> {
        // Two calls (one per type): mixing types in one params object is [VERIFY], so it is avoided.
        val subs = if (subIds.isEmpty()) emptyList<ProductDetails>() to emptyMap() else
            when (val r = queryDetails(subIds, BillingClient.ProductType.SUBS)) {
                is GatewayResult.Err -> return r
                is GatewayResult.Ok -> r.value
            }
        val inapp = if (inappIds.isEmpty()) emptyList<ProductDetails>() to emptyMap() else
            when (val r = queryDetails(inappIds, BillingClient.ProductType.INAPP)) {
                is GatewayResult.Err -> return r
                is GatewayResult.Ok -> r.value
            }
        // Never cached across Store openings (stale objects make launchBillingFlow fail): replaced on every query.
        // The queried ids are replaced (a Store opening queries SUBS and INAPP separately, so both survive).
        details = details - (subIds + inappIds).toSet() + (subs.first + inapp.first).associateBy { it.productId }
        return GatewayResult.Ok(
            ProductsSnapshot(
                subs = subs.first.associate { it.productId to toSubInfo(it) },
                inapp = inapp.first.associate { it.productId to toInappInfo(it) },
                unfetched = subs.second + inapp.second,
            ),
        )
    }

    private suspend fun queryDetails(ids: List<String>, type: String): GatewayResult<Pair<List<ProductDetails>, Map<String, Int>>> {
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(ids.map { QueryProductDetailsParams.Product.newBuilder().setProductId(it).setProductType(type).build() })
            .build()
        return suspendCancellableCoroutine { cont ->
            client.queryProductDetailsAsync(params) { result, queryResult ->
                val out = if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    GatewayResult.Ok(
                        queryResult.productDetailsList to queryResult.unfetchedProductList.associate { it.productId to it.statusCode },
                    )
                } else if (result.responseCode == BillingClient.BillingResponseCode.ITEM_UNAVAILABLE) {
                    // ✔ ProductDetailsResponseListener: ITEM_UNAVAILABLE "if no product details are found". Not an error:
                    // none of these products exists yet (e.g. `premium` not created), so the other type still loads.
                    GatewayResult.Ok(emptyList<ProductDetails>() to ids.associateWith { UNFETCHED_PRODUCT_NOT_FOUND })
                } else {
                    GatewayResult.Err(result.responseCode, null)
                }
                if (cont.isActive) cont.resume(out)
            }
        }
    }

    override suspend fun queryOwned(): GatewayResult<List<OwnedPurchase>> {
        val includeSuspended =
            client.isFeatureSupported(BillingClient.FeatureType.INCLUDE_SUSPENDED_SUBSCRIPTIONS).responseCode == BillingClient.BillingResponseCode.OK
        val subsParams = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS)
            .let { if (includeSuspended) it.includeSuspendedSubscriptions(true) else it }
            .build()
        val subs = when (val r = queryPurchases(subsParams)) {
            is GatewayResult.Err -> return r
            is GatewayResult.Ok -> r.value
        }
        val inapp = when (val r = queryPurchases(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build())) {
            is GatewayResult.Err -> return r
            is GatewayResult.Ok -> r.value
        }
        return GatewayResult.Ok((subs + inapp).flatMap(::toOwned))
    }

    private suspend fun queryPurchases(params: QueryPurchasesParams): GatewayResult<List<Purchase>> =
        suspendCancellableCoroutine { cont ->
            client.queryPurchasesAsync(params) { result, purchases ->
                val out = if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    GatewayResult.Ok(purchases)
                } else {
                    GatewayResult.Err(result.responseCode, null)
                }
                if (cont.isActive) cont.resume(out)
            }
        }

    override fun launch(activity: Activity, offer: PurchasableOffer, obfuscatedAccountId: String): GatewayResult<Unit> {
        val pd = details[offer.productId] ?: return GatewayResult.Err(BillingClient.BillingResponseCode.ITEM_UNAVAILABLE, null)
        val productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(pd)
            .let { b -> offer.offerToken?.let { b.setOfferToken(it) } ?: b }
            .build()
        val params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(productParams))
            .setObfuscatedAccountId(obfuscatedAccountId)
            .build()
        val result = client.launchBillingFlow(activity, params)
        return if (result.responseCode == BillingClient.BillingResponseCode.OK) {
            GatewayResult.Ok(Unit)
        } else {
            GatewayResult.Err(result.responseCode, null)
        }
    }

    override fun end() {
        client.endConnection()
    }

    private companion object {
        /** One [OwnedPurchase] per product id of a purchase (a purchase may name several products). */
        fun toOwned(p: Purchase): List<OwnedPurchase> {
            val state = when (p.purchaseState) {
                Purchase.PurchaseState.PURCHASED -> OwnedState.PURCHASED
                Purchase.PurchaseState.PENDING -> OwnedState.PENDING
                else -> return emptyList()
            }
            return p.products.map { OwnedPurchase(it, p.purchaseToken, state, p.isSuspended) }
        }

        fun toSubInfo(pd: ProductDetails): SubProductInfo = SubProductInfo(
            productId = pd.productId,
            offers = pd.subscriptionOfferDetails.orEmpty().map { o ->
                SubOfferInfo(
                    basePlanId = o.basePlanId,
                    offerId = o.offerId,
                    offerToken = o.offerToken,
                    phases = o.pricingPhases.pricingPhaseList.map { PricingPhaseInfo(it.formattedPrice, it.priceAmountMicros, it.billingPeriod) },
                )
            },
        )

        /** `UnfetchedProduct.StatusCode.PRODUCT_NOT_FOUND` (see [ProductsSnapshot.unfetched]). */
        private const val UNFETCHED_PRODUCT_NOT_FOUND = 3

        /** §1.1: the pack's one purchase option (the code works with any id; this only orders the choice). */
        private const val PACK_PURCHASE_OPTION_ID = "buy"

        /**
         * `oneTimePurchaseOfferDetailsList` is non-null only with several offers ✔; else the single offer. With several,
         * prefer the plain `buy` option without a discount/pre-order offer (`offerId == null`), so a later Play Console
         * offer never becomes the shown price by list order.
         */
        fun toInappInfo(pd: ProductDetails): InappProductInfo {
            val list = pd.oneTimePurchaseOfferDetailsList
            val offer = list?.let { l ->
                l.firstOrNull { it.purchaseOptionId == PACK_PURCHASE_OPTION_ID && it.offerId == null }
                    ?: l.firstOrNull { it.offerId == null }
                    ?: l.firstOrNull { it.purchaseOptionId == PACK_PURCHASE_OPTION_ID }
                    ?: l.firstOrNull()
            } ?: pd.oneTimePurchaseOfferDetails
            return InappProductInfo(pd.productId, offer?.formattedPrice.orEmpty(), offer?.offerToken)
        }
    }
}
