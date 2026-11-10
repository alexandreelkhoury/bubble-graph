package app.jamaa.tv.games.bluff

import app.jamaa.tv.Fixtures
import app.jamaa.tv.games.GameDecoders
import app.jamaa.tv.protocol.ProtocolJson
import app.jamaa.tv.protocol.RoomView
import app.jamaa.tv.protocol.ServerMessage
import app.jamaa.tv.protocol.StateMsg
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import java.io.File

/** Lane A's Bluff fixtures (shared/fixtures/v2/games/bluff), decoded with the strict decoder, plus the engine samples. */
object BluffFixtures {
    val dir: File get() = File(Fixtures.dir, "v2/games/bluff")

    fun text(name: String): String = File(dir, name).also { check(it.isFile) { "Missing fixture ${it.absolutePath}" } }.readText(Charsets.UTF_8)

    fun state(name: String): StateMsg = ProtocolJson.strict.decodeFromString(ServerMessage.serializer(), text(name)) as StateMsg

    /** `s2c.state.tv.playing.bluff.<suffix>.json`. */
    fun tv(suffix: String): StateMsg = state("s2c.state.tv.playing.bluff.$suffix.json")

    fun room(suffix: String): RoomView = tv(suffix).view

    /** The composed view of a TV fixture, through the platform registry (as the app decodes it). */
    fun view(suffix: String): BluffView {
        val v = room(suffix)
        val g = GameDecoders.decode(v.game!!, v.room)
        return (g as BluffGameView).view
    }

    fun names(prefix: String): List<String> = dir.list()!!.filter { it.startsWith(prefix) && it.endsWith(".json") }.sorted()

    /** The TV fixtures that carry a reveal. */
    val revealFixtures = listOf("reveal", "reveal.fact", "reveal.final", "reveal.nobody_voted", "reveal.nobody_found")

    @Serializable data class Sample(val reveal: BluffReveal, val scores: List<BluffScore>, val phase: String)

    /** Engine-built reveals by name ([BluffEngineSamples]). */
    val samples: Map<String, Sample> by lazy {
        val root = Json.parseToJsonElement(BluffEngineSamples.json).jsonObject
        root.mapValues { (_, v) -> ProtocolJson.strict.decodeFromJsonElement(Sample.serializer(), v) }
    }

    /** Every reveal we can test: fixtures (name `fixture:<suffix>`) and engine samples (`engine:<name>`). */
    fun allReveals(): List<Triple<String, BluffReveal, List<BluffScore>>> {
        val fx = revealFixtures.map { s ->
            val pub = ProtocolJson.strict.decodeFromJsonElement(BluffPub.serializer(), room(s).game!!.public)
            Triple("fixture:$s", pub.reveal!!, pub.scores)
        }
        return fx + samples.map { (k, v) -> Triple("engine:$k", v.reveal, v.scores) }
    }

    /** An optional big corpus (thousands of engine reveals): `BLUFF_REVEAL_CORPUS=<file of TV public views>`. */
    fun corpus(): List<Pair<BluffReveal, List<BluffScore>>> {
        val path = System.getenv("BLUFF_REVEAL_CORPUS") ?: return emptyList()
        val arr = Json.parseToJsonElement(File(path).readText()) as kotlinx.serialization.json.JsonArray
        return arr.map {
            val pub = ProtocolJson.decoder.decodeFromJsonElement(BluffPub.serializer(), it as JsonObject)
            pub.reveal!! to pub.scores
        }
    }
}
