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
        // Lifetime premium is a one-time product: the fixture carries no subscription plan or trial data.
        assertEquals(setOf("premium", "pairs"), fixture.keys)
        assertTrue(Products.PRODUCT_ID_REGEX.matches(Products.PREMIUM_PRODUCT_ID))
        assertEquals("alexkhoury@hotmail.com", Products.SUPPORT_EMAIL)
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
    fun sellableProductIds() {
        assertTrue(Products.isSellableProductId("premium"))
        assertTrue(Products.isSellableProductId("pack_lb_food_01"))
        assertFalse(Products.isSellableProductId("Premium"))
        assertFalse(Products.isSellableProductId("pack_"))
        // The catalog fixture names the same premium product id.
        val catalog = Json.parseToJsonElement(Fixtures.read("http.billing.catalog.response.json")).jsonObject
        assertEquals(Products.PREMIUM_PRODUCT_ID, catalog["premium"]!!.jsonObject["productId"]!!.jsonPrimitive.content)
    }

    @Test
    fun installIdShapeAndHash() {
        val id = InstallId.generate()
        assertTrue(InstallId.REGEX.matches(id))
        // sha256("abc") (FIPS 180-2 test vector), lowercase hex, 64 chars.
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", InstallId.hash("abc"))
        assertEquals(64, InstallId.hash(id).length)
    }

    @Test
    fun installIdDisplayGroupsOfFour() {
        // Settings → About (PAYMENTS-SPEC §3.12): readable off the screen; `pnpm grant` strips the spaces again.
        val shown = InstallId.display("0123456789abcdef0123456789abcdef")
        assertEquals("0123 4567 89ab cdef 0123 4567 89ab cdef", shown)
        assertEquals("0123456789abcdef0123456789abcdef", shown.replace(" ", ""))
    }
}
