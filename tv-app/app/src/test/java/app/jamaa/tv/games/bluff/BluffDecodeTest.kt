package app.jamaa.tv.games.bluff

import app.jamaa.tv.games.GameCatalog
import app.jamaa.tv.games.GameDecoders
import app.jamaa.tv.games.GameIds
import app.jamaa.tv.games.UnsupportedGameView
import app.jamaa.tv.i18n.I18nKeys
import app.jamaa.tv.protocol.ActionMsg
import app.jamaa.tv.protocol.ClientMessage
import app.jamaa.tv.protocol.ProtocolJson
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** GAME-BLUFF §13.2 view decoding against lane A's fixtures, the TV-side secrecy guards, intents (§13.1), the catalog. */
class BluffDecodeTest {

    @Test fun everyTvFixtureDecodesStrictlyIntoTheBluffView() {
        val names = BluffFixtures.names("s2c.state.tv.playing.bluff.")
        assertTrue("fixtures found (${names.size})", names.size >= 15)
        for (n in names) {
            val st = BluffFixtures.state(n)
            val env = st.view.game!!
            // Strict: an unknown or missing key in game.public fails here (the app decoder is lenient on purpose).
            val pub = ProtocolJson.strict.decodeFromJsonElement(BluffPub.serializer(), env.public)
            assertEquals(n, env.phase, pub.phase.name)
            val g = GameDecoders.decode(env, st.view.room)
            assertTrue("$n decodes (not ${(g as? UnsupportedGameView)?.reason})", g is BluffGameView)
            val v = (g as BluffGameView).view
            assertEquals(n, pub.scores.size, v.players.size)
            assertEquals(n, v.players.sortedBy { it.seat }, v.players)
            assertNull("the TV never gets game.me ($n)", env.me)
        }
    }

    @Test fun playerFixturesShareThePublicShapeAndTheirMeDecodes() {
        val names = BluffFixtures.names("s2c.state.player.playing.bluff.")
        assertTrue(names.size >= 10)
        for (n in names) {
            val env = BluffFixtures.state(n).view.game!!
            ProtocolJson.strict.decodeFromJsonElement(BluffPub.serializer(), env.public)
            env.me?.let { ProtocolJson.strict.decodeFromJsonElement(BluffMe.serializer(), it) }
        }
    }

    @Test fun composeJoinsMembersAndFlagsOnlyPublicProgress() {
        val w = BluffFixtures.view("writing.submitted")
        assertEquals(BluffPhase.WRITING, w.phase)
        assertEquals(listOf("Rami", "Léa", "نور", "Sam", "Zoé").take(w.players.size), w.players.map { it.name })
        val pub = ProtocolJson.strict.decodeFromJsonElement(BluffPub.serializer(), BluffFixtures.room("writing.submitted").game!!.public)
        assertEquals(pub.submittedIds.toSet(), w.players.filter { it.submitted }.map { it.id }.toSet())
        assertTrue(w.players.none { it.voted })
        assertTrue("no option before VOTING", w.options.isEmpty())
        assertNull(w.reveal)
        val hold = BluffFixtures.view("hold")
        assertEquals(listOf("Zoé"), hold.players.filter { it.isNew }.map { it.name })
    }

    /** Defence in depth (GAME-BLUFF §8.1): a frame carrying options or a reveal too early is never drawn. */
    @Test fun composeDropsSecretsOutsideTheirPhases() {
        val st = BluffFixtures.tv("reveal")
        val env = st.view.game!!
        val pub = ProtocolJson.decoder.decodeFromJsonElement(BluffPub.serializer(), env.public)
        for (early in listOf(BluffPhase.ROUND_INTRO, BluffPhase.WRITING, BluffPhase.HOLD)) {
            val v = BluffTv.compose(st.view.room, pub.copy(phase = early), env)
            assertTrue(early.name, v.options.isEmpty())
            assertNull(early.name, v.reveal)
        }
        val voting = BluffTv.compose(st.view.room, pub.copy(phase = BluffPhase.VOTING), env)
        assertNull("no reveal in VOTING", voting.reveal)
        assertEquals(pub.options, voting.options)
        assertNotNull(BluffTv.compose(st.view.room, pub.copy(phase = BluffPhase.SCORES), env).reveal)
        assertNull(BluffTv.compose(st.view.room, pub.copy(phase = BluffPhase.AWARDS), env).reveal)
    }

    /** What the TV receives before REVEAL never holds a truth, an author, a vote target or a like (lane A's leak oracle, seen from the TV). */
    @Test fun tvFixturesBeforeRevealCarryNoSecretKeys() {
        val secretKeys = listOf("\"truth\"", "\"authorIds\"", "\"voterIds\"", "\"likerIds\"", "\"houseLies\"", "\"truthAlt\"", "\"note\"", "\"kind\": \"truth\"")
        for (n in BluffFixtures.names("s2c.state.tv.playing.bluff.")) {
            val phase = BluffFixtures.state(n).view.game!!.phase
            if (phase in listOf("REVEAL", "SCORES", "AWARDS", "RESULTS")) continue
            val text = BluffFixtures.text(n)
            for (k in secretKeys) assertFalse("$n leaks $k", text.contains(k))
            val pub = ProtocolJson.strict.decodeFromJsonElement(BluffPub.serializer(), BluffFixtures.state(n).view.game!!.public)
            assertNull(n, pub.reveal)
            if (phase != "VOTING") assertTrue("$n: options only from VOTING", pub.options.isEmpty())
            if (phase == "WRITING") assertTrue("$n: spotOnIds hidden in WRITING", pub.spotOnIds.isEmpty())
        }
    }

    @Test fun unknownBluffShapeFallsBackToTheUpdateCard() {
        val st = BluffFixtures.tv("writing")
        val env = st.view.game!!.copy(public = JsonObject(mapOf("schema" to JsonPrimitive(99))))
        assertTrue(GameDecoders.decode(env, st.view.room) is UnsupportedGameView)
    }

    @Test fun setupViewReadsSettingsExtrasAndTheBigGroupHint() {
        val room = BluffFixtures.state("s2c.state.tv.setup.bluff.json").view.room
        val v = BluffTv.setupView(room)!!
        assertEquals("normal", v.settings.length)
        assertEquals(6, v.extras.available)
        assertTrue(v.hintKeys.isEmpty())
        val big = v.copy(extras = v.extras.copy(bigGroup = true))
        assertEquals("game.bluff.setup.bigGroup", big.hintKeys["length"])
        assertNotNull(I18nKeys.strings[big.hintKeys.getValue("length")])
        assertTrue(big.copy(settings = big.settings.copy(length = "short")).hintKeys.isEmpty())
        assertNull(BluffTv.setupView(room.copy(setup = null)))
    }

    @Test fun moduleIsImplementedAndDeclared() {
        assertTrue(BluffTv.implemented)
        assertTrue(GameDecoders.isSupported(GameIds.BLUFF))
        assertEquals(GameCatalog.BLUFF.viewVersion, GameDecoders.supported().first { it.id == GameIds.BLUFF }.v)
    }

    /** GAME-BLUFF §10.2 sections, in the shared meta's order, every key generated in the i18n tables. */
    @Test fun catalogRuleSectionsAndPauseItemsResolve() {
        val ids = GameCatalog.BLUFF.ruleSections.map { it.id }
        assertEquals(listOf("goal", "round1", "round2", "writing", "voting", "points", "final", "house", "same", "host"), ids)
        for (s in GameCatalog.BLUFF.ruleSections) {
            assertNotNull(s.titleKey, I18nKeys.strings[s.titleKey])
            assertNotNull(s.bodyKey, I18nKeys.strings[s.bodyKey])
            for (ph in s.phases) assertTrue(ph, ph in GameCatalog.BLUFF.phases)
        }
        for (p in GameCatalog.BLUFF.pauseItems) assertNotNull(p.labelKey, I18nKeys.strings[p.labelKey])
        // Every in-game phase opens the ⓘ sheet somewhere (no phase falls back to the top).
        for (ph in GameCatalog.BLUFF.phases.filter { it != "RESULTS" }) {
            assertTrue(ph, GameCatalog.BLUFF.ruleSections.any { ph in it.phases } || ph == "AWARDS")
        }
    }

    // ---------------------------------------------------------------- intents (encode-compare with lane A's fixtures)

    private fun assertEncodes(fixture: String, msg: ClientMessage) {
        val expected = Json.parseToJsonElement(BluffFixtures.text(fixture))
        assertEquals(fixture, expected, ProtocolJson.encoder.encodeToJsonElement(ClientMessage.serializer(), msg))
    }

    private fun fixtureId(fixture: String): String =
        (Json.parseToJsonElement(BluffFixtures.text(fixture)) as JsonObject)["id"].let { (it as JsonPrimitive).content }

    @Test fun hostIntentsEncodeLikeTheFixtures() {
        fun check(f: String, i: app.jamaa.tv.protocol.GameIntent) = assertEncodes(f, ActionMsg(id = fixtureId(f), a = i))
        check("c2s.action.game.bluff.host_advance.json", BluffTv.hostAdvance())
        check("c2s.action.game.bluff.end_game.json", BluffTv.endGame())
        check("c2s.action.game.bluff.skip_prompt.json", BluffTv.skipPrompt("3fa2b0c1"))
        check("c2s.action.game.bluff.hide_option.json", BluffTv.hideOption("9c01d2e3"))
    }

    /** The pause items (GAME-BLUFF §2): each resolves to a full intent (or the hide picker) in its phases only. */
    @Test fun pauseItemsResolveToFullActions() {
        val writing = BluffFixtures.view("writing")
        val skip = BluffTv.pauseAction("SKIP_PROMPT", writing) as BluffTv.PauseAction.Send
        assertEquals(JsonPrimitive(writing.prompt!!.id), skip.intent.i["promptId"])
        assertEquals(BluffTv.PauseAction.Unavailable, BluffTv.pauseAction("SKIP_PROMPT", writing.copy(skipsLeft = 0)))
        assertEquals(BluffTv.PauseAction.Unavailable, BluffTv.pauseAction("SKIP_PROMPT", BluffFixtures.view("voting")))

        val voting = BluffFixtures.view("voting.final")
        assertEquals(BluffTv.PauseAction.PickOptionToHide, BluffTv.pauseAction("HIDE_OPTION", voting))
        assertEquals(BluffTv.PauseAction.Unavailable, BluffTv.pauseAction("HIDE_OPTION", voting.copy(hidesLeft = 0)))
        assertEquals(BluffTv.PauseAction.Unavailable, BluffTv.pauseAction("HIDE_OPTION", voting.copy(options = voting.options.take(2))))

        assertEquals(BluffTv.PauseAction.Unavailable, BluffTv.pauseAction("HOST_ADVANCE", writing))
        assertEquals(BluffTv.PauseAction.Unavailable, BluffTv.pauseAction("HOST_ADVANCE", voting))
        for (s in listOf("round_intro", "reveal", "scores", "awards")) {
            assertTrue(s, BluffTv.pauseAction("HOST_ADVANCE", BluffFixtures.view(s)) is BluffTv.PauseAction.Send)
        }
        assertTrue(BluffTv.pauseAction("END_GAME", BluffFixtures.view("hold")) is BluffTv.PauseAction.Send)
        assertEquals(BluffTv.PauseAction.Unavailable, BluffTv.pauseAction("END_GAME", writing))
        assertEquals(BluffTv.PauseAction.Unavailable, BluffTv.pauseAction("BOGUS", writing))

        // Every catalog pause item resolves in each of its declared phases (fixtures stand in for each phase).
        val byPhase = mapOf("WRITING" to "writing", "VOTING" to "voting.final", "ROUND_INTRO" to "round_intro", "REVEAL" to "reveal", "SCORES" to "scores", "AWARDS" to "awards", "HOLD" to "hold")
        for (item in GameCatalog.BLUFF.pauseItems) for (ph in item.phases) {
            assertTrue("${item.id} in $ph", BluffTv.pauseAction(item.intent, BluffFixtures.view(byPhase.getValue(ph))) != BluffTv.PauseAction.Unavailable)
        }
    }
}
