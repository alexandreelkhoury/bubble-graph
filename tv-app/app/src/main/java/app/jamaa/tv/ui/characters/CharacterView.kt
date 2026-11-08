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
 * Geometry: lane D's generated [CharacterPaths] (shared/src/characters, pinned by shared/fixtures/v2/characters.json).
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
