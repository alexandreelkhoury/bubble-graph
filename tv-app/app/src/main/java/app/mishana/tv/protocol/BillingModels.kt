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

/** `SubscriptionInfo`. `state` is a Play `SubscriptionState` name; `expiresAt` is the raw Google expiry (ms, no slack). */
@Serializable data class SubscriptionInfo(
    val state: String,
    val basePlanId: String?,
    val autoRenewing: Boolean,
    val inTrial: Boolean,
    val expiresAt: Long?,
)

/** `EntitlementBody`. `premiumUntil` includes RENEWAL_SLACK_MS; `expiresAt` is the token's exp (ms). */
@Serializable data class EntitlementBody(
    val token: String,
    val premium: Boolean,
    val premiumUntil: Long?,
    val packs: List<String>,
    val expiresAt: Long,
    val subscription: SubscriptionInfo?,
)

@Serializable data class PurchaseResultEntry(val productId: String, val result: String)

@Serializable data class VerifyResponse(val entitlement: EntitlementBody, val results: List<PurchaseResultEntry>)

@Serializable data class EntitlementResponse(val entitlement: EntitlementBody)

@Serializable data class CatalogSubscription(val productId: String, val basePlanIds: List<String>, val trialOfferId: String)

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
    val subscription: CatalogSubscription,
    val freePackIds: List<String>,
    val packs: List<CatalogPack>,
)

/** `{"error": BillingErrorCode}`. */
@Serializable data class BillingHttpError(val error: String)

/** §3.10 fake routes (debug builds only use them). */
@Serializable data class FakePurchaseRequest(
    val installId: String,
    val productId: String,
    val basePlanId: String? = null,
    val offerId: String? = null,
    val outcome: String? = null,
)

@Serializable data class FakePurchaseResponse(val purchaseToken: String)

/** `PURCHASE_RESULTS` and `SUB_STATES` values the TV branches on. */
object PurchaseResults {
    const val OK = "OK"
    const val PENDING = "PENDING"
    const val NOT_OWNED = "NOT_OWNED"
    const val INVALID = "INVALID"
    const val REVOKED = "REVOKED"
    const val INSTALL_LIMIT = "INSTALL_LIMIT"
    const val UPSTREAM_ERROR = "UPSTREAM_ERROR"
}

object SubStates {
    const val ACTIVE = "SUBSCRIPTION_STATE_ACTIVE"
    const val IN_GRACE_PERIOD = "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"
    const val ON_HOLD = "SUBSCRIPTION_STATE_ON_HOLD"
    const val PAUSED = "SUBSCRIPTION_STATE_PAUSED"
    const val CANCELED = "SUBSCRIPTION_STATE_CANCELED"
    const val EXPIRED = "SUBSCRIPTION_STATE_EXPIRED"
    const val PENDING = "SUBSCRIPTION_STATE_PENDING"
}
