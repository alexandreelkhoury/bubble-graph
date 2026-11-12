package app.jamaa.tv.ui.components

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaMotion
import app.jamaa.tv.ui.theme.JamaaTheme

/**
 * A non-focusable key hint (DESIGN §9): the remote key's glyph (Back by default, auto-mirrored in RTL) at 20 dp and a
 * `textMuted` caption, e.g. "◁ Back: close", "↕ Scroll". Replaces bare "Back" words in hint lines.
 */
@Composable
fun KeyHint(text: String, modifier: Modifier = Modifier, icon: ImageVector = JamaaIcons.BackKey, color: Color = JamaaColors.TextMuted) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
        Text(text, style = JamaaTheme.type.caption, color = color, maxLines = 1)
    }
}

/**
 * "More this way" fades on a scrolling list: the top [length] fades out while [top] and the bottom while [bottom] (a
 * DstIn mask, so whatever is behind shows through). The layer is always on and the fade height animates, so a list
 * reaching its end never snaps or re-dims the focused row.
 */
@Composable
fun Modifier.edgeFade(top: Boolean, bottom: Boolean, length: Dp = 40.dp): Modifier {
    val t = animateDpAsState(if (top) length else 0.dp, tween(JamaaMotion.Base, easing = JamaaMotion.Standard), label = "fadeTop")
    val b = animateDpAsState(if (bottom) length else 0.dp, tween(JamaaMotion.Base, easing = JamaaMotion.Standard), label = "fadeBottom")
    return this
        .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
        .drawWithContent {
            drawContent()
            val tp = t.value.toPx()
            val bp = b.value.toPx()
            if (tp > 0f) {
                drawRect(Brush.verticalGradient(0f to Color.Transparent, 1f to Color.Black, startY = 0f, endY = tp), blendMode = BlendMode.DstIn)
            }
            if (bp > 0f) {
                drawRect(
                    Brush.verticalGradient(0f to Color.Black, 1f to Color.Transparent, startY = size.height - bp, endY = size.height),
                    blendMode = BlendMode.DstIn,
                )
            }
        }
}
