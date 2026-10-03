package app.mishana.tv.ui.screens

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
import app.mishana.tv.BuildConfig
import app.mishana.tv.R
import app.mishana.tv.i18n.messageText
import app.mishana.tv.ui.components.ButtonKind
import app.mishana.tv.ui.components.InitialFocus
import app.mishana.tv.ui.components.Mark
import app.mishana.tv.ui.components.MishButton
import app.mishana.tv.ui.components.MishIcons
import app.mishana.tv.ui.components.Spinner
import app.mishana.tv.ui.components.Wordmark
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishMotion
import app.mishana.tv.ui.theme.MishTheme

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
    val type = MishTheme.type
    val retry = remember { FocusRequester() }
    val version = remember { FocusRequester() }
    Box(Modifier.fillMaxSize()) {
        Mark(48.dp, Modifier.align(Alignment.TopStart))
        Column(
            Modifier.align(Alignment.Center).padding(bottom = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Wordmark(width = 560.dp, animate = true)
            Spacer(Modifier.height(20.dp))
            Text(stringResource(R.string.brand__slogan), style = type.body, color = MishColors.TextSecondary, textAlign = TextAlign.Center)
            Spacer(Modifier.height(40.dp))
            AnimatedContent(
                targetState = status,
                transitionSpec = { fadeIn(tween(MishMotion.Base)) togetherWith fadeOut(tween(MishMotion.Fast)) },
                contentAlignment = Alignment.Center,
                label = "homeStatus",
            ) { st ->
                when (st) {
                    is HomeStatus.Busy -> Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.height(96.dp).semantics { liveRegion = LiveRegionMode.Polite },
                    ) {
                        Spinner(28.dp)
                        Spacer(Modifier.width(16.dp))
                        Text(stringResource(st.labelRes), style = type.titleS, color = MishColors.Text)
                    }
                    is HomeStatus.Failed -> Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    ) {
                        Text(stringResource(R.string.tv__create_failed), style = type.title, color = MishColors.Text)
                        if (st.messageKey != "tv.createFailed") {
                            Text(messageText(st.messageKey), style = type.caption, color = MishColors.TextMuted)
                        }
                        Spacer(Modifier.height(8.dp))
                        MishButton(
                            text = stringResource(R.string.common__retry),
                            onClick = onRetry,
                            modifier = Modifier.focusRequester(retry),
                            kind = ButtonKind.Primary,
                            icon = MishIcons.Refresh,
                            minWidth = 220.dp,
                        )
                    }
                }
            }
        }
        Text(
            stringResource(R.string.brand__tagline),
            style = type.caption,
            color = MishColors.TextMuted,
            modifier = Modifier.align(Alignment.BottomCenter),
        )
        if (BuildConfig.DEBUG) {
            // Focusable version label: long-press OK opens the debug settings (debug builds only).
            MishButton(
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
