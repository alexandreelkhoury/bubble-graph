package app.jamaa.tv.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
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
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.isSpecified
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
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
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.game.Names
import app.jamaa.tv.games.mishana.MishanaLayout
import app.jamaa.tv.games.mishana.MishanaTv
import app.jamaa.tv.games.mishana.MishanaView
import app.jamaa.tv.games.mishana.player
import app.jamaa.tv.games.mishana.ui.StageText
import app.jamaa.tv.games.mishana.ui.fitHeight
import app.jamaa.tv.games.mishana.ui.noClip
import app.jamaa.tv.games.mishana.ui.stagedEnter
import app.jamaa.tv.i18n.isolate
import app.jamaa.tv.i18n.nameList
import app.jamaa.tv.protocol.ClientIntent
import app.jamaa.tv.protocol.Phase
import app.jamaa.tv.protocol.PublicPlayer
import app.jamaa.tv.protocol.VoteOutcome
import app.jamaa.tv.ui.components.ActionPill
import app.jamaa.tv.ui.components.Avatar
import app.jamaa.tv.ui.components.AvatarState
import app.jamaa.tv.ui.components.InGameScaffold
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.components.Stamp
import app.jamaa.tv.ui.components.TimerRing
import app.jamaa.tv.ui.components.TimerSeconds
import app.jamaa.tv.ui.components.fullBleed
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaMotion
import app.jamaa.tv.ui.theme.JamaaShapes
import app.jamaa.tv.ui.theme.JamaaTheme
import kotlinx.coroutines.delay

/**
 * TV-05 Clues (CLUES and TIE_BREAK), broadcast layout (v4): the speaker's avatar in the depleting timer ring on the
 * start side under a stage light, the words on the end side (rule or tie line, "Maya, your clue!", the sub-line,
 * "Up next"), the speaking-order strip at the bottom. TIE_BREAK first plays the TV-08 overlay.
 */
@Composable
fun CluesScreen(view: MishanaView, clockOffsetMs: Long, paused: Boolean, send: (ClientIntent) -> Unit) {
    val type = JamaaTheme.type
    val pill = remember { FocusRequester() }
    val speaker = view.player(view.currentSpeakerId)
    val order = view.speakingOrder.mapNotNull { view.player(it) }
    val tie = view.phase == Phase.TIE_BREAK
    val density = LocalDensity.current

    // TV-08: a 4 s tie overlay at the start of TIE_BREAK (OK skips it): long enough to read the rule from the couch.
    // Halved in reduced motion.
    val reduce = JamaaTheme.reduceMotion
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

    // Where the speaker's ring is (window coordinates): the stage light aims there. Read in draw only.
    var ringCenter by remember { mutableStateOf(Offset.Unspecified) }
    var ringRadius by remember { mutableFloatStateOf(0f) }
    val nextUp = nextSpeaker(order, view.currentSpeakerId)

    InGameScaffold(
        defaultFocus = pill,
        actionBar = {
            OrderStrip(order, view.currentSpeakerId, Modifier.weight(1f).padding(top = 8.dp))
            ActionPill(
                stringResource(R.string.clues__skip_turn),
                { send(MishanaTv.hostAdvance()) },
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
            // Stage light: a soft beam from the top of the screen onto the speaker's ring and a primary glow (14 %)
            // around it. Full-bleed canvas in window coordinates, like the ring's recorded centre.
            val beam = remember { Path() }
            Canvas(Modifier.fillMaxSize().fullBleed().clearAndSetSemantics {}) {
                val c = ringCenter
                if (!c.isSpecified || ringRadius <= 0f) return@Canvas
                val r = ringRadius
                val floor = c.y + r * 0.7f
                beam.reset()
                beam.moveTo(c.x - r * 0.3f, 0f)
                beam.lineTo(c.x + r * 0.3f, 0f)
                beam.lineTo(c.x + r * 1.2f, floor)
                beam.lineTo(c.x - r * 1.2f, floor)
                beam.close()
                drawPath(
                    beam,
                    Brush.verticalGradient(
                        0f to JamaaColors.Primary.copy(alpha = 0.02f),
                        0.75f to JamaaColors.Primary.copy(alpha = 0.08f),
                        1f to Color.Transparent,
                        startY = 0f,
                        endY = floor,
                    ),
                )
                drawCircle(
                    Brush.radialGradient(listOf(JamaaColors.Primary.copy(alpha = 0.14f), Color.Transparent), center = c, radius = r * 1.8f),
                    radius = r * 1.8f,
                    center = c,
                )
            }
            BoxWithConstraints(Modifier.fillMaxSize()) {
                // The ring takes the stage height (150–260 dp); the words take the rest of the width.
                val ring = MishanaLayout.heroRing((maxHeight - 16.dp).value).dp
                val dir = if (LocalLayoutDirection.current == LayoutDirection.Rtl) -1 else 1
                Row(Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .width(ring + 64.dp)
                            .fillMaxHeight()
                            .onGloballyPositioned {
                                ringCenter = it.boundsInWindow().center
                                ringRadius = with(density) { ring.toPx() } / 2f
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        AnimatedContent(
                            targetState = speaker,
                            contentKey = { it?.id },
                            transitionSpec = {
                                (if (reduce) {
                                    fadeIn(tween(JamaaMotion.Fast)) togetherWith fadeOut(tween(JamaaMotion.Fast))
                                } else {
                                    // The new speaker pops into the light; the last one shrinks back into the dark.
                                    (scaleIn(tween(JamaaMotion.Slow, easing = JamaaMotion.Overshoot), initialScale = 0.72f) + fadeIn(tween(JamaaMotion.Base))) togetherWith
                                        (scaleOut(tween(JamaaMotion.Base, easing = JamaaMotion.Accel), targetScale = 0.86f) + fadeOut(tween(JamaaMotion.Base)))
                                }).noClip()
                            },
                            label = "speakerRing",
                        ) { sp ->
                            if (sp != null) SpeakerRing(sp, view, clockOffsetMs, ring) else Spacer(Modifier.size(ring))
                        }
                    }
                    Spacer(Modifier.width(16.dp))
                    Column(Modifier.weight(1f).fitHeight(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        // During a tie-break the eyebrow says who tied and what happens next (the top bar already
                        // says TIE-BREAK, so no second badge).
                        if (tie) {
                            val names = nameList(view.tieCandidates.mapNotNull { view.player(it)?.name?.let { n -> Names.ellipsize(n, 16) } })
                            Eyebrow(stringResource(R.string.tie__persist, names), JamaaColors.Accent)
                        } else {
                            Eyebrow(stringResource(R.string.clues__rule), JamaaColors.TextSecondary)
                        }
                        AnimatedContent(
                            targetState = speaker,
                            contentKey = { it?.id },
                            transitionSpec = {
                                (if (reduce) {
                                    fadeIn(tween(JamaaMotion.Fast)) togetherWith fadeOut(tween(JamaaMotion.Fast))
                                } else {
                                    // The words arrive a beat after the ring, from where the order strip continues
                                    // (the end side; offsets are absolute px, so mirrored by hand in Arabic).
                                    (slideInHorizontally(tween(JamaaMotion.Slow, delayMillis = 80, easing = JamaaMotion.Decel)) { dir * it / 5 } + fadeIn(tween(JamaaMotion.Slow, delayMillis = 80))) togetherWith
                                        (slideOutHorizontally(tween(JamaaMotion.Base, easing = JamaaMotion.Accel)) { -dir * it / 5 } + fadeOut(tween(JamaaMotion.Fast)))
                                }).noClip()
                            },
                            label = "speakerWords",
                        ) { sp ->
                            if (sp != null) SpeakerWords(sp, noTimer = view.deadline == null) else Spacer(Modifier.height(1.dp))
                        }
                        AnimatedContent(
                            targetState = nextUp,
                            contentKey = { it?.id },
                            transitionSpec = { (fadeIn(tween(JamaaMotion.Slow, delayMillis = 160)) togetherWith fadeOut(tween(JamaaMotion.Fast))).noClip() },
                            label = "nextUp",
                        ) { p ->
                            if (p != null) NextUpChip(p) else Spacer(Modifier.height(1.dp))
                        }
                        val firstTurn = view.round == 1 && !tie && view.players.none { it.alive && it.spoke }
                        if (firstTurn) {
                            StageText(stringResource(R.string.clues__first_hint), type.caption, JamaaColors.TextMuted, Modifier.fillMaxWidth(), textAlign = TextAlign.Start)
                        }
                    }
                }
            }
        }
    }

    // TV-08 overlay above the stage.
    AnimatedVisibility(
        visibleState = tieVisible,
        modifier = Modifier.fullBleed(),
        enter = fadeIn(tween(JamaaMotion.Fast)),
        exit = fadeOut(tween(JamaaMotion.Slow)),
    ) {
        TieOverlay(view)
    }

    InitialFocus(pill)
}

/** The next player in this round's order who has not spoken yet, after the current speaker (null at the end). */
internal fun nextSpeaker(order: List<PublicPlayer>, currentId: String?): PublicPlayer? {
    val cur = order.indexOfFirst { it.id == currentId }
    if (cur < 0) return null
    return order.drop(cur + 1).firstOrNull { !it.spoke && !it.left }
}

/** The quiet line over the speaker's name: the rule, or who is in the tie-break. Wraps; never cut. */
@Composable
private fun Eyebrow(text: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(width = 4.dp, height = 24.dp).background(color, JamaaShapes.pill))
        Spacer(Modifier.width(12.dp))
        StageText(text, JamaaTheme.type.label, color, Modifier.fillMaxWidth(), maxLines = 2, minScale = 0.85f, textAlign = TextAlign.Start)
    }
}

/** The speaker's avatar (74 % of the ring) in the 10 dp depleting timer ring, seconds on a chip at its top end. */
@Composable
private fun SpeakerRing(sp: PublicPlayer, view: MishanaView, clockOffsetMs: Long, ring: Dp) {
    val deadline = view.deadline
    Box(Modifier.size(ring), contentAlignment = Alignment.Center) {
        if (deadline != null) {
            TimerRing(deadline, clockOffsetMs, ring, 10.dp)
        }
        Avatar(sp.color, ring * 0.74f, state = AvatarState.of(sp, speaking = sp.connected, showHost = false))
        if (deadline != null) {
            TimerSeconds(
                deadline,
                clockOffsetMs,
                Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = 14.dp, y = (-2).dp)
                    .background(JamaaColors.Bg.copy(alpha = 0.85f), JamaaShapes.pill)
                    .padding(horizontal = 10.dp),
            )
        }
    }
}

/** "Maya, your clue!" (displayM, up to 2 lines, steps down rather than cut; only the name may ellipsize) + sub-line. */
@Composable
private fun SpeakerWords(sp: PublicPlayer, noTimer: Boolean) {
    val type = JamaaTheme.type
    Column(Modifier.fillMaxWidth().semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite }) {
        StageText(
            stringResource(R.string.clues__speaking, isolate(Names.ellipsize(sp.name, 20))),
            type.displayM,
            JamaaColors.Text,
            Modifier.fillMaxWidth(),
            maxLines = 2,
            minScale = 0.62f,
            textAlign = TextAlign.Start,
        )
        Spacer(Modifier.height(4.dp))
        StageText(
            // TV wording: the speaker ends the turn on their phone (the TV is remote-only, never "tap").
            stringResource(if (noTimer) R.string.tv__clues_no_timer else R.string.tv__clues_sub),
            type.body,
            JamaaColors.TextSecondary,
            Modifier.fillMaxWidth(),
            maxLines = 2,
            minScale = 0.85f,
            textAlign = TextAlign.Start,
        )
    }
}

/** "Up next: Sami" with their avatar (`clues.upNext`): the next player gets their clue ready. */
@Composable
private fun NextUpChip(p: PublicPlayer) {
    Row(
        Modifier
            .background(JamaaColors.Surface, JamaaShapes.pill)
            .padding(start = 6.dp, end = 16.dp, top = 4.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(p.color, 30.dp, state = AvatarState(away = !p.connected))
        Spacer(Modifier.width(10.dp))
        Text(
            stringResource(R.string.clues__up_next, isolate(Names.ellipsize(p.name, 16))),
            style = JamaaTheme.type.titleS,
            color = JamaaColors.TextSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
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
                        JamaaIcons.ChevronForward,
                        contentDescription = null,
                        tint = JamaaColors.TextMuted,
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
    val scale by animateFloatAsState(if (current) 1.25f else 1f, tween(JamaaMotion.Slow, easing = JamaaMotion.Overshoot), label = "cur")
    val bar by animateFloatAsState(if (current) 1f else 0f, tween(JamaaMotion.Slow, easing = JamaaMotion.Decel), label = "bar")
    val done by animateFloatAsState(if (p.spoke && !current) 0.6f else 1f, tween(JamaaMotion.Base), label = "done")
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(STRIP_ITEM)
            .graphicsLayer { alpha = done },
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
            style = JamaaTheme.type.titleS,
            color = if (current) JamaaColors.Text else JamaaColors.TextSecondary,
            maxLines = 1,
            softWrap = false,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
            modifier = Modifier.widthIn(max = STRIP_TEXT),
        )
        Spacer(Modifier.height(4.dp))
        // The underline grows out from the centre when the turn arrives.
        Box(
            Modifier
                .width(28.dp)
                .height(4.dp)
                .graphicsLayer { scaleX = bar; alpha = bar }
                .background(JamaaColors.Primary, JamaaShapes.pill),
        )
        Spacer(Modifier.height(2.dp))
    }
}

/** "+3": players of the order outside the visible window. */
@Composable
private fun MoreCount(count: Int) {
    Box(Modifier.width(STRIP_MORE), contentAlignment = Alignment.Center) {
        Text("+$count", style = JamaaTheme.type.titleS, color = JamaaColors.TextMuted, maxLines = 1)
    }
}

/**
 * TV-08: "It's a tie!" stamp, the tied players' cards (2–4) sliding in from both sides to meet around "vs", their
 * tallies, and `tie.explain`. The column is laid out with room for the stamp's −8° tilt and scales itself to the
 * screen (never overlapping), on an opaque scrim so TV-05 never shows through the words.
 */
@Composable
private fun TieOverlay(view: MishanaView) {
    val type = JamaaTheme.type
    val tally = view.lastVote?.tally.orEmpty()
    val tied = view.tieCandidates.mapNotNull { view.player(it) }
    val reduce = JamaaTheme.reduceMotion
    // 2–3 tied: 104 dp avatars, title names, "vs" between. 4: compact cards (76 dp, titleS) without "vs", so four
    // cards always fit the 864 dp safe width.
    val compact = tied.size > 3
    val avatar = if (compact) 76.dp else 104.dp
    val nameStyle = if (compact) type.titleS else type.title
    val dir = if (LocalLayoutDirection.current == LayoutDirection.Rtl) -1f else 1f
    Box(
        Modifier
            .fillMaxSize()
            .background(JamaaColors.Bg.copy(alpha = 0.97f))
            .background(Brush.radialGradient(listOf(JamaaColors.Accent.copy(alpha = 0.10f), Color.Transparent))),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            // Full-bleed overlay: the column starts under the top bar and the HUB-06 back hint (screen y 115).
            Modifier.padding(start = 48.dp, end = 48.dp, top = 115.dp, bottom = 27.dp).fitHeight(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // The stamp's tilt reaches ~24 dp above and below its box: padding keeps it off the cards.
            Stamp(stringResource(R.string.tie__title), JamaaColors.Accent, Modifier.padding(vertical = 20.dp), style = type.displayL)
            Spacer(Modifier.height(20.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(if (compact) 20.dp else 28.dp), verticalAlignment = Alignment.CenterVertically) {
                tied.forEachIndexed { i, p ->
                    if (i > 0 && !compact) {
                        Text(
                            stringResource(R.string.tie__vs),
                            style = type.headline,
                            color = JamaaColors.Primary,
                            modifier = Modifier.stagedEnter(delayMs = 260, fromScale = 0.4f, rise = 0.dp),
                        )
                    }
                    // SPEC-GAP: no i18n key for "{count} votes" (DESIGN TV-08); the tally is a number badge on the card.
                    val votes = tally.firstOrNull { it.targetId == p.id }?.voterIds?.size ?: 0
                    // The cards slide in from the side they sit on and meet in the middle.
                    val side = if (i < tied.size / 2.0) -1f else 1f
                    val slide = remember { Animatable(if (reduce) 1f else 0f) }
                    LaunchedEffect(Unit) {
                        slide.animateTo(1f, tween(JamaaMotion.Slow, delayMillis = 60 * i, easing = JamaaMotion.Decel))
                    }
                    Column(
                        Modifier
                            .graphicsLayer {
                                translationX = side * dir * (1f - slide.value) * 160.dp.toPx()
                                alpha = slide.value
                            }
                            .widthIn(max = if (compact) 196.dp else 240.dp)
                            .background(JamaaColors.Surface, JamaaShapes.tile)
                            .padding(horizontal = if (compact) 20.dp else 28.dp, vertical = 18.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box {
                            Avatar(p.color, avatar, state = AvatarState(away = !p.connected))
                            Box(
                                Modifier
                                    .align(Alignment.TopEnd)
                                    .offset(x = 14.dp, y = (-14).dp)
                                    .stagedEnter(delayMs = 360 + 80 * i, fromScale = 0.3f, rise = 0.dp)
                                    .size(40.dp)
                                    .background(JamaaColors.Accent, CircleShape),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(votes.toString(), style = type.title, color = JamaaColors.Ink)
                            }
                        }
                        Spacer(Modifier.height(10.dp))
                        Text(
                            Names.ellipsize(p.name, 12),
                            style = nameStyle,
                            color = JamaaColors.Text,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
            StageText(
                stringResource(R.string.tie__explain),
                type.title,
                JamaaColors.TextSecondary,
                Modifier.widthIn(max = 720.dp).stagedEnter(delayMs = 420),
                maxLines = 2,
                minScale = 0.8f,
            )
        }
    }
}
