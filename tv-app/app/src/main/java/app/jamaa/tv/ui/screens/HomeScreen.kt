package app.jamaa.tv.ui.screens

import kotlin.math.sin
import kotlin.math.cos
import kotlin.math.PI
import androidx.compose.animation.SizeTransform
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import app.jamaa.tv.ui.theme.PlayerSwatch
import app.jamaa.tv.ui.characters.Character
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import app.jamaa.tv.ui.components.wordmarkAspect
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.compose.foundation.layout.size
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.jamaa.tv.BuildConfig
import app.jamaa.tv.R
import app.jamaa.tv.i18n.MessageKeys
import app.jamaa.tv.i18n.messageText
import app.jamaa.tv.ui.components.ButtonKind
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.JamaaButton
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.components.Spinner
import app.jamaa.tv.ui.components.Wordmark
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaMotion
import app.jamaa.tv.ui.theme.JamaaTheme

/** What the splash shows under the slogan. */
sealed interface HomeStatus {
    /** Spinner + [labelRes] (`tv.creatingRoom`, or `conn.connecting` while the first state arrives). */
    data class Busy(val labelRes: Int) : HomeStatus

    /** `tv.createFailed` + a muted error line + (• Try again). */
    data class Failed(val messageKey: String) : HomeStatus
}

/**
 * TV-01 Home / splash. The app creates a room automatically; Home is only shown while that runs or after it fails.
 * Back exits the app (handled by the activity default). Debug builds: long-press OK on the version label → DebugSettings
 * (the label is reachable with the D-pad but never takes initial focus: it is not what the screen is about).
 * [animate]: the HUB-01 entrance plays (once per app session: the caller passes false after the first splash, so a
 * status change or a reconnect never replays it). The status slot has a fixed height, so the wordmark never jumps
 * between "Connecting…" and "Couldn't create".
 */
@Composable
fun HomeScreen(status: HomeStatus, onRetry: () -> Unit, onOpenDebug: () -> Unit, animate: Boolean = true) {
    val type = JamaaTheme.type
    val retry = remember { FocusRequester() }
    // Latched: the caller flipping its flag while this splash plays must not cut the entrance short.
    val entrance = remember { animate }
    val reduce = JamaaTheme.reduceMotion
    val still = reduce || !entrance
    // The wordmark settles from 92 % while its letters fade in; the slogan rises 12 dp once the ring has landed.
    val settle = remember { Animatable(if (still) 1f else 0f) }
    val sloganIn = remember { Animatable(if (still) 1f else 0f) }
    LaunchedEffect(still) {
        if (still) return@LaunchedEffect
        launch { settle.animateTo(1f, tween(700, easing = JamaaMotion.Decel)) }
        delay(SPLASH_MS - 300L)
        sloganIn.animateTo(1f, tween(JamaaMotion.Slow, easing = JamaaMotion.Decel))
    }
    val ring = remember { SplashGeometry.ring(SPLASH_WORDMARK_DP, SPLASH_WORDMARK_DP * wordmarkAspect(), SPLASH_CHAR_DP) }
    Box(Modifier.fillMaxSize()) {
        Column(
            Modifier.align(Alignment.Center).padding(bottom = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // HUB-01: the 12 characters spiral in from off screen and settle on an orbit that clears the wordmark's
            // box (JAMAA and جماعة) by 8 dp, so none ever crosses a letter; the letters fade in on the same first frame.
            Box(Modifier.size(ring.boxW.dp, ring.boxH.dp), contentAlignment = Alignment.Center) {
                SplashRing(entrance, ring)
                Wordmark(
                    width = SPLASH_WORDMARK_DP.dp,
                    animate = entrance,
                    modifier = Modifier.graphicsLayer {
                        val k = 0.92f + 0.08f * settle.value
                        scaleX = k
                        scaleY = k
                    },
                )
            }
            Spacer(Modifier.height(8.dp))
            Text(
                stringResource(R.string.brand__slogan),
                style = type.body,
                color = JamaaColors.TextSecondary,
                textAlign = TextAlign.Center,
                modifier = Modifier.graphicsLayer {
                    alpha = sloganIn.value
                    translationY = (1f - sloganIn.value) * 12.dp.toPx()
                },
            )
            Spacer(Modifier.height(16.dp))
            AnimatedContent(
                targetState = status,
                transitionSpec = { (fadeIn(tween(JamaaMotion.Base)) togetherWith fadeOut(tween(JamaaMotion.Fast))) using SizeTransform(clip = false) },
                contentAlignment = Alignment.TopCenter,
                modifier = Modifier.height(STATUS_SLOT_H),
                label = "homeStatus",
            ) { st ->
                when (st) {
                    is HomeStatus.Busy -> Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.height(64.dp).semantics { liveRegion = LiveRegionMode.Polite },
                    ) {
                        Spinner(size = 28.dp)
                        Spacer(Modifier.width(16.dp))
                        Text(stringResource(st.labelRes), style = type.titleS, color = JamaaColors.Text)
                    }
                    is HomeStatus.Failed -> Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    ) {
                        Text(stringResource(R.string.tv__create_failed), style = type.title, color = JamaaColors.Text)
                        if (st.messageKey != MessageKeys.TV_CREATE_FAILED) {
                            Text(messageText(st.messageKey), style = type.caption, color = JamaaColors.TextMuted, maxLines = 1)
                        }
                        Spacer(Modifier.height(4.dp))
                        JamaaButton(
                            text = stringResource(R.string.common__retry),
                            onClick = onRetry,
                            modifier = Modifier.focusRequester(retry),
                            kind = ButtonKind.Primary,
                            icon = JamaaIcons.Refresh,
                            minWidth = 220.dp,
                        )
                    }
                }
            }
        }
        Text(
            stringResource(R.string.brand__tagline),
            style = type.caption,
            color = JamaaColors.TextMuted,
            modifier = Modifier.align(Alignment.BottomCenter),
        )
        if (BuildConfig.DEBUG) {
            // Focusable version label: long-press OK opens the debug settings (debug builds only).
            JamaaButton(
                text = "v" + BuildConfig.VERSION_NAME,
                onClick = {},
                onLongClick = onOpenDebug,
                kind = ButtonKind.Ghost,
                modifier = Modifier.align(Alignment.BottomEnd),
            )
        }
    }
    if (status is HomeStatus.Failed) InitialFocus(retry, key = status)
}

private const val SPLASH_WORDMARK_DP = 200f
private const val SPLASH_CHAR_DP = 36f
private const val SPLASH_MS = 1_200

/** Spinner row (64) or title + error line + Retry (≈ 136): one fixed slot, so the column above never re-centres. */
private val STATUS_SLOT_H = 140.dp

/**
 * HUB-01 ring geometry (pure, JVM-tested): an ellipse around the wordmark's box such that a character's circle (its
 * radius + [SplashGeometry.GAP] dp) centred anywhere on it — or on any larger copy of it, which is where the entrance
 * spiral flies — never touches the box. The flattest such ellipse within [SplashGeometry.RX_MAX] keeps the column short.
 */
internal object SplashGeometry {
    const val GAP = 8f
    const val RX_MAX = 228f

    class Ring(val rx: Float, val ry: Float, val charDp: Float) {
        val boxW get() = 2 * (rx + charDp / 2)
        val boxH get() = 2 * (ry + charDp / 2)

        /** Slot [i] of [n] (clockwise from the top), relative to the centre. */
        fun slot(i: Int, n: Int, k: Float = 1f, turn: Double = 0.0): Pair<Float, Float> {
            val a = 2.0 * PI * i / n - PI / 2 + turn
            return (cos(a) * rx * k).toFloat() to (sin(a) * ry * k).toFloat()
        }
    }

    /** Does the ellipse (rx, ry) contain the box (± [a], ± [b]) grown by [c] (rounded corners)? */
    private fun clears(rx: Float, ry: Float, a: Float, b: Float, c: Float): Boolean {
        for (k in 0..24) {
            val t = PI / 2 * k / 24
            val x = a + c * cos(t)
            val y = b + c * sin(t)
            if ((x / rx) * (x / rx) + (y / ry) * (y / ry) > 1.0) return false
        }
        return true
    }

    fun ring(wordW: Float, wordH: Float, charDp: Float): Ring {
        val a = wordW / 2
        val b = wordH / 2
        val c = charDp / 2 + GAP
        var ry = b + c
        while (true) {
            var rx = a + c
            while (rx <= RX_MAX) {
                if (clears(rx, ry, a, b, c)) return Ring(rx, ry, charDp)
                rx += 1f
            }
            ry += 1f
        }
    }
}

/**
 * JAMAA-PLATFORM §3.2 HUB-01: the 12 characters spiral in from beyond the screen — each along its own arm, a third of a
 * turn, 40 ms apart — and land on their slots of the orbit with a small squash, then smile. The spiral only ever runs on
 * copies of the orbit at least as big as it, so no character crosses the wordmark or the slogan. Once landed they bob
 * gently (±2 dp, each on its own phase; never toward the letters by more than the 8 dp gap). The progress is read in
 * the layer only; a character recomposes once, when it arrives. Calm motion (or [animate] false): placed at once, still.
 */
@Composable
private fun SplashRing(animate: Boolean, ring: SplashGeometry.Ring) {
    val reduce = JamaaTheme.reduceMotion
    val still = reduce || !animate
    val progress = remember { Animatable(if (still) 1f else 0f) }
    LaunchedEffect(still) { if (!still) progress.animateTo(1f, tween(SPLASH_MS, easing = LinearEasing)) }
    val bob = if (reduce) null else rememberInfiniteTransition(label = "splashBob").animateFloat(0f, 1f, infiniteRepeatable(tween(2_400, easing = LinearEasing)), label = "bob")
    val swatches = PlayerSwatch.entries.take(12)
    val n = swatches.size
    val density = LocalDensity.current
    val px = density.density
    val stepMs = 40f
    val span = 1f - stepMs * (n - 1) / SPLASH_MS
    swatches.forEachIndexed { i, sw ->
        val stagger = stepMs * i / SPLASH_MS
        val arrived by remember { derivedStateOf { progress.value >= stagger + span } }
        Character(
            sw.id, SPLASH_CHAR_DP.dp,
            if (arrived) app.jamaa.tv.platform.Expression.HAPPY else app.jamaa.tv.platform.Expression.IDLE,
            Modifier.graphicsLayer {
                val t = ((progress.value - stagger) / span).coerceIn(0f, 1f)
                val e = JamaaMotion.Decel.transform(t)
                // In: 3.4 × the orbit and a third of a turn back, spiralling down to the slot (k never below 1).
                val (x, y) = ring.slot(i, n, k = 1f + 2.4f * (1f - e), turn = -(1f - e) * PI * 0.66)
                // The bob rides along the orbit's normal outward only (never toward the letters).
                val wobble = bob?.let { (sin(2.0 * PI * (it.value + i / n.toFloat())).toFloat() + 1f) / 2f } ?: 0f
                val (nx, ny) = ring.slot(i, n).let { (sx, sy) -> val l = kotlin.math.hypot(sx, sy).coerceAtLeast(1f); sx / l to sy / l }
                translationX = (x + nx * wobble * 2f * (if (t >= 1f) 1f else 0f)) * px
                translationY = (y + ny * wobble * 2f * (if (t >= 1f) 1f else 0f)) * px
                rotationZ = (1f - e) * -300f
                alpha = (t * 4f).coerceAtMost(1f)
                // Landing squash: 1.12 → 1 over the last 15 % of its flight.
                val land = ((t - 0.85f) / 0.15f).coerceIn(0f, 1f)
                val squash = if (t >= 1f) 1f else 1f + 0.12f * sin(PI * land).toFloat()
                scaleX = squash
                scaleY = 2f - squash
            },
        )
    }
}
