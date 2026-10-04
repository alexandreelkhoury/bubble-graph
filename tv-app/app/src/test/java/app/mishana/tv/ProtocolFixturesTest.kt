package app.mishana.tv

import app.mishana.tv.protocol.CatalogResponse
import app.mishana.tv.protocol.CreateRoomRequest
import app.mishana.tv.protocol.CreateRoomResponse
import app.mishana.tv.protocol.EntitlementRequest
import app.mishana.tv.protocol.VerifyRequest
import app.mishana.tv.protocol.VerifyResponse
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import app.mishana.tv.protocol.DeadlineKind
import app.mishana.tv.protocol.ErrorMsg
import app.mishana.tv.protocol.Phase
import app.mishana.tv.protocol.PongMsg
import app.mishana.tv.protocol.ProtocolJson
import app.mishana.tv.protocol.ServerMessage
import app.mishana.tv.protocol.StateMsg
import app.mishana.tv.protocol.WelcomeMsg
import app.mishana.tv.protocol.WinRule
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** SPEC §10 / §14.4: Kotlin decodes the S2C fixtures with the strict decoder and re-encodes them identically. */
class ProtocolFixturesTest {

    private val tvStateFixtures = listOf(
        "s2c.state.tv.lobby.json",
        "s2c.state.tv.role_reveal.json",
        "s2c.state.tv.clues.json",
        "s2c.state.tv.voting.json",
        "s2c.state.tv.tie_break.json",
        "s2c.state.tv.elimination.json",
        "s2c.state.tv.mr_white_guess.json",
        "s2c.state.tv.results.json",
    )

    private fun roundTrip(name: String): ServerMessage {
        val text = Fixtures.read(name)
        val decoded = ProtocolJson.strict.decodeFromString(ServerMessage.serializer(), text)
        val reEncoded = ProtocolJson.strict.encodeToJsonElement(ServerMessage.serializer(), decoded)
        assertEquals("round trip of $name", Json.parseToJsonElement(text), reEncoded)
        return decoded
    }

    @Test
    fun everyTvStateFixtureDecodesAndRoundTrips() {
        for (name in tvStateFixtures) {
            val msg = roundTrip(name)
            assertTrue("$name is a state message", msg is StateMsg)
            assertEquals("$name view kind", "tv", (msg as StateMsg).view.kind)
        }
        // Any extra TV state fixture added later must also decode.
        Fixtures.dir.listFiles { f -> f.name.startsWith("s2c.state.tv.") && f.name.endsWith(".json") }
            ?.map { it.name }
            ?.filter { it !in tvStateFixtures }
            ?.forEach { roundTrip(it) }
    }

    @Test
    fun welcomeErrorPong() {
        val welcome = roundTrip("s2c.welcome.json") as WelcomeMsg
        assertEquals("p_1b2c3d4e5f60718293a4b5c6", welcome.playerId)
        assertEquals("KXRT", welcome.roomCode)

        val error = roundTrip("s2c.error.json") as ErrorMsg
        assertEquals("NOT_YOUR_TURN", error.code)
        assertEquals("error.notYourTurn", error.messageKey)
        assertEquals("4", error.ref)

        val pong = roundTrip("s2c.pong.json")
        assertTrue(pong is PongMsg)
        assertEquals(Constants.PONG_FRAME, Fixtures.read("s2c.pong.json").let { Json.parseToJsonElement(it).toString() })
    }

    @Test
    fun createRoomResponse() {
        val text = Fixtures.read("http.create_room.response.json")
        val resp = ProtocolJson.strict.decodeFromString(CreateRoomResponse.serializer(), text)
        assertEquals("KXRT", resp.code)
        assertEquals("0123456789abcdef0123456789abcdef", resp.tvToken)
        assertEquals("https://mish-ana.example.workers.dev/KXRT", resp.joinUrl)
        assertEquals("/parties/room/KXRT", resp.wsPath)
        assertEquals("OK", resp.entitlement) // PAYMENTS-SPEC §3.11
        assertEquals(
            Json.parseToJsonElement(text),
            ProtocolJson.strict.encodeToJsonElement(CreateRoomResponse.serializer(), resp),
        )
    }

    @Test
    fun votingDeepAsserts() {
        val msg = roundTrip("s2c.state.tv.voting.json") as StateMsg
        assertEquals(42L, msg.seq)
        assertEquals(1790000040000L, msg.serverNow)
        val v = msg.view
        assertEquals(Phase.VOTING, v.phase)
        assertEquals(4, v.players.size)
        assertFalse(v.players[2].connected)
        assertEquals("نور", v.players[2].name)
        assertEquals(DeadlineKind.VOTE, v.deadline!!.kind)
        assertEquals(1790000120000L, v.deadline.at)
        assertEquals("coral", v.players[0].color)
        assertFalse(v.players[0].left)
        assertEquals(2, v.votesCast)
        assertEquals(3, v.votesExpected)
        assertEquals(WinRule.OFFICIAL, v.settings.winRule)
        assertEquals(10, v.settings.points.undercover)
        assertNull(v.lastVote)
    }

    /** PAYMENTS-SPEC §3.11 view keys, appended after availablePacks. */
    @Test
    fun billingViewKeys() {
        val lobby = (roundTrip("s2c.state.tv.lobby.json") as StateMsg).view
        assertFalse(lobby.premium)
        assertFalse(lobby.tvBusy)
        assertFalse(lobby.poolExhausted)
        assertTrue(lobby.availablePacks.all { it.tier == "free" || it.tier == "premium" })
        assertTrue("the free TEST_CATALOG lobby shows locked packs", lobby.lockedPacks.isNotEmpty())
        for (p in lobby.lockedPacks) {
            assertTrue(p.productId.startsWith("pack_"))
            assertTrue(p.pairCount > 0)
        }
        // Metadata only: exactly these keys, never words or pair ids.
        val raw = Json.parseToJsonElement(Fixtures.read("s2c.state.tv.lobby.json")).jsonObject["view"]!!.jsonObject
        for (p in raw["lockedPacks"]!!.jsonArray) {
            assertEquals(setOf("id", "locale", "title", "pairCount", "ageRating", "productId"), p.jsonObject.keys)
        }
        val keys = raw.keys.toList()
        assertEquals(listOf("availablePacks", "premium", "lockedPacks", "tvBusy", "poolExhausted"), keys.takeLast(5))
        val voting = (roundTrip("s2c.state.tv.voting.json") as StateMsg).view
        assertFalse(voting.premium)
        assertEquals(emptyList<Any>(), voting.lockedPacks)
    }

    /** PAYMENTS-SPEC §3.4: the billing HTTP fixtures round-trip strictly through the Kotlin mirrors. */
    @Test
    fun billingHttpFixtures() {
        fun <T> strict(name: String, ser: kotlinx.serialization.KSerializer<T>): T {
            val text = Fixtures.read(name)
            val v = ProtocolJson.strict.decodeFromString(ser, text)
            assertEquals(name, Json.parseToJsonElement(text), ProtocolJson.strict.encodeToJsonElement(ser, v))
            return v
        }
        val catalog = strict("http.billing.catalog.response.json", CatalogResponse.serializer())
        assertEquals("premium", catalog.subscription.productId)
        assertEquals(listOf("monthly", "yearly"), catalog.subscription.basePlanIds)
        assertEquals(3, catalog.freePackIds.size)
        val verify = strict("http.billing.verify.response.json", VerifyResponse.serializer())
        assertEquals(1790028800000L, verify.entitlement.expiresAt)
        assertTrue(verify.entitlement.subscription!!.inTrial)
        val req = strict("http.billing.verify.request.json", VerifyRequest.serializer())
        assertEquals(2, req.purchases.size)
        strict("http.billing.entitlement.request.json", EntitlementRequest.serializer())
        // The production (tolerant) decoder accepts a newer server's extra keys.
        val extra = Fixtures.read("http.billing.verify.response.json").trim().removeSuffix("}") + ""","future":1}"""
        assertEquals(verify, ProtocolJson.decoder.decodeFromString(VerifyResponse.serializer(), extra))
    }

    @Test
    fun createRoomRequestEncodesTheEntitlement() {
        val expected = Json.parseToJsonElement(Fixtures.read("http.create_room.request.json"))
        val token = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCIsImtpZCI6ImsxIn0.e30.c2ln"
        assertEquals(expected, ProtocolJson.encoder.encodeToJsonElement(CreateRoomRequest.serializer(), CreateRoomRequest("fr", token)))
        // No token: the key is omitted.
        assertEquals(
            Json.parseToJsonElement("""{"locale":"fr"}"""),
            ProtocolJson.encoder.encodeToJsonElement(CreateRoomRequest.serializer(), CreateRoomRequest("fr")),
        )
    }

    @Test
    fun productionDecoderIgnoresUnknownTypesAndPartyserverErrors() {
        assertNull(ProtocolJson.decodeServer("""{"v":1,"t":"brand-new","x":1}"""))
        assertNull(ProtocolJson.decodeServer("""{"error":"Error: boom\n at x"}"""))
        assertNull(ProtocolJson.decodeServer("not json"))
        assertTrue(ProtocolJson.decodeServer(Constants.PONG_FRAME) is PongMsg)
        // New keys from a newer server are tolerated in production.
        val withExtra = Fixtures.read("s2c.error.json").trim().removeSuffix("}") + ""","future":true}"""
        assertTrue(ProtocolJson.decodeServer(withExtra) is ErrorMsg)
    }
}
