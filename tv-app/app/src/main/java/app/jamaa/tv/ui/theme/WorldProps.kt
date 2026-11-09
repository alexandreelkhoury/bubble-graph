package app.jamaa.tv.ui.theme

import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.withTransform
import app.jamaa.tv.games.GameIds
import app.jamaa.tv.games.WorldIds
import app.jamaa.tv.platform.Expression
import kotlin.math.PI
import kotlin.math.sin

/**
 * DESIGN-JAMAA §2.2 poster art, code-drawn like web `PosterArt` (components/Poster.tsx + platform.css `.poster__art--*`):
 * three characters acting each game and 2–3 world props. The same table and props feed the hub poster and the portal's
 * world layer (§3.10 A), so both TVs show the same cast and the same world.
 */
object PosterArt {
    /** Three characters acting each game (web `CAST`, DESIGN-JAMAA §2.2 "Art"); public, decorative. */
    fun cast(gameId: String?): List<Pair<String, Expression>> = when (gameId) {
        GameIds.MISHANA -> listOf("azure" to Expression.POINT, "plum" to Expression.SHOCK, "lemon" to Expression.POINT)
        GameIds.BLUFF -> listOf("jade" to Expression.THINK, "tangerine" to Expression.SMUG, "lilac" to Expression.THINK)
        GameIds.LIKELY -> listOf("aqua" to Expression.POINT, "rose" to Expression.SHY, "sand" to Expression.POINT)
        GameIds.TRIVIA -> listOf("grape" to Expression.IDLE, "coral" to Expression.CHEER, "mint" to Expression.IDLE)
        else -> listOf("coral" to Expression.IDLE, "azure" to Expression.IDLE, "lemon" to Expression.IDLE)
    }

    /**
     * Eye direction of cast member [i] of three, in physical face units: the outer two look at the middle one (web
     * `look = i == 0 ? "end" : i == 2 ? "start"`). The start side is the right in RTL.
     */
    fun look(i: Int, rtl: Boolean): Float {
        val towardEnd = when (i) {
            0 -> 1f
            2 -> -1f
            else -> 0f
        }
        return if (rtl) -towardEnd else towardEnd
    }

    /** Loop period of the ambient prop animation on the focused poster (web `prop-drift` 6 s; the others divide it). */
    const val AMBIENT_MS = 6_000
}

/**
 * Draws [worldId]'s props in this draw scope's box (sized like a 210 × 290 poster, scaled), at loop phase [phase]
 * (0..1, [PosterArt.AMBIENT_MS]); a fixed phase (0) is the still poster. [shift] moves the props by a fraction of the box
 * height. [box] is the poster box to lay out in (default: this scope; the portal scales a poster-sized box). Unknown worlds
 * draw the night market.
 */
fun DrawScope.drawWorldProps(worldId: String?, colors: WorldColors, phase: Float, rtl: Boolean, shift: Float = 0f, box: Size = size) {
    val w = box.width
    val h = box.height
    val u = w / 210f
    /** x of a point [frac] of the width from the start edge (mirrored in RTL). */
    fun sx(frac: Float) = if (rtl) w * (1f - frac) else w * frac
    fun wave(offset: Float) = sin(2.0 * PI * (phase + offset)).toFloat()
    withTransform({ translate(0f, shift * h) }) {
        when (worldId) {
            WorldIds.HAKAWATI_CAFE -> {
                // A brass lantern on its cord (flickers), a cup with a wisp of steam.
                val cordX = sx(0.18f)
                val cordH = h * 0.26f
                drawLine(Color(0x66FFE3A3), Offset(cordX, 0f), Offset(cordX, cordH), 2f * u)
                val flicker = 0.92f + 0.08f * wave(0.1f) * wave(0.37f)
                drawCircle(Brush.radialGradient(listOf(Color(0x73FFE3A3), Color.Transparent), Offset(cordX, cordH + 15f * u), 36f * u), 36f * u, Offset(cordX, cordH + 15f * u), alpha = flicker)
                drawRoundRect(
                    Brush.radialGradient(listOf(Color(0xFFFFE3A3), Color(0xFFE9A23B), Color(0xFF7A4A00)), Offset(cordX, cordH + 13f * u), 18f * u),
                    topLeft = Offset(cordX - 12f * u, cordH),
                    size = Size(24f * u, 30f * u),
                    cornerRadius = CornerRadius(9f * u),
                    alpha = flicker,
                )
                val cupX = if (rtl) w * 0.14f else w * (1f - 0.14f) - 22f * u
                val cupY = h * 0.30f
                drawRoundRect(Color(0xFFF4E6CF), Offset(cupX, cupY), Size(22f * u, 16f * u), CornerRadius(6f * u))
                drawRect(Color(0xFFD9C3A0), Offset(cupX, cupY + 12f * u), Size(22f * u, 4f * u))
                val steam = (phase * 2f) % 1f
                val sa = if (steam < 0.4f) steam / 0.4f else 1f - (steam - 0.4f) / 0.6f
                val path = Path().apply {
                    val x0 = cupX + 11f * u + 3f * u * steam
                    val y0 = cupY - 2f * u - 10f * u * steam
                    moveTo(x0, y0)
                    cubicTo(x0 - 5f * u, y0 - 4f * u, x0 + 5f * u, y0 - 8f * u, x0, y0 - 12f * u)
                }
                drawPath(path, Color(0x66FFF7EC), alpha = sa.coerceIn(0f, 1f), style = Stroke(2f * u, cap = StrokeCap.Round))
            }
            WorldIds.ROOFTOP -> {
                // A string of lights across the top, the moon, the skyline.
                val lights = Path().apply {
                    moveTo(-0.04f * w, h * 0.08f)
                    quadraticTo(w * 0.5f, h * 0.08f + 40f * u, w * 1.04f, h * 0.08f)
                }
                drawPath(lights, Color(0x59B8FFF6), style = Stroke(2f * u))
                for (k in 0 until 7) {
                    val t = (k + 0.5f) / 7f
                    val x = -0.04f * w + 1.08f * w * t
                    val y = h * 0.08f + 40f * u * 2f * t * (1f - t)
                    val tw = 0.6f + 0.4f * (0.5f + 0.5f * wave(k / 7f))
                    drawCircle(colors.glow, 2.6f * u, Offset(x, y + 3f * u), alpha = tw)
                }
                val moon = Offset(if (rtl) w * 0.12f + 12f * u else w * 0.88f - 12f * u, h * 0.30f + 12f * u)
                drawCircle(Color(0x80FFC94D), 19f * u, moon)
                drawCircle(Brush.radialGradient(listOf(Color(0xFFFFE7A0), Color(0xFFFFC94D), Color(0xFFC98A1A)), moon, 12f * u), 12f * u, moon)
                val top = h * (1f - 0.32f - 0.24f)
                val sky = Path().apply {
                    val xs = floatArrayOf(0f, .12f, .12f, .22f, .22f, .40f, .40f, .52f, .52f, .70f, .70f, .80f, .80f, 1f)
                    val ys = floatArrayOf(.40f, .40f, .10f, .10f, .50f, .50f, .25f, .25f, .60f, .60f, 0f, 0f, .45f, .45f)
                    moveTo(sx(xs[0]), top + ys[0] * h * 0.24f)
                    for (i in 1 until xs.size) lineTo(sx(xs[i]), top + ys[i] * h * 0.24f)
                    lineTo(sx(1f), top + h * 0.24f)
                    lineTo(sx(0f), top + h * 0.24f)
                    close()
                }
                drawPath(sky, Brush.verticalGradient(listOf(Color(0xE60E2C3B), Color(0xB3071A24)), top, top + h * 0.24f))
            }
            WorldIds.QUIZ_STUDIO -> {
                // Two spotlight cones sweeping ±8°, the contestants' desk.
                for ((k, startSide) in listOf(0 to true, 1 to false)) {
                    val angle = 8f * wave(k * 0.5f)
                    val cw = w * 0.46f
                    val left = if (startSide xor rtl) 0f else w - cw
                    val pivot = Offset(left + cw / 2f, -0.10f * h)
                    rotate(angle, pivot) {
                        val cone = Path().apply {
                            moveTo(left + cw * 0.45f, -0.10f * h)
                            lineTo(left + cw * 0.55f, -0.10f * h)
                            lineTo(left + cw, h * 1.10f)
                            lineTo(left, h * 1.10f)
                            close()
                        }
                        drawPath(cone, Brush.verticalGradient(listOf(Color(0x80FFD84D), Color.Transparent), -0.10f * h, h * 0.86f))
                    }
                }
                val desk = Rect(w * 0.22f, h * (1f - 0.02f - 0.09f), w * 0.78f, h * 0.98f)
                drawRoundRect(Brush.verticalGradient(listOf(Color(0xFF222B63), Color(0xFF161D4A)), desk.top, desk.bottom), desk.topLeft, desk.size, CornerRadius(6f * u))
                drawRect(Color(0x99FFD84D), desk.topLeft, Size(desk.width, 3f * u))
            }
            else -> {
                // The night market's bang marks: three tilted "!" in glow → accent, drifting (Mish Ana!'s shared bang).
                data class Bang(val start: Float, val top: Float, val height: Float, val alpha: Float, val delay: Float)
                val bangs = listOf(Bang(0.10f, 0.10f, 0.18f, 0.55f, 0f), Bang(1f - 0.12f, 0.18f, 0.13f, 0.35f, -1f / 3f), Bang(0.46f, 0.04f, 0.09f, 0.25f, -2f / 3f))
                for (b in bangs) {
                    val bh = b.height * h
                    val bw = bh / 3f
                    // inset-inline-end for the second mark: its far edge sits 12 % from the end.
                    val x0 = if (b.start > 0.5f) sx(b.start) - (if (rtl) -bw else bw) else sx(b.start)
                    val left = if (rtl) x0 - bw else x0
                    val y = b.top * h - 8f * u * (0.5f - 0.5f * kotlin.math.cos(2.0 * PI * (phase + b.delay)).toFloat())
                    // web skewX(-10deg): the mark leans toward the end side (mirrored in RTL).
                    rotate(if (rtl) -10f else 10f, Offset(left + bw / 2f, y + bh / 2f)) {
                        drawRoundRect(
                            Brush.verticalGradient(listOf(colors.glow, colors.accent), y, y + bh),
                            Offset(left, y),
                            Size(bw, bh),
                            CornerRadius(bw / 2f),
                            alpha = b.alpha,
                        )
                        val dot = bw * 0.8f
                        drawCircle(colors.glow, dot / 2f, Offset(left + bw / 2f, y + bh * 1.45f - dot / 2f), alpha = b.alpha)
                    }
                }
            }
        }
    }
}
