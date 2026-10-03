package app.mishana.tv

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import app.mishana.tv.game.GameViewModel
import app.mishana.tv.ui.AppRoot
import app.mishana.tv.ui.theme.MishAnaTheme

/**
 * Single activity (SPEC §9.3). AppCompat hosts Compose so per-app locales work on API < 33; the ViewModel survives
 * the recreation a language change causes, so the room (and its in-memory tvToken) is kept.
 */
class MainActivity : AppCompatActivity() {
    private val vm: GameViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MishAnaTheme { AppRoot(vm) } }
    }
}
