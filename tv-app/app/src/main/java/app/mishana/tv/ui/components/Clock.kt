package app.mishana.tv.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.withFrameMillis

/** Wall clock that ticks every frame while composed (timer rings, countdown text). Local time; add the clock offset for server time. */
@Composable
fun rememberFrameClock(): State<Long> {
    val now = remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            withFrameMillis { now.longValue = System.currentTimeMillis() }
        }
    }
    return now
}
