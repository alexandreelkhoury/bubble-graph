package app.mishana.tv.billing

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** PAYMENTS-SPEC §4.6, every row. */
class BillingErrorsTest {
    @Test
    fun playCodes() {
        assertEquals(BillingErrorUi.None, BillingErrors.forPlayCode(0))
        assertEquals(BillingErrorUi.None, BillingErrors.forPlayCode(1)) // USER_CANCELED: nothing
        for (c in listOf(2, 12, -1)) assertEquals("code $c", BillingErrorUi.Toast("store.network"), BillingErrors.forPlayCode(c))
        assertEquals(BillingErrorUi.PlayUnavailable, BillingErrors.forPlayCode(3))
        assertEquals(BillingErrorUi.Toast("store.itemUnavailable"), BillingErrors.forPlayCode(4))
        for (c in listOf(5, 6, -2)) assertEquals("code $c", BillingErrorUi.Toast("store.errorGeneric"), BillingErrors.forPlayCode(c))
        assertEquals(BillingErrorUi.AlreadyOwnedRestore, BillingErrors.forPlayCode(7))
        assertEquals(BillingErrorUi.Toast("store.errorGeneric"), BillingErrors.forPlayCode(8))
        assertEquals(BillingErrorUi.Toast("store.errorGeneric"), BillingErrors.forPlayCode(99)) // unknown
    }

    @Test
    fun developerSideCodesAreLogged() {
        for (c in listOf(5, 6, -2)) assertTrue(BillingErrors.isDeveloperSide(c))
        for (c in listOf(0, 1, 2, 3, 4, 7, 8, 12, -1)) assertFalse(BillingErrors.isDeveloperSide(c))
    }

    @Test
    fun serverRows() {
        assertEquals(BillingErrorUi.Toast("store.verifyFailed"), BillingErrors.forPurchaseResult("UPSTREAM_ERROR"))
        assertEquals(BillingErrorUi.Toast("store.installLimit", "help@example.com"), BillingErrors.forPurchaseResult("INSTALL_LIMIT", "help@example.com"))
        assertEquals(BillingErrorUi.Toast("store.installLimitNoHelp"), BillingErrors.forPurchaseResult("INSTALL_LIMIT", ""))
        for (r in listOf("OK", "PENDING", "NOT_OWNED", "INVALID", "REVOKED")) assertEquals(r, BillingErrorUi.None, BillingErrors.forPurchaseResult(r))
        assertEquals(BillingErrorUi.Toast("error.rateLimited"), BillingErrors.forHttpFailure(429, "RATE_LIMITED"))
        assertEquals(BillingErrorUi.Toast("store.verifyFailed"), BillingErrors.forHttpFailure(503, "NOT_CONFIGURED"))
        assertEquals(BillingErrorUi.Toast("store.verifyFailed"), BillingErrors.forHttpFailure(500, "INTERNAL"))
        assertEquals(BillingErrorUi.Toast("store.verifyFailed"), BillingErrors.forHttpFailure(null, null)) // network
    }
}
