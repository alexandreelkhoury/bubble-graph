package app.jamaa.tv.games.trivia

import app.jamaa.tv.games.GameDecoders
import app.jamaa.tv.games.GameIds
import app.jamaa.tv.games.UnsupportedGameView
import app.jamaa.tv.protocol.GameIntent
import app.jamaa.tv.protocol.ProtocolJson
import app.jamaa.tv.protocol.TvGame
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** GAME-TRIVIA §13.2 views on the TV, decoded from lane A's fixtures (strict: every key known, none missing). */
class TriviaDecodeTest {
    @Test
    fun everyTvFixtureDecodesStrictlyAndThroughTheRegistry() {
        assertTrue(TriviaFixtures.tvPhases.size >= 15)
        for (name in TriviaFixtures.tvPhases) {
            val v = TriviaFixtures.tv("playing.trivia.$name")
            val env = v.game!!
            assertEquals(GameIds.TRIVIA, env.gameId)
            // Strict: an unknown or missing key in game.public fails here, not silently on a TV.
            val pub = ProtocolJson.strict.decodeFromJsonElement(TriviaPub.serializer(), env.public)
            assertEquals(name, env.phase, pub.phase.name)
            val decoded = GameDecoders.decode(env, v.room)
            assertTrue("$name: ${decoded::class.simpleName}", decoded is TriviaGameView)
            val view = (decoded as TriviaGameView).view
            assertEquals(pub.scores.size, view.players.size)
            assertEquals(env.over, view.over)
            assertNull("the TV never receives game.me", env.me)
        }
    }

    @Test
    fun phoneFixturesCarryTheMeShape() {
        val names = TriviaFixtures.dir.listFiles()!!.map { it.name }.filter { it.startsWith("s2c.state.player.playing.trivia.") }
        assertTrue(names.isNotEmpty())
        for (n in names) {
            val env = TriviaFixtures.state(n).view.game!!
            ProtocolJson.strict.decodeFromJsonElement(TriviaPub.serializer(), env.public)
            val me = ProtocolJson.strict.decodeFromJsonElement(TriviaMe.serializer(), env.me!!)
            assertTrue(n, me.myChoice == null || me.myChoice in 0..3)
        }
    }

    @Test
    fun theRegistryDeclaresTriviaInTheHello() {
        assertTrue(GameDecoders.isSupported(GameIds.TRIVIA))
        assertTrue(TvGame(GameIds.TRIVIA, 1) in GameDecoders.supported())
        assertTrue(TriviaTv.implemented)
    }

    @Test
    fun playersAreJoinedToTheRoomMembersInSeatOrder() {
        val v = TriviaFixtures.view("reveal")
        assertEquals(listOf("Rami", "Léa", "نور", "Sam"), v.players.map { it.name })
        assertEquals(listOf(0, 1, 2, 3), v.players.map { it.seat })
        assertEquals("coral", v.players[0].color)
        assertTrue(v.players[0].isHost)
        assertEquals(940, v.player("p_0a1b2c3d4e5f60718293a4b5")!!.score)
        assertEquals(1, v.number)
        assertEquals("en", v.contentLocale)
    }

    @Test
    fun aScoreLineWithoutItsMemberShowsAsLeft() {
        val tv = TriviaFixtures.tv("playing.trivia.answer")
        val room = tv.room.copy(members = tv.room.members.drop(1))
        val v = TriviaTv.decode(tv.game!!, room).view
        val gone = v.player("p_0a1b2c3d4e5f60718293a4b5")!!
        assertTrue(gone.left)
        assertFalse(gone.connected)
        assertFalse(v.active.any { it.id == gone.id })
    }

    /** GAME-TRIVIA §8.1 / §13.3: before REVEAL nothing on the TV says which answer is right or who picked what. */
    @Test
    fun secrecyBeforeTheReveal() {
        for (name in TriviaFixtures.tvPhases) {
            val env = TriviaFixtures.tv("playing.trivia.$name").game!!
            val v = TriviaFixtures.view(name)
            if (v.phase == TriviaPhase.REVEAL) {
                assertNotNull(name, v.reveal)
                continue
            }
            assertNull(name, v.reveal)
            val json = env.public.toString()
            assertTrue("$name: reveal must be null before REVEAL", json.contains("\"reveal\":null"))
            for (k in listOf("\"choice\":", "\"choices\":", "\"correctIndex\"", "\"answers\"", "\"source\"", "\"usedKeys\"", "\"rngState\"")) {
                assertFalse("$name leaks $k", json.contains(k))
            }
            for (i in v.options.indices) {
                val s = TriviaBoard.tileState(v, i)
                assertTrue("$name tile $i = $s", s == TileState.OPEN || s == TileState.GHOST)
            }
        }
    }

    @Test
    fun readShowsTheQuestionAloneWithGhostSlots() {
        val v = TriviaFixtures.view("read")
        assertEquals(TriviaPhase.READ, v.phase)
        assertNotNull(v.question)
        assertTrue(v.options.isEmpty())
        assertEquals(TileState.GHOST, TriviaBoard.tileState(v, 0))
        val f = TriviaFixtures.view("read.final")
        assertTrue(f.isFinal)
        assertEquals(QuestionType.TF, f.question!!.type)
    }

    @Test
    fun aRevealOutsideRevealIsDropped() {
        val tv = TriviaFixtures.tv("playing.trivia.reveal")
        val env = tv.game!!
        val forged = JsonObject(env.public.jsonObject.toMutableMap().apply { put("phase", JsonPrimitive("LEADERBOARD")) })
        val v = TriviaTv.decode(env.copy(public = forged, phase = "LEADERBOARD"), tv.room).view
        assertNull(v.reveal)
    }

    @Test
    fun productionDecodingToleratesNewKeys() {
        val tv = TriviaFixtures.tv("playing.trivia.answer")
        val env = tv.game!!
        val extra = JsonObject(env.public.jsonObject.toMutableMap().apply { put("futureKey", JsonPrimitive(1)) })
        assertTrue(GameDecoders.decode(env.copy(public = extra), tv.room) is TriviaGameView)
    }

    @Test
    fun aMalformedPublicFallsBackToTheUpdateCard() {
        val tv = TriviaFixtures.tv("playing.trivia.answer")
        val env = tv.game!!
        val broken = JsonObject(env.public.jsonObject.toMutableMap().apply { put("phase", JsonPrimitive("NOPE")) })
        assertTrue(GameDecoders.decode(env.copy(public = broken), tv.room) is UnsupportedGameView)
    }

    @Test
    fun setupDecodesTheQuizCards() {
        val s = TriviaFixtures.setup("one_quiz")
        assertNull(s.settings.quizId)
        assertEquals("normal", s.settings.length)
        assertEquals(9, s.extras.available)
        assertEquals("demo-quiz-01", s.extras.quiz!!.id)
        assertEquals(listOf("science", "geography", "music"), s.extras.quiz!!.featuredTopics)
        assertEquals(3, s.extras.quiz!!.moreTopics)
        assertNotNull(TriviaFixtures.setup("short"))
        // Another game's setup is not Trivia's.
        val mishana = app.jamaa.tv.TvFixtures.room("setup.mishana").room
        assertNull(TriviaTv.setupView(mishana))
    }

    /** GAME-TRIVIA §13.1: the host intents equal lane A's C2S fixtures (`a.i`). */
    @Test
    fun hostIntentsMatchTheFixtures() {
        fun fixtureIntent(name: String): JsonObject =
            ProtocolJson.decoder.parseToJsonElement(TriviaFixtures.raw(name)).jsonObject["a"]!!.jsonObject["i"]!!.jsonObject
        assertEquals(fixtureIntent("c2s.action.game.trivia.host_advance.json"), TriviaTv.hostAdvance().i)
        assertEquals(fixtureIntent("c2s.action.game.trivia.end_game.json"), TriviaTv.endGame().i)
        assertEquals(fixtureIntent("c2s.action.game.trivia.void_question.json"), TriviaTv.voidQuestion("q004").i)
        val voided = TriviaFixtures.view("reveal.voided")
        val i: GameIntent = TriviaTv.pauseIntent("VOID_QUESTION", voided)!!
        assertEquals(GameIds.TRIVIA, i.gameId)
        assertEquals(fixtureIntent("c2s.action.game.trivia.void_question.json"), i.i)
        assertNull(TriviaTv.pauseIntent("VOID_QUESTION", TriviaFixtures.view("leaderboard")))
        assertEquals(JsonObject(mapOf("quizId" to JsonPrimitive("lb-quiz-01"))), TriviaTv.quizPatch("lb-quiz-01"))
    }
}
