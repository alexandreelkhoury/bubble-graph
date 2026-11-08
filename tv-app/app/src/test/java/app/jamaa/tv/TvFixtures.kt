package app.jamaa.tv

import app.jamaa.tv.protocol.ProtocolJson
import app.jamaa.tv.protocol.ServerMessage
import app.jamaa.tv.protocol.StateMsg
import app.jamaa.tv.protocol.TvView

/** The TV views of shared/fixtures (SPEC §14.4), decoded with the strict decoder. */
object TvFixtures {
    fun view(phase: String): TvView =
        (ProtocolJson.strict.decodeFromString(ServerMessage.serializer(), Fixtures.read("s2c.state.tv.$phase.json")) as StateMsg).view
}
