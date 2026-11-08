package app.jamaa.tv.ui.platform

import android.view.KeyEvent as AndroidKeyEvent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.nativeKeyEvent
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.jamaa.tv.i18n.messageKeyRes
import app.jamaa.tv.platform.RemoteKey
import app.jamaa.tv.ui.components.JamaaFocusSurface
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaShapes
import app.jamaa.tv.ui.theme.JamaaTheme

/** The remote key of a Compose key event (JAMAA-PLATFORM §3.10 E); INFO/MENU/PROG_* all open the ⓘ sheet (§3.6). */
fun KeyEvent.remoteKey(): RemoteKey = when (key) {
    Key.DirectionCenter, Key.Enter, Key.NumPadEnter -> RemoteKey.OK
    Key.DirectionUp -> RemoteKey.UP
    Key.DirectionDown -> RemoteKey.DOWN
    Key.DirectionLeft -> RemoteKey.LEFT
    Key.DirectionRight -> RemoteKey.RIGHT
    Key.Back, Key.Escape -> RemoteKey.BACK
    else -> when (nativeKeyEvent.keyCode) {
        // [VERIFY per reference remote] TV.md lists which remotes send INFO; most Google TV remotes do not.
        AndroidKeyEvent.KEYCODE_INFO, AndroidKeyEvent.KEYCODE_MENU,
        AndroidKeyEvent.KEYCODE_PROG_RED, AndroidKeyEvent.KEYCODE_PROG_GREEN,
        AndroidKeyEvent.KEYCODE_PROG_YELLOW, AndroidKeyEvent.KEYCODE_PROG_BLUE,
        -> RemoteKey.INFO
        else -> RemoteKey.OTHER
    }
}

/** `repeatCount` of the native event (key-repeat must never activate a button, §3.10 E rule 3). */
val KeyEvent.repeats: Int get() = nativeKeyEvent.repeatCount

/** The string of a dotted i18n key (an unknown key falls back to `error.internal`, never crashes). */
@Composable
fun keyText(key: String): String = stringResource(messageKeyRes(key))

@Composable
fun keyText(key: String, vararg args: Any): String = stringResource(messageKeyRes(key), *args)

/** A round icon button of the top bars (ⓘ 40 dp, gear). */
@Composable
fun RoundIconButton(icon: ImageVector, label: String, onClick: () -> Unit, modifier: Modifier = Modifier, size: Dp = 40.dp) {
    JamaaFocusSurface(onClick = onClick, modifier = modifier.size(size), shape = JamaaShapes.pill) {
        Icon(icon, contentDescription = label, modifier = Modifier.align(Alignment.Center).size(size * 0.55f))
    }
}

/** A small pill chip (badges, topic chips, the in-game hint). Never focusable. */
@Composable
fun Chip(text: String, modifier: Modifier = Modifier, fill: Color = JamaaColors.Surface, ink: Color = JamaaColors.TextSecondary, icon: ImageVector? = null) {
    Row(
        modifier.background(fill, JamaaShapes.pill).padding(horizontal = 10.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (icon != null) Icon(icon, contentDescription = null, tint = ink, modifier = Modifier.size(14.dp))
        Text(text, style = JamaaTheme.type.caption, color = ink, maxLines = 1)
    }
}

/** A labelled top-bar button (Pass, cup chip). */
@Composable
fun BarButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, icon: ImageVector? = null, accent: Boolean = false, content: (@Composable () -> Unit)? = null) {
    JamaaFocusSurface(onClick = onClick, modifier = modifier, shape = JamaaShapes.pill, container = if (accent) JamaaColors.Accent.copy(alpha = 0.18f) else JamaaColors.Surface) {
        Box(Modifier.padding(horizontal = 14.dp, vertical = 6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (icon != null) Icon(icon, contentDescription = null, tint = if (accent) JamaaColors.Accent else JamaaColors.Text, modifier = Modifier.size(18.dp))
                content?.invoke()
                Text(text, style = JamaaTheme.type.label, maxLines = 1)
            }
        }
    }
}
