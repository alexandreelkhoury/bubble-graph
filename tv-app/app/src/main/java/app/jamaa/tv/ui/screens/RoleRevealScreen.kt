package app.jamaa.tv.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.game.Names
import app.jamaa.tv.games.mishana.MishanaLayout
import app.jamaa.tv.games.mishana.MishanaTv
import app.jamaa.tv.games.mishana.MishanaView
import app.jamaa.tv.games.mishana.ui.StageText
import app.jamaa.tv.games.mishana.ui.fitHeight
import app.jamaa.tv.games.mishana.ui.stagedEnter
import app.jamaa.tv.protocol.ClientIntent
import app.jamaa.tv.protocol.PublicPlayer
import app.jamaa.tv.ui.components.ActionPill
import app.jamaa.tv.ui.components.Avatar
import app.jamaa.tv.ui.components.AvatarState
import app.jamaa.tv.ui.components.InGameScaffold
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.components.TimerChip
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaMotion
import app.jamaa.tv.ui.theme.JamaaTheme

/**
 * TV-04 Role reveal wait ("Check your phones!"). The headline block, then the players as big as the stage allows
 * ([MishanaLayout.revealAvatar]: up to 112 dp, one row up to 6, two rows for 7–12) dealing in one by one; each hops
 * and gets its check when that phone is ready. The pill (`tv.startNow`) double-OK → HOST_ADVANCE.
 */
@Composable
fun RoleRevealScreen(view: MishanaView, clockOffsetMs: Long, send: (ClientIntent) -> Unit) {
    val type = JamaaTheme.type
    val pill = remember { FocusRequester() }
    val players = view.players.filter { !it.left }
    val ready = players.count { it.ready }
    val reduce = JamaaTheme.reduceMotion
    // Read in the layer only: the wobble never recomposes the screen.
    val wobble = if (reduce) {
        null
    } else {
        rememberInfiniteTransition(label = "phoneWobble")
            .animateFloat(-7f, 7f, infiniteRepeatable(tween(800, easing = JamaaMotion.Standard), RepeatMode.Reverse), label = "w")
    }
    InGameScaffold(
        defaultFocus = pill,
        actionBar = {
            // "4 / 7 ready" + the 48 dp ready timer sit in the action bar, so the stage holds only the headline and
            // the avatars and never squeezes them out.
            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                    Text(
                        stringResource(R.string.reveal__ready_count, ready.toString(), players.size.toString()),
                        style = type.title,
                        color = JamaaColors.Text,
                        maxLines = 1,
                    )
                }
                val deadline = view.deadline
                if (deadline != null) {
                    Spacer(Modifier.width(20.dp))
                    TimerChip(deadline, clockOffsetMs, size = 48.dp)
                }
            }
            ActionPill(stringResource(R.string.tv__start_now), { send(MishanaTv.hostAdvance()) }, pill)
        },
    ) {
        val rowSizes = MishanaLayout.revealRows(players.size)
        val blankHint = (view.roleCounts?.blank ?: 0) > 0
        val density = LocalDensity.current
        val titleLh = with(density) { type.displayL.lineHeight.toDp() }
        val bodyLh = with(density) { type.body.lineHeight.toDp() }
        val nameLh = with(density) { type.title.lineHeight.toDp() }
        BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            // The phone icon only when the avatars keep a good size without it (one row); the avatars are what
            // people check, so they get the rest of the stage.
            val icon = if (rowSizes.size == 1) 64.dp else 0.dp
            val text = titleLh + bodyLh * (if (blankHint) 2 else 1) + 24.dp + (if (icon > 0.dp) icon + 4.dp else 0.dp)
            val avatar = MishanaLayout.revealAvatar(players.size, maxWidth.value, (maxHeight - text).value, nameLh.value).dp
            Column(
                Modifier.fillMaxWidth().fitHeight(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                if (icon > 0.dp) {
                    Icon(
                        JamaaIcons.Phone,
                        contentDescription = null,
                        tint = JamaaColors.Primary,
                        modifier = Modifier
                            .stagedEnter(fromScale = 0.5f, rise = 0.dp)
                            .size(icon)
                            .graphicsLayer { rotationZ = wobble?.value ?: 0f },
                    )
                    Spacer(Modifier.height(4.dp))
                }
                StageText(
                    stringResource(R.string.reveal__check_phones),
                    type.displayL,
                    JamaaColors.Text,
                    Modifier.fillMaxWidth().stagedEnter(delayMs = 60).semantics { liveRegion = LiveRegionMode.Polite },
                    maxLines = 1,
                    minScale = 0.6f,
                )
                StageText(
                    stringResource(R.string.reveal__check_body),
                    type.body,
                    JamaaColors.TextSecondary,
                    Modifier.fillMaxWidth().stagedEnter(delayMs = 140),
                    maxLines = 2,
                    minScale = 0.85f,
                )
                if (blankHint) {
                    StageText(
                        stringResource(R.string.reveal__blank_hint),
                        type.body,
                        JamaaColors.TextMuted,
                        Modifier.fillMaxWidth().stagedEnter(delayMs = 200),
                        maxLines = 2,
                        minScale = 0.85f,
                    )
                }
                Spacer(Modifier.height(24.dp))
                Column(verticalArrangement = Arrangement.spacedBy(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    var index = 0
                    for (size in rowSizes) {
                        val row = players.subList(index, index + size)
                        val first = index
                        Row(horizontalArrangement = Arrangement.spacedBy(20.dp), verticalAlignment = Alignment.Top) {
                            row.forEachIndexed { i, p -> ReadyAvatar(p, avatar, first + i) }
                        }
                        index += size
                    }
                }
            }
        }
    }
    InitialFocus(pill)
}

/**
 * One player: deals in (from 60 %, 50 ms stagger after the headline), then hops 14 dp when their phone says ready
 * (the check pops with it). Away players keep the away badge, never the check. Reduced motion: no hop.
 */
@Composable
private fun ReadyAvatar(p: PublicPlayer, size: Dp, index: Int) {
    val reduce = JamaaTheme.reduceMotion
    val hop = remember { Animatable(0f) }
    var seen by remember { mutableStateOf(p.ready) }
    LaunchedEffect(p.ready) {
        if (p.ready && !seen && !reduce) {
            hop.animateTo(1f, tween(JamaaMotion.Fast, easing = JamaaMotion.Decel))
            hop.animateTo(0f, tween(JamaaMotion.Slow, easing = JamaaMotion.Overshoot))
        }
        seen = p.ready
    }
    val hopPx = with(LocalDensity.current) { 14.dp.toPx() }
    Column(
        Modifier.width(size + 40.dp).stagedEnter(delayMs = 260 + 50 * index, fromScale = 0.6f, rise = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Avatar(
            p.color,
            size,
            Modifier.graphicsLayer { translationY = -hop.value * hopPx },
            state = AvatarState.of(p, check = p.ready, showHost = false),
        )
        Spacer(Modifier.height(6.dp))
        Text(
            Names.ellipsize(p.name, 10),
            style = if (size >= 80.dp) JamaaTheme.type.title else JamaaTheme.type.titleS,
            color = if (p.connected) JamaaColors.Text else JamaaColors.TextMuted,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
        )
    }
}
