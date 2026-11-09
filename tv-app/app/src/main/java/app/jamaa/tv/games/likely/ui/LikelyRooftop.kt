package app.jamaa.tv.games.likely.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.semantics.clearAndSetSemantics
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme
import app.jamaa.tv.ui.theme.Worlds
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

// "Awards Night on the Rooftop" (GAME-LIKELY §12.1, DESIGN-JAMAA §1.5 rooftop palette): code-drawn props only (no
// bitmaps, no emoji, nothing borrowed from another game's look). Every prop is a pure DrawScope function so the stage
// can draw it in its own 864 × 486 dp coordinate space.

internal val Rooftop = Worlds.Rooftop

/** Award gold (DESIGN-JAMAA §1.6): #FFE7A0 → #FFC94D → #C98A1A with a #7A4A00 stamped edge. */
internal val GoldHi = Color(0xFFFFE7A0)
internal val Gold = Color(0xFFFFC94D)
internal val GoldLo = Color(0xFFC98A1A)
internal val GoldEdge = Color(0xFF7A4A00)
internal val Velvet = Color(0xFF7A1238)
internal val VelvetDeep = Color(0xFF4A0820)
internal val Cream = JamaaColors.Text
internal val EnvelopeCream = Color(0xFFF6E9D2)

internal fun goldBrush(top: Float, bottom: Float): Brush = Brush.verticalGradient(0f to GoldHi, 0.5f to Gold, 1f to GoldLo, startY = top, endY = bottom)

/**
 * The rooftop backdrop over the world stage: the city glow on the horizon, a string of lights swagging across the top
 * (bulbs twinkle slowly, never strobe; off in calm motion), and the gold arch of bulbs behind the card. [dim] (0..1)
 * lowers the lights for the reveal's drumroll, in a wave from the edges to the centre (DESIGN-JAMAA §5.3).
 */
@Composable
internal fun RooftopBackdrop(dim: () -> Float, ambient: Int, modifier: Modifier = Modifier) {
    val reduce = JamaaTheme.reduceMotion
    val twinkle = if (!reduce && ambient > 0) {
        rememberInfiniteTransition(label = "bulbs").animateFloat(0f, 1f, infiniteRepeatable(tween(3_200), RepeatMode.Restart), label = "t")
    } else {
        null
    }
    Canvas(modifier.fillMaxSize().clearAndSetSemantics {}) {
        val d = dim().coerceIn(0f, 1f)
        val w = size.width
        val h = size.height
        // City glow on the horizon (behind the jury), then a darker roof parapet line.
        drawRect(Brush.verticalGradient(listOf(Color.Transparent, Rooftop.glow.copy(alpha = 0.10f * (1f - 0.6f * d)), Color.Transparent), startY = h * 0.45f, endY = h * 0.85f))
        drawRect(Rooftop.deep.copy(alpha = 0.55f), topLeft = Offset(0f, h * 0.86f), size = Size(w, h * 0.14f))
        // Skyline silhouettes (low boxes with a few lit windows) on the horizon.
        val sky = Rooftop.surface.copy(alpha = 0.9f)
        var x = 0f
        var i = 0
        while (x < w) {
            val bw = w * (0.05f + 0.03f * ((i * 37) % 5))
            val bh = h * (0.08f + 0.04f * ((i * 53) % 4))
            drawRect(sky, topLeft = Offset(x, h * 0.86f - bh), size = Size(bw, bh))
            if (i % 2 == 0) drawRect(Gold.copy(alpha = 0.35f * (1f - d)), topLeft = Offset(x + bw * 0.3f, h * 0.86f - bh * 0.7f), size = Size(bw * 0.12f, bh * 0.12f))
            x += bw + w * 0.01f
            i++
        }
        // String lights: two swags across the top.
        val t = twinkle?.value ?: 0f
        for (row in 0..1) {
            val y0 = h * (0.04f + 0.05f * row)
            val sag = h * 0.06f
            val wire = Path().apply {
                // The quadratic swag (control at mid-width, 2 × sag down) as its exact cubic equivalent.
                moveTo(0f, y0)
                cubicTo(w / 3f, y0 + sag * 4f / 3f, w * 2f / 3f, y0 + sag * 4f / 3f, w, y0)
            }
            drawPath(wire, Color.Black.copy(alpha = 0.45f), style = Stroke(1.5f))
            val bulbs = 18
            for (b in 0..bulbs) {
                val u = b / bulbs.toFloat()
                val by = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * (y0 + sag * 2f) + u * u * y0
                // The wave: edges dim first.
                val edge = kotlin.math.abs(u - 0.5f) * 2f
                val lit = (1f - (d * 1.4f - (1f - edge) * 0.4f).coerceIn(0f, 1f) * 0.7f)
                val tw = 0.85f + 0.15f * sin((t + u * 3f + row * 0.5f) * 2f * PI.toFloat())
                drawCircle(Gold.copy(alpha = 0.25f * lit * tw), radius = 9f, center = Offset(u * w, by + 4f))
                drawCircle(GoldHi.copy(alpha = lit * tw), radius = 3.2f, center = Offset(u * w, by + 4f))
            }
        }
    }
}

/** The gold arch of bulbs behind the card (lit from the centre outward on entrance, [lit] 0..1). */
internal fun DrawScope.bulbArch(center: Offset, radius: Float, lit: Float, dim: Float) {
    val n = 15
    for (i in 0 until n) {
        val u = i / (n - 1f)
        val a = PI.toFloat() * (1f - u)
        val p = Offset(center.x + radius * cos(a), center.y - radius * sin(a))
        val fromCentre = kotlin.math.abs(u - 0.5f) * 2f
        val on = ((lit - fromCentre * 0.8f) / 0.2f).coerceIn(0f, 1f) * (1f - 0.65f * dim)
        drawCircle(Gold.copy(alpha = 0.22f * on), 12f, p)
        drawCircle(GoldHi.copy(alpha = 0.25f + 0.75f * on), 4f, p)
    }
}

/**
 * The spotlight dropping from the rig (DESIGN-JAMAA §5.3): a radial-gradient cone in `world.glow` at 40 %, no blur.
 * [drop] 0..1 slides it down 120 dp (overshoot easing settles it).
 */
internal fun DrawScope.spotlight(target: Offset, drop: Float, unit: Float) {
    if (drop <= 0f) return
    val y = target.y - 120f * unit * (1f - drop)
    val topW = 26f * unit
    val baseW = 70f * unit
    val cone = Path().apply {
        moveTo(target.x - topW, 0f)
        lineTo(target.x + topW, 0f)
        lineTo(target.x + baseW, y)
        lineTo(target.x - baseW, y)
        close()
    }
    val a = drop.coerceIn(0f, 1f)
    drawPath(cone, Brush.verticalGradient(listOf(Rooftop.glow.copy(alpha = 0.05f * a), Rooftop.glow.copy(alpha = 0.40f * a)), startY = 0f, endY = y))
    drawOval(Brush.radialGradient(listOf(Rooftop.glow.copy(alpha = 0.45f * a), Color.Transparent), center = Offset(target.x, y), radius = baseW * 1.2f), topLeft = Offset(target.x - baseW * 1.2f, y - 16f * unit), size = Size(baseW * 2.4f, 32f * unit))
    // The rig lamp at the top.
    drawRoundRect(Rooftop.elevated, topLeft = Offset(target.x - topW * 1.3f, -6f * unit), size = Size(topW * 2.6f, 14f * unit), cornerRadius = CornerRadius(4f * unit))
}

/** The award rosette (gold, ribbon tails), [r] its radius in px; [spin] degrees (180 → 0 as it lands). */
internal fun DrawScope.rosette(c: Offset, r: Float, spin: Float, alpha: Float = 1f) {
    if (alpha <= 0f) return
    translate(c.x, c.y) {
        // Ribbon tails (not spinning): two notched strips below.
        for (s in listOf(-1f, 1f)) {
            val tail = Path().apply {
                moveTo(s * r * 0.15f, r * 0.4f)
                lineTo(s * r * 0.7f, r * 1.55f)
                lineTo(s * r * 0.45f, r * 1.35f)
                lineTo(s * r * 0.3f, r * 1.6f)
                lineTo(s * r * -0.15f, r * 0.5f)
                close()
            }
            drawPath(tail, (if (s < 0) Velvet else Rooftop.accent).copy(alpha = alpha))
        }
        rotate(spin, pivot = Offset.Zero) {
            val petals = 14
            val ring = Path()
            for (i in 0 until petals * 2) {
                val a = i * PI.toFloat() / petals
                val rr = if (i % 2 == 0) r else r * 0.82f
                val p = Offset(rr * cos(a), rr * sin(a))
                if (i == 0) ring.moveTo(p.x, p.y) else ring.lineTo(p.x, p.y)
            }
            ring.close()
            drawPath(ring, goldBrush(-r, r), alpha = alpha)
            drawPath(ring, GoldEdge.copy(alpha = alpha), style = Stroke(r * 0.05f))
            drawCircle(GoldEdge.copy(alpha = alpha), r * 0.62f, Offset.Zero, style = Stroke(r * 0.05f))
            drawCircle(goldBrush(-r * 0.6f, r * 0.6f), r * 0.55f, Offset.Zero, alpha = alpha)
            // A five-point star stamped in the centre.
            val star = Path()
            for (i in 0 until 10) {
                val a = -PI.toFloat() / 2 + i * PI.toFloat() / 5
                val rr = if (i % 2 == 0) r * 0.32f else r * 0.14f
                val p = Offset(rr * cos(a), rr * sin(a))
                if (i == 0) star.moveTo(p.x, p.y) else star.lineTo(p.x, p.y)
            }
            star.close()
            drawPath(star, GoldEdge.copy(alpha = alpha * 0.8f))
        }
    }
}

/** A cream envelope (secret votes: identical for everyone, no voter colour). */
internal fun DrawScope.envelope(c: Offset, w: Float, tilt: Float, alpha: Float = 1f) {
    if (alpha <= 0f) return
    val h = w * 0.66f
    rotate(tilt, pivot = c) {
        drawRoundRect(EnvelopeCream.copy(alpha = alpha), topLeft = Offset(c.x - w / 2, c.y - h / 2), size = Size(w, h), cornerRadius = CornerRadius(w * 0.08f))
        val flap = Path().apply {
            moveTo(c.x - w / 2, c.y - h / 2)
            lineTo(c.x, c.y + h * 0.08f)
            lineTo(c.x + w / 2, c.y - h / 2)
        }
        drawPath(flap, GoldEdge.copy(alpha = 0.55f * alpha), style = Stroke(w * 0.05f, cap = StrokeCap.Round))
        drawCircle(Velvet.copy(alpha = alpha), w * 0.09f, Offset(c.x, c.y + h * 0.04f))
    }
}

/** The ballot box at the centre of the stage; [shake] 0..1 wobbles it while the drumroll plays. */
internal fun DrawScope.ballotBox(c: Offset, w: Float, shake: Float, alpha: Float) {
    if (alpha <= 0f) return
    val wobble = sin(shake * PI.toFloat() * 6f) * 6f * (1f - shake)
    rotate(wobble, pivot = Offset(c.x, c.y + w * 0.4f)) {
        val h = w * 0.8f
        drawRoundRect(Rooftop.elevated.copy(alpha = alpha), topLeft = Offset(c.x - w / 2, c.y - h / 2), size = Size(w, h), cornerRadius = CornerRadius(w * 0.08f))
        drawRoundRect(goldBrush(c.y - h / 2, c.y + h / 2), topLeft = Offset(c.x - w / 2, c.y - h / 2), size = Size(w, h), cornerRadius = CornerRadius(w * 0.08f), style = Stroke(w * 0.04f), alpha = alpha)
        drawRoundRect(Rooftop.deep.copy(alpha = alpha), topLeft = Offset(c.x - w * 0.3f, c.y - h / 2 + w * 0.06f), size = Size(w * 0.6f, w * 0.07f), cornerRadius = CornerRadius(w * 0.03f))
    }
}

/** An agreement coin in the scorer's colour with a cream rim (DESIGN-JAMAA §5.1), [r] its radius. */
internal fun DrawScope.coin(c: Offset, r: Float, color: Color) {
    drawCircle(color, r, c)
    drawCircle(Cream, r, c, style = Stroke(r * 0.3f))
    drawCircle(Color.White.copy(alpha = 0.35f), r * 0.35f, Offset(c.x - r * 0.3f, c.y - r * 0.3f))
}

/** Quadratic Bézier point; the control sits 90 dp above the chord midpoint (DESIGN §6.2 B). */
internal fun bezier(a: Offset, b: Offset, lift: Float, t: Float): Offset {
    val ctrl = Offset((a.x + b.x) / 2f, minOf(a.y, b.y) - lift)
    val u = 1f - t
    return Offset(u * u * a.x + 2 * u * t * ctrl.x + t * t * b.x, u * u * a.y + 2 * u * t * ctrl.y + t * t * b.y)
}

/** The velvet stage curtain: two panels that [open] 0..1 to the sides (AWARDS intro). */
internal fun DrawScope.curtain(open: Float) {
    val half = size.width / 2f
    val shift = half * open.coerceIn(0f, 1f)
    for (s in listOf(-1f, 1f)) {
        val left = if (s < 0) -shift else half + shift
        drawRect(Brush.horizontalGradient(listOf(VelvetDeep, Velvet, VelvetDeep, Velvet, VelvetDeep), startX = left, endX = left + half), topLeft = Offset(left, 0f), size = Size(half, size.height))
        drawRect(goldBrush(0f, 18f), topLeft = Offset(left, 0f), size = Size(half, 10f))
    }
}

/** A "?" puff of smoke for the Mystery Award; [p] 0..1. */
internal fun DrawScope.puff(c: Offset, r: Float, p: Float) {
    if (p <= 0f || p >= 1f) return
    val a = (1f - p) * 0.8f
    for (i in 0 until 6) {
        val ang = i * PI.toFloat() / 3f
        val d = r * (0.3f + 0.9f * p)
        drawCircle(JamaaColors.TextSecondary.copy(alpha = a * 0.6f), r * (0.35f + 0.25f * p), Offset(c.x + d * cos(ang), c.y + d * sin(ang)))
    }
}

/** The gold glint sweep across an award card ([p] 0..1, a 40 dp bright band). */
internal fun DrawScope.glint(p: Float) {
    if (p <= 0f || p >= 1f) return
    val x = -size.width * 0.3f + size.width * 1.6f * p
    drawRect(Brush.linearGradient(listOf(Color.Transparent, GoldHi.copy(alpha = 0.45f), Color.Transparent), start = Offset(x - 40f, 0f), end = Offset(x + 40f, size.height)))
}
