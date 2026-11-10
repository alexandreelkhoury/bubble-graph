package app.jamaa.tv.games.likely.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.jamaa.tv.game.CuePlay
import app.jamaa.tv.games.GameScreenArgs
import app.jamaa.tv.games.likely.LikelyCardFit
import app.jamaa.tv.games.likely.LikelyChoreo
import app.jamaa.tv.games.likely.LikelyGameView
import app.jamaa.tv.games.likely.LikelyMark
import app.jamaa.tv.games.likely.LikelyMode
import app.jamaa.tv.games.likely.LikelyPhase
import app.jamaa.tv.games.likely.LikelySounds
import app.jamaa.tv.games.likely.LikelyStage
import app.jamaa.tv.games.likely.LikelyTimeline
import app.jamaa.tv.games.likely.LikelyView
import app.jamaa.tv.i18n.isolate
import app.jamaa.tv.platform.RemoteKey
import app.jamaa.tv.protocol.DeadlineKind
import app.jamaa.tv.protocol.DeadlineView
import app.jamaa.tv.ui.components.DeadlineSounds
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.LocalSounds
import app.jamaa.tv.ui.components.QrCode
import app.jamaa.tv.ui.components.RoomCode
import app.jamaa.tv.ui.components.TimerRing
import app.jamaa.tv.ui.platform.keyText
import app.jamaa.tv.ui.platform.remoteKey
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme
import app.jamaa.tv.ui.theme.PlayerSwatch
import app.jamaa.tv.ui.theme.WorldStage

/**
 * Most Likely on the TV (GAME-LIKELY §8, §12; DESIGN-JAMAA §5.3, §7.8): the rooftop stage, the card, the jury arc,
 * the conga / ballot-rain reveal, the awards ceremony and the results wall. Every timed move samples the step lists
 * of [LikelyChoreo] through the platform sampler; the reveal's clock is fitted to the server's REVEAL deadline and the
 * awards pages follow the server's AWARDS clock. Remote: there is no focusable control in game (host actions are
 * pause-menu items, GAME-LIKELY §8.2); OK completes the running animation (platform §3.10 E), Back opens the pause
 * menu (platform), INFO the ⓘ sheet (platform).
 */
@Composable
fun LikelyGameScreen(game: LikelyGameView, args: GameScreenArgs) {
    val view = game.view
    Box(Modifier.fillMaxSize()) {
        WorldStage(Rooftop)
        if (view.phase == LikelyPhase.RESULTS) {
            LikelyResults(view, args)
            return@Box
        }
        val reduce = JamaaTheme.reduceMotion
        val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
        val clock = rememberLikelyClock(view, args.clockOffsetMs, reduce, paused = args.overlayOpen)
        val awards = if (view.phase == LikelyPhase.AWARDS) rememberAwardsClock(view, args.clockOffsetMs, reduce) else null
        val sounds = LocalSounds.current
        val root = remember { FocusRequester() }
        view.deadline?.takeIf { view.phase == LikelyPhase.VOTING }?.let {
            DeadlineSounds(DeadlineView(DeadlineKind.VOTE, it, LikelyStage.votingDurationMs(view)), args.clockOffsetMs)
        }
        Box(
            Modifier
                .fillMaxSize()
                .focusRequester(root)
                .focusable()
                .onKeyEvent { e ->
                    if (e.remoteKey() != RemoteKey.OK) return@onKeyEvent false
                    if (e.type == KeyEventType.KeyDown && !args.overlayOpen) {
                        val done = awards?.complete() ?: clock.complete()
                        if (done) sounds.stopAll()
                    }
                    true // OK in game never does anything else
                },
        ) {
            RooftopBackdrop(dim = { clock.p("dim") * (if (view.phase == LikelyPhase.REVEAL) 1f else 0f) }, ambient = if (reduce) 0 else 12)
            if (awards != null) {
                LikelyAwards(view, awards, rtl, args)
            } else {
                Column(Modifier.fillMaxSize()) {
                    Header(view, args, clock)
                    LikelyStageBox(Modifier.weight(1f).fillMaxWidth()) {
                        LikelyPlayStage(view, args, clock, rtl, this)
                    }
                }
            }
        }
        InitialFocus(root, key = "likely:${view.n}")
    }
}

// ---------------------------------------------------------------- the phase clock

/**
 * The current phase's timeline on a local clock, fitted to the server's deadline ([LikelyChoreo.start]): [t] is read
 * in layer, draw and placement lambdas only, so a running animation never recomposes the screen by itself. OK sets
 * [completed]: every step jumps to its end state at once (and later marks stay silent).
 */
@Stable
internal class LikelyClock(val key: String, val timeline: LikelyTimeline?, private val startAt: Int, private val scale: Double, val reduced: Boolean) {
    val local = mutableDoubleStateOf(0.0)
    val completed = mutableStateOf(timeline == null || startAt >= timeline.totalMs)

    fun t(): Double {
        val total = timeline?.totalMs?.toDouble() ?: 0.0
        val base = startAt + local.doubleValue / scale
        return if (completed.value) maxOf(base, total) else base
    }

    /** Progress of step [id] for element [index]; a step this timeline does not have is done (1). */
    fun p(id: String, index: Int = 0): Float = LikelyChoreo.progress(timeline?.step(id), t(), index, reduced)

    /** The reveal settles when its open-ended hold starts (the caption then stays): OK has nothing left to finish. */
    private val settleMs: Int = timeline?.step("hold")?.startMs ?: timeline?.totalMs ?: 0

    /** The frame loop runs to the timeline's end (the hold's fade and the rail keep drawing). */
    fun animating(): Boolean = timeline != null && !completed.value && t() < timeline.totalMs

    /** Something OK can complete: before the hold (or the end). The first card's entrance wait counts (t < 0). */
    fun running(): Boolean = timeline != null && !completed.value && t() < settleMs

    /** The first card still waits for the platform world entrance ([LikelyChoreo.cardStart]). */
    fun waiting(): Boolean = timeline != null && !completed.value && t() < 0

    /** OK: jump to the end state. True when something was running. */
    fun complete(): Boolean {
        val was = running()
        completed.value = true
        return was
    }
}

/** The timeline of the current phase, keyed so CARD → VOTING keeps the card's deal running. */
internal fun timelineKey(view: LikelyView): String = when (view.phase) {
    LikelyPhase.CARD, LikelyPhase.VOTING -> "card:${view.n}:${view.cardIndex}:${view.card?.id}"
    LikelyPhase.REVEAL -> "reveal:${view.n}:${view.cardIndex}:${view.card?.id}"
    else -> "${view.phase}:${view.n}"
}

@Composable
internal fun rememberLikelyClock(view: LikelyView, clockOffsetMs: Long, reduced: Boolean, paused: Boolean): LikelyClock {
    val key = timelineKey(view)
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val clock = remember(key, reduced) {
        val remaining = view.deadline?.let { it - (System.currentTimeMillis() + clockOffsetMs) }
        when (view.phase) {
            // The first card waits out the platform entrance (its deadline carries ENTRANCE_GRACE_MS, GAME-LIKELY §4).
            LikelyPhase.CARD -> LikelyChoreo.cardStart(view.cardIndex, remaining).let { s ->
                LikelyClock(key, LikelyChoreo.cardDeal, s.atMs, s.scale, reduced)
            }
            // Mounted in VOTING (a reconnect): the card is already dealt.
            LikelyPhase.VOTING -> LikelyClock(key, LikelyChoreo.cardDeal, LikelyChoreo.cardDeal.totalMs, 1.0, reduced)
            LikelyPhase.REVEAL -> {
                val tl = LikelyStage.revealPlan(view, rtl)?.timeline
                val s = LikelyChoreo.start(tl?.totalMs ?: 0, remaining)
                LikelyClock(key, tl, s.atMs, s.scale, reduced)
            }
            else -> LikelyClock(key, null, 0, 1.0, reduced)
        }
    }
    val isPaused by rememberUpdatedState(paused)
    val sounds = LocalSounds.current
    LaunchedEffect(clock) {
        val tl = clock.timeline ?: return@LaunchedEffect
        var last = withFrameMillis { it }
        var prevT = clock.t() - 0.5
        while (clock.animating()) {
            val now = withFrameMillis { it }
            if (!isPaused) clock.local.doubleValue += (now - last).toDouble()
            last = now
            val t = clock.t()
            if (!clock.completed.value) playMarks(LikelyChoreo.marksBetween(tl, prevT, t)) { sounds.play(it) }
            prevT = t
        }
    }
    return clock
}

internal inline fun playMarks(marks: List<LikelyMark>, play: (CuePlay) -> Unit) {
    for (m in marks) LikelySounds.platformCue(m.cue)?.let { play(CuePlay(it, m.rate)) }
}

// ---------------------------------------------------------------- header

@Composable
private fun Header(view: LikelyView, args: GameScreenArgs, clock: LikelyClock) {
    val type = JamaaTheme.type
    // The first card's top bar stays hidden under the platform entrance, then fades in with the deal (web is-gated).
    Row(
        Modifier.fillMaxWidth().height(44.dp).graphicsLayer { alpha = if (view.phase == LikelyPhase.CARD && clock.t() < 0) 0f else 1f },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (view.phase != LikelyPhase.HOLD) {
            Text(
                keyText("game.likely.card.counter", LikelyStage.cardNumber(view).toString(), view.cardCount),
                style = type.label,
                color = Rooftop.accentText,
            )
            if (view.card?.rerun == true && view.phase != LikelyPhase.REVEAL) {
                Spacer(Modifier.width(12.dp))
                Tag(keyText("game.likely.card.rerun"), GoldHi)
            }
            if (view.mode == LikelyMode.SPICY) {
                Spacer(Modifier.width(12.dp))
                Tag(keyText("game.likely.spicy.tag"), Color(0xFFFF7A59))
            }
        }
        Spacer(Modifier.weight(1f))
        if (view.anonymous) {
            Tag(keyText("game.likely.rules.secret.title"), JamaaColors.TextSecondary)
            Spacer(Modifier.width(12.dp))
        }
        val deadline = view.deadline
        if (view.phase == LikelyPhase.VOTING && deadline != null) {
            TimerRing(
                DeadlineView(DeadlineKind.VOTE, deadline, LikelyStage.votingDurationMs(view)),
                args.clockOffsetMs,
                size = 44.dp,
                stroke = 4.dp,
                number = type.label,
                calmColor = Rooftop.accent,
            )
        } else if (view.phase == LikelyPhase.CARD) {
            // Votes are not live yet: the room sees that phones open in a moment (web `lkready`).
            ReadyChip(keyText("game.likely.card.getReady"))
        } else {
            Spacer(Modifier.size(44.dp))
        }
    }
}

/** CARD: "Voting opens in a moment", a pulsing dot in the world accent where the VOTING timer ring will sit. */
@Composable
private fun ReadyChip(text: String) {
    val pulse = rememberInfiniteTransition(label = "lk-ready")
    val a by pulse.animateFloat(0.35f, 1f, infiniteRepeatable(tween(700), RepeatMode.Reverse), label = "lk-ready-dot")
    val reduce = JamaaTheme.reduceMotion
    Row(
        Modifier
            .height(36.dp)
            .background(Rooftop.surface.copy(alpha = 0.85f), RoundedCornerShape(50))
            .border(1.5.dp, Rooftop.accent.copy(alpha = 0.6f), RoundedCornerShape(50))
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(10.dp).graphicsLayer { alpha = if (reduce) 1f else a }.background(Rooftop.accent, RoundedCornerShape(50)))
        Spacer(Modifier.width(8.dp))
        Text(text, style = JamaaTheme.type.caption, color = JamaaColors.Text, maxLines = 1)
    }
}

@Composable
internal fun Tag(text: String, ink: Color) {
    Box(
        Modifier
            .border(1.5.dp, ink.copy(alpha = 0.8f), RoundedCornerShape(50))
            .padding(horizontal = 12.dp, vertical = 3.dp),
    ) {
        Text(text, style = JamaaTheme.type.caption, color = ink, maxLines = 1)
    }
}

// ---------------------------------------------------------------- the stage box (864 × 486 dp coordinates)

/** The stage scale: stage units (TV dp of the 864 × 486 safe area) → real dp of the area the stage got. */
@Stable
internal class StageScope(val unit: Float, val rtl: Boolean) {
    fun dp(v: Double): Dp = (v * unit).dp
    fun dp(v: Float): Dp = (v * unit).dp
}

/**
 * Lays its content out in stage units under a forced LTR direction (the stage math already mirrors for RTL), scaled
 * to fit the area and centred. Text inside keeps its own bidi.
 */
@Composable
internal fun LikelyStageBox(modifier: Modifier, content: @Composable StageScope.() -> Unit) {
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    BoxWithConstraints(modifier, contentAlignment = Alignment.Center) {
        val unit = minOf(maxWidth.value / 864f, maxHeight.value / 486f)
        val scope = remember(unit, rtl) { StageScope(unit, rtl) }
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            Box(Modifier.requiredSize((864 * unit).dp, (486 * unit).dp)) { scope.content() }
        }
    }
}

// ---------------------------------------------------------------- the card (LK-TV-01 / 02)

/** The card: header, the phrase big (named player in their colour), the award line; dealt in, shrunk on REVEAL. */
@Composable
internal fun LikelyCardFace(view: LikelyView, clock: LikelyClock, stage: StageScope, modifier: Modifier = Modifier) {
    val card = view.card ?: return
    val type = JamaaTheme.type
    val named = view.player(card.namedPlayerId)
    // game.likely.card.question split around its {prompt}: the lead-in small, the prompt + the locale's closing big
    // (¿…? in es, the narrow no-break space before ? in fr, ؟ in ar). Never a hard-coded mark (web `Question`).
    val (lead, closing) = LikelyStage.questionParts(keyText("game.likely.card.question", LikelyStage.QUESTION_MARK))
    val prompt = remember(card.prompt, named?.name, named?.color, closing) {
        val span = LikelyStage.namedSpan(card.prompt, named?.name)
        buildAnnotatedString {
            if (span == null || named == null) {
                append(card.prompt)
            } else {
                append(card.prompt.substring(0, span.first))
                withStyle(SpanStyle(color = PlayerSwatch.byId(named.color).color, fontWeight = FontWeight.Black)) { append(card.prompt.substring(span)) }
                append(card.prompt.substring(span.last + 1))
            }
            append(closing)
        }
    }
    // Long prompts step the type down (web `cardSize`); if a tier still overflows the card, the next one is taken:
    // the punchline is never ellipsized.
    val tiers = listOf(type.displayS, type.headline, type.title, type.titleS)
    val arabicScale = app.jamaa.tv.ui.theme.LocalIsArabic.current
    val fitted = remember(card.prompt, closing, arabicScale) { LikelyCardFit.tier(card.prompt, closing, arabicScale) }
    var shrink by remember(card.id) { mutableIntStateOf(0) }
    val tier = (fitted + shrink).coerceAtMost(tiers.lastIndex)
    val shape = RoundedCornerShape(stage.dp(26f))
    Box(
        modifier
            .graphicsLayer {
                val deal = clock.p("deal")
                val flip = clock.p("flip")
                val up = if (view.phase == LikelyPhase.REVEAL) clock.p("dim") else 0f
                // Dealt from the golden deck at the top-end corner, flipping on Y; then (REVEAL) shrunk to the top.
                val fromX = (if (stage.rtl) -1f else 1f) * size.width * 0.9f * (1f - deal)
                translationX = fromX
                translationY = -size.height * 0.7f * (1f - deal) - size.height * 0.26f * up
                rotationY = 180f * (1f - flip).coerceIn(0f, 1f) * (if (stage.rtl) -1f else 1f)
                cameraDistance = 12f * density
                val sc = 1f - 0.4f * up
                scaleX = sc * (0.6f + 0.4f * deal.coerceAtMost(1.1f))
                scaleY = sc * (0.6f + 0.4f * deal.coerceAtMost(1.1f))
                alpha = deal.coerceIn(0f, 1f)
            }
            .background(Brush.verticalGradient(listOf(Rooftop.elevated, Rooftop.surface)), shape)
            .border(stage.dp(2.5f), goldBrush(0f, 400f), shape)
            .padding(horizontal = stage.dp(28f), vertical = stage.dp(16f)),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Text(
                lead,
                style = if (tier == 0) type.title else type.titleS,
                textAlign = TextAlign.Center,
                color = Rooftop.accentText,
                modifier = Modifier.graphicsLayer { alpha = clock.p("header") },
            )
            Spacer(Modifier.height(stage.dp(8f)))
            Text(
                prompt,
                style = tiers[tier],
                color = JamaaColors.Text,
                textAlign = TextAlign.Center,
                onTextLayout = { if (it.hasVisualOverflow && tier < tiers.lastIndex) shrink++ },
                // Measured after the header and the award line (weight): the phrase gets the card's remaining height.
                modifier = Modifier.weight(1f, fill = false).graphicsLayer {
                    val p = clock.p("phrase")
                    alpha = p.coerceIn(0f, 1f)
                    scaleX = 0.92f + 0.08f * p
                    scaleY = 0.92f + 0.08f * p
                },
            )
            Spacer(Modifier.height(stage.dp(10f)))
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.graphicsLayer { alpha = clock.p("award") }) {
                androidx.compose.foundation.Canvas(Modifier.size(stage.dp(22f))) { rosette(center, size.minDimension * 0.36f, 0f) }
                Spacer(Modifier.width(stage.dp(6f)))
                Text(card.award, style = type.label, color = Gold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

// ---------------------------------------------------------------- HOLD

@Composable
internal fun HoldPanel(view: LikelyView, args: GameScreenArgs, stage: StageScope, modifier: Modifier = Modifier) {
    val type = JamaaTheme.type
    Row(
        modifier
            .background(Rooftop.surface.copy(alpha = 0.92f), RoundedCornerShape(stage.dp(24f)))
            .border(stage.dp(2f), Rooftop.accent.copy(alpha = 0.6f), RoundedCornerShape(stage.dp(24f)))
            .padding(stage.dp(20f)),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(stage.dp(24f)),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                keyText("game.likely.hold.waiting", LikelyStage.holdCount(view)),
                style = type.headline,
                color = JamaaColors.Text,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(stage.dp(10f)))
            Text(keyText("game.likely.coach.hold"), style = type.body, color = JamaaColors.TextSecondary, textAlign = TextAlign.Center)
            Spacer(Modifier.height(stage.dp(14f)))
            RoomCode(args.room.roomCode, centered = true)
        }
        QrCode(args.room.joinUrl, panel = stage.dp(140f))
    }
}

/** A name, isolated for bidi, ellipsized. */
internal fun shortName(name: String): String = isolate(app.jamaa.tv.game.Names.ellipsize(name, 10))
