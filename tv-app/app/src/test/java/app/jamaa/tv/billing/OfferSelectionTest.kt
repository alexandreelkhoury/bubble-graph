package app.jamaa.tv.billing

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** PAYMENTS-SPEC §4.2 "Offers" / §4.9 OfferSelectionTest. */
class OfferSelectionTest {
    private fun phase(price: String, micros: Long, period: String) = PricingPhaseInfo(price, micros, period)
    private fun base(plan: String, price: String, period: String) = SubOfferInfo(plan, null, "tok-$plan-base", listOf(phase(price, 4_990_000, period)))
    private fun trial(plan: String, price: String, period: String, trialPeriod: String = "P7D") =
        SubOfferInfo(plan, Products.TRIAL_OFFER_ID, "tok-$plan-trial", listOf(phase("Free", 0, trialPeriod), phase(price, 4_990_000, period)))

    private val full = SubProductInfo(
        "jamaa_pass",
        listOf(base("monthly", "$4.99", "P1M"), trial("monthly", "$4.99", "P1M"), base("yearly", "$29.99", "P1Y"), trial("yearly", "$29.99", "P1Y", "P1W")),
    )

    @Test
    fun trialOfferIsChosenWhenEligible() {
        val y = OfferSelection.planFor(full, "yearly")!!
        assertEquals("tok-yearly-trial", y.offerToken)
        assertEquals(Products.TRIAL_OFFER_ID, y.offerId)
        assertEquals("$29.99", y.price) // the recurring (last) phase
        assertEquals(BillingPeriod.YEAR, y.period)
        assertEquals(7, y.trialDays) // P1W
        val m = OfferSelection.planFor(full, "monthly")!!
        assertEquals("tok-monthly-trial", m.offerToken)
        assertEquals(BillingPeriod.MONTH, m.period)
        assertEquals(7, m.trialDays) // P7D
    }

    @Test
    fun ineligibleUserGetsTheBaseOffer() {
        // Play returns only user-eligible offers: no trial entry at all.
        val sub = SubProductInfo("jamaa_pass", listOf(base("monthly", "$4.99", "P1M"), base("yearly", "$29.99", "P1Y")))
        val y = OfferSelection.planFor(sub, "yearly")!!
        assertEquals("tok-yearly-base", y.offerToken)
        assertNull(y.offerId)
        assertNull(y.trialDays)
        assertEquals(listOf("yearly", "monthly"), OfferSelection.plans(sub).map { it.basePlanId })
    }

    @Test
    fun missingPlansAreLeftOut() {
        val sub = SubProductInfo("jamaa_pass", listOf(base("monthly", "$4.99", "P1M")))
        assertNull(OfferSelection.planFor(sub, "yearly"))
        assertEquals(listOf("monthly"), OfferSelection.plans(sub).map { it.basePlanId })
        assertEquals(emptyList<PlanOffer>(), OfferSelection.plans(null))
        assertEquals(emptyList<PlanOffer>(), OfferSelection.plans(SubProductInfo("jamaa_pass", emptyList())))
    }

    @Test
    fun trialDaysAndPeriods() {
        assertEquals(7, OfferSelection.trialDays(listOf(phase("Free", 0, "P7D"), phase("$1", 1, "P1M"))))
        assertEquals(14, OfferSelection.trialDays(listOf(phase("Free", 0, "P2W"))))
        assertEquals(3, OfferSelection.trialDays(listOf(phase("Free", 0, "P3D"))))
        assertNull(OfferSelection.trialDays(listOf(phase("$1", 1, "P1M"))))
        assertNull(OfferSelection.trialDays(listOf(phase("Free", 0, "P1M"))))
        assertEquals(BillingPeriod.MONTH, OfferSelection.periodOf("P1M"))
        assertEquals(BillingPeriod.YEAR, OfferSelection.periodOf("P1Y"))
        assertEquals(BillingPeriod.YEAR, OfferSelection.periodOf("P12M"))
        assertNull(OfferSelection.periodOf("P3M"))
        assertNull(OfferSelection.periodOf("P1W"))
    }

    @Test
    fun disclosureFollowsTheFocusedPlan() {
        val withTrial = Disclosure.of(OfferSelection.planFor(full, "yearly")!!)
        assertEquals(7, withTrial.trialDays)
        assertEquals("store.legalCancelTrial", withTrial.cancelKey)
        val sub = SubProductInfo("jamaa_pass", listOf(base("monthly", "$4.99", "P1M")))
        val noTrial = Disclosure.of(OfferSelection.planFor(sub, "monthly")!!)
        assertNull(noTrial.trialDays)
        assertEquals("$4.99", noTrial.price)
        assertEquals("store.legalCancel", noTrial.cancelKey)
    }

    @Test
    fun packOfferUsesTheSingleOfferToken() {
        assertEquals(PurchasableOffer("pack_en_food_01", "ot"), OfferSelection.packOffer(InappProductInfo("pack_en_food_01", "$1.99", "ot")))
        assertNull(OfferSelection.packOffer(null))
    }

    /** JAMAA-PLATFORM §4.1 / §4.5: the trial badge only with an eligible trial-7d offer; "Save {n}%" from the two prices. */
    @Test
    fun trialBadgeAndYearlySaving() {
        val sub = SubProductInfo(
            "jamaa_pass",
            listOf(
                SubOfferInfo("monthly", null, "m", listOf(phase("$4.99", 4_990_000, "P1M"))),
                SubOfferInfo("yearly", Products.TRIAL_OFFER_ID, "yt", listOf(phase("Free", 0, "P7D"), phase("$29.99", 29_990_000, "P1Y"))),
            ),
        )
        val m = OfferSelection.planFor(sub, "monthly")!!
        val y = OfferSelection.planFor(sub, "yearly")!!
        assertEquals(false, m.trialBadge)
        assertEquals(true, y.trialBadge)
        assertEquals(29_990_000L, y.priceMicros) // the recurring phase, not the free one
        assertEquals(50, OfferSelection.savePercent(m, y)) // 1 − 29.99 / (12 × 4.99) = 49.9 %
        assertNull(OfferSelection.savePercent(null, y))
        assertNull(OfferSelection.savePercent(m, m.copy(priceMicros = 4_990_000L * 12))) // no saving: no badge
    }
}
