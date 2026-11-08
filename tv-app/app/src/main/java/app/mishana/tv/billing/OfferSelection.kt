package app.mishana.tv.billing

/** A subscription plan button's data (PAYMENTS-SPEC §4.2 "Offers", §4.5 disclosure). */
data class PlanOffer(
    val basePlanId: String,
    /** The token passed to `setOfferToken`: the trial offer's when the user is eligible, else the base offer's. */
    val offerToken: String,
    /** The offer id behind [offerToken] (`trial-7d` or null). */
    val offerId: String?,
    /** The recurring price, Play's `formattedPrice` verbatim. */
    val price: String,
    val period: BillingPeriod?,
    /** Free-trial length in days, or null without an eligible trial. */
    val trialDays: Int?,
)

enum class BillingPeriod { MONTH, YEAR }

/** §4.2 offer rules. Pure: works on the Play-free [SubProductInfo] snapshot. */
object OfferSelection {
    private val DAYS = Regex("^P(\\d+)D$")
    private val WEEKS = Regex("^P(\\d+)W$")
    private val MONTHS = Regex("^P(\\d+)M$")
    private val YEARS = Regex("^P(\\d+)Y$")

    /**
     * The plan for [basePlanId]: trial offer = `basePlanId == id && offerId == TRIAL_OFFER_ID` (present only if Play
     * says the user is eligible), base offer = `basePlanId == id && offerId == null`. Null when neither exists
     * (e.g. NO_ELIGIBLE_OFFER). Price and period come from the chosen offer's last pricing phase.
     */
    fun planFor(sub: SubProductInfo?, basePlanId: String): PlanOffer? {
        if (sub == null) return null
        val trial = sub.offers.firstOrNull { it.basePlanId == basePlanId && it.offerId == Products.TRIAL_OFFER_ID }
        val base = sub.offers.firstOrNull { it.basePlanId == basePlanId && it.offerId == null }
        val chosen = trial ?: base ?: return null
        val recurring = chosen.phases.lastOrNull() ?: return null
        return PlanOffer(
            basePlanId = basePlanId,
            offerToken = chosen.offerToken,
            offerId = chosen.offerId,
            price = recurring.formattedPrice,
            period = periodOf(recurring.billingPeriod),
            trialDays = trial?.let { trialDays(it.phases) },
        )
    }

    /** §4.4: yearly first, then monthly; plans Play did not return are left out. */
    fun plans(sub: SubProductInfo?): List<PlanOffer> =
        listOf(Products.BASE_PLAN_YEARLY, Products.BASE_PLAN_MONTHLY).mapNotNull { planFor(sub, it) }

    /** Days of the first free phase (`priceAmountMicros == 0`): `P{n}D` → n, `P{n}W` → 7n. Null if none or unparseable. */
    fun trialDays(phases: List<PricingPhaseInfo>): Int? {
        val free = phases.firstOrNull { it.priceAmountMicros == 0L } ?: return null
        DAYS.matchEntire(free.billingPeriod)?.let { return it.groupValues[1].toInt() }
        WEEKS.matchEntire(free.billingPeriod)?.let { return it.groupValues[1].toInt() * 7 }
        return null
    }

    /** ISO 8601 billing period: `P1M` → month, `P1Y` (or `P12M`) → year; anything else → null. */
    fun periodOf(iso: String): BillingPeriod? {
        MONTHS.matchEntire(iso)?.let { return if (it.groupValues[1] == "1") BillingPeriod.MONTH else if (it.groupValues[1] == "12") BillingPeriod.YEAR else null }
        YEARS.matchEntire(iso)?.let { return if (it.groupValues[1] == "1") BillingPeriod.YEAR else null }
        return null
    }

    /** One-time product: its single offer (`oneTimePurchaseOfferDetailsList?.firstOrNull() ?: oneTimePurchaseOfferDetails`). */
    fun packOffer(p: InappProductInfo?): PurchasableOffer? = p?.let { PurchasableOffer(it.productId, it.offerToken) }
}

/** §4.5: the one disclosure paragraph under the plan buttons, for the focused plan. */
data class Disclosure(
    /** `store.legalTrialRenew` (plural on [trialDays]) when non-null, else `store.legalPriceRenew`. */
    val trialDays: Int?,
    val price: String,
    val period: BillingPeriod?,
) {
    /** `store.legalCancelTrial` with a trial, else `store.legalCancel`. */
    val cancelKey: String get() = if (trialDays != null) "store.legalCancelTrial" else "store.legalCancel"

    companion object {
        fun of(plan: PlanOffer): Disclosure = Disclosure(plan.trialDays, plan.price, plan.period)
    }
}
