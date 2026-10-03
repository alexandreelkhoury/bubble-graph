package app.mishana.tv.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import app.mishana.tv.R
import app.mishana.tv.game.ArmedAction
import kotlinx.coroutines.delay

/**
 * The in-game action pill (SPEC §9.6, DESIGN §7): a ghost pill that holds focus. The first OK arms it
 * (label → `tv.pressAgain` for 3 s), a second OK within 3 s calls [onConfirm] (HOST_ADVANCE).
 * [onFirstPress] lets a reveal animation consume the first OK to jump to its end state (returns true if consumed).
 */
@Composable
fun ActionPill(
    label: String,
    onConfirm: () -> Unit,
    focusRequester: FocusRequester,
    modifier: Modifier = Modifier,
    onFirstPress: () -> Boolean = { false },
) {
    val armed = remember { ArmedAction() }
    var armedLabel by remember { mutableStateOf(false) }
    var armToken by remember { mutableStateOf(0) }
    val consume by rememberUpdatedState(onFirstPress)
    val confirm by rememberUpdatedState(onConfirm)
    LaunchedEffect(armToken) {
        if (armToken > 0) {
            delay(3_000)
            armedLabel = false
        }
    }
    MishButton(
        text = if (armedLabel) stringResource(R.string.tv__press_again) else label,
        onClick = {
            if (consume()) return@MishButton
            val now = System.currentTimeMillis()
            when (armed.press(now)) {
                ArmedAction.Result.ARMED -> {
                    armedLabel = true
                    armToken++
                }
                ArmedAction.Result.FIRED -> {
                    armedLabel = false
                    confirm()
                }
            }
        },
        modifier = modifier.focusRequester(focusRequester),
        kind = if (armedLabel) ButtonKind.Primary else ButtonKind.Ghost,
        minWidth = 200.dp,
    )
}
