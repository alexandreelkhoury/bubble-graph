package app.jamaa.tv.ui.motion

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import app.jamaa.tv.games.GameIds
import app.jamaa.tv.games.mishana.MishanaLogo
import app.jamaa.tv.games.mishana.MishanaLogoVariant
import app.jamaa.tv.ui.theme.WorldColors
import app.jamaa.tv.ui.theme.drawWorldProps
import kotlin.math.PI
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.tv.material3.Text
import app.jamaa.tv.games.GameCatalog
import app.jamaa.tv.platform.ActiveMoment
import app.jamaa.tv.platform.Moment
import app.jamaa.tv.platform.MotionMode
import app.jamaa.tv.ui.theme.worldOf
import app.jamaa.tv.ui.components.fullBleed
import app.jamaa.tv.ui.hub.gameTitle
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme

/**
 * Draws the signature moment the ViewModel is playing (JAMAA-PLATFORM §3.10 A/B/D) over the current screen and reports
 * its end. Time comes from the frame clock (`withFrameMillis`), progress from the moment's step list
 * ([Moment] / [app.jamaa.tv.platform.MomentStep.progress]); when OK completed it ([ActiveMoment.completed]) the layer
 * jumps to the end state at once. The screen below is already the destination (the room phase changed), so the layer
 * only has to hide it and reveal it: the portal's arch mask grows until it covers the canvas, the entrance darkens,
 * shows the world's door and the title, then fades. Lite motion: the arch clips the world layer only over a solid
 * 40 % black (no live hub under the mask) — which is what this layer always does, so lite and full share one path here.
 * Progress comes from lane D's generated Choreo.kt sampler (platform/Moments.kt picks the variant).
 */
@Composable
fun MomentLayer(active: ActiveMoment?, motion: MotionMode, onEnded: (Int) -> Unit, contentLocale: String? = null) {
    val m = active ?: return
    var elapsed by remember(m.seq) { mutableLongStateOf(0L) }
    LaunchedEffect(m.seq, m.completed) {
        if (m.completed) {
            elapsed = m.moment.totalMs
            onEnded(m.seq)
            return@LaunchedEffect
        }
        val start = withFrameMillis { it }
        while (elapsed < m.moment.totalMs) {
            elapsed = withFrameMillis { it } - start
        }
        onEnded(m.seq)
    }
    val worldId = GameCatalog.meta(m.gameId)?.world
    val world = worldOf(worldId)
    val id = m.moment.id
    val origin = LocalPortalOrigins.current.of(m.gameId)
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    Box(Modifier.fillMaxSize().fullBleed().clearAndSetSemantics {}) {
        when {
            id.startsWith("portalBack") -> PortalLayer(m.moment, elapsed, worldId, world, origin, rtl, reverse = true)
            id.startsWith("portal") -> PortalLayer(m.moment, elapsed, worldId, world, origin, rtl, reverse = false)
            id.startsWith("entrance") -> EntranceLayer(m, elapsed, worldId, world, contentLocale)
            else -> Unit // the cup: the results screen animates its own panel; the layer only holds the input rule
        }
    }
}

/** The arch box that covers the whole canvas (web `COVER` on a 960 × 540 canvas: the mask "exceeds the screen"). */
private fun cover(w: Float, h: Float) = Rect(-0.75f * w, -1.4074f * h, 1.75f * w, 1.9259f * h)

/** Where the poster sits when the hub never reported it (web's default `{x 72, y 82, w 227, h 313}` on 960 × 540). */
private fun defaultPoster(w: Float, h: Float) = Rect(0.075f * w, 0.1519f * h, 0.3115f * w, 0.7315f * h)

private fun lerpRect(a: Rect, b: Rect, p: Float) = Rect(
    a.left + (b.left - a.left) * p,
    a.top + (b.top - a.top) * p,
    a.right + (b.right - a.right) * p,
    a.bottom + (b.bottom - a.bottom) * p,
)

/** The bab (flat-bottomed arch) in a box: a half-round top, straight sides (web `archPath`). */
private fun archPath(b: Rect): Path {
    val r = minOf(b.width / 2f, b.height)
    return Path().apply {
        moveTo(b.left, b.bottom)
        lineTo(b.left, b.top + r)
        arcTo(Rect(b.left, b.top, b.left + 2f * r, b.top + 2f * r), 180f, 180f, false)
        lineTo(b.right, b.bottom)
        close()
    }
}

/**
 * §3.10 A: the focused poster becomes a doorway arch that grows out of the poster's own rect (both its origin and its
 * box lerp to [cover], web `lerpBox(src, COVER, arch)`) with the world revealed through it in two layers: the stage
 * moving at 0.6× and the poster's props at 1.0× the mask growth (the parallax). Reverse: the world shrinks back into the
 * poster. The press dip (1.08 → 1.03) is the carousel's. Calm motion: a 150 ms crossfade.
 */
@Composable
private fun PortalLayer(moment: Moment, t: Long, worldId: String?, world: WorldColors, origin: Rect?, rtl: Boolean, reverse: Boolean) {
    if (moment.reduced) { // calm motion: a 150 ms crossfade
        val p = moment.step("fade")?.progress(t) ?: 1f
        Canvas(Modifier.fillMaxSize().graphicsLayer { alpha = if (reverse) p * (1f - p) * 4f else 1f - p }) { drawRect(world.deep) }
        return
    }
    val arch = moment.step("arch")?.progress(t) ?: 1f
    val fade = moment.step("handoff")?.progress(t) ?: 0f
    val parallax = if (reverse) 1f - arch else moment.step("parallax")?.progress(t) ?: 1f
    val grow = if (reverse) 1f - arch else arch
    Canvas(Modifier.fillMaxSize().graphicsLayer { alpha = if (reverse) 1f - (moment.step("othersIn")?.progress(t) ?: 0f) else 1f - fade }) {
        // Outside the arch the hub darkens to #000 at 40 %.
        drawRect(Color.Black.copy(alpha = 0.4f * grow))
        val src = origin ?: defaultPoster(size.width, size.height)
        val box = lerpRect(src, cover(size.width, size.height), grow)
        clipPath(archPath(box)) {
            // The stage layer at 0.6×: it starts as the poster's own stage and opens toward the screen's.
            val stage = lerpRect(src, Rect(0f, 0f, size.width, size.height), 0.6f * parallax + 0.4f * grow * grow)
            drawRect(world.deep)
            drawRect(Brush.verticalGradient(listOf(world.stageTop, world.deep), stage.top, stage.bottom), stage.topLeft, stage.size)
            drawRect(Brush.radialGradient(listOf(world.glow.copy(alpha = 0.28f), Color.Transparent), Offset(stage.center.x, stage.top), stage.width * 0.8f), stage.topLeft, stage.size)
            // The props layer at 1.0×: the poster's props grow with the mask (scaled from the poster to the screen).
            val props = lerpRect(src, Rect(0f, 0f, size.width, size.height), parallax)
            withTransform({
                translate(props.left, props.top)
                scale(props.width / src.width.coerceAtLeast(1f), props.height / src.height.coerceAtLeast(1f), pivot = Offset.Zero)
            }) {
                // Drawn in the poster's own box so the props sit where they sat on the poster.
                drawWorldProps(worldId, world, 0f, rtl, box = src.size)
            }
        }
    }
}

/**
 * §3.10 B: darken → the world's door → the game's title lockup lands (1.2 → 1) → settle. The door is dispatched per
 * world (the G lanes add theirs in [drawDoor]); the generic door is a lamp dropping on its cord, swinging once on a
 * damped spring around the cord's pivot, its light cone turning the stage on.
 */
@Composable
private fun EntranceLayer(m: ActiveMoment, t: Long, worldId: String?, world: WorldColors, contentLocale: String?) {
    val mo = m.moment
    if (mo.reduced) {
        val fade = mo.step("fade")?.progress(t) ?: 1f
        val title = mo.step("title")?.progress(t) ?: 1f
        Box(Modifier.fillMaxSize().graphicsLayer { alpha = if (title >= 1f) 0f else 1f }, contentAlignment = Alignment.Center) {
            Canvas(Modifier.fillMaxSize().graphicsLayer { alpha = 1f - fade }) { drawRect(JamaaColors.Bg) }
            TitleLockup(m.gameId, contentLocale, JamaaTheme.type.displayM)
        }
        return
    }
    val darken = mo.step("darken")?.progress(t) ?: 1f
    val door = mo.step("door")?.progress(t) ?: 1f
    val doorStart = mo.step("door")?.startMs ?: 250L
    val title = mo.step("title")?.progress(t) ?: 1f
    val settle = mo.step("titleSettle")?.progress(t) ?: 1f
    // The swing: ±12° at the drop, a damped spring back to 0 (ζ ≈ 0.25, ~1.6 Hz) from the moment the door starts.
    val swingT = ((t - doorStart).coerceAtLeast(0L)) / 1000f
    val swing = 12f * kotlin.math.exp(-3.2f * swingT) * kotlin.math.cos(2f * PI.toFloat() * 1.6f * swingT)
    Box(Modifier.fillMaxSize().graphicsLayer { alpha = 1f - settle }, contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            drawRect(Color.Black.copy(alpha = 0.7f * darken))
            drawDoor(worldId, world, door, swing)
        }
        if (title > 0f) {
            val sc = 1.2f - 0.2f * title
            Box(Modifier.graphicsLayer { scaleX = sc; scaleY = sc; alpha = title.coerceIn(0f, 1f) }) {
                TitleLockup(m.gameId, contentLocale, JamaaTheme.type.displayL)
            }
        }
    }
}

/** The world's door at progress [p] (0..1, `ease.door`); [swing] in degrees. Unknown or not-yet-drawn worlds: the lamp. */
private fun DrawScope.drawDoor(worldId: String?, world: WorldColors, p: Float, swing: Float) {
    when (worldId) {
        // JAMAA-GAP (G lanes): hakawati-cafe, rooftop and quiz-studio doors plug in here; until then they use the lamp.
        else -> {
            val pivot = Offset(size.width / 2f, 0f)
            val lampY = -40f + (size.height * 0.28f + 40f) * p
            rotate(swing * p, pivot) {
                drawLine(world.glow.copy(alpha = 0.5f), pivot, Offset(pivot.x, lampY - 18f), 2f)
                drawCircle(world.glow, 18f, Offset(pivot.x, lampY))
            }
            if (p > 0.6f) {
                val a = ((p - 0.6f) / 0.4f).coerceIn(0f, 1f)
                drawRect(Brush.radialGradient(listOf(world.accent.copy(alpha = 0.35f * a), Color.Transparent), center = Offset(size.width / 2f, lampY), radius = size.height * 0.8f))
            }
        }
    }
}

/** The game's title lockup (§1.6): Mish Ana!'s wordmark in the content language's script; other games their title. */
@Composable
private fun TitleLockup(gameId: String?, contentLocale: String?, style: androidx.compose.ui.text.TextStyle) {
    if (gameId == GameIds.MISHANA) {
        MishanaLogo(480.dp, variant = if (contentLocale == "ar") MishanaLogoVariant.Arabic else MishanaLogoVariant.Latin)
    } else {
        Text(gameId?.let { gameTitle(it) } ?: "", style = style, color = JamaaColors.Text)
    }
}
