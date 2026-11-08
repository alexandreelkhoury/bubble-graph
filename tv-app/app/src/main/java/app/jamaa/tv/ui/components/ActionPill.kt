package app.jamaa.tv.ui.components

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp

/** Kept for layouts that reserved the old pill's width. */
val PILL_MAX_WIDTH = 300.dp

/**
 * The in-game stage focus anchor (JAMAA-PLATFORM §3.2 HUB-06, §3.10 E rule 5). In game the TV shows **no focusable
 * on-screen buttons**: host actions (Skip, Close the vote, Start now…) live only in the pause menu (Back), announced by
 * the "◁ Back: menu & rules" hint (AppRoot). This keeps the former pill's signature so the Mish Ana! screens port
 * unchanged, but draws nothing: it only holds D-pad focus for the stage, and OK on it calls [onFirstPress] so a reveal
 * choreography completes locally. [label], [onConfirm] and [resetKey] are no longer used.
 */
@Suppress("UNUSED_PARAMETER")
@Composable
fun ActionPill(
    label: String,
    onConfirm: () -> Unit,
    focusRequester: FocusRequester,
    modifier: Modifier = Modifier,
    resetKey: Any? = null,
    onFirstPress: () -> Boolean = { false },
) {
    val complete by rememberUpdatedState(onFirstPress)
    androidx.compose.foundation.layout.Box(
        modifier
            .size(1.dp)
            .clearAndSetSemantics {}
            .focusRequester(focusRequester)
            .onKeyEvent { e ->
                val ok = e.key == Key.DirectionCenter || e.key == Key.Enter || e.key == Key.NumPadEnter
                if (ok && e.type == KeyEventType.KeyUp) complete()
                ok
            }
            .focusable(),
    )
}
