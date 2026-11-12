package app.jamaa.tv.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaMotion
import app.jamaa.tv.ui.theme.JamaaShapes
import app.jamaa.tv.ui.theme.JamaaTheme

/**
 * One device-settings row of a sheet (hub Settings): a 28 dp icon, the label start-aligned (`titleS`), the current
 * [value] in accent at the end, and a chevron when OK opens a picker ([picker]). 56 dp, row shape, row focus (cream
 * fill, ink content). The value cross-fades when it changes, so the row never resizes.
 */
@Composable
fun SettingsRow(
    icon: ImageVector,
    label: String,
    value: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    picker: Boolean = false,
    valueColor: Color = JamaaColors.Accent,
) {
    JamaaFocusSurface(onClick = onClick, modifier = modifier.fillMaxWidth().height(56.dp), shape = JamaaShapes.row, kind = FocusKind.Row) {
        Row(Modifier.fillMaxWidth().align(Alignment.CenterStart).padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(28.dp))
            Spacer(Modifier.width(14.dp))
            Text(label, style = JamaaTheme.type.titleS, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            if (value != null) {
                Spacer(Modifier.width(12.dp))
                AnimatedContent(
                    targetState = value,
                    transitionSpec = { fadeIn(tween(JamaaMotion.Fast)) togetherWith fadeOut(tween(JamaaMotion.Fast)) },
                    contentAlignment = Alignment.CenterEnd,
                    label = "settingsValue",
                ) { v ->
                    Text(v, style = JamaaTheme.type.titleS, color = focusInk(valueColor), maxLines = 1)
                }
            }
            if (picker) {
                Spacer(Modifier.width(6.dp))
                Icon(JamaaIcons.ChevronForward, contentDescription = null, tint = focusInk(JamaaColors.TextSecondary), modifier = Modifier.size(22.dp))
            }
        }
    }
}
