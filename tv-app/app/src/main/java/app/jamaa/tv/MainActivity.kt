package app.jamaa.tv

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import app.jamaa.tv.game.BillingRuntime
import app.jamaa.tv.game.GameViewModel
import app.jamaa.tv.game.TvUiState
import app.jamaa.tv.monitor.CrashReporter
import app.jamaa.tv.monitor.Monitor
import app.jamaa.tv.settings.DebugPrefs
import app.jamaa.tv.ui.AppRoot
import app.jamaa.tv.ui.theme.JamaaTheme

/**
 * Single activity (SPEC §9.3). AppCompat hosts Compose so per-app locales work on API < 33; the ViewModel survives
 * the recreation a language change causes, so the room (and its in-memory tvToken) is kept.
 *
 * Billing (PAYMENTS-SPEC §2.4 rule 1, §4.2): the process-wide repository is created (and connects) on first use; every
 * ON_START / ON_RESUME re-reads Play's purchases, and the connection ends only when the activity really finishes.
 */
class MainActivity : AppCompatActivity() {
    private val vm: GameViewModel by viewModels()
    private val billing by lazy { BillingRuntime.get(application) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startMonitor()
        billing // start(): connect + restore
        setContent { JamaaTheme { AppRoot(vm) } }
    }

    /**
     * JAMAA-PLATFORM §8.3: once per process, the crash hook (saved now, sent on the next launch) and the caught-error
     * reporter. The context is the screen (room phase:game) and the room code only.
     */
    private fun startMonitor() {
        if (Monitor.reporter != null) return
        val prefs = DebugPrefs(applicationContext)
        val reporter = CrashReporter(
            store = CrashReporter.storeIn(noBackupFilesDir),
            serverUrl = { prefs.effectiveServerUrl() },
            version = BuildConfig.VERSION_NAME,
            context = {
                when (val s = vm.ui.value) {
                    is TvUiState.InRoom -> (s.view?.room?.let { "${it.phase.name}:${it.setupGameId ?: ""}" } ?: "room") to s.code
                    is TvUiState.CreateFailed -> "createFailed" to null
                    TvUiState.CreatingRoom -> "creating" to null
                    is TvUiState.Fatal -> "fatal" to null
                }
            },
        )
        Monitor.reporter = reporter
        reporter.start()
    }

    override fun onStart() {
        super.onStart()
        billing.onLifecycleStart()
    }

    override fun onResume() {
        super.onResume()
        billing.onResume()
    }

    override fun onStop() {
        billing.onStop()
        super.onStop()
    }

    override fun onDestroy() {
        if (isFinishing) BillingRuntime.release()
        super.onDestroy()
    }
}
