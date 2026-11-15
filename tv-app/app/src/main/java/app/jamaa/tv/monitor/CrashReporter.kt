package app.jamaa.tv.monitor

import app.jamaa.tv.net.Http
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * JAMAA-PLATFORM §8.3 on the Android TV: an uncaught exception is saved by [CrashStore] (then the previous handler
 * still crashes the app as before) and sent on the next launch; caught errors ([report]) are sent at once. Both go to
 * `POST <server>/api/client-errors`, throttled per process ([ReportThrottle]). Failures are silent: monitoring never
 * affects the game. [context] gives the screen and room code (no player data).
 */
class CrashReporter(
    private val store: CrashStore,
    private val serverUrl: () -> String,
    private val version: String,
    private val context: () -> Pair<String?, String?> = { null to null },
    private val send: (url: String, json: String) -> Unit = ::post,
    private val throttle: ReportThrottle = ReportThrottle(),
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Installs the uncaught-exception hook (chained) and sends a crash saved by the previous run. */
    fun start() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, e ->
            onUncaught(e)
            previous?.uncaughtException(thread, e)
        }
        scope.launch { sendPending() }
    }

    /** The crash path: synchronous, never throws. */
    fun onUncaught(e: Throwable) {
        try {
            val (screen, room) = safeContext()
            store.save(ErrorReport.of("crash", e, screen, room))
        } catch (t: Throwable) {
            // nothing else to do while dying
        }
    }

    /** Sends (and forgets) the crash saved by the previous run, if any. */
    fun sendPending() {
        val r = store.take() ?: return
        trySend(r)
    }

    /** A caught error worth knowing about (not an expected network failure). Async, throttled. */
    fun report(where: String, e: Throwable) {
        val (screen, room) = safeContext()
        val r = ErrorReport.of("caught", e, screen ?: where, room)
        if (!throttle.allow(r)) return
        scope.launch { trySend(r, throttled = true) }
    }

    private fun trySend(r: ErrorReport, throttled: Boolean = false) {
        if (!throttled && !throttle.allow(r)) return
        try {
            send(serverUrl().trim().trimEnd('/') + PATH, r.toJson(version))
        } catch (e: Exception) {
            // offline or server down: the report is dropped (a crash was already taken from the store)
        }
    }

    private fun safeContext(): Pair<String?, String?> = try { context() } catch (e: Exception) { null to null }

    companion object {
        const val PATH = "/api/client-errors"

        private val client: OkHttpClient by lazy {
            Http.base.newBuilder().callTimeout(10, TimeUnit.SECONDS).build()
        }

        private fun post(url: String, json: String) {
            val req = Request.Builder().url(url).post(json.toRequestBody("application/json".toMediaType())).build()
            client.newCall(req).execute().close()
        }

        /** The production store: the app's no-backup files dir (never in a backup). */
        fun storeIn(noBackupDir: File): CrashStore = CrashStore(File(noBackupDir, "monitor"))
    }
}

/** Process-wide reporter (MainActivity starts it; the ViewModel reports caught errors through [GameDeps]). */
object Monitor {
    @Volatile var reporter: CrashReporter? = null

    fun report(where: String, e: Throwable) {
        reporter?.report(where, e)
    }
}
