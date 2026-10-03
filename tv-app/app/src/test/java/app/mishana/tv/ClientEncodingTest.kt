package app.mishana.tv

import app.mishana.tv.protocol.ActionMsg
import app.mishana.tv.protocol.BackToLobby
import app.mishana.tv.protocol.ClientMessage
import app.mishana.tv.protocol.HelloTv
import app.mishana.tv.protocol.HostAdvance
import app.mishana.tv.protocol.HostOverrideGuess
import app.mishana.tv.protocol.Kick
import app.mishana.tv.protocol.PlayAgain
import app.mishana.tv.protocol.ProtocolJson
import app.mishana.tv.protocol.SettingsPatch
import app.mishana.tv.protocol.Start
import app.mishana.tv.protocol.UpdateSettings
import app.mishana.tv.protocol.WinRule
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

/** SPEC §10.1: encode-compare (structural JSON equality) for HelloTv and every TV intent. */
class ClientEncodingTest {

    private fun assertEncodes(fixture: String, msg: ClientMessage) {
        val expected = Json.parseToJsonElement(Fixtures.read(fixture))
        val actual = ProtocolJson.encoder.encodeToJsonElement(ClientMessage.serializer(), msg)
        assertEquals(fixture, expected, actual)
    }

    @Test fun helloTv() = assertEncodes("c2s.hello.tv.json", HelloTv(tvToken = "0123456789abcdef0123456789abcdef"))

    @Test fun updateSettings() = assertEncodes(
        "c2s.action.update_settings.json",
        ActionMsg(id = "1", a = UpdateSettings(SettingsPatch(winRule = WinRule.PARITY, clueSeconds = 30))),
    )

    @Test fun start() = assertEncodes("c2s.action.start.json", ActionMsg(id = "2", a = Start))

    @Test fun hostOverrideGuess() =
        assertEncodes("c2s.action.host_override_guess.json", ActionMsg(id = "7", a = HostOverrideGuess(accept = true)))

    @Test fun hostAdvance() = assertEncodes("c2s.action.host_advance.json", ActionMsg(id = "8", a = HostAdvance))

    @Test fun kick() =
        assertEncodes("c2s.action.kick.json", ActionMsg(id = "9", a = Kick(playerId = "p_2c3d4e5f60718293a4b5c6d7")))

    @Test fun playAgain() = assertEncodes("c2s.action.play_again.json", ActionMsg(id = "10", a = PlayAgain))

    @Test fun backToLobby() = assertEncodes("c2s.action.back_to_lobby.json", ActionMsg(id = "11", a = BackToLobby))

    @Test fun pingFrameIsByteExact() {
        assertEquals(Constants.PING_FRAME + "\n", Fixtures.read("c2s.ping.json"))
        assertEquals("""{"v":1,"t":"ping"}""", Constants.PING_FRAME)
        assertEquals("""{"v":1,"t":"pong"}""", Constants.PONG_FRAME)
    }

    @Test fun nullActionIdIsOmitted() {
        val text = ProtocolJson.encodeClient(ActionMsg(a = Start))
        assertEquals(Json.parseToJsonElement("""{"v":1,"t":"action","a":{"type":"START"}}"""), Json.parseToJsonElement(text))
    }
}
