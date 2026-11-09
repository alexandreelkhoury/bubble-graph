package app.jamaa.tv.ui.components

import android.os.SystemClock
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.type
import app.jamaa.tv.game.Countdown
import app.jamaa.tv.game.Cue
import app.jamaa.tv.game.CuePlay
import app.jamaa.tv.game.RateLimiter
import app.jamaa.tv.game.SoundCues
import app.jamaa.tv.protocol.DeadlineView
import app.jamaa.tv.ui.platform.repeats

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
        // A held key's auto-repeats never re-select or re-back (only the arrows' repeats move focus, and tick).
        if (e.repeats > 0 && e.key !in ARROWS) return
        when (e.key) {
            Key.DirectionUp, Key.DirectionDown, Key.DirectionLeft, Key.DirectionRight -> arrowAt = SystemClock.uptimeMillis()
            Key.DirectionCenter, Key.Enter, Key.NumPadEnter -> sink(CuePlay(Cue.UI_SELECT))
            Key.Back, Key.Escape -> sink(CuePlay(Cue.UI_BACK))
            else -> Unit
        }
    }

    /** A focusable gained focus ([JamaaFocusSurface]): tick only when the D-pad moved it. */
    fun focusMoved() {
        val now = SystemClock.uptimeMillis()
        if (now - arrowAt < ARROW_WINDOW_MS && limiter.allow(now)) sink(CuePlay(Cue.UI_MOVE))
    }

    companion object {
        const val FOCUS_TICK_GAP_MS = 70L
        const val ARROW_WINDOW_MS = 150L
        val None = TvSounds({}, {})
        private val ARROWS = setOf(Key.DirectionUp, Key.DirectionDown, Key.DirectionLeft, Key.DirectionRight)
    }
}

val LocalSounds = staticCompositionLocalOf { TvSounds.None }

/** The running timer's cues (sampled every frame, the digits' clock): the last 5 s tick and the horn, or the Blank's heartbeat ([SoundCues.deadlineCue]). */
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
            // On the frame clock, like the digits ([rememberSecondsLeft]): the tick lands on the frame the number
            // changes, instead of up to 100 ms after it with a polling delay.
            withFrameMillis { }
        }
    }
}
