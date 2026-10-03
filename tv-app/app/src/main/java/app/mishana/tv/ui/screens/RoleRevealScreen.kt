package app.mishana.tv.ui.screens

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalDensity
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.mishana.tv.R
import app.mishana.tv.game.Names
import app.mishana.tv.protocol.ClientIntent
import app.mishana.tv.protocol.HostAdvance
import app.mishana.tv.protocol.PublicPlayer
import app.mishana.tv.protocol.TvView
import app.mishana.tv.ui.components.ActionPill
import app.mishana.tv.ui.components.Avatar
import app.mishana.tv.ui.components.AvatarState
import app.mishana.tv.ui.components.InitialFocus
import app.mishana.tv.ui.components.MishIcons
import app.mishana.tv.ui.components.TimerChip
import app.mishana.tv.ui.components.focusFallback
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishMotion
import app.mishana.tv.ui.theme.MishTheme

/**
 * Shared in-game layout: the stage fills the space under the top bar; the bottom action bar (54 dp) holds the
 * action pill at the end. Focus falls back to [defaultFocus] whenever it is lost.
 */
@Composable
fun InGameScaffold(
    defaultFocus: FocusRequester,
    modifier: Modifier = Modifier,
    actionBar: @Composable RowScope.() -> Unit,
    stage: @Composable () -> Unit,
) {
    Column(modifier.fillMaxSize().focusFallback(defaultFocus)) {
        Box(Modifier.fillMaxWidth().weight(1f)) { stage() }
        Row(
            Modifier.fillMaxWidth().defaultMinSize(minHeight = 54.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.End),
            content = actionBar,
        )
    }
}

/** A row of mini avatars with names (TV-04, TV-05 strip). */
@Composable
fun AvatarRow(players: List<PublicPlayer>, size: androidx.compose.ui.unit.Dp, state: (PublicPlayer) -> AvatarState, nameMax: Int = 8) {
    Row(horizontalArrangement = Arrangement.spacedBy(20.dp), verticalAlignment = Alignment.Top) {
        for (p in players) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(size + 24.dp)) {
                Avatar(p.color, size, state = state(p))
                Spacer(Modifier.height(6.dp))
                Text(
                    Names.ellipsize(p.name, nameMax),
                    style = MishTheme.type.caption,
                    color = if (p.connected) MishColors.Text else MishColors.TextMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

/** TV-04 Role reveal wait ("Check your phones!"). The pill (`tv.startNow`) double-OK → HOST_ADVANCE. */
@Composable
fun RoleRevealScreen(view: TvView, clockOffsetMs: Long, send: (ClientIntent) -> Unit) {
    val type = MishTheme.type
    val pill = remember { FocusRequester() }
    val players = view.players.filter { !it.left }
    val ready = players.count { it.ready }
    val reduce = MishTheme.reduceMotion
    val wobble = if (reduce) {
        0f
    } else {
        val t = rememberInfiniteTransition(label = "phoneWobble")
        t.animateFloat(-7f, 7f, infiniteRepeatable(tween(800, easing = MishMotion.Standard), RepeatMode.Reverse), label = "w").value
    }
    InGameScaffold(
        defaultFocus = pill,
        actionBar = {
            // "4 / 7 ready" + the 48 dp ready timer sit in the action bar (bottom end), so the stage only holds
            // the headline and the avatars and never squeezes them out.
            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                    Text(
                        stringResource(R.string.reveal__ready_count, ready.toString(), players.size.toString()),
                        style = type.title,
                        color = MishColors.Text,
                        maxLines = 1,
                    )
                }
                val deadline = view.deadline
                if (deadline != null) {
                    Spacer(Modifier.width(20.dp))
                    TimerChip(deadline, clockOffsetMs, size = 48.dp)
                }
            }
            ActionPill(stringResource(R.string.tv__start_now), { send(HostAdvance) }, pill)
        },
    ) {
        val twoRows = players.size > 7
        val rows = if (!twoRows) listOf(players) else players.chunked((players.size + 1) / 2)
        val blankHint = (view.roleCounts?.blank ?: 0) > 0
        val density = LocalDensity.current
        val titleLh = with(density) { type.displayM.lineHeight.toDp() }
        val bodyLh = with(density) { type.body.lineHeight.toDp() }
        val captionLh = with(density) { type.caption.lineHeight.toDp() }
        BoxWithConstraints(Modifier.fillMaxSize()) {
            // Fit the stage (12 players, Arabic line heights, 1.3× font scale): the phone icon shrinks, then goes,
            // then the avatars step down — the ready avatars are what people check, so they stay.
            fun needed(icon: Dp, avatar: Dp): Dp {
                val text = titleLh + bodyLh * (if (blankHint) 2 else 1) + 16.dp
                val avatars = (avatar + 6.dp + captionLh) * rows.size + 10.dp * (rows.size - 1)
                return (if (icon > 0.dp) icon + 4.dp else 0.dp) + text + avatars
            }
            val baseAvatar = if (twoRows) 52.dp else 64.dp
            val (iconSize, avatarSize) = listOf(84.dp to baseAvatar, 56.dp to baseAvatar, 0.dp to baseAvatar, 0.dp to 44.dp)
                .firstOrNull { (i, a) -> needed(i, a) <= maxHeight } ?: (0.dp to 40.dp)
            Column(
                Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                if (iconSize > 0.dp) {
                    Icon(
                        MishIcons.Phone,
                        contentDescription = null,
                        tint = MishColors.Primary,
                        modifier = Modifier.size(iconSize).graphicsLayer { rotationZ = wobble },
                    )
                    Spacer(Modifier.height(4.dp))
                }
                Text(
                    stringResource(R.string.reveal__check_phones),
                    style = type.displayL.copy(fontSize = type.displayM.fontSize, lineHeight = type.displayM.lineHeight),
                    color = MishColors.Text,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                )
                Text(stringResource(R.string.reveal__check_body), style = type.body, color = MishColors.TextSecondary, textAlign = TextAlign.Center, maxLines = 1)
                if (blankHint) {
                    Text(stringResource(R.string.reveal__blank_hint), style = type.body, color = MishColors.TextMuted, textAlign = TextAlign.Center, maxLines = 1)
                }
                Spacer(Modifier.height(16.dp))
                Column(verticalArrangement = Arrangement.spacedBy(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    for (r in rows) {
                        AvatarRow(r, avatarSize, { AvatarState.of(it, check = it.ready, showHost = false) })
                    }
                }
            }
        }
    }
    InitialFocus(pill)
}
