package app.jamaa.tv.settings

import android.content.Context
import app.jamaa.tv.Constants
import app.jamaa.tv.games.GameIds
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * JAMAA-PLATFORM §2.6a: this TV's no-repeat memory across rooms (game id → used item keys, oldest first). POST
 * /api/rooms sends [load] as `memory`, the new room starts from it, and each `memory` frame (TV socket only) is
 * [save]d: games in the frame replace the stored list, games absent from it keep theirs. Mirrors
 * shared/src/room/memory.ts (`sanitizeMemoryWire`, `mergeMemoryWire`).
 */
interface RoomMemoryStore {
    fun load(): Map<String, List<String>>
    fun save(incoming: Map<String, List<String>>)
}

object RoomMemory {
    /** One item key as the games store it: `<id>` or `<packId|family>:<itemId>` (shared MEMORY_KEY_REGEX). */
    val KEY_REGEX = Regex("^[a-z0-9][a-z0-9-]{0,39}(?::[a-z0-9][a-z0-9-]{0,39})?$")

    fun isKey(k: String): Boolean = k.length <= Constants.MEMORY_KEY_MAX_CHARS && KEY_REGEX.matches(k)

    /** Known games only (GameIds.ALL order); per game, well-formed unique keys (a repeat keeps its latest place), ≤ 300 most recent. */
    fun sanitize(raw: Map<String, List<String>>): Map<String, List<String>> {
        val out = LinkedHashMap<String, List<String>>()
        for (id in GameIds.ALL) {
            val list = raw[id] ?: continue
            val seen = HashSet<String>()
            val keys = ArrayList<String>()
            for (i in list.indices.reversed()) {
                if (keys.size >= Constants.MEMORY_MAX_KEYS) break
                val k = list[i]
                if (!isKey(k) || !seen.add(k)) continue
                keys += k
            }
            keys.reverse()
            if (keys.isNotEmpty()) out[id] = keys
        }
        return out
    }

    fun merge(stored: Map<String, List<String>>, incoming: Map<String, List<String>>): Map<String, List<String>> {
        val a = sanitize(stored)
        val b = sanitize(incoming)
        val out = LinkedHashMap<String, List<String>>()
        for (id in GameIds.ALL) (b[id] ?: a[id])?.let { out[id] = it }
        return out
    }

    private val SERIALIZER = MapSerializer(String.serializer(), ListSerializer(String.serializer()))
    private val JSON = Json { ignoreUnknownKeys = true }

    fun encode(m: Map<String, List<String>>): String = JSON.encodeToString(SERIALIZER, m)

    /** Tolerant decode of the stored JSON: non-string entries are skipped, anything unreadable gives an empty map. */
    fun decode(text: String?): Map<String, List<String>> {
        if (text == null) return emptyMap()
        return try {
            val o = JSON.parseToJsonElement(text) as? JsonObject ?: return emptyMap()
            val raw = o.mapValues { (_, v) ->
                (v as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.takeIf { p -> p.isString }?.content }.orEmpty()
            }
            sanitize(raw)
        } catch (e: Exception) {
            emptyMap()
        }
    }
}

/** SharedPreferences "jamaa_prefs" (next to the sound mute and the intro flags), key `room_memory` (one JSON object). */
class SharedRoomMemoryStore(context: Context) : RoomMemoryStore {
    private val prefs = context.applicationContext.getSharedPreferences(SoundPrefs.FILE, Context.MODE_PRIVATE)

    override fun load(): Map<String, List<String>> = try {
        RoomMemory.decode(prefs.getString(KEY, null))
    } catch (e: Exception) {
        emptyMap()
    }

    @Synchronized
    override fun save(incoming: Map<String, List<String>>) {
        try {
            prefs.edit().putString(KEY, RoomMemory.encode(RoomMemory.merge(load(), incoming))).apply()
        } catch (e: Exception) {
            // A full or broken prefs file only costs the no-repeat history.
        }
    }

    companion object {
        const val KEY = "room_memory"
    }
}

/** In-memory store (tests, previews). */
class MemoryRoomMemoryStore(initial: Map<String, List<String>> = emptyMap()) : RoomMemoryStore {
    var stored: Map<String, List<String>> = RoomMemory.sanitize(initial)
        private set

    override fun load(): Map<String, List<String>> = stored

    override fun save(incoming: Map<String, List<String>>) {
        stored = RoomMemory.merge(stored, incoming)
    }
}
