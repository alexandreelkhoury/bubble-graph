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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.PathParser
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
fun MomentLayer(active: ActiveMoment?, motion: MotionMode, onEnded: (Int) -> Unit) {
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
    val world = worldOf(GameCatalog.meta(m.gameId)?.world)
    val id = m.moment.id
    Box(Modifier.fillMaxSize().fullBleed().clearAndSetSemantics {}) {
        when {
            id.startsWith("portalBack") -> PortalLayer(m.moment, elapsed, world.stageTop, world.deep, reverse = true)
            id.startsWith("portal") -> PortalLayer(m.moment, elapsed, world.stageTop, world.deep, reverse = false)
            id.startsWith("entrance") -> EntranceLayer(m, elapsed, world.accent, world.glow, motion)
            else -> Unit // the cup: the results screen animates its own panel; the layer only holds the input rule
        }
    }
}

// The bab (lilac Arch body without its door cut), flat-bottomed: "M5 20.75V10.25a7 7 0 0 1 14 0v10.5z" in the 24-unit
// viewBox (DESIGN §5.2), rebuilt per frame at the mask's scale.

@Composable
private fun PortalLayer(moment: Moment, t: Long, top: Color, deep: Color, reverse: Boolean) {
    if (moment.reduced) { // calm motion: a 150 ms crossfade
        val p = moment.step("fade")?.progress(t) ?: 1f
        Canvas(Modifier.fillMaxSize().graphicsLayer { alpha = if (reverse) p * (1f - p) * 4f else 1f - p }) { drawRect(deep) }
        return
    }
    val arch = moment.step("arch")?.progress(t) ?: 1f
    val fade = moment.step("handoff")?.progress(t) ?: 0f
    val grow = if (reverse) 1f - arch else arch
    Canvas(Modifier.fillMaxSize().graphicsLayer { alpha = if (reverse) 1f - (moment.step("othersIn")?.progress(t) ?: 0f) else 1f - fade }) {
        // Outside the arch the hub darkens to #000 at 40 %.
        drawRect(Color.Black.copy(alpha = 0.4f * grow))
        val poster = size.height * 0.55f / 24f
        val full = size.maxDimension * 1.15f / 14f
        val s = poster + (full - poster) * grow
        val cx = size.width / 2f
        val cy = size.height / 2f
        fun x(u: Float) = cx + (u - 12f) * s
        fun y(u: Float) = cy + (u - 12f) * s
        val r = 7f * s
        val path = PathParser().parsePathString("M${x(5f)} ${y(20.75f)}V${y(10.25f)}A$r $r 0 0 1 ${x(19f)} ${y(10.25f)}V${y(20.75f)}Z").toPath()
        clipPath(path) {
            drawRect(Brush.verticalGradient(listOf(top, deep)))
            // Two-layer parallax: a glow layer moving at 0.6× of the mask growth.
            drawCircle(Color.White.copy(alpha = 0.06f), size.minDimension * (0.2f + 0.6f * 0.6f * grow), Offset(cx, cy * 0.8f))
        }
    }
}

@Composable
private fun EntranceLayer(m: ActiveMoment, t: Long, accent: Color, glow: Color, motion: MotionMode) {
    val mo = m.moment
    if (mo.reduced) {
        val fade = mo.step("fade")?.progress(t) ?: 1f
        val title = mo.step("title")?.progress(t) ?: 1f
        Box(Modifier.fillMaxSize().graphicsLayer { alpha = if (title >= 1f) 0f else 1f }, contentAlignment = Alignment.Center) {
            Canvas(Modifier.fillMaxSize().graphicsLayer { alpha = 1f - fade }) { drawRect(JamaaColors.Bg) }
            Text(m.gameId?.let { gameTitle(it) } ?: "", style = JamaaTheme.type.displayM, color = JamaaColors.Text)
        }
        return
    }
    val darken = mo.step("darken")?.progress(t) ?: 1f
    val door = mo.step("door")?.progress(t) ?: 1f
    val title = mo.step("title")?.progress(t) ?: 1f
    val settle = mo.step("titleSettle")?.progress(t) ?: 1f
    Box(Modifier.fillMaxSize().graphicsLayer { alpha = 1f - settle }, contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            drawRect(Color.Black.copy(alpha = 0.7f * darken))
            // The world's door (generic form): a lamp drops from the top and its light cone turns the stage on.
            val lampY = -40f + (size.height * 0.28f + 40f) * door
            drawCircle(glow, 18f, Offset(size.width / 2f, lampY))
            if (door > 0.6f) {
                val a = ((door - 0.6f) / 0.4f).coerceIn(0f, 1f)
                drawRect(Brush.radialGradient(listOf(accent.copy(alpha = 0.35f * a), Color.Transparent), center = Offset(size.width / 2f, lampY), radius = size.height * 0.8f))
            }
        }
        if (title > 0f) {
            val sc = 1.2f - 0.2f * title
            Text(
                m.gameId?.let { gameTitle(it) } ?: "",
                style = JamaaTheme.type.displayL,
                color = JamaaColors.Text,
                modifier = Modifier.graphicsLayer { scaleX = sc; scaleY = sc; alpha = title.coerceIn(0f, 1f) },
            )
        }
    }
}
