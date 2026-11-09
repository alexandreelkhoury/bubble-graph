package app.jamaa.tv.ui.characters

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.tv.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.jamaa.tv.platform.CharacterRules
import app.jamaa.tv.platform.Expression
import app.jamaa.tv.ui.components.Avatar
import app.jamaa.tv.ui.components.AvatarGlyphs
import app.jamaa.tv.ui.components.AvatarState
import app.jamaa.tv.ui.components.desaturate
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme
import app.jamaa.tv.ui.theme.PlayerSwatch
import kotlinx.coroutines.delay
import kotlin.random.Random

/**
 * A player character (JAMAA-PLATFORM §3.7, DESIGN-JAMAA §4): the DESIGN §5.2 glyph body in the player colour with a
 * face drawn in the per-shape face box, one of the 13 expressions, the body motion that doubles it at small sizes, the
 * reaction burst above the head (1.5 s, replayed per [burstKey] = `reaction.n`), the VIP crown ([AvatarState.host]),
 * the 2 dp cream ring at 24 % on the low-contrast coral / grape / plum (§4.2), the pointing nub on the [look] side for
 * `point`, and a ground shadow that stays on the floor (it shrinks and fades as the body hops). Below 40 dp the classic
 * avatar tile is drawn (faces off). Geometry: lane D's generated [CharacterPaths] (shared/src/characters, pinned by
 * shared/fixtures/v2/characters.json). [expression] must come from public data only (CharacterRules.expression).
 */
@Composable
fun Character(
    colorId: String,
    size: Dp,
    expression: Expression,
    modifier: Modifier = Modifier,
    /** Eye offset toward a target, in face units (clamped to 1.2); its x sign also picks the lean and nub side. */
    look: Offset = Offset.Zero,
    state: AvatarState = AvatarState(),
    /** A reaction kind (`laugh`, `shock`…) whose burst plays above the head; null = none. */
    burst: String? = null,
    /** Replays the burst when it changes (`reaction.n`). */
    burstKey: Int = 0,
) {
    if (size < CharacterRules.MIN_FACE_DP.dp) {
        Avatar(colorId, size, modifier, state.copy(away = state.away || expression == Expression.AWAY))
        return
    }
    val swatch = PlayerSwatch.byId(colorId)
    val reduce = JamaaTheme.reduceMotion
    val away = expression == Expression.AWAY
    val body = if (away || state.eliminated || state.left) swatch.color.desaturate(0.8f) else swatch.color
    val ink = swatch.glyph
    val shapeKey = swatch.shape.name.lowercase()

    // Blink every 3–6 s (random per client), 120 ms close-open; idle only.
    var blink by remember { mutableFloatStateOf(1f) }
    LaunchedEffect(expression, reduce) {
        if (expression != Expression.IDLE || reduce) return@LaunchedEffect
        while (true) {
            delay(Random.nextLong(3_000, 6_000))
            blink = 0.15f
            delay(120)
            blink = 1f
        }
    }
    // Body motion doubles the expression (hop, sink, jump-back, breathe), keyed by the expression change.
    val hop = remember { Animatable(0f) }
    LaunchedEffect(expression, reduce) {
        hop.snapTo(0f)
        if (reduce) return@LaunchedEffect
        when (expression) {
            Expression.HAPPY, Expression.DONE -> { hop.animateTo(-0.15f, tween(130)); hop.animateTo(0f, tween(130)) }
            Expression.LAUGH -> repeat(2) { hop.animateTo(-0.10f, tween(90)); hop.animateTo(0f, tween(90)) }
            Expression.CHEER -> repeat(3) { hop.animateTo(-0.2f, tween(110)); hop.animateTo(0f, tween(110)) }
            Expression.SAD -> hop.animateTo(0.04f, tween(400))
            Expression.SHOCK -> { hop.animateTo(-0.06f, tween(150)); hop.animateTo(0f, tween(150)) }
            else -> Unit
        }
    }
    val breathe = if (!reduce && expression == Expression.IDLE) {
        rememberInfiniteTransition(label = "breathe").animateFloat(1f, 1.02f, infiniteRepeatable(tween(1_600), RepeatMode.Reverse), label = "b")
    } else {
        null
    }
    // The reaction burst: 1.5 s (web `ch-burst`: rise, pop to 1.15, settle, drift up and fade); calm: held still.
    val burstArt = CharacterBursts.forReaction(burst)
    val burstT = remember { Animatable(1f) }
    LaunchedEffect(burstKey, burst) {
        if (burstArt == null) return@LaunchedEffect
        burstT.snapTo(0f)
        if (reduce) {
            burstT.snapTo(0.5f)
            delay(CharacterRules.REACTION_MS)
            burstT.snapTo(1f)
        } else {
            burstT.animateTo(1f, tween(CharacterRules.REACTION_MS.toInt(), easing = LinearEasing))
        }
    }
    val pointEnd = look.x >= 0f
    val lean = when (expression) {
        Expression.SMUG -> -6f
        Expression.FACEPALM -> 4f
        Expression.POINT -> if (pointEnd) 10f else -10f
        Expression.THINK -> 3f
        else -> 0f
    }
    val boost = CharacterRules.featureBoost(size.value, swatch.shape)
    val box = CharacterRules.faceBox(swatch.shape)
    val lk = Offset(look.x.coerceIn(-1.2f, 1.2f), look.y.coerceIn(-1.2f, 1.2f))
    val ringed = colorId in RINGED

    Box(modifier.size(size).clearAndSetSemantics {}, contentAlignment = Alignment.Center) {
        // The ground shadow stays on the floor, outside the rig: a hop (negative) shrinks and fades it.
        Canvas(Modifier.fillMaxSize()) {
            val w = this.size.width
            val lift = (-hop.value).coerceAtLeast(0f)
            val k = 1f / (1f + 2.5f * lift)
            val sw = w * 0.7f * k
            drawOval(Color.Black.copy(alpha = 0.3f * k), topLeft = Offset((w - sw) / 2f, w * 0.92f), size = Size(sw, w * 0.08f))
        }
        Box(
            Modifier
                .fillMaxSize()
                .graphicsLayer {
                    val b = breathe?.value ?: 1f
                    transformOrigin = TransformOrigin(0.5f, 1f)
                    scaleY = b
                    scaleX = 1f / kotlin.math.sqrt(b)
                    translationY = hop.value * this.size.height
                    rotationZ = lean
                    alpha = if (away) 0.6f else 1f
                },
            contentAlignment = Alignment.Center,
        ) {
            // Under the body: the pointing nub (only 0.2 × body sticks out, so it reads as attached).
            if (expression == Expression.POINT) {
                Canvas(Modifier.fillMaxSize()) {
                    val unit = this.size.width / 24f
                    val len = 9f + 0.2f * BODY_W
                    val x = if (pointEnd) 12f else 12f - len
                    drawRoundRect(body, Offset(x * unit, 12.6f * unit), Size(len * unit, 2.8f * unit), CornerRadius(1.4f * unit))
                }
            }
            // The glyph path is the body at ≥ 40 dp; no tile behind it.
            Icon(AvatarGlyphs.of(swatch.shape), contentDescription = null, tint = body, modifier = Modifier.fillMaxSize())
            Canvas(Modifier.fillMaxSize()) {
                val unit = this.size.width / 24f
                if (ringed) {
                    CharacterPaths.bodies[shapeKey]?.let { d ->
                        withTransform({ scale(unit, unit, pivot = Offset.Zero) }) {
                            drawPath(p(d), RING, style = Stroke(width = 2.dp.toPx() / unit))
                        }
                    }
                }
                val k = box.scale * boost
                // Boosted features stay centred on the face box.
                val cx = (box.x + box.w / 2f) * unit
                val cy = (box.y + box.h / 2f) * unit
                withTransform({
                    translate(cx - 6f * k * unit, cy - 4.5f * k * unit)
                    scale(k * unit, k * unit, pivot = Offset.Zero)
                }) {
                    drawFace(expression, ink, body, if (expression == Expression.IDLE) blink else 1f, lk)
                }
                // The VIP crown at the head anchor (web `ch__crown`, body units; it sits above the box).
                if (state.host) {
                    withTransform({ scale(unit, unit, pivot = Offset.Zero) }) {
                        drawPath(p(CROWN), CROWN_GOLD)
                        drawPath(p(CROWN), CharacterBursts.INK, style = Stroke(width = 0.5f, join = StrokeJoin.Round))
                    }
                }
            }
        }
        if (burstArt != null && burstT.value < 1f) {
            Canvas(Modifier.fillMaxSize()) {
                val t = burstT.value
                // Keyframes: 0 → (+8 px, 0.4, a 0), 18 % → (−6, 1.15, 1), 70 % → (−14, 1, 1), 100 % → (−24, 0.9, 0).
                val (dy, sc, a) = burstFrame(t)
                val bw = maxOf(22.dp.toPx(), this.size.width * 0.5f)
                val u = bw / 24f
                val left = (this.size.width - bw) / 2f
                val top = -0.18f * this.size.width + dy.dp.toPx()
                withTransform({
                    translate(left, top)
                    scale(sc, sc, pivot = Offset(bw / 2f, bw / 2f))
                    scale(u, u, pivot = Offset.Zero)
                }) {
                    for (part in burstArt) {
                        val path = p(part.d)
                        if (part.stroke != null) {
                            drawPath(path, part.stroke, alpha = a, style = Stroke(width = part.width, cap = StrokeCap.Round))
                        } else {
                            drawPath(path, part.fill ?: CharacterBursts.INK, alpha = a)
                            drawPath(path, CharacterBursts.INK, alpha = a, style = Stroke(width = 0.7f, join = StrokeJoin.Round))
                        }
                    }
                }
            }
        }
    }
}

private val RINGED = setOf("coral", "grape", "plum")
private val RING = Color(0xFFFFF7EC).copy(alpha = 0.24f)
private val CROWN_GOLD = Color(0xFFFFC94D)
private const val CROWN = "M7.5 -1.5l2 1.6L12 -3.6l2.5 3.7 2-1.6-.9 4.5H8.4z"

/** Body width in body units (the glyphs span ~3..21 of the 24-unit box): the point nub scales from it. */
private const val BODY_W = 18f

/** The burst's (y offset in dp, scale, alpha) at progress [t] (web `@keyframes ch-burst`, linear between stops). */
private fun burstFrame(t: Float): Triple<Float, Float, Float> {
    fun seg(a: Float, b: Float, x: Float, y: Float) = x + (y - x) * ((t - a) / (b - a)).coerceIn(0f, 1f)
    return when {
        t < 0.18f -> Triple(seg(0f, .18f, 8f, -6f), seg(0f, .18f, 0.4f, 1.15f), seg(0f, .18f, 0f, 1f))
        t < 0.70f -> Triple(seg(.18f, .7f, -6f, -14f), seg(.18f, .7f, 1.15f, 1f), 1f)
        else -> Triple(seg(.7f, 1f, -14f, -24f), seg(.7f, 1f, 1f, 0.9f), seg(.7f, 1f, 1f, 0f))
    }
}

private val parsed = HashMap<String, Path>()
private fun p(d: String): Path = parsed.getOrPut(d) { PathParser().parsePathString(d).toPath() }

/**
 * Draws one expression's features from the generated [CharacterPaths] (12 × 9 face space). Eyes follow [look] and the
 * idle [blink] (ry × 0.15–1 around the eye line); cheeks are cream on ink faces (ink on cream faces), rose for `shy`;
 * `facepalm` adds the body-coloured hand disc over the eyes (DESIGN-JAMAA §4.3).
 */
private fun DrawScope.drawFace(e: Expression, ink: Color, body: Color, blink: Float, look: Offset) {
    val features = CharacterPaths.expressions[e.name.lowercase()] ?: return
    val creamEyes = ink == JamaaColors.Text
    for (f in features) {
        val color = when (f.part) {
            "cheeks" -> if (e == Expression.SHY) Color(0xFFFF96C5) else if (creamEyes) ink else JamaaColors.Text
            else -> ink
        }
        val path = p(f.d)
        val draw: DrawScope.() -> Unit = {
            if (f.style == CharacterPaths.FeatureStyle.FILL) drawPath(path, color, alpha = f.alpha)
            else drawPath(path, color, alpha = f.alpha, style = Stroke(width = f.strokeWidth, cap = StrokeCap.Round))
        }
        if (f.part == "eyes") {
            withTransform({
                translate(look.x, look.y)
                scale(1f, blink, pivot = Offset(6f, 3.6f))
            }, draw)
        } else {
            draw()
        }
    }
    if (e == Expression.FACEPALM) {
        drawCircle(body, 3.4f, Offset(6f, 3.4f))
        drawCircle(ink, 3.4f, Offset(6f, 3.4f), style = Stroke(0.4f))
    }
}
