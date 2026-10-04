package app.mishana.tv

import app.mishana.tv.protocol.ProtocolJson
import app.mishana.tv.protocol.ServerMessage
import app.mishana.tv.protocol.StateMsg
import app.mishana.tv.protocol.TvView

/** The TV views of shared/fixtures (SPEC §14.4), decoded with the strict decoder. */
object TvFixtures {
    fun view(phase: String): TvView =
        (ProtocolJson.strict.decodeFromString(ServerMessage.serializer(), Fixtures.read("s2c.state.tv.$phase.json")) as StateMsg).view
}
