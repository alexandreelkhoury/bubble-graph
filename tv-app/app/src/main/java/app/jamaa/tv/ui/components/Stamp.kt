package app.jamaa.tv.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.jamaa.tv.ui.theme.JamaaShapes
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaMotion
import app.jamaa.tv.ui.theme.JamaaTheme

/**
 * Rubber stamp (DESIGN §9 `Stamp`): lands at −8° with `ease.overshoot` from 1.6× (400 ms), or simply appears
 * in reduced motion / when [instant] (skip to end state).
 */
@Composable
fun Stamp(
    text: String,
    color: Color,
    modifier: Modifier = Modifier,
    style: TextStyle = JamaaTheme.type.displayM,
    instant: Boolean = false,
    durationMs: Int = 400,
) {
    val reduce = JamaaTheme.reduceMotion
    val scale = remember { Animatable(if (reduce || instant) 1f else 1.6f) }
    val alpha = remember { Animatable(if (reduce || instant) 1f else 0f) }
    LaunchedEffect(instant) {
        if (instant || reduce) {
            scale.snapTo(1f)
            alpha.snapTo(1f)
        } else {
            alpha.animateTo(1f, tween(durationMs / 3))
        }
    }
    LaunchedEffect(instant) {
        if (!instant && !reduce) scale.animateTo(1f, tween(durationMs, easing = JamaaMotion.Overshoot))
    }
    val shape = JamaaShapes.row
    Box(
        modifier
            .graphicsLayer {
                rotationZ = -8f
                scaleX = scale.value
                scaleY = scale.value
                this.alpha = alpha.value
            }
            .background(JamaaColors.Bg.copy(alpha = 0.72f), shape)
            .border(BorderStroke(6.dp, color), shape)
            .padding(horizontal = 28.dp, vertical = 6.dp),
    ) {
        Text(text = text, style = style, color = color, textAlign = TextAlign.Center, maxLines = 2)
    }
}
