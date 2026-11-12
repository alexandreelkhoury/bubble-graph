package app.jamaa.tv.ui.platform

import android.view.KeyEvent as AndroidKeyEvent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandHorizontally
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkHorizontally
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.tv.material3.Border
import app.jamaa.tv.ui.theme.JamaaMotion
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

/**
 * A round icon button of the top bars (ⓘ 40 dp, gear). At rest an `elevated` disc with a 1 dp outline (it reads as a
 * button, not a glyph on the background); focused it grows into a pill that names itself ([label]).
 */
@Composable
fun RoundIconButton(icon: ImageVector, label: String, onClick: () -> Unit, modifier: Modifier = Modifier, size: Dp = 40.dp) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val shape = JamaaShapes.pill
    val glyph = size * 0.55f
    JamaaFocusSurface(
        onClick = onClick,
        modifier = modifier.height(size).widthIn(min = size),
        shape = shape,
        container = JamaaColors.Elevated,
        rest = Border(BorderStroke(1.dp, JamaaColors.Outline), shape = shape),
        interactionSource = interaction,
    ) {
        Row(
            Modifier.align(Alignment.Center).padding(horizontal = (size - glyph) / 2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(icon, contentDescription = label, modifier = Modifier.size(glyph))
            AnimatedVisibility(
                visible = focused,
                enter = fadeIn(tween(JamaaMotion.Fast)) + expandHorizontally(tween(JamaaMotion.Fast, easing = JamaaMotion.Standard)),
                exit = fadeOut(tween(JamaaMotion.Fast)) + shrinkHorizontally(tween(JamaaMotion.Fast, easing = JamaaMotion.Standard)),
            ) {
                // The icon already carries the label for TalkBack.
                Text(label, style = JamaaTheme.type.label, maxLines = 1, modifier = Modifier.padding(start = 8.dp, end = 4.dp).clearAndSetSemantics { })
            }
        }
    }
}

/** A small pill chip (badges, topic chips, the in-game hint). Never focusable. */
@Composable
fun Chip(text: String, modifier: Modifier = Modifier, fill: Color = JamaaColors.Surface, ink: Color = JamaaColors.TextSecondary, icon: ImageVector? = null) {
    Row(
        // One chip size everywhere: 28 dp high (taller only for Arabic's 30 sp caption line), 18 dp icon.
        modifier.background(fill, JamaaShapes.pill).defaultMinSize(minHeight = 28.dp).padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (icon != null) Icon(icon, contentDescription = null, tint = ink, modifier = Modifier.size(18.dp))
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
