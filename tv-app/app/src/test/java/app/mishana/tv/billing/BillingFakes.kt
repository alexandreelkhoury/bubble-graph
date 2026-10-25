package app.mishana.tv.billing

import android.app.Activity
import app.mishana.tv.protocol.CatalogPack
import app.mishana.tv.protocol.CatalogResponse
import app.mishana.tv.protocol.CatalogPremium
import app.mishana.tv.protocol.EntitlementBody
import app.mishana.tv.protocol.LocalizedTitle
import app.mishana.tv.protocol.PurchaseRef
import app.mishana.tv.protocol.PurchaseResultEntry
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
    val productQueries = mutableListOf<List<String>>()

    override suspend fun connect(): GatewayResult<Unit> {
        connects += 1
        return connectResult
    }

    override suspend fun queryProducts(ids: List<String>): GatewayResult<ProductsSnapshot> {
        productQueries += ids
        val p = products
        if (p !is GatewayResult.Ok) return p
        return GatewayResult.Ok(
            ProductsSnapshot(
                inapp = p.value.inapp.filterKeys { it in ids },
                unfetched = p.value.unfetched.filterKeys { it in ids },
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

    /** Overrides `premiumUntil` (e.g. a timed owner grant); null = 30 days ahead. */
    var premiumUntil: Long? = null

    var catalog = CatalogResponse(
        mode = "google",
        packageName = "app.mishana.tv",
        premium = CatalogPremium("premium"),
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
        val exp = t + 8 * 3_600_000L
        return EntitlementBody(
            token = "tok$tokenSeq",
            premium = premium,
            premiumUntil = if (premium) premiumUntil ?: (t + 30L * 86_400_000) else null,
            packs = packs.toList(),
            expiresAt = exp,
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
    /** Lifetime `premium` ($7.99) plus one-time products for [packProductIds] ($1.99), all INAPP. */
    fun all(vararg packProductIds: String): ProductsSnapshot = ProductsSnapshot(
        inapp = mapOf("premium" to InappProductInfo("premium", "$7.99", "ot-premium")) +
            packProductIds.associateWith { InappProductInfo(it, "$1.99", "ot-$it") },
    )
}
