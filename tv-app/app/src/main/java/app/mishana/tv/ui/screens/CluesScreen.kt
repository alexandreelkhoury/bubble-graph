package app.mishana.tv.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.mishana.tv.R
import app.mishana.tv.game.Countdown
import app.mishana.tv.game.Names
import app.mishana.tv.i18n.isolate
import app.mishana.tv.protocol.ClientIntent
import app.mishana.tv.protocol.HostAdvance
import app.mishana.tv.protocol.Phase
import app.mishana.tv.protocol.PublicPlayer
import app.mishana.tv.protocol.TvView
import app.mishana.tv.protocol.VoteOutcome
import app.mishana.tv.ui.components.ActionPill
import app.mishana.tv.ui.components.Avatar
import app.mishana.tv.ui.components.AvatarState
import app.mishana.tv.ui.components.InitialFocus
import app.mishana.tv.ui.components.MishIcons
import app.mishana.tv.ui.components.Stamp
import app.mishana.tv.ui.components.TimerNumber
import app.mishana.tv.ui.components.TimerRing
import app.mishana.tv.ui.components.ToastState
import app.mishana.tv.ui.components.rememberFrameClock
import app.mishana.tv.ui.components.urgencyColor
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishMotion
import app.mishana.tv.ui.theme.MishTheme
import kotlinx.coroutines.delay

/**
 * TV-05 Clues (CLUES and TIE_BREAK). Spotlight on the current speaker with the timer ring wrapped around the avatar,
 * the speaking-order strip at the bottom, and the `clues.skipTurn` pill. TIE_BREAK first plays the TV-08 overlay.
 */
@Composable
fun CluesScreen(view: TvView, clockOffsetMs: Long, paused: Boolean, send: (ClientIntent) -> Unit, toasts: ToastState) {
    val type = MishTheme.type
    val pill = remember { FocusRequester() }
    val speaker = view.player(view.currentSpeakerId)
    val order = view.speakingOrder.mapNotNull { view.player(it) }
    val tie = view.phase == Phase.TIE_BREAK

    // TV-08: a ≤ 2.5 s tie overlay at the start of TIE_BREAK (OK skips it). Halved in reduced motion.
    val reduce = MishTheme.reduceMotion
    val tieKey = "${view.gameNumber}:${view.round}"
    var tieShownFor by remember { mutableStateOf<String?>(null) }
    val showTie = tie && view.lastVote?.outcome == VoteOutcome.TIE && tieShownFor != tieKey
    val tieVisible = remember { MutableTransitionState(false) }
    val isPaused by rememberUpdatedState(paused)
    LaunchedEffect(showTie) {
        if (showTie) {
            tieVisible.targetState = true
            var waited = 0L
            val total = if (reduce) 1_250L else 2_500L
            while (waited < total) {
                delay(50)
                if (!isPaused) waited += 50
                if (!tieVisible.targetState) break
            }
            tieVisible.targetState = false
            tieShownFor = tieKey
        }
    }

    SkipToasts(view, toasts)

    InGameScaffold(
        defaultFocus = pill,
        actionBar = {
            OrderStrip(order, view.currentSpeakerId, Modifier.weight(1f))
            ActionPill(
                stringResource(R.string.clues__skip_turn),
                { send(HostAdvance) },
                pill,
                onFirstPress = {
                    if (tieVisible.targetState) {
                        tieVisible.targetState = false
                        true
                    } else {
                        false
                    }
                },
            )
        },
    ) {
        Box(Modifier.fillMaxSize()) {
            // Spotlight: a radial cone of primary at 12 % from the top centre.
            Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
                drawRect(
                    Brush.radialGradient(
                        colors = listOf(MishColors.Primary.copy(alpha = 0.12f), Color.Transparent),
                        center = Offset(size.width / 2f, size.height * 0.42f),
                        radius = size.height * 0.62f,
                    ),
                )
            }
            Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (tie) TieBadge()
                    Text(stringResource(R.string.clues__rule), style = type.caption, color = MishColors.TextMuted)
                }
                val firstTurn = view.round == 1 && !tie && view.players.none { it.alive && it.spoke }
                if (firstTurn) {
                    Text(stringResource(R.string.clues__first_hint), style = type.caption, color = MishColors.TextSecondary, textAlign = TextAlign.Center)
                }
                Spacer(Modifier.weight(1f))
                AnimatedContent(
                    targetState = speaker,
                    contentKey = { it?.id },
                    transitionSpec = {
                        if (reduce) {
                            fadeIn(tween(MishMotion.Fast)) togetherWith fadeOut(tween(MishMotion.Fast))
                        } else {
                            (slideInHorizontally(tween(MishMotion.Slow, easing = MishMotion.Decel)) { it / 3 } + fadeIn(tween(MishMotion.Slow))) togetherWith
                                (slideOutHorizontally(tween(MishMotion.Base, easing = MishMotion.Accel)) { -it / 3 } + fadeOut(tween(MishMotion.Base)))
                        }
                    },
                    label = "speaker",
                ) { sp ->
                    if (sp != null) SpeakerHero(sp, view, clockOffsetMs) else Spacer(Modifier.height(260.dp))
                }
                Spacer(Modifier.weight(1f))
            }
        }
    }

    // TV-08 overlay above the stage.
    AnimatedVisibility(
        visibleState = tieVisible,
        enter = fadeIn(tween(MishMotion.Fast)),
        exit = fadeOut(tween(MishMotion.Slow)),
    ) {
        TieOverlay(view)
    }

    InitialFocus(pill)
}

@Composable
private fun TieBadge() {
    Row(
        Modifier
            .background(MishColors.Accent, RoundedCornerShape(50))
            .padding(horizontal = 14.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(stringResource(R.string.phase__tie_break), style = MishTheme.type.caption, color = MishColors.Ink)
    }
}

/** The current speaker: 160 dp avatar inside a 216 dp / 8 dp ring, seconds at the ring's top end, name in displayM. */
@Composable
private fun SpeakerHero(sp: PublicPlayer, view: TvView, clockOffsetMs: Long) {
    val type = MishTheme.type
    val deadline = view.deadline
    val now by rememberFrameClock()
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(216.dp), contentAlignment = Alignment.Center) {
            if (deadline != null) {
                TimerRing(deadline, clockOffsetMs, 216.dp, 8.dp)
            }
            Avatar(sp.color, 160.dp, state = AvatarState.of(sp, speaking = sp.connected, showHost = false))
            if (deadline != null) {
                val remaining = Countdown.remainingMs(deadline.at, clockOffsetMs, now)
                TimerNumber(
                    remaining,
                    urgencyColor(remaining),
                    Modifier.align(Alignment.TopEnd).offset(x = 36.dp, y = (-6).dp),
                )
            }
        }
        Spacer(Modifier.height(10.dp))
        Text(
            stringResource(R.string.clues__speaking, isolate(Names.ellipsize(sp.name, 20))),
            style = type.displayM,
            color = MishColors.Text,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = 820.dp).semantics { liveRegion = LiveRegionMode.Polite },
        )
        Text(
            stringResource(if (deadline == null) R.string.clues__no_timer else R.string.clues__speaker_sub),
            style = type.body,
            color = MishColors.TextSecondary,
            textAlign = TextAlign.Center,
        )
    }
}

/** Speaking order: done = check + 60 %; current = 1.25× + a 4 dp primary underline; chevrons follow reading direction. */
@Composable
private fun OrderStrip(order: List<PublicPlayer>, currentId: String?, modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        order.forEachIndexed { i, p ->
            if (i > 0) {
                Icon(MishIcons.ChevronForward, contentDescription = null, tint = MishColors.TextMuted, modifier = Modifier.size(16.dp))
            }
            val current = p.id == currentId
            val scale by animateFloatAsState(if (current) 1.25f else 1f, tween(MishMotion.Base, easing = MishMotion.Standard), label = "cur")
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .width(64.dp)
                    .alpha(if (p.spoke && !current) 0.6f else 1f),
            ) {
                Avatar(
                    p.color,
                    32.dp,
                    Modifier.graphicsLayer { scaleX = scale; scaleY = scale },
                    state = AvatarState.of(p, check = p.spoke && !current, showHost = false),
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    Names.ellipsize(p.name, 8),
                    style = MishTheme.type.caption,
                    color = if (current) MishColors.Text else MishColors.TextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Box(
                    Modifier
                        .width(28.dp)
                        .height(4.dp)
                        .background(if (current) MishColors.Primary else Color.Transparent, RoundedCornerShape(2.dp)),
                )
            }
        }
    }
}

/** TV-08: "It's a tie!" with the tied players and their tallies, then it fades to reveal TV-05. */
@Composable
private fun TieOverlay(view: TvView) {
    val type = MishTheme.type
    val tally = view.lastVote?.tally.orEmpty()
    val tied = view.tieCandidates.mapNotNull { view.player(it) }
    Box(Modifier.fillMaxSize().background(MishColors.Bg.copy(alpha = 0.94f)), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Stamp(stringResource(R.string.tie__title), MishColors.Accent, style = type.displayL)
            Spacer(Modifier.height(28.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(40.dp), verticalAlignment = Alignment.CenterVertically) {
                tied.forEachIndexed { i, p ->
                    if (i > 0) {
                        Text("!", style = type.displayM, color = MishColors.Primary, modifier = Modifier.graphicsLayer { rotationZ = 8f })
                    }
                    // SPEC-GAP: no i18n key for "{count} votes" (DESIGN TV-08); the tally is a number badge on the card.
                    val votes = tally.firstOrNull { it.targetId == p.id }?.voterIds?.size ?: 0
                    val pop = remember { Animatable(if (MishTheme.reduceMotion) 1f else 0f) }
                    LaunchedEffect(Unit) {
                        pop.animateTo(1f, tween(MishMotion.Base, delayMillis = 120 * i, easing = MishMotion.Overshoot))
                    }
                    run {
                        Column(
                            Modifier
                                .graphicsLayer { scaleX = pop.value; scaleY = pop.value; alpha = pop.value.coerceIn(0f, 1f) }
                                .background(MishColors.Surface, RoundedCornerShape(24.dp))
                                .padding(horizontal = 28.dp, vertical = 18.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Box {
                                Avatar(p.color, 96.dp, state = AvatarState(away = !p.connected))
                                Box(
                                    Modifier
                                        .align(Alignment.TopEnd)
                                        .offset(x = 14.dp, y = (-14).dp)
                                        .size(40.dp)
                                        .background(MishColors.Accent, CircleShape),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(votes.toString(), style = type.title, color = MishColors.Ink)
                                }
                            }
                            Spacer(Modifier.height(10.dp))
                            Text(Names.ellipsize(p.name, 12), style = type.title, color = MishColors.Text, maxLines = 1)
                        }
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
            Text(
                stringResource(R.string.tie__explain),
                style = type.body,
                color = MishColors.TextSecondary,
                textAlign = TextAlign.Center,
                modifier = Modifier.widthIn(max = 640.dp),
            )
        }
    }
}

/** `clues.skipped` when the turn passes over an away player. */
@Composable
private fun SkipToasts(view: TvView, toasts: ToastState) {
    val fmt = stringResource(R.string.clues__skipped, "%NAME%")
    val prev = remember { mutableStateOf<Pair<String?, List<String>>?>(null) }
    LaunchedEffect(view.currentSpeakerId, view.speakingOrder) {
        val before = prev.value
        prev.value = view.currentSpeakerId to view.speakingOrder
        if (before == null || before.second != view.speakingOrder) return@LaunchedEffect
        val from = view.speakingOrder.indexOf(before.first)
        val to = view.currentSpeakerId?.let { view.speakingOrder.indexOf(it) } ?: view.speakingOrder.size
        if (from < 0 || to <= from + 1) return@LaunchedEffect
        for (id in view.speakingOrder.subList(from + 1, to)) {
            val p = view.player(id) ?: continue
            if (!p.connected) toasts.show(fmt.replace("%NAME%", isolate(p.name)), MishColors.Danger)
        }
    }
}
