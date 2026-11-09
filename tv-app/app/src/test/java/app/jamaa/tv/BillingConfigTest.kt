package app.jamaa.tv

import app.jamaa.tv.net.RoomApi
import kotlinx.coroutines.runBlocking
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/** Server BILLING_ENABLED: `GET /api/config` turns billing on only with an explicit `"billing": true` (fail closed). */
class BillingConfigTest {
    private lateinit var server: MockWebServer

    @Before fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @After fun tearDown() = server.close()

    private fun reply(code: Int, body: String) = server.enqueue(MockResponse.Builder().code(code).addHeader("Content-Type", "application/json").body(body).build())
    private fun enabled() = runBlocking { RoomApi.billingEnabled(server.url("/").toString(), OkHttpClient()) }

    @Test
    fun fixtureIsOffAndTrueIsOn() {
        reply(200, Fixtures.read("http.config.json"))
        assertFalse(enabled())
        assertEquals("/api/config", server.takeRequest().target)
        reply(200, """{"billing":true,"future":1}""")
        assertTrue(enabled())
    }

    @Test
    fun anythingElseIsOff() {
        reply(405, """{"error":"BAD_MESSAGE"}""") // a server from before the switch
        assertFalse(enabled())
        reply(200, """{"billing":"true"}""")
        assertFalse(enabled())
        reply(200, "not json")
        assertFalse(enabled())
        server.close()
        assertFalse(enabled())
    }

    /** JAMAA-PLATFORM §2.5: `games` comes in the same call; absent or malformed → null (the TV uses its own list). */
    @Test
    fun clientConfigReadsTheOfferedGames() {
        fun config() = runBlocking { RoomApi.clientConfig(server.url("/").toString(), OkHttpClient()) }
        reply(200, Fixtures.v2("http.config.json"))
        val c = config()
        assertEquals(listOf("mishana"), c.games)
        reply(200, """{"billing":true,"games":["mishana","bluff","likely","trivia"]}""")
        assertEquals(app.jamaa.tv.net.ClientConfig(true, listOf("mishana", "bluff", "likely", "trivia")), config())
        reply(200, """{"billing":false}""")
        assertEquals(app.jamaa.tv.net.ClientConfig(false, null), config())
        reply(200, """{"billing":false,"games":"mishana"}""")
        assertEquals(null, config().games)
        reply(500, "")
        assertEquals(app.jamaa.tv.net.ClientConfig.OFF, config())
    }
}
