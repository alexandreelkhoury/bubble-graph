package app.mishana.tv.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.Constraints
import kotlin.math.roundToInt
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.Image
import app.mishana.tv.Brand
import app.mishana.tv.R
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishMotion
import app.mishana.tv.ui.theme.MishTheme
import kotlin.math.tan

enum class WordmarkVariant { Bilingual, Latin, Arabic }

/** Builds the skewed bang stem (rounded rect skewed −8° about its centre) in artboard units. */
private fun stemPath(): Path {
    val x = BrandPaths.STEM_X
    val y = BrandPaths.STEM_Y
    val w = BrandPaths.STEM_W
    val h = BrandPaths.STEM_H
    val r = BrandPaths.STEM_R
    val k = r * 0.5522848f
    val t = tan(Math.toRadians(BrandPaths.SKEW_DEG.toDouble())).toFloat()
    fun px(px: Float, py: Float) = px + t * (py - BrandPaths.SKEW_CY)
    val p = Path()
    fun m(a: Float, b: Float) = p.moveTo(px(a, b), b)
    fun l(a: Float, b: Float) = p.lineTo(px(a, b), b)
    fun c(a1: Float, b1: Float, a2: Float, b2: Float, a3: Float, b3: Float) =
        p.cubicTo(px(a1, b1), b1, px(a2, b2), b2, px(a3, b3), b3)
    m(x + r, y)
    l(x + w - r, y)
    c(x + w - r + k, y, x + w, y + r - k, x + w, y + r)
    l(x + w, y + h - r)
    c(x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h)
    l(x + r, y + h)
    c(x + r - k, y + h, x, y + h - r + k, x, y + h - r)
    l(x, y + r)
    c(x, y + r - k, x + r - k, y, x + r, y)
    p.close()
    return p
}

/**
 * "The shared bang" wordmark (DESIGN §1.3), drawn from Cairo Black outlines (BrandPaths, generated).
 * [animate]: the stem draws in from the bottom, then the amber dot drops with `ease.overshoot` (≤ 800 ms, TV-01).
 */
@Composable
fun Wordmark(
    width: Dp,
    modifier: Modifier = Modifier,
    variant: WordmarkVariant = WordmarkVariant.Bilingual,
    animate: Boolean = false,
) {
    val reduce = MishTheme.reduceMotion
    val latin = remember { PathParser().parsePathString(BrandPaths.LATIN).toPath() }
    val arabic = remember { PathParser().parsePathString(BrandPaths.ARABIC).toPath() }
    val stem = remember { stemPath() }
    val pad = 20f
    val lb = BrandPaths.LATIN_BOUNDS
    val ab = BrandPaths.ARABIC_BOUNDS
    val bb = BrandPaths.BANG_BOUNDS
    val x0 = when (variant) {
        WordmarkVariant.Arabic -> bb[0]
        else -> lb[0]
    } - pad
    val x1 = when (variant) {
        WordmarkVariant.Latin -> bb[2]
        else -> ab[2]
    } + pad
    val y0 = minOf(lb[1], ab[1], bb[1]) - pad
    val y1 = maxOf(lb[3], ab[3], bb[3]) + pad
    val aspect = (y1 - y0) / (x1 - x0)

    val stemIn = remember { Animatable(if (animate && !reduce) 0f else 1f) }
    val dotIn = remember { Animatable(if (animate && !reduce) 0f else 1f) }
    LaunchedEffect(animate, reduce) {
        if (animate && !reduce) {
            stemIn.animateTo(1f, tween(420, easing = MishMotion.Decel))
            dotIn.animateTo(1f, tween(340, easing = MishMotion.Overshoot))
        }
    }

    Canvas(
        modifier
            .size(width, width * aspect)
            .semantics { contentDescription = Brand.NAME + " " + Brand.NAME_AR },
    ) {
        val s = size.width / (x1 - x0)
        withTransform({
            scale(s, s, pivot = Offset.Zero)
            translate(-x0, -y0)
        }) {
            if (variant != WordmarkVariant.Arabic) drawPath(latin, MishColors.Text)
            if (variant != WordmarkVariant.Latin) drawPath(arabic, MishColors.Text)
            drawBang(stem, stemIn.value, dotIn.value)
        }
    }
}

private fun DrawScope.drawBang(stem: Path, stemProgress: Float, dotProgress: Float) {
    val top = BrandPaths.STEM_Y
    val bottom = BrandPaths.STEM_Y + BrandPaths.STEM_H
    val reveal = bottom - (bottom - top + 12f) * stemProgress
    clipRect(left = BrandPaths.BANG_BOUNDS[0] - 60f, top = reveal - 30f, right = BrandPaths.BANG_BOUNDS[2] + 60f, bottom = bottom + 40f) {
        // Glow (screens only): a few soft magenta strokes around the stem.
        for ((w, a) in listOf(36f to 0.06f, 24f to 0.09f, 12f to 0.14f)) {
            drawPath(stem, MishColors.Primary.copy(alpha = a * stemProgress), style = Stroke(width = w))
        }
        drawPath(stem, MishColors.Primary)
    }
    if (dotProgress > 0f) {
        val drop = (1f - dotProgress) * -90f
        drawCircle(
            color = MishColors.Accent,
            radius = BrandPaths.DOT_R,
            center = Offset(BrandPaths.DOT_CX, BrandPaths.DOT_CY + drop),
            alpha = dotProgress.coerceIn(0f, 1f),
        )
    }
}

/** The app mark (speech bubble + bang), vector drawable generated from the same source. */
@Composable
fun Mark(size: Dp, modifier: Modifier = Modifier) {
    Image(
        painter = painterResource(R.drawable.ic_mark),
        contentDescription = null,
        modifier = modifier.size(size),
    )
}

/**
 * `elev.0` screen background: `bg` + a radial `bgGlow` from the top centre (60 % radius), drifting slowly
 * (30 s loop; static in reduced motion). [pattern] adds the faint bang-mark pattern (4 %) used on Home.
 *
 * Cost on low-end TV GPUs: the glow and the pattern are recorded once (`drawWithCache`); the drift only moves the
 * glow's layer (`graphicsLayer` translation read in the layer phase), so nothing recomposes or re-records per frame.
 */
@Composable
fun MishBackground(
    modifier: Modifier = Modifier,
    base: Color = MishColors.Bg,
    pattern: Boolean = false,
    content: @Composable BoxScope.() -> Unit = {},
) {
    val reduce = MishTheme.reduceMotion
    val drift = if (reduce) {
        null
    } else {
        rememberInfiniteTransition(label = "bgDrift")
            .animateFloat(0f, 1f, infiniteRepeatable(tween(15_000, easing = LinearEasing), RepeatMode.Reverse), label = "d")
    }
    val glowAlpha = if (base == MishColors.Bg) 1f else 0.5f
    Box(modifier.fillMaxSize().background(base)) {
        Box(
            Modifier
                .fillMaxSize()
                // A layer wider than the screen (± the drift range), so its edges never show while it moves.
                .layout { measurable, constraints ->
                    val extra = (constraints.maxWidth * DRIFT_RANGE / 2).roundToInt()
                    val placeable = measurable.measure(Constraints.fixed(constraints.maxWidth + 2 * extra, constraints.maxHeight))
                    layout(constraints.maxWidth, constraints.maxHeight) { placeable.place(-extra, 0) }
                }
                .graphicsLayer {
                    // Centre moves 0.42 → 0.58 of the screen width (the layer is 1 + DRIFT_RANGE wide).
                    translationX = ((drift?.value ?: 0.5f) - 0.5f) * DRIFT_RANGE * size.width / (1f + DRIFT_RANGE)
                }
                .drawWithCache {
                    val screenW = size.width / (1f + DRIFT_RANGE)
                    val brush = Brush.radialGradient(
                        colors = listOf(MishColors.BgGlow.copy(alpha = glowAlpha), Color.Transparent),
                        center = Offset(size.width / 2f, -size.height * 0.05f),
                        radius = screenW * 0.6f,
                    )
                    onDrawBehind { drawRect(brush) }
                },
        )
        if (pattern) {
            Box(
                Modifier.fillMaxSize().drawWithCache {
                    val step = 72.dp.toPx()
                    val h = 14.dp.toPx()
                    val c = MishColors.Text.copy(alpha = 0.04f)
                    val stems = Path()
                    val dots = mutableListOf<Offset>()
                    var row = 0
                    var y = step / 2
                    while (y < size.height + step) {
                        var x = if (row % 2 == 0) step / 2 else step
                        while (x < size.width + step) {
                            // a tiny leaning bang: stem + dot
                            stems.moveTo(x + h * 0.14f, y - h / 2)
                            stems.lineTo(x - h * 0.14f, y + h * 0.25f)
                            dots += Offset(x - h * 0.2f, y + h * 0.62f)
                            x += step
                        }
                        y += step * 0.75f
                        row++
                    }
                    val stroke = Stroke(width = h * 0.28f, cap = StrokeCap.Round)
                    onDrawBehind {
                        drawPath(stems, c, style = stroke)
                        for (d in dots) drawCircle(c, h * 0.16f, d)
                    }
                },
            )
        }
        content()
    }
}

/** The glow drifts over this fraction of the screen width (0.42 → 0.58). */
private const val DRIFT_RANGE = 0.16f
