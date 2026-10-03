@file:OptIn(ExperimentalSerializationApi::class)

package app.mishana.tv.protocol

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

/** SPEC §9.5. */
object ProtocolJson {
    /** Production S2C: tolerant of new keys. */
    val decoder = Json { ignoreUnknownKeys = true; explicitNulls = true }

    /** C2S: emits `v` and omits null patch fields / null action id. */
    val encoder = Json { encodeDefaults = true; explicitNulls = false }

    /** Tests only: fixtures must round-trip exactly. */
    val strict = Json { ignoreUnknownKeys = false; explicitNulls = true; encodeDefaults = true }

    /**
     * Decodes one server frame. Returns null for an unknown `t`, for partyserver's own `{"error": "<stack>"}`
     * frame (no `t`), and for anything that is not valid JSON. PONG_FRAME is matched upstream and never reaches here,
     * but would decode to [PongMsg] if it did.
     */
    fun decodeServer(text: String): ServerMessage? = try {
        decoder.decodeFromString(ServerMessage.serializer(), text)
    } catch (e: SerializationException) {
        null
    } catch (e: IllegalArgumentException) {
        null
    }

    fun encodeClient(msg: ClientMessage): String = encoder.encodeToString(ClientMessage.serializer(), msg)
}
