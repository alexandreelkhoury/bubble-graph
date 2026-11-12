package app.jamaa.tv.ui.screens

import kotlin.math.sin
import kotlin.math.cos
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.sign
import androidx.compose.animation.SizeTransform
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import app.jamaa.tv.ui.theme.PlayerSwatch
import app.jamaa.tv.ui.characters.Character
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.runtime.LaunchedEffect
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
    Box(Modifier.fillMaxSize()) {
        Column(
            Modifier.align(Alignment.Center).padding(bottom = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // HUB-01: the 12 characters roll in from the sides into a ring around the wordmark (≤ 1.2 s); the wordmark's
            // letters fade in on the same first frame.
            Box(Modifier.size(SPLASH_RING_W, SPLASH_RING_H), contentAlignment = Alignment.Center) {
                SplashRing(entrance)
                Wordmark(width = 260.dp, animate = entrance)
            }
            Spacer(Modifier.height(20.dp))
            Text(stringResource(R.string.brand__slogan), style = type.body, color = JamaaColors.TextSecondary, textAlign = TextAlign.Center)
            Spacer(Modifier.height(24.dp))
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

private val SPLASH_RING_W = 470.dp
private val SPLASH_RING_H = 190.dp
private const val SPLASH_MS = 1_100

/** Spinner row (64) or title + error line + Retry (≈ 148): one fixed slot, so the column above never re-centres. */
private val STATUS_SLOT_H = 160.dp

/**
 * JAMAA-PLATFORM §3.2 HUB-01: each of the 12 characters slides in from beyond the side edge it sits on, along its own
 * row of the ellipse, to its slot around the wordmark, 30 ms apart, and smiles on arrival. They never cross the wordmark
 * or the slogan (the top and bottom ones travel above and below the wordmark). The progress is read in the layer only;
 * a character recomposes once, when it arrives. Calm motion (or [animate] false): placed at once.
 */
@Composable
private fun SplashRing(animate: Boolean) {
    val reduce = JamaaTheme.reduceMotion
    val still = reduce || !animate
    val progress = remember { Animatable(if (still) 1f else 0f) }
    LaunchedEffect(still) { if (!still) progress.animateTo(1f, tween(SPLASH_MS, easing = LinearEasing)) }
    val swatches = PlayerSwatch.entries.take(12)
    val n = swatches.size
    val density = LocalDensity.current
    val rx = with(density) { (SPLASH_RING_W / 2 - 22.dp).toPx() }
    val ry = with(density) { (SPLASH_RING_H / 2 - 22.dp).toPx() }
    val far = with(density) { 900.dp.toPx() } // the start sits well outside the 960 dp canvas
    val span = 1f - 30f * (n - 1) / SPLASH_MS
    swatches.forEachIndexed { i, sw ->
        val angle = 2.0 * PI * i / n - PI / 2
        val stagger = 30f * i / SPLASH_MS
        val slotX = (cos(angle) * rx).toFloat()
        val slotY = (sin(angle) * ry).toFloat()
        // The side it comes from: its own half of the ring (the top and bottom ones alternate).
        val side = if (abs(slotX) < 1f) (if (i % 2 == 0) -1f else 1f) else sign(slotX)
        val arrived by remember { derivedStateOf { progress.value >= stagger + span } }
        Character(
            sw.id, 36.dp,
            if (arrived) app.jamaa.tv.platform.Expression.HAPPY else app.jamaa.tv.platform.Expression.IDLE,
            Modifier.graphicsLayer {
                val t = ((progress.value - stagger) / span).coerceIn(0f, 1f)
                val e = JamaaMotion.Decel.transform(t)
                translationX = slotX + (side * far - slotX) * (1f - e)
                translationY = slotY
                rotationZ = (1f - e) * 360f * -side
            },
        )
    }
}
