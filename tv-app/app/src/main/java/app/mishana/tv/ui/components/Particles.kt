package app.mishana.tv.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.semantics.clearAndSetSemantics
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishTheme
import kotlin.math.sin
import kotlin.random.Random

private class Bit(val x: Float, val vx: Float, val vy: Float, val spin: Float, val size: Float, val color: Color, val delay: Float)

/**
 * Confetti in paper white and amber (DESIGN §6.2-D, 1.6 s; a single burst, no strobe). Removed in reduced motion.
 */
@Composable
fun Confetti(modifier: Modifier = Modifier, durationMs: Int = 1_600, seed: Int = 7) {
    if (MishTheme.reduceMotion) return
    val bits = remember(seed) {
        val r = Random(seed)
        List(90) {
            Bit(
                x = r.nextFloat(),
                vx = (r.nextFloat() - 0.5f) * 0.5f,
                vy = 0.55f + r.nextFloat() * 0.7f,
                spin = (r.nextFloat() - 0.5f) * 900f,
                size = 6f + r.nextFloat() * 8f,
                color = if (r.nextBoolean()) MishColors.Blank else MishColors.Accent,
                delay = r.nextFloat() * 0.25f,
            )
        }
    }
    val t = remember { Animatable(0f) }
    LaunchedEffect(seed) { t.animateTo(1f, tween(durationMs, easing = LinearEasing)) }
    Canvas(modifier.fillMaxSize().clearAndSetSemantics {}) {
        val p = t.value
        if (p >= 1f) return@Canvas
        for (b in bits) {
            val lp = ((p - b.delay) / (1f - b.delay)).coerceIn(0f, 1f)
            if (lp <= 0f) continue
            val x = (b.x + b.vx * lp) * size.width
            val y = (-0.05f + b.vy * lp + 0.35f * lp * lp) * size.height
            val alpha = if (lp > 0.8f) (1f - lp) / 0.2f else 1f
            val s = b.size * density / 2f
            rotate(b.spin * lp, pivot = Offset(x, y)) {
                drawRect(b.color.copy(alpha = alpha), topLeft = Offset(x - s, y - s / 2), size = Size(s * 2, s))
            }
        }
    }
}

/**
 * Victory particles (DESIGN §6.2-E): role emblems floating up (12, slow, 3 s), e.g. houses for the Civilians.
 */
@Composable
fun FloatingEmblems(
    vector: androidx.compose.ui.graphics.vector.ImageVector,
    color: Color,
    modifier: Modifier = Modifier,
    count: Int = 12,
    durationMs: Int = 3_000,
) {
    if (MishTheme.reduceMotion) return
    val painter = rememberVectorPainter(vector)
    val seeds = remember {
        val r = Random(11)
        List(count) { Triple(r.nextFloat(), r.nextFloat() * 0.4f, 28f + r.nextFloat() * 28f) }
    }
    val t = remember { Animatable(0f) }
    LaunchedEffect(Unit) { t.animateTo(1f, tween(durationMs, easing = LinearEasing)) }
    Canvas(modifier.fillMaxSize().clearAndSetSemantics {}) {
        val p = t.value
        for ((i, s) in seeds.withIndex()) {
            val (fx, delay, sz) = s
            val lp = ((p - delay) / (1f - delay)).coerceIn(0f, 1f)
            if (lp <= 0f || lp >= 1f) continue
            val px = sz * density
            val x = fx * size.width + sin((lp * 6f + i).toDouble()).toFloat() * 18f * density
            val y = size.height * (1.05f - lp * 1.2f)
            val alpha = when {
                lp < 0.15f -> lp / 0.15f
                lp > 0.75f -> (1f - lp) / 0.25f
                else -> 1f
            } * 0.55f
            translate(x - px / 2, y - px / 2) {
                with(painter) {
                    draw(Size(px, px), alpha = alpha, colorFilter = androidx.compose.ui.graphics.ColorFilter.tint(color))
                }
            }
        }
    }
}
