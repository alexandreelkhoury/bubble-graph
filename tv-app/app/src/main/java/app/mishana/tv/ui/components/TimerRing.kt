package app.mishana.tv.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.State
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.mishana.tv.game.Countdown
import app.mishana.tv.protocol.DeadlineView
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishTheme

fun urgencyColor(urgency: Countdown.Urgency, calm: Color = MishColors.Text): Color = when (urgency) {
    Countdown.Urgency.CALM -> calm
    Countdown.Urgency.WARN -> MishColors.Accent
    Countdown.Urgency.DANGER -> MishColors.Danger
}

/**
 * Whole seconds left on [deadline], recomputed from the frame clock but only invalidating readers when the number
 * changes (once a second), never every frame.
 */
@Composable
fun rememberSecondsLeft(deadline: DeadlineView, clockOffsetMs: Long): State<Int> {
    val clock = rememberFrameClock()
    return remember(deadline, clockOffsetMs, clock) {
        derivedStateOf { Countdown.remainingSeconds(deadline.at, clockOffsetMs, clock.value) }
    }
}

/** Urgency stage from whole seconds (DESIGN TV-05): text until 10 s, accent until 5 s, then danger. */
private fun urgencyOf(secs: Int): Countdown.Urgency = Countdown.urgency(secs * 1_000L)

/** The animated timer colour for [secs] (ring, bar and digits share it, so they never disagree). */
@Composable
private fun timerColor(secs: Int, calm: Color, urgent: Boolean = true): Color {
    val color by animateColorAsState(if (urgent) urgencyColor(urgencyOf(secs), calm) else calm, label = "timerColor")
    return color
}

/**
 * Depleting ring (DESIGN TV-05/TV-10, §10: always clockwise from 12 o'clock, never mirrored).
 * Colour: text → accent (≤ 10 s) → danger with a pulse (≤ 5 s; no pulse in reduced motion).
 * The arc is drawn from the frame clock in the draw phase; [number] (a text style) adds the seconds in the centre.
 */
@Composable
fun TimerRing(
    deadline: DeadlineView,
    clockOffsetMs: Long,
    size: Dp,
    stroke: Dp,
    modifier: Modifier = Modifier,
    number: TextStyle? = null,
    calmColor: Color = MishColors.Text,
    urgent: Boolean = true,
) {
    val clock = rememberFrameClock()
    val secs by rememberSecondsLeft(deadline, clockOffsetMs)
    val color = timerColor(secs, calmColor, urgent)
    val pulse = if (urgent && urgencyOf(secs) == Countdown.Urgency.DANGER && secs > 0 && !MishTheme.reduceMotion) {
        rememberInfiniteTransition(label = "ringPulse").animateFloat(1f, 1.04f, infiniteRepeatable(tween(500), RepeatMode.Reverse), label = "p")
    } else {
        null
    }
    Box(modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(
            Modifier
                .fillMaxSize()
                .graphicsLayer {
                    val p = pulse?.value ?: 1f
                    scaleX = p
                    scaleY = p
                }
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
            val sweep = 360f * Countdown.fraction(deadline, clockOffsetMs, clock.value)
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
        if (number != null) TimerDigits(secs, color, number)
    }
}

/** Seconds only, Western digits, never `0:27` (DESIGN §3.5); same colour as its ring. */
@Composable
fun TimerSeconds(
    deadline: DeadlineView,
    clockOffsetMs: Long,
    modifier: Modifier = Modifier,
    style: TextStyle = MishTheme.type.timer,
    calmColor: Color = MishColors.Text,
) {
    val secs by rememberSecondsLeft(deadline, clockOffsetMs)
    TimerDigits(secs, timerColor(secs, calmColor), style, modifier)
}

@Composable
private fun TimerDigits(secs: Int, color: Color, style: TextStyle, modifier: Modifier = Modifier) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Text(text = secs.toString(), style = style, color = color, modifier = modifier)
    }
}

/**
 * Small timer chip: ring + number from one clock (TV-04 bottom end, TV-06, TV-09). [urgent] = false is the calm
 * auto-advance countdown (TV-09: secondary text, never accent/danger nor a pulse; red means "act now").
 */
@Composable
fun TimerChip(deadline: DeadlineView, clockOffsetMs: Long, modifier: Modifier = Modifier, size: Dp = 56.dp, urgent: Boolean = true) {
    TimerRing(
        deadline, clockOffsetMs, size, 5.dp, modifier,
        number = MishTheme.type.title,
        calmColor = if (urgent) MishColors.Text else MishColors.TextSecondary,
        urgent = urgent,
    )
}

/**
 * Linear timer bar (DESIGN TV-06). Mirrors in RTL: it depletes toward inline-start. Drawn from the frame clock in
 * the draw phase (no per-frame re-measure).
 */
@Composable
fun TimerBar(
    deadline: DeadlineView,
    clockOffsetMs: Long,
    modifier: Modifier = Modifier,
    height: Dp = 8.dp,
) {
    val clock = rememberFrameClock()
    val secs by rememberSecondsLeft(deadline, clockOffsetMs)
    val color = timerColor(secs, MishColors.Primary)
    val track = MishColors.Text.copy(alpha = 0.10f)
    Box(
        modifier
            .fillMaxWidth()
            .height(height)
            .clearAndSetSemantics {}
            .drawBehind {
                val r = CornerRadius(size.height / 2, size.height / 2)
                drawRoundRect(track, cornerRadius = r)
                val w = size.width * Countdown.fraction(deadline, clockOffsetMs, clock.value)
                if (w > 0f) {
                    val x = if (layoutDirection == LayoutDirection.Rtl) size.width - w else 0f
                    drawRoundRect(color, topLeft = Offset(x, 0f), size = Size(w, size.height), cornerRadius = r)
                }
            },
    )
}
