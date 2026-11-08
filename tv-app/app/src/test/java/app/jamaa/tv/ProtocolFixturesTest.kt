package app.jamaa.tv

import app.jamaa.tv.protocol.CatalogResponse
import app.jamaa.tv.protocol.CreateRoomRequest
import app.jamaa.tv.protocol.CreateRoomResponse
import app.jamaa.tv.protocol.EntitlementRequest
import app.jamaa.tv.protocol.VerifyRequest
import app.jamaa.tv.protocol.VerifyResponse
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import app.jamaa.tv.protocol.DeadlineKind
import app.jamaa.tv.protocol.ErrorMsg
import app.jamaa.tv.protocol.Phase
import app.jamaa.tv.protocol.PongMsg
import app.jamaa.tv.protocol.ProtocolJson
import app.jamaa.tv.protocol.ServerMessage
import app.jamaa.tv.protocol.StateMsg
import app.jamaa.tv.protocol.WelcomeMsg
import app.jamaa.tv.protocol.WinRule
import app.jamaa.tv.protocol.RoleMode
import app.jamaa.tv.protocol.RoomPhase
import app.jamaa.tv.game.GameViewModel
import app.jamaa.tv.games.GameDecoders
import app.jamaa.tv.games.GameIds
import app.jamaa.tv.games.UnsupportedGameView
import app.jamaa.tv.games.UnsupportedReason
import app.jamaa.tv.games.mishana.MishanaGameView
import app.jamaa.tv.games.mishana.MishanaTv
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.io.File
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * SPEC §10 / §14.4 with protocol v2 (JAMAA-PLATFORM §2.5): Kotlin decodes the S2C fixtures of shared/fixtures/v2 with
 * the strict decoder and re-encodes them identically; each game envelope decodes through GameDecoders.
 */
class ProtocolFixturesTest {

    private fun tvStateFixtures(): List<String> =
        File(Fixtures.dir, "v2").listFiles { f -> f.name.startsWith("s2c.state.tv.") && f.name.endsWith(".json") }!!.map { it.name }.sorted()

    private fun roundTrip(name: String): ServerMessage {
        val text = Fixtures.v2(name)
        val decoded = ProtocolJson.strict.decodeFromString(ServerMessage.serializer(), text)
        val reEncoded = ProtocolJson.strict.encodeToJsonElement(ServerMessage.serializer(), decoded)
        assertEquals("round trip of $name", Json.parseToJsonElement(text), reEncoded)
        return decoded
    }

    @Test
    fun everyTvStateFixtureDecodesAndRoundTrips() {
        val names = tvStateFixtures()
        assertTrue("hub, setup and playing fixtures exist", names.size >= 10)
        for (name in names) {
            val msg = roundTrip(name)
            assertTrue("$name is a state message", msg is StateMsg)
            val v = (msg as StateMsg).view
            assertEquals("$name view kind", "tv", v.kind)
            assertNull("$name: the TV never gets `me`", v.me)
            // Every envelope decodes into a drawable game (this build renders mishana) or the update card, never throws.
            v.game?.let { env ->
                val g = GameDecoders.decode(env, v.room)
                if (env.gameId == GameIds.MISHANA) assertTrue("$name decodes as Mish Ana!", g is MishanaGameView)
                else assertTrue(g is UnsupportedGameView)
            }
            // SETUP carries the setup of `setupGameId`; HUB and PLAYING carry none (§2.5).
            assertEquals(name, v.room.phase == RoomPhase.SETUP, v.room.setup != null)
            if (v.room.setup != null) assertEquals(v.room.setupGameId, v.room.setup!!.gameId)
        }
    }

    @Test
    fun hubFixture() {
        val v = (roundTrip("s2c.state.tv.hub.json") as StateMsg).view
        assertEquals(RoomPhase.HUB, v.room.phase)
        assertEquals("mishana", v.room.focusedGameId)
        assertNull(v.room.setupGameId)
        assertNull(v.game)
        assertEquals(listOf("mishana"), v.room.games.map { it.id })
        assertEquals(listOf(10, 20), v.room.games[0].durationMinutes)
        assertEquals(listOf("Rami", "Léa", "نور", "Sam"), v.room.members.map { it.name })
        assertTrue(v.room.members.first().isHost)
        assertTrue(v.room.cup.stars.isEmpty())
        assertNull(v.room.cup.last)
        // RoomPublic key order is part of the contract (fixtures round-trip byte-equal in TS and Kotlin).
        val raw = Json.parseToJsonElement(Fixtures.v2("s2c.state.tv.hub.json")).jsonObject["view"]!!.jsonObject["room"]!!.jsonObject
        assertEquals(
            listOf("roomCode", "joinUrl", "phase", "focusedGameId", "setupGameId", "contentLocale", "members", "hostPlayerId",
                "games", "setup", "cup", "premium", "tvBusy", "contentLocales"),
            raw.keys.toList(),
        )
    }

    @Test
    fun cupAndReaction() {
        val v = (roundTrip("s2c.state.tv.hub.cup.json") as StateMsg).view
        assertEquals(3, v.room.cup.stars.values.count { it == 3 })
        assertEquals("mishana", v.room.cup.last!!.gameId)
        assertEquals(1, v.room.cup.last!!.ranking.size)
    }

    @Test
    fun mishanaSetupFixture() {
        val room = (roundTrip("s2c.state.tv.setup.mishana.json") as StateMsg).view.room
        val setup = room.setup!!
        assertTrue(setup.canStart)
        assertNull(setup.startBlocker)
        val sv = MishanaTv.setupView(room)!!
        assertEquals("en", sv.settings.wordLocale) // = contentLocale
        assertEquals(RoleMode.CUSTOM, sv.settings.roleMode)
        assertEquals(1, sv.roleCounts!!.undercover)
        assertFalse(sv.poolExhausted)
        assertEquals(listOf("en", "fr", "ar"), sv.wordLocales)
        assertEquals(4, sv.players.size)
        // PackInfo / LockedPackInfo v2: + gameId, family, stars, domain, topics; locked = metadata only.
        val raw = Json.parseToJsonElement(Fixtures.v2("s2c.state.tv.setup.mishana.json")).jsonObject["view"]!!.jsonObject["room"]!!
            .jsonObject["setup"]!!.jsonObject
        for (p in raw["lockedPacks"]!!.jsonArray) {
            assertEquals(
                setOf("id", "gameId", "family", "locale", "title", "pairCount", "ageRating", "productId", "stars", "domain", "topics"),
                p.jsonObject.keys,
            )
        }
        for (p in setup.lockedPacks) assertTrue(p.productId.startsWith("pack_"))
        assertFalse(MishanaTv.poolExhausted(setup))
    }

    @Test
    fun otherGamesSetupsDecodeWithoutTheirPackage() {
        for (id in listOf("bluff", "likely", "trivia")) {
            val room = (roundTrip("s2c.state.tv.setup.$id.json") as StateMsg).view.room
            assertEquals(id, room.setup!!.gameId)
            assertEquals(id, (room.setup!!.extras["gameId"] as kotlinx.serialization.json.JsonPrimitive).content)
            assertNull(MishanaTv.setupView(room))
            assertFalse(room.setup!!.canStart) // stubs: GAME_DISABLED
        }
    }

    @Test
    fun votingDeepAsserts() {
        val msg = roundTrip("s2c.state.tv.playing.mishana.voting.json") as StateMsg
        val env = msg.view.game!!
        assertEquals("VOTING", env.phase)
        assertEquals(4, env.awaitedIds.size)
        assertFalse(env.over)
        val v = TvFixtures.mishana("voting")
        assertEquals(Phase.VOTING, v.phase)
        assertEquals(4, v.players.size)
        assertEquals("نور", v.players[2].name) // joined from room.members
        assertEquals("coral", v.players[0].color)
        assertTrue(v.players[0].isHost)
        assertEquals(DeadlineKind.VOTE, v.deadline!!.kind)
        assertEquals(WinRule.OFFICIAL, v.settings.winRule)
        assertEquals(10, v.settings.points.undercover)
        assertEquals(4, v.votesExpected)
        assertNull(v.lastVote)
        // The game's player entries carry only game fields (names live in the room).
        val rawPlayer = env.public["players"]!!.jsonArray[0].jsonObject
        assertEquals(setOf("id", "alive", "left", "ready", "spoke", "hasVoted", "revealedRole", "score"), rawPlayer.keys)
    }

    @Test
    fun replayIsANewInstance() {
        val v = TvFixtures.room("playing.mishana.replay")
        assertEquals(2, v.game!!.n)
        // The engine restarts its own counter; the TV keys its per-game state on the instance number.
        assertEquals(2, TvFixtures.mishana("replay").gameNumber)
        assertEquals(5, TvFixtures.mishana("replay").players.size)
    }

    @Test
    fun benchedMemberIsNotAPlayer() {
        val v = TvFixtures.room("playing.mishana.clues")
        val zoe = v.room.members.first { it.name == "Zoé" }
        assertTrue(zoe.benched)
        assertTrue(TvFixtures.mishana("clues").players.none { it.id == zoe.id })
    }

    @Test
    fun unknownGameIdRendersTheUpdateCard() {
        val v = TvFixtures.room("playing.mishana.voting")
        val env = v.game!!
        val unknown = GameDecoders.decode(env.copy(gameId = "karaoke"), v.room)
        assertEquals(UnsupportedReason.UNKNOWN_GAME, (unknown as UnsupportedGameView).reason)
        val stub = GameDecoders.decode(env.copy(gameId = "bluff"), v.room) as UnsupportedGameView
        assertEquals(UnsupportedReason.NOT_IMPLEMENTED, stub.reason)
        val broken = GameDecoders.decode(env.copy(public = JsonObject(mapOf("phase" to JsonPrimitive("VOTING")))), v.room) as UnsupportedGameView
        assertEquals(UnsupportedReason.DECODE_FAILED, broken.reason)
        // A whole frame with an unknown game decodes in production (the room view stays usable).
        val text = Fixtures.v2("s2c.state.tv.playing.mishana.voting.json").replace("\"gameId\": \"mishana\"", "\"gameId\": \"karaoke\"")
        val msg = ProtocolJson.decodeServer(text) as StateMsg
        assertEquals("karaoke", msg.view.game!!.gameId)
    }

    @Test
    fun welcomeErrorPong() {
        val welcome = roundTrip("s2c.welcome.json") as WelcomeMsg
        assertEquals("p_1b2c3d4e5f60718293a4b5c6", welcome.playerId)
        assertEquals("KXRT", welcome.roomCode)

        for (code in listOf("game_unavailable", "not_in_game", "reaction_too_fast", "unsupported_version", "wrong_game")) {
            val error = roundTrip("s2c.error.$code.json") as ErrorMsg
            assertEquals(code.uppercase(), error.code)
            assertEquals(GameViewModel.errorMessageKey(error.code), error.messageKey)
        }

        val pong = roundTrip("s2c.pong.json")
        assertTrue(pong is PongMsg)
        assertEquals(Constants.PONG_FRAME, Fixtures.v2("s2c.pong.json").let { Json.parseToJsonElement(it).toString() })
    }

    @Test
    fun createRoomResponse() {
        val text = Fixtures.read("http.create_room.response.json")
        val resp = ProtocolJson.strict.decodeFromString(CreateRoomResponse.serializer(), text)
        assertEquals("KXRT", resp.code)
        assertEquals("0123456789abcdef0123456789abcdef", resp.tvToken)
        assertEquals("https://play.example.workers.dev/KXRT", resp.joinUrl)
        assertEquals("/parties/room/KXRT", resp.wsPath)
        assertEquals("OK", resp.entitlement) // PAYMENTS-SPEC §3.11
        assertEquals(
            Json.parseToJsonElement(text),
            ProtocolJson.strict.encodeToJsonElement(CreateRoomResponse.serializer(), resp),
        )
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
        assertNull(ProtocolJson.decodeServer("""{"v":2,"t":"brand-new","x":1}"""))
        assertNull(ProtocolJson.decodeServer("""{"error":"Error: boom\n at x"}"""))
        assertNull(ProtocolJson.decodeServer("not json"))
        assertTrue(ProtocolJson.decodeServer(Constants.PONG_FRAME) is PongMsg)
        // New keys from a newer server are tolerated in production.
        val withExtra = Fixtures.v2("s2c.error.wrong_game.json").trim().removeSuffix("}") + ""","future":true}"""
        assertTrue(ProtocolJson.decodeServer(withExtra) is ErrorMsg)
    }
}
