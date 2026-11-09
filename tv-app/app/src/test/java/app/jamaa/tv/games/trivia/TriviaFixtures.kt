package app.jamaa.tv.games.trivia

import app.jamaa.tv.Fixtures
import app.jamaa.tv.protocol.ProtocolJson
import app.jamaa.tv.protocol.RoomView
import app.jamaa.tv.protocol.ServerMessage
import app.jamaa.tv.protocol.StateMsg
import java.io.File

/** Lane A's Trivia fixtures (shared/fixtures/v2/games/trivia), decoded with the strict decoder. */
object TriviaFixtures {
    val dir: File get() = File(Fixtures.dir, "v2/games/trivia")

    fun raw(name: String): String = Fixtures.v2("games/trivia/$name")

    fun state(name: String): StateMsg = ProtocolJson.strict.decodeFromString(ServerMessage.serializer(), raw(name)) as StateMsg

    /** e.g. "playing.trivia.reveal" → the TV room view. */
    fun tv(name: String): RoomView = state("s2c.state.tv.$name.json").view

    /** The composed Trivia view of `s2c.state.tv.playing.trivia.<phase>.json`. */
    fun view(phase: String): TriviaView {
        val v = tv("playing.trivia.$phase")
        return TriviaTv.decode(v.game!!, v.room).view
    }

    fun setup(name: String): TriviaSetupView = TriviaTv.setupView(tv("setup.trivia.$name").room)!!

    /** Every TV playing fixture name ("answer", "reveal.genius", …). */
    val tvPhases: List<String> by lazy {
        dir.listFiles()!!.map { it.name }
            .filter { it.startsWith("s2c.state.tv.playing.trivia.") }
            .map { it.removePrefix("s2c.state.tv.playing.trivia.").removeSuffix(".json") }
            .sorted()
    }
}
