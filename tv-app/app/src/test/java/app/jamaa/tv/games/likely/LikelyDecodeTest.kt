package app.jamaa.tv.games.likely

import app.jamaa.tv.Fixtures
import app.jamaa.tv.games.GameCatalog
import app.jamaa.tv.games.GameDecoders
import app.jamaa.tv.games.GameIds
import app.jamaa.tv.games.SettingFieldSpec
import app.jamaa.tv.games.UnsupportedGameView
import app.jamaa.tv.i18n.I18nKeys
import app.jamaa.tv.protocol.ActionMsg
import app.jamaa.tv.protocol.ClientMessage
import app.jamaa.tv.protocol.ProtocolJson
import app.jamaa.tv.protocol.UpdateGameSettings
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** GAME-LIKELY §13.2 view decoding against lane A's fixtures, the intents (§13.1) and the catalog mirror. */
class LikelyDecodeTest {

    @Test fun everyTvFixtureDecodesStrictlyIntoTheLikelyView() {
        val names = LikelyFixtures.names("s2c.state.tv.playing.likely.")
        assertTrue("fixtures found", names.size >= 15)
        for (n in names) {
            val st = LikelyFixtures.state(n)
            val env = st.view.game!!
            // Strict: an unknown or missing key in game.public fails here (the app decoder is lenient on purpose).
            val pub = ProtocolJson.strict.decodeFromJsonElement(LikelyPub.serializer(), env.public)
            assertEquals(n, env.phase, pub.phase.name)
            val g = GameDecoders.decode(env, st.view.room)
            assertTrue("$n decodes (not ${(g as? UnsupportedGameView)?.reason})", g is LikelyGameView)
            val v = (g as LikelyGameView).view
            assertEquals(n, pub.scores.size, v.players.size)
            assertEquals(n, v.players.sortedBy { it.seat }, v.players)
            assertNull("the TV never gets game.me ($n)", env.me)
        }
    }

    @Test fun playerFixturesShareThePublicShape() {
        for (n in LikelyFixtures.names("s2c.state.player.playing.likely.")) {
            val env = LikelyFixtures.state(n).view.game!!
            ProtocolJson.strict.decodeFromJsonElement(LikelyPub.serializer(), env.public)
        }
    }

    @Test fun composeJoinsMembersAndFlagsVoters() {
        val v = LikelyFixtures.view("voting.some_voted")
        assertEquals(LikelyPhase.VOTING, v.phase)
        assertEquals(listOf("Rami", "Léa", "نور", "Sam"), v.players.map { it.name })
        assertEquals(listOf(true, true, false, false), v.players.map { it.voted })
        assertNull(v.reveal)
        val card = LikelyFixtures.view("card.new")
        assertEquals(listOf("Zoé"), card.players.filter { it.isNew }.map { it.name })
        assertTrue(card.players.none { it.voted })
    }

    @Test fun secretModeNeverCarriesBallotsOrPoints() {
        for (s in listOf("reveal.secret.ar", "awards.secret.ar", "results.secret.ar", "card.secret.ar")) {
            val v = LikelyFixtures.view(s)
            assertTrue(s, v.anonymous)
            assertNull(s, v.reveal?.ballots)
            assertTrue(s, v.reveal?.deltas.orEmpty().isEmpty())
            assertTrue(s, v.players.all { it.score == 0 && it.scoreBefore == 0 })
            assertTrue(s, v.awards.none { it.kind == LikelyAwardKind.MIND_READER || it.kind == LikelyAwardKind.SELF_AWARE })
        }
    }

    @Test fun composeStripsBallotsDefensivelyInSecretMode() {
        val st = LikelyFixtures.tv("reveal")
        val env = st.view.game!!
        val pub = ProtocolJson.decoder.decodeFromJsonElement(LikelyPub.serializer(), env.public).copy(showVoters = false)
        val v = LikelyTv.compose(st.view.room, pub, env)
        assertNull(v.reveal!!.ballots)
        assertTrue(v.reveal!!.deltas.isEmpty())
        // ... and a reveal outside REVEAL is never drawn.
        val early = LikelyTv.compose(st.view.room, pub.copy(phase = LikelyPhase.VOTING), env)
        assertNull(early.reveal)
    }

    @Test fun unknownLikelyShapeFallsBackToTheUpdateCard() {
        val st = LikelyFixtures.tv("card")
        val env = st.view.game!!.copy(public = JsonObject(mapOf("schema" to JsonPrimitive(99))))
        assertTrue(GameDecoders.decode(env, st.view.room) is UnsupportedGameView)
    }

    @Test fun setupViewReadsSettingsAndExtras() {
        val s = LikelyFixtures.state("s2c.state.tv.setup.likely.secret.ar.json").view.room
        val v = LikelyTv.setupView(s)!!
        assertEquals("short", v.settings.length)
        assertFalse(v.settings.showVoters)
        assertEquals(LikelyMode.FAMILY, v.settings.mode)
        assertEquals(12, v.extras.available)
        assertNull(LikelyTv.setupView(LikelyFixtures.state("s2c.state.tv.setup.likely.json").view.room.copy(setup = null)))
    }

    @Test fun moduleIsImplementedAndDeclared() {
        assertTrue(LikelyTv.implemented)
        assertTrue(GameDecoders.isSupported(GameIds.LIKELY))
        assertEquals(1, GameDecoders.supported().first { it.id == GameIds.LIKELY }.v)
    }

    // ---------------------------------------------------------------- intents (encode-compare with lane A's fixtures)

    private fun assertEncodes(fixture: String, msg: ClientMessage) {
        val expected = Json.parseToJsonElement(LikelyFixtures.text(fixture))
        assertEquals(fixture, expected, ProtocolJson.encoder.encodeToJsonElement(ClientMessage.serializer(), msg))
    }

    @Test fun intentsEncodeLikeTheFixtures() {
        assertEncodes("c2s.action.game.likely.skip_card.json", ActionMsg(id = "3", a = LikelyTv.skipCard("fam-001")))
        assertEncodes("c2s.action.game.likely.host_advance.json", ActionMsg(id = "4", a = LikelyTv.hostAdvance()))
        assertEncodes("c2s.action.game.likely.end_game.json", ActionMsg(id = "5", a = LikelyTv.endGame()))
        val patch = JsonObject(LikelyTv.lengthPatch("short") + LikelyTv.showVotersPatch(false))
        assertEncodes("c2s.action.update_game_settings.likely.json", ActionMsg(id = "6", a = UpdateGameSettings("likely", patch)))
    }

    /** The pause items (§2): Skip card needs the card on screen; Next is not offered in VOTING; End game only in HOLD. */
    @Test fun pauseItemsResolveToFullIntents() {
        val card = LikelyFixtures.view("card")
        val skip = LikelyTv.pauseIntent("SKIP_CARD", card)!!
        assertEquals(JsonPrimitive(card.card!!.id), skip.i["cardId"])
        assertNotNull(LikelyTv.pauseIntent("SKIP_CARD", LikelyFixtures.view("voting")))
        assertNull(LikelyTv.pauseIntent("SKIP_CARD", LikelyFixtures.view("reveal")))
        assertNull(LikelyTv.pauseIntent("HOST_ADVANCE", LikelyFixtures.view("voting")))
        assertNotNull(LikelyTv.pauseIntent("HOST_ADVANCE", LikelyFixtures.view("reveal")))
        assertNotNull(LikelyTv.pauseIntent("HOST_ADVANCE", LikelyFixtures.view("awards")))
        assertNull(LikelyTv.pauseIntent("END_GAME", LikelyFixtures.view("card")))
        assertNotNull(LikelyTv.pauseIntent("END_GAME", LikelyFixtures.view("hold")))
        assertNull(LikelyTv.pauseIntent("BOGUS", card))
        // Every pause item the catalog lists maps to an intent in at least one of its phases.
        val byPhase = mapOf("CARD" to "card", "VOTING" to "voting", "REVEAL" to "reveal", "AWARDS" to "awards", "HOLD" to "hold")
        for (item in GameCatalog.LIKELY.pauseItems) {
            for (ph in item.phases) assertNotNull("${item.id} in $ph", LikelyTv.pauseIntent(item.intent, LikelyFixtures.view(byPhase.getValue(ph))))
        }
    }

    // ---------------------------------------------------------------- catalog mirror (GAME-LIKELY §2, §9, §10)

    @Test fun catalogMirrorsTheSharedMeta() {
        val ts = File(Fixtures.dir, "../src/games/likely/meta.ts").readText()
        val m = GameCatalog.LIKELY
        for (r in m.ruleSections) {
            assertTrue(r.id, ts.contains("id: \"${r.id}\""))
            assertTrue(r.id, ts.contains("phases: [${r.phases.joinToString(", ") { "\"$it\"" }}]"))
        }
        assertEquals(listOf("vote", "points", "chaos", "awards", "secret"), m.ruleSections.map { it.id })
        assertEquals(listOf("SKIP_CARD", "HOST_ADVANCE", "END_GAME"), m.pauseItems.map { it.intent })
        assertEquals(listOf("packIds", "length", "showVoters"), m.basic.map { it.key })
        assertTrue(ts.contains("LIKELY_SPICY_ENABLED = ${LikelySpicy.ENABLED}"))
    }

    @Test fun everyLikelyKeyTheTvResolvesExists() {
        val m = GameCatalog.LIKELY
        val keys = (listOf(m.titleKey, m.taglineKey) + m.howToKeys + listOf("game.likely.howto.3.anon", "game.likely.howto.4.anon")).toMutableList()
        for (r in m.ruleSections) keys += listOf(r.titleKey, r.bodyKey)
        for (p in m.pauseItems) keys += p.labelKey
        for (f in m.basic) {
            keys += f.labelKey
            if (f is SettingFieldSpec.Choice) f.options.forEach { keys += it.labelKey }
        }
        val missing = keys.filter { it !in I18nKeys.strings }
        assertEquals(emptyList<String>(), missing)
    }
}
