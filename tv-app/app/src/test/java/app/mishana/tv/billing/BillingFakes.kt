package app.mishana.tv.billing

import android.app.Activity
import app.mishana.tv.protocol.CatalogPack
import app.mishana.tv.protocol.CatalogResponse
import app.mishana.tv.protocol.CatalogSubscription
import app.mishana.tv.protocol.EntitlementBody
import app.mishana.tv.protocol.LocalizedTitle
import app.mishana.tv.protocol.PurchaseRef
import app.mishana.tv.protocol.PurchaseResultEntry
import app.mishana.tv.protocol.SubscriptionInfo
import app.mishana.tv.protocol.VerifyResponse
import kotlinx.coroutines.flow.MutableSharedFlow

/** Test doubles for the billing seams (PAYMENTS-SPEC §4.9 "with a fake gateway and fake API"). */
class FakeGateway : BillingGateway {
    override val purchaseUpdates = MutableSharedFlow<PurchaseUpdate>(extraBufferCapacity = 16)
    var connectResult: GatewayResult<Unit> = GatewayResult.Ok(Unit)
    var owned: GatewayResult<List<OwnedPurchase>> = GatewayResult.Ok(emptyList())
    var products: GatewayResult<ProductsSnapshot> = GatewayResult.Ok(ProductsSnapshot())
    var launchResult: GatewayResult<Unit> = GatewayResult.Ok(Unit)
    var connects = 0
    var ownedQueries = 0
    var lifecycleStarts = 0
    val launched = mutableListOf<Pair<PurchasableOffer, String>>()
    val productQueries = mutableListOf<Pair<List<String>, List<String>>>()

    override suspend fun connect(): GatewayResult<Unit> {
        connects += 1
        return connectResult
    }

    override suspend fun queryProducts(subIds: List<String>, inappIds: List<String>): GatewayResult<ProductsSnapshot> {
        productQueries += subIds to inappIds
        val p = products
        if (p !is GatewayResult.Ok) return p
        return GatewayResult.Ok(
            ProductsSnapshot(
                subs = p.value.subs.filterKeys { it in subIds },
                inapp = p.value.inapp.filterKeys { it in inappIds },
                unfetched = p.value.unfetched.filterKeys { it in subIds || it in inappIds },
            ),
        )
    }

    override suspend fun queryOwned(): GatewayResult<List<OwnedPurchase>> {
        ownedQueries += 1
        return owned
    }

    override fun launch(activity: Activity, offer: PurchasableOffer, obfuscatedAccountId: String): GatewayResult<Unit> {
        launched += offer to obfuscatedAccountId
        return launchResult
    }

    override fun end() = Unit

    override fun onLifecycleStart() {
        lifecycleStarts += 1
    }
}

class FakeApi(private val now: () -> Long) : BillingApi {
    val verifyCalls = mutableListOf<List<PurchaseRef>>()
    var entitlementCalls = 0
    var catalogCalls = 0
    var fail: BillingApiException? = null
    var catalogFail: BillingApiException? = null
    var tokenSeq = 0

    /** Per-product result; default OK. */
    val results = mutableMapOf<String, String>()

    /** What the server knows: premium + owned packs (grows with OK verifies). */
    var premium = false
    val packs = sortedSetOf<String>()
    var subscription: SubscriptionInfo? = null

    var catalog = CatalogResponse(
        mode = "google",
        packageName = "app.mishana.tv",
        subscription = CatalogSubscription("premium", listOf("monthly", "yearly"), "trial-7d"),
        freePackIds = listOf("en-everyday-01", "fr-everyday-01", "ar-everyday-01"),
        packs = listOf(
            pack("en-food-01", "en", 33),
            pack("en-things-01", "en", 64),
            pack("fr-food-01", "fr", 33),
            pack("lb-food-01", "ar-LB", 27, language = "ar"),
        ),
    )

    fun body(): EntitlementBody {
        tokenSeq += 1
        val t = now()
        return EntitlementBody(
            token = "tok$tokenSeq",
            premium = premium,
            premiumUntil = if (premium) t + 30L * 86_400_000 else null,
            packs = packs.toList(),
            expiresAt = t + 8 * 3_600_000L,
            subscription = subscription,
        )
    }

    override suspend fun catalog(): CatalogResponse {
        catalogCalls += 1
        catalogFail?.let { throw it }
        return catalog
    }

    override suspend fun verify(installId: String, purchases: List<PurchaseRef>): VerifyResponse {
        verifyCalls += purchases
        check(verifyCalls.size < 500) { "runaway verify loop" }
        fail?.let { throw it }
        val res = purchases.map { p ->
            val r = results[p.productId] ?: "OK"
            if (r == "OK") {
                if (p.productId == Products.PREMIUM_PRODUCT_ID) premium = true
                Products.packIdFromProductId(p.productId)?.let { packs += it }
            }
            PurchaseResultEntry(p.productId, r)
        }
        return VerifyResponse(body(), res)
    }

    override suspend fun entitlement(installId: String): EntitlementBody {
        entitlementCalls += 1
        fail?.let { throw it }
        return body()
    }

    companion object {
        fun pack(id: String, locale: String, pairs: Int, language: String = locale) =
            CatalogPack(id, Products.packProductId(id), locale, language, LocalizedTitle(id, id, id), pairs, "all")
    }
}

class MemoryStore(private var id: String = "5f2c8e1a9b0d4c3e7a6f1b2d3c4e5f60") : EntitlementStore {
    var saved: SavedEntitlement? = null
    var saves = 0
    override fun installId(): String = id
    override fun load(): SavedEntitlement? = saved
    override fun save(body: EntitlementBody, savedAt: Long) {
        saved = SavedEntitlement(body, savedAt)
        saves += 1
    }
}

object PlayProducts {
    private fun phase(price: String, micros: Long, period: String) = PricingPhaseInfo(price, micros, period)

    /** Premium with both plans and a trial on each; one-time products for [packProductIds]. */
    fun all(vararg packProductIds: String): ProductsSnapshot = ProductsSnapshot(
        subs = mapOf(
            "premium" to SubProductInfo(
                "premium",
                listOf(
                    SubOfferInfo("monthly", null, "m-base", listOf(phase("$4.99", 4_990_000, "P1M"))),
                    SubOfferInfo("monthly", "trial-7d", "m-trial", listOf(phase("Free", 0, "P7D"), phase("$4.99", 4_990_000, "P1M"))),
                    SubOfferInfo("yearly", null, "y-base", listOf(phase("$29.99", 29_990_000, "P1Y"))),
                    SubOfferInfo("yearly", "trial-7d", "y-trial", listOf(phase("Free", 0, "P7D"), phase("$29.99", 29_990_000, "P1Y"))),
                ),
            ),
        ),
        inapp = packProductIds.associateWith { InappProductInfo(it, "$1.99", "ot-$it") },
    )
}
