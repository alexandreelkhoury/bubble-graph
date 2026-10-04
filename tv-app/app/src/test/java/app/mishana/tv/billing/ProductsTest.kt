package app.mishana.tv.billing

import app.mishana.tv.Fixtures
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** PAYMENTS-SPEC §1.3 / §4.9: the Kotlin mirror matches shared/fixtures/billing.products.json. */
class ProductsTest {
    private val fixture = Json.parseToJsonElement(Fixtures.read("billing.products.json")).jsonObject

    @Test
    fun constantsMatchTheFixture() {
        assertEquals(fixture["premium"]!!.jsonPrimitive.content, Products.PREMIUM_PRODUCT_ID)
        assertEquals(fixture["basePlans"]!!.jsonArray.map { it.jsonPrimitive.content }, Products.BASE_PLAN_IDS)
        assertEquals(fixture["trialOfferId"]!!.jsonPrimitive.content, Products.TRIAL_OFFER_ID)
        assertEquals(listOf("points"), Products.PREMIUM_SETTING_KEYS)
        assertEquals(35, Products.PREMIUM_PACK_ID_MAX)
    }

    @Test
    fun pairsRoundTrip() {
        val pairs = fixture["pairs"]!!.jsonArray.map { it.jsonArray[0].jsonPrimitive.content to it.jsonArray[1].jsonPrimitive.content }
        assertTrue(pairs.isNotEmpty())
        for ((packId, productId) in pairs) {
            assertEquals(productId, Products.packProductId(packId))
            assertEquals(packId, Products.packIdFromProductId(productId))
            assertTrue(Products.PRODUCT_ID_REGEX.matches(productId))
        }
    }

    @Test
    fun catalogFixtureProductsRoundTrip() {
        val packs = Json.parseToJsonElement(Fixtures.read("http.billing.catalog.response.json")).jsonObject["packs"]!!.jsonArray
        for (p in packs) {
            val packId = p.jsonObject["packId"]!!.jsonPrimitive.content
            val productId = p.jsonObject["productId"]!!.jsonPrimitive.content
            assertEquals(productId, Products.packProductId(packId))
            assertEquals(packId, Products.packIdFromProductId(productId))
        }
    }

    @Test
    fun rejectsMalformedProductIds() {
        for (bad in listOf("pack_", "pack_A", "premium", "pack__x", "pack_x_", "pack-x", "x_pack_y")) {
            assertNull(bad, Products.packIdFromProductId(bad))
        }
        assertFalse(Products.PRODUCT_ID_REGEX.matches("Premium"))
        assertFalse(Products.PRODUCT_ID_REGEX.matches("_x"))
        assertFalse(Products.PRODUCT_ID_REGEX.matches("a".repeat(41)))
        assertTrue(Products.PRODUCT_ID_REGEX.matches("a".repeat(40)))
    }

    @Test
    fun languageOf() {
        assertEquals("ar", Products.languageOf("ar-LB"))
        assertEquals("fr", Products.languageOf("fr"))
        assertEquals("en", Products.languageOf("en"))
    }

    @Test
    fun manageLinkNamesTheProductAndPackage() {
        assertEquals(
            "https://play.google.com/store/account/subscriptions?sku=premium&package=app.mishana.tv",
            Products.MANAGE_SUBSCRIPTION_URL,
        )
        assertTrue(Products.MANAGE_SUBSCRIPTION_URL.endsWith("package=" + Products.PACKAGE_NAME))
    }

    @Test
    fun installIdShapeAndHash() {
        val id = InstallId.generate()
        assertTrue(InstallId.REGEX.matches(id))
        // sha256("abc") (FIPS 180-2 test vector), lowercase hex, 64 chars.
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", InstallId.hash("abc"))
        assertEquals(64, InstallId.hash(id).length)
    }
}
