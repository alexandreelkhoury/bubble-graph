package app.jamaa.tv.games.likely

import app.jamaa.tv.Fixtures
import app.jamaa.tv.games.GameDecoders
import app.jamaa.tv.protocol.ProtocolJson
import app.jamaa.tv.protocol.RoomView
import app.jamaa.tv.protocol.ServerMessage
import app.jamaa.tv.protocol.StateMsg
import java.io.File

/** Lane A's Likely fixtures (shared/fixtures/v2/games/likely), decoded with the strict decoder. */
object LikelyFixtures {
    val dir: File get() = File(Fixtures.dir, "v2/games/likely")

    fun text(name: String): String = File(dir, name).also { check(it.isFile) { "Missing fixture ${it.absolutePath}" } }.readText(Charsets.UTF_8)

    fun state(name: String): StateMsg = ProtocolJson.strict.decodeFromString(ServerMessage.serializer(), text(name)) as StateMsg

    /** `s2c.state.tv.playing.likely.<suffix>.json`. */
    fun tv(suffix: String): StateMsg = state("s2c.state.tv.playing.likely.$suffix.json")

    fun room(suffix: String): RoomView = tv(suffix).view

    /** The composed view of a TV fixture, through the platform registry (as the app decodes it). */
    fun view(suffix: String): LikelyView {
        val v = room(suffix)
        val g = GameDecoders.decode(v.game!!, v.room)
        return (g as LikelyGameView).view
    }

    /** Remaining ms of the fixture's phase at its own `serverNow`. */
    fun remainingMs(suffix: String): Long {
        val s = tv(suffix)
        return (view(suffix).deadline ?: s.serverNow) - s.serverNow
    }

    fun names(prefix: String): List<String> = dir.list()!!.filter { it.startsWith(prefix) && it.endsWith(".json") }.sorted()
}
