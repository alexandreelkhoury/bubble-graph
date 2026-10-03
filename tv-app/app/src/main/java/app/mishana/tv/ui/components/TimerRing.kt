package app.mishana.tv.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.mishana.tv.game.Countdown
import app.mishana.tv.protocol.DeadlineView
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishTheme

fun urgencyColor(remainingMs: Long, calm: Color = MishColors.Text): Color = when (Countdown.urgency(remainingMs)) {
    Countdown.Urgency.CALM -> calm
    Countdown.Urgency.WARN -> MishColors.Accent
    Countdown.Urgency.DANGER -> MishColors.Danger
}

/**
 * Depleting ring (DESIGN TV-05/TV-10, §10: always clockwise from 12 o'clock, never mirrored).
 * Colour: text → accent (≤ 10 s) → danger with a pulse (≤ 5 s; no pulse in reduced motion).
 */
@Composable
fun TimerRing(
    deadline: DeadlineView,
    clockOffsetMs: Long,
    size: Dp,
    stroke: Dp,
    modifier: Modifier = Modifier,
    showNumber: Boolean = false,
    calmColor: Color = MishColors.Text,
) {
    val now by rememberFrameClock()
    val remaining = Countdown.remainingMs(deadline.at, clockOffsetMs, now)
    val fraction = Countdown.fraction(deadline, clockOffsetMs, now)
    val color by animateColorAsState(urgencyColor(remaining, calmColor), label = "ringColor")
    val pulse = if (Countdown.urgency(remaining) == Countdown.Urgency.DANGER && remaining > 0 && !MishTheme.reduceMotion) {
        val t = rememberInfiniteTransition(label = "ringPulse")
        t.animateFloat(1f, 1.04f, infiniteRepeatable(tween(500), RepeatMode.Reverse), label = "p").value
    } else {
        1f
    }
    Box(modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(
            Modifier
                .fillMaxSize()
                .graphicsLayer { scaleX = pulse; scaleY = pulse }
                .clearAndSetSemantics {},
        ) {
            val sw = stroke.toPx()
            val inset = sw / 2
            val arcSize = Size(this.size.width - sw, this.size.height - sw)
            drawArc(
                color = MishColors.Text.copy(alpha = 0.12f),
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = Offset(inset, inset),
                size = arcSize,
                style = Stroke(sw),
            )
            // Remaining time: clockwise from 12 o'clock; it depletes from its start (the clock metaphor).
            val sweep = 360f * fraction
            drawArc(
                color = color,
                startAngle = -90f + (360f - sweep),
                sweepAngle = sweep,
                useCenter = false,
                topLeft = Offset(inset, inset),
                size = arcSize,
                style = Stroke(sw, cap = StrokeCap.Round),
            )
        }
        if (showNumber) {
            TimerNumber(remaining, color)
        }
    }
}

/** Seconds only, Western digits, never `0:27` (DESIGN §3.5). */
@Composable
fun TimerNumber(remainingMs: Long, color: Color, modifier: Modifier = Modifier) {
    val secs = ((remainingMs + 999) / 1000).toInt()
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Text(text = secs.toString(), style = MishTheme.type.timer, color = color, modifier = modifier)
    }
}

/** Small timer chip: ring + number (TV-04 bottom end, TV-06). */
@Composable
fun TimerChip(deadline: DeadlineView, clockOffsetMs: Long, modifier: Modifier = Modifier, size: Dp = 56.dp) {
    val now by rememberFrameClock()
    val remaining = Countdown.remainingMs(deadline.at, clockOffsetMs, now)
    Box(modifier.size(size), contentAlignment = Alignment.Center) {
        TimerRing(deadline, clockOffsetMs, size, 5.dp)
        val secs = ((remaining + 999) / 1000).toInt()
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            Text(
                text = secs.toString(),
                style = MishTheme.type.title,
                color = urgencyColor(remaining),
            )
        }
    }
}

/**
 * Linear timer bar (DESIGN TV-06). Mirrors in RTL: it depletes toward inline-start, which the layout direction
 * handles because the fill is aligned to the start.
 */
@Composable
fun TimerBar(
    deadline: DeadlineView,
    clockOffsetMs: Long,
    modifier: Modifier = Modifier,
    height: Dp = 8.dp,
) {
    val now by rememberFrameClock()
    val remaining = Countdown.remainingMs(deadline.at, clockOffsetMs, now)
    val fraction = Countdown.fraction(deadline, clockOffsetMs, now)
    val color by animateColorAsState(urgencyColor(remaining, MishColors.Primary), label = "barColor")
    val shape = RoundedCornerShape(50)
    Box(
        modifier
            .fillMaxWidth()
            .height(height)
            .clip(shape)
            .background(MishColors.Text.copy(alpha = 0.10f)),
    ) {
        Box(
            Modifier
                .fillMaxHeight()
                .fillMaxWidth(fraction)
                .align(Alignment.CenterStart)
                .background(color, shape),
        )
    }
}
