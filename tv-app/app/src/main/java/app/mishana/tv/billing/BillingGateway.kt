package app.mishana.tv.billing

import android.app.Activity
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.coroutines.resume

/**
 * PAYMENTS-SPEC §4.1: the seam between the billing logic and Google Play Billing. [PlayBillingGateway] is the real
 * one; debug builds may swap in the fake gateway (§4.8). Everything here is Play-free, so it runs on the JVM.
 */
interface BillingGateway {
    /** From `PurchasesUpdatedListener` (or the fake purchase dialog). */
    val purchaseUpdates: SharedFlow<PurchaseUpdate>

    suspend fun connect(): GatewayResult<Unit>
    suspend fun queryProducts(subIds: List<String>, inappIds: List<String>): GatewayResult<ProductsSnapshot>

    /** SUBS + INAPP, PURCHASED or PENDING. */
    suspend fun queryOwned(): GatewayResult<List<OwnedPurchase>>

    /** Main thread. `Ok` means the Play sheet is up; the outcome arrives on [purchaseUpdates]. */
    fun launch(activity: Activity, offer: PurchasableOffer, obfuscatedAccountId: String): GatewayResult<Unit>
    fun end()

    /** §4.2: `BILLING_UNAVAILABLE` is terminal until the next `ON_START`, which calls this. */
    fun onLifecycleStart() {}

    /** §4.8: true while the debug fake store is in use (the Store shows `store.testMode`). */
    val isFake: Boolean get() = false

    /** §4.8: the fake gateway's remote-friendly purchase dialog; null for Google Play. */
    val fakePrompt: FakePurchasePrompt? get() = null
}

enum class OwnedState { PURCHASED, PENDING }

data class OwnedPurchase(val productId: String, val purchaseToken: String, val state: OwnedState, val suspended: Boolean)

/** One `onPurchasesUpdated(result, purchases)`. [sub] is the PBL 8 sub-response code, when any. */
data class PurchaseUpdate(val code: Int, val sub: Int?, val purchases: List<OwnedPurchase>)

sealed interface GatewayResult<out T> {
    data class Ok<T>(val value: T) : GatewayResult<T>
    data class Err(val code: Int, val sub: Int?) : GatewayResult<Nothing>
}

/** What `launchBillingFlow` needs: the product, the chosen offer token, and (subs) the plan/offer for the fake store. */
data class PurchasableOffer(val productId: String, val offerToken: String?, val basePlanId: String? = null, val offerId: String? = null)

/** A pricing phase of a subscription offer (`ProductDetails.PricingPhase`). */
data class PricingPhaseInfo(val formattedPrice: String, val priceAmountMicros: Long, val billingPeriod: String)

/** `ProductDetails.SubscriptionOfferDetails`, Play-free. [offerId] null = the base plan's own offer. */
data class SubOfferInfo(val basePlanId: String, val offerId: String?, val offerToken: String, val phases: List<PricingPhaseInfo>)

data class SubProductInfo(val productId: String, val offers: List<SubOfferInfo>)

/** A one-time product's single purchase option. */
data class InappProductInfo(val productId: String, val formattedPrice: String, val offerToken: String?)

/**
 * Both `queryProductDetailsAsync` answers. [unfetched] maps a product id Play did not return to its
 * `UnfetchedProduct.StatusCode` (PRODUCT_NOT_FOUND = 3, NO_ELIGIBLE_OFFER = 4).
 */
data class ProductsSnapshot(
    val subs: Map<String, SubProductInfo> = emptyMap(),
    val inapp: Map<String, InappProductInfo> = emptyMap(),
    val unfetched: Map<String, Int> = emptyMap(),
)

/** §4.8: the debug fake purchase dialog ("Fake purchase: Approve / Pending / Cancel / Error"). */
interface FakePurchasePrompt {
    val request: StateFlow<PurchasableOffer?>
    fun choose(choice: FakeChoice)
}

enum class FakeChoice { APPROVE, PENDING, CANCEL, ERROR }

/** `BillingClient.BillingResponseCode` values (✔ PBL reference). Kept here so the pure code needs no Play classes. */
object ResponseCodes {
    const val FEATURE_NOT_SUPPORTED = -2
    const val SERVICE_DISCONNECTED = -1
    const val OK = 0
    const val USER_CANCELED = 1
    const val SERVICE_UNAVAILABLE = 2
    const val BILLING_UNAVAILABLE = 3
    const val ITEM_UNAVAILABLE = 4
    const val DEVELOPER_ERROR = 5
    const val ERROR = 6
    const val ITEM_ALREADY_OWNED = 7
    const val ITEM_NOT_OWNED = 8
    const val NETWORK_ERROR = 12

    /** §4.2: the setup results that are retried by hand (with backoff, up to 5 times). */
    val RETRYABLE_SETUP: Set<Int> = setOf(SERVICE_UNAVAILABLE, SERVICE_DISCONNECTED, ERROR, NETWORK_ERROR)
}

/**
 * §4.2 `connect()`: one `startConnection` in flight (concurrent callers await the same result), manual retries only for
 * [ResponseCodes.RETRYABLE_SETUP] (up to [maxRetries], never while a call is in flight), and `BILLING_UNAVAILABLE`
 * terminal until [onLifecycleStart]. [start] calls `startConnection` and reports `onBillingSetupFinished`'s code once.
 */
class ConnectGuard(
    private val start: (onResult: (Int) -> Unit) -> Unit,
    private val delayMs: (attempt: Int) -> Long,
    private val maxRetries: Int = 5,
) {
    private val mutex = Mutex()
    private var inFlight: CompletableDeferred<Int>? = null

    @Volatile var ready: Boolean = false
        private set

    @Volatile var terminal: Boolean = false
        private set

    /** Number of `startConnection` calls made (tests). */
    @Volatile var starts: Int = 0
        private set

    suspend fun connect(): Int {
        if (ready) return ResponseCodes.OK
        if (terminal) return ResponseCodes.BILLING_UNAVAILABLE
        var owner = false
        val d = mutex.withLock {
            inFlight ?: CompletableDeferred<Int>().also {
                inFlight = it
                owner = true
            }
        }
        if (owner) {
            val code = try {
                runAttempts()
            } catch (t: Throwable) {
                mutex.withLock { inFlight = null }
                d.completeExceptionally(t)
                throw t
            }
            mutex.withLock { inFlight = null }
            d.complete(code)
        }
        return d.await()
    }

    private suspend fun runAttempts(): Int {
        var attempt = 0
        while (true) {
            starts += 1
            val code = suspendCancellableCoroutine { cont ->
                var done = false
                start { c ->
                    // onBillingSetupFinished may fire again later (auto-reconnect): only the first answer counts here.
                    if (!done) {
                        done = true
                        if (cont.isActive) cont.resume(c)
                    } else if (c == ResponseCodes.OK) {
                        ready = true
                    }
                }
            }
            when {
                code == ResponseCodes.OK -> {
                    ready = true
                    return code
                }
                code == ResponseCodes.BILLING_UNAVAILABLE -> {
                    terminal = true
                    return code
                }
                code in ResponseCodes.RETRYABLE_SETUP && attempt < maxRetries -> {
                    delay(delayMs(attempt))
                    attempt += 1
                }
                else -> return code
            }
        }
    }

    /** `onBillingServiceDisconnected()`: state only (auto-reconnect re-establishes it on the next call). */
    fun onDisconnected() {
        ready = false
    }

    /** The next `ON_START` may try again after `BILLING_UNAVAILABLE` (the user may have signed in). */
    fun onLifecycleStart() {
        terminal = false
    }
}
