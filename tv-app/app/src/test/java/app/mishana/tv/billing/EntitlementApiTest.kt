package app.mishana.tv.billing

import app.mishana.tv.Fixtures
import app.mishana.tv.protocol.PurchaseRef
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

/** PAYMENTS-SPEC §3.4 / §4.9: request shapes (against the V fixtures), response decoding, errors. */
class EntitlementApiTest {
    private lateinit var server: MockWebServer
    private lateinit var api: EntitlementApi

    @Before fun setUp() {
        server = MockWebServer()
        server.start()
        api = EntitlementApi({ server.url("/").toString() }, OkHttpClient())
    }

    @After fun tearDown() = server.close()

    private fun json(code: Int, body: String) = MockResponse.Builder().code(code).addHeader("Content-Type", "application/json").body(body).build()

    @Test
    fun verifyRequestBodyMatchesTheFixtureAndDecodes() = runBlocking {
        server.enqueue(json(200, Fixtures.read("http.billing.verify.response.json")))
        val r = api.verify(
            "5f2c8e1a9b0d4c3e7a6f1b2d3c4e5f60",
            listOf(
                PurchaseRef("premium", "aBcDeFgHiJkLmNoPqRsTuVwX.AO-J1OyExampleSubscriptionPurchaseToken0123456789"),
                PurchaseRef("pack_en_food_01", "zYxWvUtSrQpOnMlKjIhGfEdC.AO-J1OzExampleOneTimePurchaseToken9876543210"),
            ),
        )
        val req = server.takeRequest()
        assertEquals("POST", req.method)
        assertEquals("/api/billing/verify", req.url.encodedPath)
        assertTrue(req.headers["Content-Type"]!!.startsWith("application/json"))
        assertNull("the TV sends no Origin", req.headers["Origin"])
        assertEquals(Json.parseToJsonElement(Fixtures.read("http.billing.verify.request.json")), Json.parseToJsonElement(req.body!!.utf8()))
        assertTrue(r.entitlement.premium)
        assertEquals(1790626400000L, r.entitlement.premiumUntil)
        assertEquals(listOf("en-food-01"), r.entitlement.packs)
        assertEquals("SUBSCRIPTION_STATE_ACTIVE", r.entitlement.subscription!!.state)
        assertEquals(listOf("OK", "OK"), r.results.map { it.result })
    }

    @Test
    fun entitlementRequestMatchesTheFixture() = runBlocking {
        val body = Json.parseToJsonElement(Fixtures.read("http.billing.verify.response.json"))
        server.enqueue(json(200, """{"entitlement":${(body as kotlinx.serialization.json.JsonObject)["entitlement"]}}"""))
        val e = api.entitlement("5f2c8e1a9b0d4c3e7a6f1b2d3c4e5f60")
        val req = server.takeRequest()
        assertEquals("/api/billing/entitlement", req.url.encodedPath)
        assertEquals(Json.parseToJsonElement(Fixtures.read("http.billing.entitlement.request.json")), Json.parseToJsonElement(req.body!!.utf8()))
        assertEquals(1790028800000L, e.expiresAt)
    }

    @Test
    fun catalogDecodes() = runBlocking {
        server.enqueue(json(200, Fixtures.read("http.billing.catalog.response.json")))
        val c = api.catalog()
        assertEquals("GET", server.takeRequest().method)
        assertEquals("google", c.mode)
        assertEquals(14, c.packs.size)
        assertEquals("ar", c.packs.first { it.packId == "lb-food-01" }.language)
    }

    @Test
    fun installLimitIsAPerPurchaseResult() = runBlocking {
        val text = Fixtures.read("http.billing.verify.response.json").replaceFirst("\"result\": \"OK\"", "\"result\": \"INSTALL_LIMIT\"")
        server.enqueue(json(200, text))
        val r = api.verify("5f2c8e1a9b0d4c3e7a6f1b2d3c4e5f60", listOf(PurchaseRef("premium", "t")))
        assertEquals("INSTALL_LIMIT", r.results[0].result)
        assertEquals(BillingErrorUi.Toast("store.installLimitNoHelp"), BillingErrors.forPurchaseResult(r.results[0].result, ""))
    }

    @Test
    fun httpErrorsCarryTheServerCode() = runBlocking {
        server.enqueue(json(429, """{"error":"RATE_LIMITED"}"""))
        try {
            api.entitlement("5f2c8e1a9b0d4c3e7a6f1b2d3c4e5f60")
            fail()
        } catch (e: BillingApiException) {
            assertEquals(429, e.httpStatus)
            assertEquals("RATE_LIMITED", e.errorCode)
            assertTrue("no install id in the message", !e.message!!.contains("5f2c8e1a"))
        }
        server.enqueue(json(503, "not json"))
        try {
            api.catalog()
            fail()
        } catch (e: BillingApiException) {
            assertEquals(503, e.httpStatus)
            assertNull(e.errorCode)
        }
    }

    @Test
    fun verifyRefusesMoreThan20() {
        try {
            runBlocking { api.verify("5f2c8e1a9b0d4c3e7a6f1b2d3c4e5f60", List(21) { PurchaseRef("premium", "t$it") }) }
            fail()
        } catch (e: IllegalArgumentException) {
            // chunked by the repository
        }
    }
}
