package app.jamaa.tv.ui.characters

import androidx.compose.animation.core.Animatable
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
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
 * face drawn in the per-shape face box, one of the 13 expressions, the body motion that doubles it at small sizes, and
 * the reaction burst. Below 40 dp the classic avatar tile is drawn (faces off).
 * JAMAA-GAP: the feature geometry comes from lane D's generated `CharacterPaths.kt` (shared/src/characters, pinned by
 * characters.json) once it exists; until then this draws DESIGN-JAMAA §4.2/§4.3's binding feature table directly.
 * [expression] must come from public data only (CharacterRules.expression).
 */
@Composable
fun Character(
    colorId: String,
    size: Dp,
    expression: Expression,
    modifier: Modifier = Modifier,
    /** Eye offset toward a target, in face units (clamped to 1.2). */
    look: Offset = Offset.Zero,
    state: AvatarState = AvatarState(),
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
    val lean = when (expression) {
        Expression.SMUG -> -6f
        Expression.FACEPALM -> 4f
        Expression.POINT -> if (look.x >= 0f) 10f else -10f
        Expression.THINK -> 3f
        else -> 0f
    }
    val boost = CharacterRules.featureBoost(size.value, swatch.shape)
    val box = CharacterRules.faceBox(swatch.shape)
    val lk = Offset(look.x.coerceIn(-1.2f, 1.2f), look.y.coerceIn(-1.2f, 1.2f))

    Box(
        modifier
            .size(size)
            .clearAndSetSemantics {}
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
        // Ground shadow + body (the glyph path is the body at ≥ 40 dp; no tile behind it).
        Canvas(Modifier.fillMaxSize()) {
            val w = this.size.width
            drawOval(Color.Black.copy(alpha = 0.3f), topLeft = Offset(w * 0.15f, w * 0.92f), size = Size(w * 0.7f, w * 0.08f))
        }
        Icon(AvatarGlyphs.of(swatch.shape), contentDescription = null, tint = body, modifier = Modifier.fillMaxSize())
        Canvas(Modifier.fillMaxSize()) {
            val unit = this.size.width / 24f
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
        }
    }
}

private val parsed = HashMap<String, Path>()
private fun p(d: String): Path = parsed.getOrPut(d) { PathParser().parsePathString(d).toPath() }

/** Draws one expression's features in the 12 × 9 face space (DESIGN-JAMAA §4.2/§4.3). */
private fun DrawScope.drawFace(e: Expression, ink: Color, body: Color, blink: Float, look: Offset) {
    val line = Stroke(width = 0.8f, cap = StrokeCap.Round)
    val creamEyes = ink == JamaaColors.Text
    fun eyes(dx: Float = 0f, dy: Float = 0f, ry: Float = 1.45f) {
        for (x in floatArrayOf(3.8f, 8.2f)) {
            val c = Offset(x + dx + look.x, 3.6f + dy + look.y)
            drawOval(ink, topLeft = Offset(c.x - 1.1f, c.y - ry * blink), size = Size(2.2f, 2f * ry * blink))
            if (!creamEyes && blink > 0.5f) drawCircle(JamaaColors.Text, 0.35f, Offset(c.x + 0.35f, c.y - 0.45f))
        }
    }
    fun closed() {
        drawPath(p("M2.7 3.8 Q3.8 2.8 4.9 3.8"), ink, style = line)
        drawPath(p("M7.1 3.8 Q8.2 2.8 9.3 3.8"), ink, style = line)
    }
    fun flatLines() {
        drawLine(ink, Offset(2.8f, 3.8f), Offset(4.8f, 3.8f), 0.8f, StrokeCap.Round)
        drawLine(ink, Offset(7.2f, 3.8f), Offset(9.2f, 3.8f), 0.8f, StrokeCap.Round)
    }
    fun mouthFlat(w: Float, dx: Float = 0f) = drawLine(ink, Offset(6f - w / 2 + dx, 6.8f), Offset(6f + w / 2 + dx, 6.8f), 0.8f, StrokeCap.Round)
    fun mouthSmile(w: Float) = drawPath(p("M${6 - w / 2} 6.6 Q6 7.4 ${6 + w / 2} 6.6"), ink, style = line)
    fun openHalf(w: Float, h: Float) = drawPath(p("M${6 - w / 2} 6.2 A${w / 2} $h 0 0 0 ${6 + w / 2} 6.2 Z"), ink)

    when (e) {
        Expression.IDLE -> { eyes(); drawPath(p("M4.4 6.6 Q6 7.6 7.6 6.6"), ink, style = line) }
        Expression.THINK -> {
            eyes(dx = 0.9f, dy = -0.8f)
            drawLine(ink, Offset(7.4f, 0.8f), Offset(9.4f, 0.8f), 0.7f, StrokeCap.Round)
            mouthFlat(2.4f, dx = 0.6f)
        }
        Expression.DONE -> { closed(); mouthSmile(2.4f) }
        Expression.HAPPY -> {
            drawPath(p("M2.7 4.2 Q3.8 2.6 4.9 4.2"), ink, style = line)
            drawPath(p("M7.1 4.2 Q8.2 2.6 9.3 4.2"), ink, style = line)
            openHalf(3.6f, 1.8f)
        }
        Expression.LAUGH -> {
            drawPath(p("M3.1 2.9 L4.5 3.6 L3.1 4.3"), ink, style = line)
            drawPath(p("M8.9 2.9 L7.5 3.6 L8.9 4.3"), ink, style = line)
            openHalf(4.4f, 2.4f)
        }
        Expression.SMUG -> {
            for (x in floatArrayOf(3.8f, 8.2f)) drawPath(p("M${x - 1.1f} 3.6 A1.1 1.45 0 0 0 ${x + 1.1f} 3.6 Z"), ink)
            drawLine(ink, Offset(7.2f, 0.8f), Offset(9.2f, 0.6f), 0.7f, StrokeCap.Round)
            drawPath(p("M4.6 6.8 Q6.8 7.4 7.8 6.0"), ink, style = line)
        }
        Expression.SHOCK -> {
            for (x in floatArrayOf(3.8f, 8.2f)) {
                drawCircle(ink, 1.4f, Offset(x, 3.6f), style = Stroke(0.6f))
                drawCircle(ink, 0.5f, Offset(x + look.x * 0.4f, 3.6f + look.y * 0.4f))
            }
            drawOval(ink, topLeft = Offset(5.3f, 5.9f), size = Size(1.4f, 1.8f))
        }
        Expression.SAD -> {
            eyes(ry = 1.1f, dy = 0.3f)
            drawLine(ink, Offset(3.0f, 1.6f), Offset(4.6f, 1.0f), 0.7f, StrokeCap.Round)
            drawLine(ink, Offset(9.0f, 1.6f), Offset(7.4f, 1.0f), 0.7f, StrokeCap.Round)
            drawPath(p("M4.4 7.4 Q6 6.4 7.6 7.4"), ink, style = line)
        }
        Expression.FACEPALM -> {
            flatLines()
            mouthFlat(2.4f)
            // The hand disc (body colour, glyph-colour outline) over the eyes.
            drawCircle(body, 3.4f, Offset(6f, 3.4f))
            drawCircle(ink, 3.4f, Offset(6f, 3.4f), style = Stroke(0.4f))
        }
        Expression.SHY -> {
            eyes(dy = 0.8f)
            drawCircle(Color(0xFFFF96C5).copy(alpha = 0.6f), 0.9f, Offset(2.2f, 5.8f))
            drawCircle(Color(0xFFFF96C5).copy(alpha = 0.6f), 0.9f, Offset(9.8f, 5.8f))
            mouthSmile(1.6f)
        }
        Expression.POINT -> { eyes(); openHalf(2.8f, 1.0f) }
        Expression.CHEER -> {
            for (x in floatArrayOf(3.8f, 8.2f)) {
                drawPath(p("M$x 2.8 L${x + 0.25f} 3.35 L${x + 0.8f} 3.6 L${x + 0.25f} 3.85 L$x 4.4 L${x - 0.25f} 3.85 L${x - 0.8f} 3.6 L${x - 0.25f} 3.35 Z"), ink)
            }
            openHalf(4.4f, 2.4f)
        }
        Expression.AWAY -> { flatLines(); mouthFlat(1.6f) }
    }
}
