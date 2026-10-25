package app.mishana.tv.protocol

import app.mishana.tv.Constants
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Kotlin mirrors of PAYMENTS-SPEC §3.4 (shared/src/billing/http.ts) and the two TV-only WS messages of §3.11.
// Exact names. Responses are decoded with ProtocolJson.decoder (tolerant of new keys); the fixtures round-trip strictly.

/** `{"v":1,"t":"entitlement","token":"…"}` (C2S, TV only). The server answers only with an error when it rejects it. */
@Serializable @SerialName("entitlement")
data class EntitlementMsg(val v: Int = Constants.PROTOCOL_VERSION, val token: String) : ClientMessage()

/** `{"v":1,"t":"storeOpen","open":true}` (C2S, TV only): the host-busy signal while the Store / Play sheet is up. */
@Serializable @SerialName("storeOpen")
data class StoreOpenMsg(val v: Int = Constants.PROTOCOL_VERSION, val open: Boolean) : ClientMessage()

@Serializable data class PurchaseRef(val productId: String, val purchaseToken: String)

@Serializable data class VerifyRequest(val installId: String, val purchases: List<PurchaseRef>)

@Serializable data class EntitlementRequest(val installId: String)

/**
 * `EntitlementBody`. `premiumUntil` (ms): for lifetime premium or an open-ended grant it is the token's exp; a timed
 * owner grant ends earlier. `expiresAt` is the token's exp (ms).
 */
@Serializable data class EntitlementBody(
    val token: String,
    val premium: Boolean,
    val premiumUntil: Long?,
    val packs: List<String>,
    val expiresAt: Long,
)

@Serializable data class PurchaseResultEntry(val productId: String, val result: String)

@Serializable data class VerifyResponse(val entitlement: EntitlementBody, val results: List<PurchaseResultEntry>)

@Serializable data class EntitlementResponse(val entitlement: EntitlementBody)

/** The lifetime Premium product (a one-time INAPP product). */
@Serializable data class CatalogPremium(val productId: String)

@Serializable data class CatalogPack(
    val packId: String,
    val productId: String,
    val locale: String,
    val language: String,
    val title: LocalizedTitle,
    val pairCount: Int,
    val ageRating: String,
)

/** `GET /api/billing/catalog`: premium packs only, in catalog order. */
@Serializable data class CatalogResponse(
    val mode: String,
    val packageName: String,
    val premium: CatalogPremium,
    val freePackIds: List<String>,
    val packs: List<CatalogPack>,
)

/** `{"error": BillingErrorCode}`. */
@Serializable data class BillingHttpError(val error: String)

/** §3.10 fake routes (debug builds only use them). */
@Serializable data class FakePurchaseRequest(
    val installId: String,
    val productId: String,
    val outcome: String? = null,
)

@Serializable data class FakePurchaseResponse(val purchaseToken: String)

/** `PURCHASE_RESULTS` values the TV branches on. */
object PurchaseResults {
    const val OK = "OK"
    const val PENDING = "PENDING"
    const val NOT_OWNED = "NOT_OWNED"
    const val INVALID = "INVALID"
    const val REVOKED = "REVOKED"
    const val INSTALL_LIMIT = "INSTALL_LIMIT"
    const val UPSTREAM_ERROR = "UPSTREAM_ERROR"
}
