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
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.graphics.TransformOrigin
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.mishana.tv.R
import app.mishana.tv.game.Names
import app.mishana.tv.i18n.isolate
import app.mishana.tv.i18n.nameList
import app.mishana.tv.protocol.ClientIntent
import app.mishana.tv.protocol.HostAdvance
import app.mishana.tv.protocol.Phase
import app.mishana.tv.protocol.PublicPlayer
import app.mishana.tv.protocol.TvView
import app.mishana.tv.protocol.VoteOutcome
import app.mishana.tv.protocol.player
import app.mishana.tv.ui.components.ActionPill
import app.mishana.tv.ui.components.Avatar
import app.mishana.tv.ui.components.AvatarState
import app.mishana.tv.ui.components.InGameScaffold
import app.mishana.tv.ui.components.InitialFocus
import app.mishana.tv.ui.components.MishIcons
import app.mishana.tv.ui.components.Stamp
import app.mishana.tv.ui.components.TimerSeconds
import app.mishana.tv.ui.components.TimerRing
import app.mishana.tv.ui.components.fullBleed
import app.mishana.tv.ui.theme.MishShapes
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishMotion
import app.mishana.tv.ui.theme.MishTheme
import kotlinx.coroutines.delay

/**
 * TV-05 Clues (CLUES and TIE_BREAK). Spotlight on the current speaker with the timer ring wrapped around the avatar,
 * the speaking-order strip at the bottom, and the `clues.skipTurn` pill. TIE_BREAK first plays the TV-08 overlay.
 */
@Composable
fun CluesScreen(view: TvView, clockOffsetMs: Long, paused: Boolean, send: (ClientIntent) -> Unit) {
    val type = MishTheme.type
    val pill = remember { FocusRequester() }
    val speaker = view.player(view.currentSpeakerId)
    val order = view.speakingOrder.mapNotNull { view.player(it) }
    val tie = view.phase == Phase.TIE_BREAK

    // TV-08: a 4 s tie overlay at the start of TIE_BREAK (OK skips it): long enough to read the rule from the couch.
    // Halved in reduced motion.
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
            val total = if (reduce) TIE_OVERLAY_MS / 2 else TIE_OVERLAY_MS
            while (waited < total) {
                delay(50)
                if (!isPaused) waited += 50
                if (!tieVisible.targetState) break
            }
            tieVisible.targetState = false
            tieShownFor = tieKey
        }
    }

    InGameScaffold(
        defaultFocus = pill,
        actionBar = {
            OrderStrip(order, view.currentSpeakerId, Modifier.weight(1f).padding(top = 8.dp))
            ActionPill(
                stringResource(R.string.clues__skip_turn),
                { send(HostAdvance) },
                pill,
                // A new speaker is a new action: presses mashed through the hand-over never skip them.
                resetKey = view.currentSpeakerId,
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
            Canvas(Modifier.fillMaxSize().fullBleed().clearAndSetSemantics {}) {
                drawRect(
                    Brush.radialGradient(
                        colors = listOf(MishColors.Primary.copy(alpha = 0.12f), Color.Transparent),
                        // Full-bleed canvas (window coordinates): the cone centres on the speaker's ring.
                        center = Offset(size.width / 2f, size.height * 0.5f),
                        radius = size.height * 0.6f,
                    ),
                )
            }
            Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
                // During a tie-break the rule line says who tied and what happens next (the top bar already says
                // TIE-BREAK, so no second badge).
                if (tie) {
                    val names = nameList(view.tieCandidates.mapNotNull { view.player(it)?.name?.let { n -> Names.ellipsize(n, 16) } })
                    Text(stringResource(R.string.tie__persist, names), style = type.caption, color = MishColors.TextSecondary, textAlign = TextAlign.Center, maxLines = 1, overflow = TextOverflow.Ellipsis)
                } else {
                    Text(stringResource(R.string.clues__rule), style = type.caption, color = MishColors.TextMuted)
                }
                val firstTurn = view.round == 1 && !tie && view.players.none { it.alive && it.spoke }
                if (firstTurn) {
                    Text(stringResource(R.string.clues__first_hint), style = type.caption, color = MishColors.TextSecondary, textAlign = TextAlign.Center)
                }
                // The hero steps its ring/avatar down (216 → 140 dp) when the stage is short (Arabic line heights,
                // the round-1 hint, large font scale) instead of pushing the name and sub-line off the stage.
                BoxWithConstraints(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    val textH = with(LocalDensity.current) { type.displayM.lineHeight.toDp() + type.body.lineHeight.toDp() } + 10.dp
                    val ring = (maxHeight - textH).coerceIn(140.dp, 216.dp)
                    val dir = if (LocalLayoutDirection.current == LayoutDirection.Rtl) -1 else 1
                    AnimatedContent(
                        targetState = speaker,
                        contentKey = { it?.id },
                        transitionSpec = {
                            if (reduce) {
                                fadeIn(tween(MishMotion.Fast)) togetherWith fadeOut(tween(MishMotion.Fast))
                            } else {
                                // The next speaker comes from where the order strip continues: the end side, which is
                                // the left in Arabic (slide offsets are absolute px, so mirror them by hand).
                                (slideInHorizontally(tween(MishMotion.Slow, easing = MishMotion.Decel)) { dir * it / 3 } + fadeIn(tween(MishMotion.Slow))) togetherWith
                                    (slideOutHorizontally(tween(MishMotion.Base, easing = MishMotion.Accel)) { -dir * it / 3 } + fadeOut(tween(MishMotion.Base)))
                            }
                        },
                        label = "speaker",
                    ) { sp ->
                        if (sp != null) SpeakerHero(sp, view, clockOffsetMs, ring) else Spacer(Modifier.height(ring))
                    }
                }
            }
        }
    }

    // TV-08 overlay above the stage.
    AnimatedVisibility(
        visibleState = tieVisible,
        modifier = Modifier.fullBleed(),
        enter = fadeIn(tween(MishMotion.Fast)),
        exit = fadeOut(tween(MishMotion.Slow)),
    ) {
        TieOverlay(view)
    }

    InitialFocus(pill)
}

/** The current speaker: 160 dp avatar inside a 216 dp / 8 dp ring (scaled together by [ring]), seconds at the ring's top end, name in displayM. */
@Composable
private fun SpeakerHero(sp: PublicPlayer, view: TvView, clockOffsetMs: Long, ring: Dp) {
    val type = MishTheme.type
    val deadline = view.deadline
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(ring), contentAlignment = Alignment.Center) {
            if (deadline != null) {
                TimerRing(deadline, clockOffsetMs, ring, 8.dp)
            }
            Avatar(sp.color, ring * (160f / 216f), state = AvatarState.of(sp, speaking = sp.connected, showHost = false))
            if (deadline != null) {
                TimerSeconds(deadline, clockOffsetMs, Modifier.align(Alignment.TopEnd).offset(x = 36.dp, y = (-6).dp))
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
            // TV wording: the speaker ends the turn on their phone (the TV is remote-only, never "tap").
            stringResource(if (deadline == null) R.string.tv__clues_no_timer else R.string.tv__clues_sub),
            style = type.body,
            color = MishColors.TextSecondary,
            textAlign = TextAlign.Center,
        )
    }
}

/** How long TV-08 stays up (2 s in reduced motion). */
internal const val TIE_OVERLAY_MS = 4_000L

private val STRIP_ITEM = 104.dp
private val STRIP_TEXT = 96.dp // STRIP_ITEM minus 2 × 4 dp: the one ellipsis point for long names
private val STRIP_CHEVRON = 24.dp // 16 dp icon + 2 × 4 dp
private val STRIP_MORE = 48.dp

/**
 * Speaking order (DESIGN TV-05): 104 dp items, 48 dp avatars, names in titleS truncated once by an end ellipsis at
 * [STRIP_TEXT] (no grapheme pre-cut). Done = check + 60 %; current = 1.25× + a 4 dp primary underline that ends
 * 2 dp above the bottom safe line (96 dp bar: 8 top + 48 + 2 + name + 4 + 4 + 2); chevrons follow the reading direction.
 * Every item keeps its full size: when the bar is too narrow, the chevrons go first, then the strip becomes a
 * window that keeps the current speaker in view with "+n" counts for the players before and after it
 * (never zero-width items).
 */
@Composable
private fun OrderStrip(order: List<PublicPlayer>, currentId: String?, modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier, contentAlignment = Alignment.CenterStart) {
        val n = order.size
        val w = maxWidth
        val chevrons = STRIP_ITEM * n + STRIP_CHEVRON * (n - 1).coerceAtLeast(0) <= w
        val fitsAll = chevrons || STRIP_ITEM * n <= w
        val cur = order.indexOfFirst { it.id == currentId }.coerceAtLeast(0)
        val slots = if (fitsAll) n else ((w - STRIP_MORE * 2) / STRIP_ITEM).toInt().coerceIn(1, n)
        // Keep one finished player visible before the current one when there is room.
        val start = if (fitsAll) 0 else (cur - 1).coerceIn(0, (n - slots).coerceAtLeast(0))
        val shown = order.subList(start, (start + slots).coerceAtMost(n))
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (start > 0) MoreCount(start)
            shown.forEachIndexed { i, p ->
                if (i > 0 && chevrons) {
                    Icon(
                        MishIcons.ChevronForward,
                        contentDescription = null,
                        tint = MishColors.TextMuted,
                        modifier = Modifier.padding(horizontal = 4.dp).size(16.dp),
                    )
                }
                StripItem(p, p.id == currentId)
            }
            val after = n - start - shown.size
            if (after > 0) MoreCount(after)
        }
    }
}

@Composable
private fun StripItem(p: PublicPlayer, current: Boolean) {
    val scale by animateFloatAsState(if (current) 1.25f else 1f, tween(MishMotion.Base, easing = MishMotion.Standard), label = "cur")
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(STRIP_ITEM)
            .alpha(if (p.spoke && !current) 0.6f else 1f),
    ) {
        Avatar(
            p.color,
            48.dp,
            Modifier.graphicsLayer { scaleX = scale; scaleY = scale; transformOrigin = TransformOrigin(0.5f, 1f) },
            state = AvatarState.of(p, check = p.spoke && !current, showHost = false),
        )
        Spacer(Modifier.height(2.dp))
        Text(
            p.name,
            style = MishTheme.type.titleS,
            color = if (current) MishColors.Text else MishColors.TextSecondary,
            maxLines = 1,
            softWrap = false,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = STRIP_TEXT),
        )
        Spacer(Modifier.height(4.dp))
        Box(
            Modifier
                .width(28.dp)
                .height(4.dp)
                .background(if (current) MishColors.Primary else Color.Transparent, MishShapes.pill),
        )
        Spacer(Modifier.height(2.dp))
    }
}

/** "+3": players of the order outside the visible window. */
@Composable
private fun MoreCount(count: Int) {
    Box(Modifier.width(STRIP_MORE), contentAlignment = Alignment.Center) {
        Text("+$count", style = MishTheme.type.titleS, color = MishColors.TextMuted, maxLines = 1)
    }
}

/** TV-08: "It's a tie!" with the tied players and their tallies, then it fades to reveal TV-05. */
@Composable
private fun TieOverlay(view: TvView) {
    val type = MishTheme.type
    val tally = view.lastVote?.tally.orEmpty()
    val tied = view.tieCandidates.mapNotNull { view.player(it) }
    val reduce = MishTheme.reduceMotion
    // 2–3 tied: 96 dp avatars, title names, "!" separators. 4: compact cards (72 dp, titleS) without separators,
    // so four cards always fit the 864 dp safe width.
    val compact = tied.size > 3
    val avatar = if (compact) 72.dp else 96.dp
    val nameStyle = if (compact) type.titleS else type.title
    Box(Modifier.fillMaxSize().background(MishColors.Bg.copy(alpha = 0.94f)), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Stamp(stringResource(R.string.tie__title), MishColors.Accent, style = type.displayL)
            Spacer(Modifier.height(28.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(if (compact) 20.dp else 40.dp), verticalAlignment = Alignment.CenterVertically) {
                tied.forEachIndexed { i, p ->
                    if (i > 0 && !compact) {
                        Text("!", style = type.displayM, color = MishColors.Primary, modifier = Modifier.graphicsLayer { rotationZ = 8f })
                    }
                    // SPEC-GAP: no i18n key for "{count} votes" (DESIGN TV-08); the tally is a number badge on the card.
                    val votes = tally.firstOrNull { it.targetId == p.id }?.voterIds?.size ?: 0
                    val pop = remember { Animatable(if (reduce) 1f else 0f) }
                    LaunchedEffect(Unit) {
                        pop.animateTo(1f, tween(MishMotion.Base, delayMillis = 120 * i, easing = MishMotion.Overshoot))
                    }
                    run {
                        Column(
                            Modifier
                                .graphicsLayer { scaleX = pop.value; scaleY = pop.value; alpha = pop.value.coerceIn(0f, 1f) }
                                .widthIn(max = if (compact) 196.dp else 240.dp)
                                .background(MishColors.Surface, MishShapes.tile)
                                .padding(horizontal = if (compact) 20.dp else 28.dp, vertical = 18.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Box {
                                Avatar(p.color, avatar, state = AvatarState(away = !p.connected))
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
                            Text(
                                Names.ellipsize(p.name, 12),
                                style = nameStyle,
                                color = MishColors.Text,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
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
