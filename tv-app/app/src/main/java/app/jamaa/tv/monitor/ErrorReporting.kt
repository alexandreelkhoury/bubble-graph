package app.jamaa.tv.monitor

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.io.File

/**
 * JAMAA-PLATFORM §8.3: one compact, PII-free error report, in the shape `POST /api/client-errors` accepts (short keys:
 * p platform, v app version, s screen, k kind, n error name, m message, st stack, r room code, c count). The message
 * and stack are truncated here and scrubbed again by the server; no player names, tokens or install ids are added.
 */
data class ErrorReport(
    val kind: String,
    val name: String,
    val message: String,
    val stack: String,
    val screen: String? = null,
    val room: String? = null,
    val count: Int = 1,
) {
    fun toJson(version: String): String = buildJsonObject {
        put("p", PLATFORM)
        put("v", version.take(32))
        put("k", kind)
        put("n", name.take(60))
        if (message.isNotEmpty()) put("m", message.take(MESSAGE_MAX))
        if (stack.isNotEmpty()) put("st", stack.take(STACK_MAX))
        screen?.let { put("s", it.take(40)) }
        room?.takeIf { ROOM_CODE.matches(it) }?.let { put("r", it) }
        if (count > 1) put("c", count.coerceAtMost(10_000))
    }.toString()

    /** The dedupe key: the same error from the same place is one report. */
    val key: String get() = "$kind|$name|${message.take(120)}"

    companion object {
        const val PLATFORM = "tv-android"
        const val MESSAGE_MAX = 300
        const val STACK_MAX = 1500
        private val ROOM_CODE = Regex("^[A-Z]{4}$")

        fun of(kind: String, t: Throwable, screen: String? = null, room: String? = null): ErrorReport {
            // The stack: the throwable's frames, then its causes' headers; never its toString() (it repeats the message).
            // The causes are kept whole; the top frames fill the rest of STACK_MAX.
            val causes = StringBuilder()
            var c = t.cause
            var depth = 0
            while (c != null && depth < 3) {
                causes.append("Caused by: ").append(c.javaClass.name).append('\n')
                c.stackTrace.firstOrNull()?.let { causes.append("at ").append(it.toString()).append('\n') }
                c = c.cause
                depth++
            }
            val tail = causes.toString().take(STACK_MAX / 3)
            val frames = StringBuilder()
            for (f in t.stackTrace.take(25)) frames.append("at ").append(f.toString()).append('\n')
            return ErrorReport(
                kind = kind,
                name = t.javaClass.simpleName.ifEmpty { "Throwable" },
                message = (t.message ?: "").take(MESSAGE_MAX),
                stack = frames.toString().take(STACK_MAX - tail.length) + tail,
                screen = screen,
                room = room,
            )
        }

        fun fromJson(text: String): ErrorReport? = try {
            val o: JsonObject = Json.parseToJsonElement(text).jsonObject
            ErrorReport(
                kind = o["k"]?.jsonPrimitive?.content ?: "crash",
                name = o["n"]?.jsonPrimitive?.content ?: "Throwable",
                message = o["m"]?.jsonPrimitive?.content ?: "",
                stack = o["st"]?.jsonPrimitive?.content ?: "",
                screen = o["s"]?.jsonPrimitive?.content,
                room = o["r"]?.jsonPrimitive?.content,
                count = o["c"]?.jsonPrimitive?.intOrNull ?: 1,
            )
        } catch (e: Exception) {
            null
        }
    }
}

/**
 * Keeps the last uncaught crash on disk until the next launch sends it (the dying process cannot do network I/O).
 * One file: a new crash replaces the old one, the same crash again bumps its count. Writing is synchronous and small,
 * because the uncaught-exception handler runs just before the process dies.
 */
class CrashStore(private val dir: File) {
    private val file get() = File(dir, FILE)

    fun save(r: ErrorReport) {
        try {
            dir.mkdirs()
            val prev = peek()
            val next = if (prev != null && prev.key == r.key) r.copy(count = prev.count + 1) else r
            val tmp = File(dir, "$FILE.tmp")
            tmp.writeText(next.toJson(""))
            if (!tmp.renameTo(file)) {
                file.writeText(next.toJson(""))
                tmp.delete()
            }
        } catch (e: Exception) {
            // never throw from the crash path
        }
    }

    fun peek(): ErrorReport? = try {
        if (file.isFile) ErrorReport.fromJson(file.readText()) else null
    } catch (e: Exception) {
        null
    }

    /** The saved crash (and forgets it), or null. */
    fun take(): ErrorReport? {
        val r = peek()
        try {
            file.delete()
        } catch (e: Exception) {
            // ignore
        }
        return r
    }

    companion object {
        const val FILE = "last-crash.json"
    }
}

/** Per process: at most [max] reports, each distinct error once (the web reporter's rule). Thread-safe. */
class ReportThrottle(private val max: Int = 5) {
    private val seen = HashSet<String>()
    private var sent = 0

    @Synchronized
    fun allow(r: ErrorReport): Boolean {
        if (sent >= max || !seen.add(r.key)) return false
        sent++
        return true
    }
}

/** Reads the count back from a report body (tests). */
internal fun countOf(json: String): Int = Json.parseToJsonElement(json).jsonObject["c"]?.jsonPrimitive?.int ?: 1
