package app.mishana.tv.billing

import app.mishana.tv.protocol.CatalogResponse
import app.mishana.tv.protocol.EntitlementBody
import app.mishana.tv.protocol.LocalizedTitle
import app.mishana.tv.protocol.LockedPackInfo
import app.mishana.tv.protocol.SubStates

// PAYMENTS-SPEC §4.4: the Store's state machine and screen model, pure (StoreFocusTest / BillingRepositoryTest).

enum class StoreOrigin { LOBBY_BUTTON, LOCKED_PACK, LOCKED_SETTING }

/** `TvUiState.InRoom.store`: why and where the Store opened. */
data class StoreEntry(val focusProductId: String?, val origin: StoreOrigin)

enum class UnavailableReason { NETWORK, BILLING_UNAVAILABLE }

sealed interface StorePhase {
    data object Loading : StorePhase
    data object Ready : StorePhase
    data class Unavailable(val reason: UnavailableReason) : StorePhase
}

/** `BillingRepository.state`: process-wide, survives rooms. */
data class StoreUiState(
    val phase: StorePhase = StorePhase.Loading,
    val storeVisible: Boolean = false,
    /** Null when `GET /api/billing/catalog` failed (the pack list then falls back to `view.lockedPacks`). */
    val catalog: CatalogResponse? = null,
    /** Null until Play answered for this Store opening (ProductDetails are never cached across openings). */
    val products: ProductsSnapshot? = null,
    val entitlement: EntitlementBody? = null,
    /** Product ids with a PENDING Play purchase. */
    val pending: Set<String> = emptySet(),
    /** A subscription Play reports as suspended (`Purchase.isSuspended`): Fix payment, never plan buttons. */
    val subscriptionSuspended: Boolean = false,
    /** Play said BILLING_UNAVAILABLE: terminal until the next ON_START (locked rows show `settings.locked`). */
    val billingUnavailable: Boolean = false,
    /** The product whose Play sheet is up or whose purchase is being confirmed (`/verify` not answered yet). */
    val purchaseInFlight: String? = null,
    /** The product whose confirmation took longer than 15 s: its button shows `store.verifyFailed` (retries continue). */
    val slowConfirm: String? = null,
    /** Debug fake store in use: banner `store.testMode`. */
    val fake: Boolean = false,
) {
    /** §3.11 / §4.3: the TV sends `storeOpen{open:true}` while this is true. */
    val busy: Boolean get() = storeVisible || purchaseInFlight != null
}

sealed interface PremiumCard {
    /**
     * Not premium and not suspended: plan buttons (yearly first). [pending]: a PENDING premium purchase;
     * [confirming] / [slow]: the premium purchase is being confirmed (spinner + `store.confirming` / `store.verifyFailed`).
     */
    data class Plans(val plans: List<PlanOffer>, val pending: Boolean, val confirming: Boolean = false, val slow: Boolean = false) : PremiumCard

    /** ON_HOLD / PAUSED / Play `isSuspended`: `store.fixPayment` + Fix payment. */
    data object Suspended : PremiumCard

    /** IN_GRACE_PERIOD (premium still on): `store.premiumActive`, `store.fixPayment`, Manage. */
    data object Grace : PremiumCard

    /** `store.premiumActive` + renews/ends on [untilMs] (raw Google expiry) + Manage. */
    data class Active(val autoRenewing: Boolean, val untilMs: Long?) : PremiumCard

    /** Play returned no usable `premium` product: `store.unavailable`, no buttons. */
    data object NoProduct : PremiumCard
}

sealed interface PackTrailing {
    data object Owned : PackTrailing
    data object Included : PackTrailing
    data object Pending : PackTrailing
    data object Confirming : PackTrailing

    /** Confirmation took longer than 15 s: `store.verifyFailed` (the app keeps retrying). */
    data object Slow : PackTrailing
    data class Buy(val price: String) : PackTrailing
}

data class PackCard(
    val productId: String,
    val packId: String,
    val title: LocalizedTitle,
    val pairCount: Int,
    val language: String,
    val otherLanguage: Boolean,
    val trailing: PackTrailing,
) {
    val buyable: Boolean get() = trailing is PackTrailing.Buy
}

data class StoreScreenModel(
    val premium: PremiumCard,
    /** The room's word language first, then the other languages (after the `store.otherLanguages` divider). */
    val packs: List<PackCard>,
    val showOtherLanguages: Boolean,
    /** `store.premiumPitch`: number of premium packs and their pairs rounded down to a multiple of 10. */
    val pitchCount: Int,
    val pitchPairs: Int,
    val pendingFooter: Boolean,
)

sealed interface StoreFocusTarget {
    /** The focusable loading stage (Back works). PAY-GAP: §4.4 names no Loading target; DESIGN needs one. */
    data object Loading : StoreFocusTarget
    data object Retry : StoreFocusTarget
    data object Ok : StoreFocusTarget
    data class Plan(val basePlanId: String) : StoreFocusTarget
    data object FixPayment : StoreFocusTarget
    data object Manage : StoreFocusTarget
    data class Pack(val productId: String) : StoreFocusTarget
    data object Restore : StoreFocusTarget
}

object StoreModel {
    private val SUSPENDED_STATES = setOf(SubStates.ON_HOLD, SubStates.PAUSED)

    fun premiumActive(e: EntitlementBody?, nowMs: Long): Boolean =
        e != null && e.premium && (e.premiumUntil == null || e.premiumUntil > nowMs)

    fun premiumCard(s: StoreUiState, nowMs: Long): PremiumCard {
        val e = s.entitlement
        val sub = e?.subscription
        val active = premiumActive(e, nowMs)
        return when {
            sub?.state == SubStates.IN_GRACE_PERIOD && active -> PremiumCard.Grace
            s.subscriptionSuspended || sub?.state in SUSPENDED_STATES -> PremiumCard.Suspended
            active -> PremiumCard.Active(autoRenewing = sub?.autoRenewing ?: false, untilMs = sub?.expiresAt)
            else -> {
                val plans = OfferSelection.plans(s.products?.subs?.get(Products.PREMIUM_PRODUCT_ID))
                val id = Products.PREMIUM_PRODUCT_ID
                if (plans.isEmpty()) PremiumCard.NoProduct else PremiumCard.Plans(plans, id in s.pending, s.purchaseInFlight == id, s.slowConfirm == id)
            }
        }
    }

    /**
     * The Store screen for [s] in a room whose word language is [wordLocale]. Without a catalog (fetch failed) the packs
     * come from [lockedPacks] (the room's word language only) and "Other languages" is hidden.
     */
    fun build(s: StoreUiState, wordLocale: String, lockedPacks: List<LockedPackInfo>, nowMs: Long): StoreScreenModel {
        val roomLang = Products.languageOf(wordLocale)
        val source: List<PackSource> = s.catalog?.packs?.map { PackSource(it.productId, it.packId, it.title, it.pairCount, Products.languageOf(it.language)) }
            ?: lockedPacks.map { PackSource(it.productId, it.id, it.title, it.pairCount, Products.languageOf(it.locale)) }
        val owned = s.entitlement?.packs?.toSet() ?: emptySet()
        val premium = premiumActive(s.entitlement, nowMs)
        fun trailing(p: PackSource): PackTrailing {
            val product = s.products?.inapp?.get(p.productId)
            return when {
                p.packId in owned -> PackTrailing.Owned
                premium -> PackTrailing.Included
                p.productId in s.pending -> PackTrailing.Pending
                s.purchaseInFlight == p.productId -> PackTrailing.Confirming
                s.slowConfirm == p.productId -> PackTrailing.Slow
                // §1.4: not created in Play Console yet (or not returned): no Buy button.
                product == null || product.offerToken == null -> PackTrailing.Included
                else -> PackTrailing.Buy(product.formattedPrice)
            }
        }
        val mine = source.filter { it.language == roomLang }
        val others = if (s.catalog == null) emptyList() else source.filter { it.language != roomLang }
        val cards = mine.map { it.card(false, trailing(it)) } + others.map { it.card(true, trailing(it)) }
        val pairs = source.sumOf { it.pairCount }
        return StoreScreenModel(
            premium = premiumCard(s, nowMs),
            packs = cards,
            showOtherLanguages = others.isNotEmpty(),
            pitchCount = source.size,
            pitchPairs = (pairs / 10) * 10,
            pendingFooter = s.pending.isNotEmpty(),
        )
    }

    /** §4.4 "Focus": the initial focus target for [entry] in [phase]. Something is always focused. */
    fun initialFocus(entry: StoreEntry, phase: StorePhase, model: StoreScreenModel?): StoreFocusTarget = when (phase) {
        StorePhase.Loading -> StoreFocusTarget.Loading
        is StorePhase.Unavailable -> if (phase.reason == UnavailableReason.NETWORK) StoreFocusTarget.Retry else StoreFocusTarget.Ok
        StorePhase.Ready -> {
            val m = model
            val wanted = entry.focusProductId
            when {
                m == null -> StoreFocusTarget.Loading
                wanted != null && wanted != Products.PREMIUM_PRODUCT_ID && m.packs.any { it.productId == wanted } -> StoreFocusTarget.Pack(wanted)
                else -> premiumFocus(m)
            }
        }
    }

    private fun premiumFocus(m: StoreScreenModel): StoreFocusTarget = when (val c = m.premium) {
        is PremiumCard.Plans -> StoreFocusTarget.Plan(c.plans.first().basePlanId)
        PremiumCard.Suspended -> StoreFocusTarget.FixPayment
        PremiumCard.Grace, is PremiumCard.Active -> StoreFocusTarget.Manage
        PremiumCard.NoProduct -> m.packs.firstOrNull()?.let { StoreFocusTarget.Pack(it.productId) } ?: StoreFocusTarget.Restore
    }

    /** §4.4: the manage link is offered only for a subscription that has not expired. */
    fun showsManage(c: PremiumCard): Boolean = c is PremiumCard.Active || c == PremiumCard.Grace || c == PremiumCard.Suspended

    private class PackSource(val productId: String, val packId: String, val title: LocalizedTitle, val pairCount: Int, val language: String) {
        fun card(other: Boolean, trailing: PackTrailing) = PackCard(productId, packId, title, pairCount, language, other, trailing)
    }
}
