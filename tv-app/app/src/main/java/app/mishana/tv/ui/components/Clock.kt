package app.mishana.tv.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.withFrameMillis

/** The room's shared frame clock (see [ProvideFrameClock]); null outside a provider. */
val LocalFrameClock = compositionLocalOf<State<Long>?> { null }

/**
 * Provides ONE wall clock for every countdown under [content] (rings, bars, seconds), ticking every frame only while
 * [active] (the phase has a deadline). Readers must read `.value` in a draw/layer lambda or through `derivedStateOf`,
 * never in composition, so a ticking clock never recomposes anything by itself.
 */
@Composable
fun ProvideFrameClock(active: Boolean, content: @Composable () -> Unit) {
    val now = remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(active) {
        now.longValue = System.currentTimeMillis()
        while (active) withFrameMillis { now.longValue = System.currentTimeMillis() }
    }
    CompositionLocalProvider(LocalFrameClock provides now, content = content)
}

/** The provided room clock, or a local per-frame clock when there is no provider. Local time: add the clock offset. */
@Composable
fun rememberFrameClock(): State<Long> {
    LocalFrameClock.current?.let { return it }
    val now = remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) withFrameMillis { now.longValue = System.currentTimeMillis() }
    }
    return now
}
