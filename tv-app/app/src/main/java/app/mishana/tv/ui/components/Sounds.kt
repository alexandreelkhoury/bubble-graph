package app.mishana.tv.ui.components

import android.os.SystemClock
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.nativeKeyEvent
import androidx.compose.ui.input.key.type
import app.mishana.tv.game.Countdown
import app.mishana.tv.game.Cue
import app.mishana.tv.game.CuePlay
import app.mishana.tv.game.RateLimiter
import app.mishana.tv.game.SoundCues
import app.mishana.tv.protocol.DeadlineView
import kotlinx.coroutines.delay

/**
 * The screens' way to the sound cues (DESIGN §6.4): [play] goes through the ViewModel (which applies the mute),
 * plus the remote's own feedback: a focus change right after a D-pad arrow ticks `ui.move` (subtle, rate-limited),
 * OK plays `ui.select`, Back `ui.back`.
 */
class TvSounds(private val sink: (CuePlay) -> Unit, private val stop: () -> Unit) {
    private var arrowAt = Long.MIN_VALUE / 2
    private val limiter = RateLimiter(FOCUS_TICK_GAP_MS)

    fun play(p: CuePlay) = sink(p)

    fun stopAll() = stop()

    /** Observes (never consumes) a key event at the root. */
    fun onKey(e: KeyEvent) {
        if (e.type != KeyEventType.KeyDown) return
        when (e.key) {
            Key.DirectionUp, Key.DirectionDown, Key.DirectionLeft, Key.DirectionRight -> arrowAt = SystemClock.uptimeMillis()
            Key.DirectionCenter, Key.Enter, Key.NumPadEnter -> if (e.nativeKeyEvent.repeatCount == 0) sink(CuePlay(Cue.UI_SELECT))
            Key.Back, Key.Escape -> if (e.nativeKeyEvent.repeatCount == 0) sink(CuePlay(Cue.UI_BACK))
            else -> Unit
        }
    }

    /** A focusable gained focus ([MishFocusSurface]): tick only when the D-pad moved it. */
    fun focusMoved() {
        val now = SystemClock.uptimeMillis()
        if (now - arrowAt < ARROW_WINDOW_MS && limiter.allow(now)) sink(CuePlay(Cue.UI_MOVE))
    }

    companion object {
        const val FOCUS_TICK_GAP_MS = 70L
        const val ARROW_WINDOW_MS = 150L
        val None = TvSounds({}, {})
    }
}

val LocalSounds = staticCompositionLocalOf { TvSounds.None }

/** The running timer's cues: the last 5 s tick and the horn, or the Blank's heartbeat ([SoundCues.deadlineCue]). */
@Composable
fun DeadlineSounds(deadline: DeadlineView?, clockOffsetMs: Long) {
    val sounds = LocalSounds.current
    val offset by rememberUpdatedState(clockOffsetMs)
    LaunchedEffect(deadline) {
        val d = deadline ?: return@LaunchedEffect
        var prev: Long? = null
        while (true) {
            val now = Countdown.remainingMs(d.at, offset, System.currentTimeMillis())
            SoundCues.deadlineCue(d.kind, prev, now)?.let { sounds.play(CuePlay(it)) }
            if (now <= 0L) break
            prev = now
            delay(100)
        }
    }
}
