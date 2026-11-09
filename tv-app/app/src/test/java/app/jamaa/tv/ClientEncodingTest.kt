package app.jamaa.tv

import app.jamaa.tv.games.GameDecoders
import app.jamaa.tv.games.mishana.MishanaTv
import app.jamaa.tv.protocol.AbortGame
import app.jamaa.tv.protocol.ActionMsg
import app.jamaa.tv.protocol.BackToHub
import app.jamaa.tv.protocol.BackToSetup
import app.jamaa.tv.protocol.ClientMessage
import app.jamaa.tv.protocol.CloseGame
import app.jamaa.tv.protocol.EntitlementMsg
import app.jamaa.tv.protocol.HelloTv
import app.jamaa.tv.protocol.HubFocus
import app.jamaa.tv.protocol.Kick
import app.jamaa.tv.protocol.OpenGame
import app.jamaa.tv.protocol.ProtocolJson
import app.jamaa.tv.protocol.Replay
import app.jamaa.tv.protocol.RoleMode
import app.jamaa.tv.protocol.SetContentLocale
import app.jamaa.tv.protocol.SettingsPatch
import app.jamaa.tv.protocol.StartGame
import app.jamaa.tv.protocol.StoreOpenMsg
import app.jamaa.tv.protocol.TvGame
import app.jamaa.tv.protocol.UpdateGameSettings
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** SPEC §10.1 with protocol v2: encode-compare (structural JSON equality) for the hello and every TV intent. */
class ClientEncodingTest {

    private fun assertEncodes(fixture: String, msg: ClientMessage) {
        val expected = Json.parseToJsonElement(Fixtures.v2(fixture))
        val actual = ProtocolJson.encoder.encodeToJsonElement(ClientMessage.serializer(), msg)
        assertEquals(fixture, expected, actual)
    }

    private val token = "0123456789abcdef0123456789abcdef"

    /** §2.5 capability negotiation: the hello declares the games this build renders, with their view versions. */
    @Test fun helloTvDeclaresTheBuildsGames() {
        val mishanaOnly = GameDecoders.modules.mapValues { (id, m) -> if (id == "mishana") m else NotShipped(m) }
        assertEncodes("c2s.hello.tv.mishana-only.json", HelloTv(tvToken = token, games = GameDecoders.supportedOf(mishanaOnly)))
        assertEncodes(
            "c2s.hello.tv.json",
            HelloTv(tvToken = token, games = listOf(TvGame("mishana", 1), TvGame("bluff", 1), TvGame("likely", 1), TvGame("trivia", 1))),
        )
    }

    @Test fun hubFocus() = assertEncodes("c2s.action.hub_focus.json", ActionMsg(id = "1", a = HubFocus("mishana")))
    @Test fun openGame() = assertEncodes("c2s.action.open_game.json", ActionMsg(id = "2", a = OpenGame("mishana")))
    @Test fun closeGame() = assertEncodes("c2s.action.close_game.json", ActionMsg(id = "3", a = CloseGame))
    @Test fun setContentLocale() = assertEncodes("c2s.action.set_content_locale.json", ActionMsg(id = "4", a = SetContentLocale("ar")))

    @Test fun updateGameSettingsFromTheMishanaDraft() {
        val patch = MishanaTv.wirePatch(SettingsPatch(roleMode = RoleMode.CUSTOM, undercoverCount = 1, blankCount = 1))!!
        assertEncodes("c2s.action.update_game_settings.json", ActionMsg(id = "5", a = UpdateGameSettings("mishana", patch)))
        // wordLocale never goes into the game patch (it is SET_CONTENT_LOCALE in v2).
        assertNull(MishanaTv.wirePatch(SettingsPatch(wordLocale = "fr")))
    }

    @Test fun startGame() = assertEncodes("c2s.action.start_game.json", ActionMsg(id = "6", a = StartGame))
    @Test fun hostOverrideGuess() =
        assertEncodes("c2s.action.game.mishana.host_override_guess.json", ActionMsg(id = "11", a = MishanaTv.hostOverrideGuess(accept = true)))
    @Test fun hostAdvance() = assertEncodes("c2s.action.game.mishana.host_advance.json", ActionMsg(id = "12", a = MishanaTv.hostAdvance()))
    @Test fun replay() = assertEncodes("c2s.action.replay.json", ActionMsg(id = "13", a = Replay))
    @Test fun backToSetup() = assertEncodes("c2s.action.back_to_setup.json", ActionMsg(id = "14", a = BackToSetup))
    @Test fun backToHub() = assertEncodes("c2s.action.back_to_hub.json", ActionMsg(id = "15", a = BackToHub))
    @Test fun abortGame() = assertEncodes("c2s.action.abort_game.json", ActionMsg(id = "16", a = AbortGame))
    @Test fun kick() = assertEncodes("c2s.action.kick.json", ActionMsg(id = "23", a = Kick(playerId = "p_3d4e5f60718293a4b5c6d7e8")))

    /** PAYMENTS-SPEC §3.11 / §4.9: the two TV-only messages. */
    @Test fun entitlement() = assertEncodes(
        "c2s.entitlement.json",
        EntitlementMsg(token = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCIsImtpZCI6ImsxIn0.e30.c2ln"),
    )

    @Test fun storeOpen() = assertEncodes("c2s.storeOpen.json", StoreOpenMsg(open = true))

    @Test fun pingFrameIsByteExact() {
        assertEquals(Constants.PING_FRAME + "\n", Fixtures.v2("c2s.ping.json"))
        assertEquals("""{"v":2,"t":"ping"}""", Constants.PING_FRAME)
        assertEquals("""{"v":2,"t":"pong"}""", Constants.PONG_FRAME)
    }

    @Test fun nullActionIdIsOmitted() {
        val text = ProtocolJson.encodeClient(ActionMsg(a = StartGame))
        assertEquals(Json.parseToJsonElement("""{"v":2,"t":"action","a":{"type":"START_GAME"}}"""), Json.parseToJsonElement(text))
    }
}
