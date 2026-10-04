package app.mishana.tv

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import app.mishana.tv.game.BillingRuntime
import app.mishana.tv.game.GameViewModel
import app.mishana.tv.ui.AppRoot
import app.mishana.tv.ui.theme.MishAnaTheme

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
        billing // start(): connect + restore
        setContent { MishAnaTheme { AppRoot(vm) } }
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
