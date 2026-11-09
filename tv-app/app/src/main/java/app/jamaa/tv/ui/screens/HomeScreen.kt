package app.jamaa.tv.ui.screens

import kotlin.math.sin
import kotlin.math.cos
import kotlin.math.PI
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
import app.jamaa.tv.ui.components.Mark
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
 * Back exits the app (handled by the activity default). Debug builds: long-press OK on the version label → DebugSettings.
 */
@Composable
fun HomeScreen(status: HomeStatus, onRetry: () -> Unit, onOpenDebug: () -> Unit) {
    val type = JamaaTheme.type
    val retry = remember { FocusRequester() }
    val version = remember { FocusRequester() }
    Box(Modifier.fillMaxSize()) {
        Mark(48.dp, Modifier.align(Alignment.TopStart))
        Column(
            Modifier.align(Alignment.Center).padding(bottom = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // HUB-01: the 12 characters roll in from the edges into a ring around the wordmark (≤ 1.2 s).
            Box(Modifier.size(SPLASH_RING_W, SPLASH_RING_H), contentAlignment = Alignment.Center) {
                SplashRing()
                Wordmark(width = 260.dp, animate = true)
            }
            Spacer(Modifier.height(20.dp))
            Text(stringResource(R.string.brand__slogan), style = type.body, color = JamaaColors.TextSecondary, textAlign = TextAlign.Center)
            Spacer(Modifier.height(40.dp))
            AnimatedContent(
                targetState = status,
                transitionSpec = { fadeIn(tween(JamaaMotion.Base)) togetherWith fadeOut(tween(JamaaMotion.Fast)) },
                contentAlignment = Alignment.Center,
                label = "homeStatus",
            ) { st ->
                when (st) {
                    is HomeStatus.Busy -> Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.height(96.dp).semantics { liveRegion = LiveRegionMode.Polite },
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
                            Text(messageText(st.messageKey), style = type.caption, color = JamaaColors.TextMuted)
                        }
                        Spacer(Modifier.height(8.dp))
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
                modifier = Modifier.align(Alignment.BottomEnd).focusRequester(version),
            )
        }
    }
    if (status is HomeStatus.Failed) {
        InitialFocus(retry, key = status)
    } else if (BuildConfig.DEBUG) {
        InitialFocus(version, key = status)
    }
}

private val SPLASH_RING_W = 470.dp
private val SPLASH_RING_H = 190.dp
private const val SPLASH_MS = 1_100

/**
 * JAMAA-PLATFORM §3.2 HUB-01: each of the 12 characters travels from beyond the screen edge (along its ring angle) to
 * its slot on an ellipse around the wordmark, 30 ms apart, and smiles on arrival. Calm motion: placed at once.
 */
@Composable
private fun SplashRing() {
    val reduce = JamaaTheme.reduceMotion
    val progress = remember { Animatable(if (reduce) 1f else 0f) }
    LaunchedEffect(reduce) { if (!reduce) progress.animateTo(1f, tween(SPLASH_MS, easing = LinearEasing)) }
    val swatches = PlayerSwatch.entries.take(12)
    val n = swatches.size
    val density = LocalDensity.current
    val rx = with(density) { (SPLASH_RING_W / 2 - 22.dp).toPx() }
    val ry = with(density) { (SPLASH_RING_H / 2 - 22.dp).toPx() }
    val far = with(density) { 900.dp.toPx() }
    swatches.forEachIndexed { i, sw ->
        val angle = 2.0 * PI * i / n - PI / 2
        val stagger = 30f * i / SPLASH_MS
        val t = ((progress.value - stagger) / (1f - 30f * (n - 1) / SPLASH_MS)).coerceIn(0f, 1f)
        val e = JamaaMotion.Decel.transform(t)
        val dist = far // the start sits well outside the 960 dp canvas
        val x = (cos(angle) * (rx + (dist - rx) * (1f - e))).toFloat()
        val y = (sin(angle) * (ry + (dist * ry / rx - ry) * (1f - e))).toFloat()
        Character(
            sw.id, 36.dp,
            if (t >= 1f) app.jamaa.tv.platform.Expression.HAPPY else app.jamaa.tv.platform.Expression.IDLE,
            Modifier.graphicsLayer { translationX = x; translationY = y; rotationZ = (1f - e) * 360f },
        )
    }
}
