package app.jamaa.tv.games.mishana.ui

import androidx.compose.animation.ContentTransform
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.Animatable

import androidx.compose.animation.core.tween
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.isSpecified
import androidx.compose.ui.unit.sp
import app.jamaa.tv.games.mishana.MishanaLayout
import app.jamaa.tv.ui.theme.JamaaMotion
import app.jamaa.tv.ui.theme.JamaaTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * The gap between the in-game top bar and the stage. It clears the platform's "◁ Back: menu & rules" hint (HUB-06:
 * a 28–32 dp chip at y 52–84 under the safe top, at the end side): the stage starts at y 88, so no stage line,
 * chip or panel ever runs under it.
 */
val STAGE_TOP_GAP: Dp = 40.dp

/**
 * Every Mish Ana! AnimatedContent ends its transform with this: the default SizeTransform clips the content to the
 * container while it animates, which cut the rings, glows, stamps and the 24 dp slide-in at the top-bar line and the
 * bottom safe line. Content draws past its box by design here, so it is never clipped.
 */
fun ContentTransform.noClip(): ContentTransform = ContentTransform(targetContentEnter, initialContentExit, targetContentZIndex, SizeTransform(clip = false))

/**
 * A sentence on the stage that is never cut: it wraps up to [maxLines] lines and steps its size down (to
 * [minScale] of the style) until it fits the box it is given. The line height follows the chosen size.
 * Ellipsis only as the very last resort (a box too small even at the smallest size).
 */
@Composable
fun StageText(
    text: String,
    style: TextStyle,
    color: Color,
    modifier: Modifier = Modifier,
    maxLines: Int = 2,
    minScale: Float = 0.6f,
    textAlign: TextAlign = TextAlign.Center,
) {
    val max = style.fontSize
    val min = (max.value * minScale).sp
    val lh = if (style.lineHeight.isSpecified && max.isSpecified && max.value > 0f) (style.lineHeight.value / max.value).em else style.lineHeight
    BasicText(
        text = text,
        modifier = modifier,
        style = style.copy(color = color, textAlign = textAlign, lineHeight = lh),
        maxLines = maxLines,
        softWrap = maxLines > 1,
        overflow = TextOverflow.Ellipsis,
        autoSize = TextAutoSize.StepBased(minFontSize = min, maxFontSize = max, stepSize = 1.sp),
    )
}

/**
 * The last guard against a crop: the content is measured at its natural height and, when that is taller than the
 * box (a long translation, Arabic line heights, a 1.3× font scale), scaled down around its centre to fit. Never
 * scales up. Use it on content without weights or fillMaxHeight (it is measured with an unbounded height).
 */
fun Modifier.fitHeight(): Modifier = this.layout { measurable, constraints ->
    val p = measurable.measure(constraints.copy(minHeight = 0, maxHeight = Constraints.Infinity))
    val boxH = if (constraints.hasBoundedHeight) constraints.maxHeight else p.height
    val s = MishanaLayout.fitScale(p.height.toFloat(), boxH.toFloat())
    val w = p.width.coerceIn(constraints.minWidth, constraints.maxWidth)
    val h = minOf(p.height, boxH).coerceAtLeast(constraints.minHeight)
    layout(w, h) {
        p.placeWithLayer((w - p.width) / 2, (h - p.height) / 2) {
            scaleX = s
            scaleY = s
            transformOrigin = TransformOrigin(0.5f, 0.5f)
        }
    }
}

/**
 * Staged entrance: after [delayMs], the element rises [rise] and fades in on `ease.decel` ([JamaaMotion.Slow]),
 * optionally growing from [fromScale]. Replays when [key] changes. Reduced motion: a 150 ms fade, no movement.
 * Values are read in the layer only (no recomposition per frame).
 */
@Composable
fun Modifier.stagedEnter(delayMs: Int = 0, key: Any? = Unit, rise: Dp = 20.dp, fromScale: Float = 1f, durationMs: Int = JamaaMotion.Slow): Modifier {
    val reduce = JamaaTheme.reduceMotion
    val t = remember(key) { Animatable(0f) }
    val a = remember(key) { Animatable(0f) }
    LaunchedEffect(key) {
        if (delayMs > 0) delay(delayMs.toLong())
        if (reduce) {
            t.snapTo(1f)
            a.animateTo(1f, tween(JamaaMotion.Fast))
        } else {
            launch { a.animateTo(1f, tween(durationMs * 2 / 3, easing = JamaaMotion.Decel)) }
            t.animateTo(1f, tween(durationMs, easing = if (fromScale < 1f) JamaaMotion.Overshoot else JamaaMotion.Decel))
        }
    }
    val risePx = with(LocalDensity.current) { rise.toPx() }
    return this.graphicsLayer {
        alpha = a.value
        translationY = (1f - t.value) * risePx
        val s = fromScale + (1f - fromScale) * t.value
        scaleX = s
        scaleY = s
    }
}
