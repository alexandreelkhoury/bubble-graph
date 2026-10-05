package app.mishana.tv.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.State
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.VectorPainter
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.mishana.tv.AvatarShape
import app.mishana.tv.R
import app.mishana.tv.game.AfterElimination
import app.mishana.tv.game.Countdown
import app.mishana.tv.game.Cue
import app.mishana.tv.game.CuePlay
import app.mishana.tv.game.SoundCues
import app.mishana.tv.game.EliminationPlan
import app.mishana.tv.game.EliminationPlan.Timing
import app.mishana.tv.game.Names
import app.mishana.tv.game.afterElimination
import app.mishana.tv.i18n.isolate
import app.mishana.tv.protocol.ClientIntent
import app.mishana.tv.protocol.HostAdvance
import app.mishana.tv.protocol.PublicPlayer
import app.mishana.tv.protocol.Role
import app.mishana.tv.protocol.TvView
import app.mishana.tv.protocol.VoteOutcome
import app.mishana.tv.protocol.VoteSummary
import app.mishana.tv.protocol.player
import app.mishana.tv.ui.components.ActionPill
import app.mishana.tv.ui.components.Avatar
import app.mishana.tv.ui.components.AvatarGlyphs
import app.mishana.tv.ui.components.AvatarState
import app.mishana.tv.ui.components.InGameScaffold
import app.mishana.tv.ui.components.InitialFocus
import app.mishana.tv.ui.components.LocalSounds
import app.mishana.tv.ui.components.PlayerTile
import app.mishana.tv.ui.components.RoleCardBack
import app.mishana.tv.ui.components.RoleCardFace
import app.mishana.tv.ui.components.Stamp
import app.mishana.tv.ui.components.TimerChip
import app.mishana.tv.ui.components.fullBleed
import app.mishana.tv.ui.components.rememberSecondsLeft
import app.mishana.tv.ui.components.roleColor
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishMotion
import app.mishana.tv.ui.theme.MishShapes
import app.mishana.tv.ui.theme.MishSpace
import app.mishana.tv.ui.theme.MishTheme
import app.mishana.tv.ui.theme.PlayerSwatch
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin

private const val WASH_ALPHA = 0.34f
private const val RAYS_ALPHA = 0.07f

private val CARD_W = 192.dp
private val CARD_H = 250.dp

/** Stages of the local reveal sequence (DESIGN §6.2-B/C). */
private enum class Stage { Board, Verdict, Wheel, Card, Done }

/**
 * The reveal sequence's clocks (one Animatable per track) and stage. Animated values are read only in draw/layer
 * lambdas or through `derivedStateOf`, so the board does not recompose per frame.
 */
@Stable
private class EliminationSequence(val plan: EliminationPlan, startDone: Boolean, val role: Role?) {
    var stage by mutableStateOf(if (startDone) Stage.Done else Stage.Board)
    var skipToken by mutableIntStateOf(0)
    val arrowsMs = Animatable(0f)
    val dim = Animatable(0f)
    val wheel = Animatable(0f)
    val fly = Animatable(0f)
    val flip = Animatable(0f)
    val wash = Animatable(0f)

    /** The vote reveal is still hiding the verdict (the top bar must not give it away meanwhile). */
    val revealing: Boolean get() = stage == Stage.Board || stage == Stage.Verdict || stage == Stage.Wheel

    suspend fun snapToEnd() {
        arrowsMs.snapTo(plan.arrowsEnd.toFloat())
        dim.snapTo(1f)
        wheel.snapTo(1f)
        fly.snapTo(1f)
        flip.snapTo(180f)
        wash.snapTo(1f)
        stage = Stage.Done
    }

    /**
     * Plays B (+ wheel) + C at time scale [k], holding while [paused] (the pause menu), with its sound cues
     * (DESIGN §6.4): drumroll from the lock, a marimba tick per landing chip, the stamp, the wheel's ratchet, a
     * heartbeat on the hold, the card swish and the role's sting. A skip cancels this coroutine, so no late cue plays.
     */
    suspend fun run(k: Float, reduce: Boolean, paused: () -> Boolean, cue: (CuePlay) -> Unit) = kotlinx.coroutines.coroutineScope {
        fun d(ms: Int) = (ms * k).toInt().coerceAtLeast(1)
        suspend fun waitUnpaused() {
            if (paused()) snapshotFlow { paused() }.first { !it }
        }
        // B. vote reveal
        waitUnpaused()
        val arrowsEnd = plan.arrowsEnd
        cue(CuePlay(Cue.DRUMROLL))
        val chips = launch {
            if (reduce) {
                if (plan.flights.isNotEmpty()) cue(CuePlay(Cue.CHIP_LAND, SoundCues.chipRate(1)))
                return@launch
            }
            var at = 0L
            for (f in plan.flights.sortedBy { it.startMs }) {
                val land = ((f.startMs + Timing.FLIGHT) * k).toLong()
                delay((land - at).coerceAtLeast(0L))
                at = land
                cue(CuePlay(Cue.CHIP_LAND, SoundCues.chipRate(f.stackIndex + 1)))
            }
        }
        if (reduce) arrowsMs.snapTo(arrowsEnd.toFloat()) else arrowsMs.animateTo(arrowsEnd.toFloat(), tween(d(arrowsEnd), easing = LinearEasing))
        waitUnpaused()
        dim.animateTo(1f, tween(d(Timing.SUSPENSE)))
        chips.cancel()
        stage = Stage.Verdict
        // The thud lands with the stamp (+150 ms), not when it mounts; a skip cancels it with this scope.
        launch {
            delay(d(SoundCues.STAMP_LAND_MS.toInt()).toLong())
            cue(CuePlay(Cue.STAMP))
        }
        delay(d(Timing.VERDICT).toLong() + d(Timing.VERDICT_SETTLE).toLong())
        waitUnpaused()
        if (plan.hasWheel) {
            stage = Stage.Wheel
            cue(CuePlay(Cue.WHEEL))
            wheel.animateTo(1f, tween(d(Timing.WHEEL), easing = FastOutSlowInEasing))
            waitUnpaused()
        }
        if (!plan.hasElimination) {
            stage = Stage.Done
            return@coroutineScope
        }
        // C. card
        stage = Stage.Card
        fly.animateTo(1f, tween(d(Timing.GROW), easing = MishMotion.Decel))
        cue(CuePlay(Cue.HEARTBEAT))
        delay(d(Timing.HOLD).toLong())
        waitUnpaused()
        launch { wash.animateTo(1f, tween(d(Timing.FLIP + Timing.WASH), easing = MishMotion.Decel)) }
        cue(CuePlay(Cue.FLIP))
        if (reduce) flip.snapTo(180f) else flip.animateTo(180f, tween(d(Timing.FLIP), easing = FastOutSlowInEasing))
        role?.let { cue(CuePlay(SoundCues.roleSting(it))) }
        stage = Stage.Done
    }
}

/**
 * Where things are on screen, in root coordinates, for the chip flights and the card's flight. Plain (non-snapshot)
 * fields: they are written by layout callbacks and only read in draw/layer lambdas, so writing them never triggers
 * another recomposition.
 */
private class BoardGeometry {
    val centers = HashMap<String, Offset>()
    val tops = HashMap<String, Offset>()
    var bin = Offset.Zero
    var origin = Offset.Zero
    var card: Offset? = null

    fun record(c: LayoutCoordinates, id: String) {
        val p = c.positionInRoot()
        centers[id] = Offset(p.x + c.size.width / 2f, p.y + c.size.height / 2f)
        tops[id] = Offset(p.x + c.size.width / 2f, p.y)
    }
}

private fun LayoutCoordinates.centerInRoot(): Offset {
    val p = positionInRoot()
    return Offset(p.x + size.width / 2f, p.y + size.height / 2f)
}

/**
 * TV-07 vote reveal + TV-09 elimination card in one screen, played locally on `lastVote` and budgeted against the
 * ELIMINATION deadline (never local constants; [EliminationPlan]). OK on the pill first jumps to the end state, then
 * the pill logic applies. Variants: random pick (wheel), no elimination, the Blank's reaction. Reduced motion: no
 * flying chips, cross-fades, halved. [onRevealing] reports whether the verdict is still hidden (AppRoot's top bar).
 */
@Composable
fun EliminationScreen(
    view: TvView,
    clockOffsetMs: Long,
    paused: Boolean,
    send: (ClientIntent) -> Unit,
    onRevealing: (Boolean) -> Unit = {},
) {
    val type = MishTheme.type
    val pill = remember { FocusRequester() }
    val reduce = MishTheme.reduceMotion
    val vote = view.lastVote
    val elim = view.eliminated
    val sequenceKey = "${view.gameNumber}:${view.round}:${vote?.revote}:${elim?.playerId}"
    val plan = remember(sequenceKey) { EliminationPlan.of(vote, view.players, elim?.playerId) }
    val k = remember(sequenceKey) {
        val deadline = view.deadline
        plan.budgetFactor(deadline?.let { Countdown.remainingMs(it.at, clockOffsetMs, System.currentTimeMillis()) }, reduce)
    }
    val seq = remember(sequenceKey) { EliminationSequence(plan, startDone = k == 0f, role = elim?.role) }
    val isPaused by rememberUpdatedState(paused)
    val sounds = LocalSounds.current
    LaunchedEffect(seq, seq.skipToken) {
        if (seq.skipToken > 0 && seq.stage != Stage.Done) sounds.stopAll() // no drumroll over the end state
        if (seq.stage == Stage.Done || seq.skipToken > 0) seq.snapToEnd() else seq.run(k, reduce, { isPaused }, sounds::play)
    }
    val revealing = seq.revealing
    SideEffect { onRevealing(revealing) }

    val geometry = remember { BoardGeometry() }
    val board = view.players.filter { (it.alive || it.id == elim?.playerId) && !it.left }

    InGameScaffold(
        defaultFocus = pill,
        actionBar = {
            val deadline = view.deadline
            if (deadline != null && seq.stage == Stage.Done) {
                EndCountdown(view, deadline, clockOffsetMs, Modifier.weight(1f))
            } else {
                Text(stringResource(R.string.tv__skip_hint), style = type.caption, color = MishColors.TextMuted, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
            }
            ActionPill(
                stringResource(R.string.common__continue),
                { send(HostAdvance) },
                pill,
                onFirstPress = {
                    if (seq.stage != Stage.Done) {
                        seq.skipToken++
                        true
                    } else {
                        false
                    }
                },
            )
        },
    ) {
        Box(Modifier.fillMaxSize()) {
            val boardVisible = seq.stage == Stage.Board || seq.stage == Stage.Verdict
            val boardAlpha = animateFloatAsState(if (boardVisible) 1f else 0f, tween(MishMotion.Base), label = "boardAlpha")
            val boardShown by remember { derivedStateOf { boardAlpha.value > 0.01f } }
            if (boardShown && vote != null) {
                VoteRevealBoard(view, vote, board, seq, geometry, Modifier.graphicsLayer { alpha = boardAlpha.value })
            }
            if (seq.stage == Stage.Wheel && vote != null) {
                WheelPick(view, plan.topIds(vote), elim?.playerId, seq.wheel.asState())
            }
            val eliminatedPlayer = view.player(elim?.playerId)
            if ((seq.stage == Stage.Card || seq.stage == Stage.Done) && elim != null && eliminatedPlayer != null) {
                EliminationCard(view, eliminatedPlayer, elim.role, boardSpec(board.size).tileW.value, seq, geometry)
            }
            if (seq.stage == Stage.Done && elim == null) {
                NoEliminationEnd(vote)
            }
        }
    }
    InitialFocus(pill)
}

private fun EliminationPlan.topIds(vote: VoteSummary): List<String> {
    val maxVotes = vote.tally.maxOfOrNull { it.voterIds.size } ?: 0
    return vote.tally.filter { it.voterIds.size == maxVotes }.map { it.targetId }
}

/** "Next round in {count}…" only when a round really follows; the Blank's last chance; else just the seconds. */
@Composable
private fun EndCountdown(view: TvView, deadline: app.mishana.tv.protocol.DeadlineView, clockOffsetMs: Long, modifier: Modifier) {
    val type = MishTheme.type
    Row(modifier, horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
        when (afterElimination(view)) {
            AfterElimination.NEXT_ROUND -> {
                val secs by rememberSecondsLeft(deadline, clockOffsetMs)
                Text(stringResource(R.string.elim__next_round, secs), style = type.body, color = MishColors.TextSecondary, textAlign = TextAlign.Center)
            }
            AfterElimination.LAST_CHANCE -> {
                Text(stringResource(R.string.elim__last_chance), style = type.body, color = MishColors.Blank, textAlign = TextAlign.Center)
                Spacer(Modifier.size(MishSpace.s4))
                TimerChip(deadline, clockOffsetMs, size = 48.dp, urgent = false)
            }
            AfterElimination.OTHER -> {
                // A calm "Next in 4" (auto-advance, never red): the stage is still the celebration beat.
                val secs by rememberSecondsLeft(deadline, clockOffsetMs)
                Text(stringResource(R.string.elim__next_in, secs), style = type.body, color = MishColors.TextSecondary, textAlign = TextAlign.Center)
            }
        }
    }
}

/** TV-07: the board, the chip flights and their trails, the "No vote" bin and the verdict stamp. */
@Composable
private fun VoteRevealBoard(
    view: TvView,
    vote: VoteSummary,
    board: List<PublicPlayer>,
    seq: EliminationSequence,
    geometry: BoardGeometry,
    modifier: Modifier,
) {
    val type = MishTheme.type
    val reduce = MishTheme.reduceMotion
    val plan = seq.plan
    val spec = boardSpec(board.size)
    val topIds = remember(vote) { plan.topIds(vote) }
    Box(modifier.fillMaxSize().onGloballyPositioned { geometry.origin = it.positionInRoot() }) {
        Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                stringResource(R.string.vote__votes_in),
                style = type.displayS,
                color = MishColors.Text,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            )
            Spacer(Modifier.weight(1f))
            Column(verticalArrangement = Arrangement.spacedBy(30.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                for (row in board.chunked(spec.perRow)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(MishSpace.s4)) {
                        for (p in row) BoardTile(p, spec, plan, seq, isTop = p.id in topIds, dimmable = topIds.isNotEmpty(), unique = topIds.size == 1, geometry = geometry)
                    }
                }
            }
            Spacer(Modifier.weight(1f))
        }
        // "No vote" bin at the bottom end.
        if (vote.abstainIds.isNotEmpty()) {
            val landedBin by remember(plan) { derivedStateOf { plan.landed(null, seq.arrowsMs.value) } }
            Column(
                Modifier
                    .align(Alignment.BottomEnd)
                    .background(MishColors.Surface, MishShapes.row)
                    .padding(horizontal = MishSpace.s4, vertical = MishSpace.s2)
                    .onGloballyPositioned { geometry.bin = it.centerInRoot() },
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(stringResource(R.string.vote__no_vote), style = type.caption, color = MishColors.TextMuted)
                Text(landedBin.toString(), style = type.title, color = MishColors.TextSecondary)
            }
        }
        // Flights + trails (draw phase only). Reduced motion: no flying chips; the chips sit in their stacks (no trails).
        val painters: Map<AvatarShape, VectorPainter> = AvatarShape.entries.associateWith { rememberVectorPainter(AvatarGlyphs.of(it)) }
        val swatches = remember(plan, view.players) { plan.flights.map { f -> PlayerSwatch.byId(view.player(f.voterId)?.color ?: "coral") } }
        val trail = remember { Path() }
        Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
            val t = seq.arrowsMs.value
            val chip = 32.dp.toPx()
            plan.flights.forEachIndexed { i, f ->
                val local = (t - f.startMs) / Timing.FLIGHT
                if (local <= 0f) return@forEachIndexed
                val from = (geometry.centers[f.voterId] ?: return@forEachIndexed) - geometry.origin
                val toBase = if (f.targetId == null) geometry.bin - geometry.origin else ((geometry.tops[f.targetId] ?: return@forEachIndexed) - geometry.origin)
                val to = if (f.targetId == null) toBase else toBase + Offset(0f, -chip / 2 - 4.dp.toPx() - f.stackIndex * 10.dp.toPx())
                val bothBottom = from.y > size.height * 0.55f && to.y > size.height * 0.55f
                val mid = Offset((from.x + to.x) / 2f, (from.y + to.y) / 2f)
                val ctrl = mid + Offset(0f, if (bothBottom) 90.dp.toPx() else -90.dp.toPx())
                val eased = MishMotion.Decel.transform(local.coerceIn(0f, 1f))
                val pos = bezier(from, ctrl, to, eased)
                val swatch = swatches[i]
                // trail: fades over 600 ms after landing
                val trailAlpha = when {
                    reduce -> 0f
                    local <= 1f -> 0.8f
                    else -> (0.8f * (1f - (local - 1f) * Timing.FLIGHT / Timing.TRAIL_FADE)).coerceAtLeast(0f)
                }
                if (trailAlpha > 0f) {
                    trail.reset()
                    trail.moveTo(from.x, from.y)
                    for (s in 1..TRAIL_STEPS) {
                        val q = bezier(from, ctrl, to, eased * s / TRAIL_STEPS)
                        trail.lineTo(q.x, q.y)
                    }
                    drawPath(trail, swatch.color.copy(alpha = trailAlpha), style = Stroke(3.dp.toPx()))
                }
                drawRoundRect(swatch.color, topLeft = pos - Offset(chip / 2, chip / 2), size = Size(chip, chip), cornerRadius = CornerRadius(chip * 0.3f))
                translate(pos.x - chip * 0.31f, pos.y - chip * 0.31f) {
                    with(painters.getValue(swatch.shape)) {
                        draw(Size(chip * 0.62f, chip * 0.62f), colorFilter = ColorFilter.tint(swatch.glyph))
                    }
                }
            }
        }
        // Verdict stamp.
        if (seq.stage == Stage.Verdict || seq.stage == Stage.Wheel) {
            val stampText = when {
                vote.outcome == VoteOutcome.NO_ELIMINATION && vote.tally.isEmpty() -> stringResource(R.string.vote__nobody_voted)
                vote.outcome == VoteOutcome.NO_ELIMINATION -> stringResource(R.string.elim__no_elimination)
                vote.outcome == VoteOutcome.RANDOM -> stringResource(R.string.stamp__tie)
                else -> stringResource(R.string.stamp__out)
            }
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Stamp(stampText, if (vote.outcome == VoteOutcome.ELIMINATED) MishColors.Primary else MishColors.Accent)
            }
        }
    }
}

private const val TRAIL_STEPS = 18

/** One board tile: its tally (recomposes only when a chip lands), the suspense dim and the verdict scale (layer only). */
@Composable
private fun BoardTile(
    p: PublicPlayer,
    spec: BoardSpec,
    plan: EliminationPlan,
    seq: EliminationSequence,
    isTop: Boolean,
    dimmable: Boolean,
    unique: Boolean,
    geometry: BoardGeometry,
) {
    val landed by remember(plan, p.id) { derivedStateOf { plan.landed(p.id, seq.arrowsMs.value) } }
    // Reduced motion: no verdict scale (the stamp and the dim carry it; DESIGN §6.3 "a fade, not a shorter bounce").
    val verdictScale = animateFloatAsState(
        if (seq.stage == Stage.Verdict && isTop && unique && !MishTheme.reduceMotion) 1.15f else 1f,
        tween(Timing.VERDICT, easing = MishMotion.Overshoot),
        label = "verdict",
    )
    Box(
        Modifier
            .graphicsLayer {
                scaleX = verdictScale.value
                scaleY = verdictScale.value
                alpha = if (isTop || !dimmable) 1f else 1f - 0.65f * seq.dim.value
            }
            .onGloballyPositioned { c -> geometry.record(c, p.id) },
    ) {
        PlayerTile(p, spec.tileW, spec.tileH, spec.avatar, state = AvatarState(away = !p.connected))
        if (landed > 0) TallyBadge(landed, Modifier.align(Alignment.TopEnd).offset(x = 12.dp, y = (-12).dp))
    }
}

/** TV-09: the card flies from the tile, grows, flips to the role face; the role-colour wash; the reaction line. */
@Composable
private fun EliminationCard(
    view: TvView,
    player: PublicPlayer,
    role: Role,
    tileWidthDp: Float,
    seq: EliminationSequence,
    geometry: BoardGeometry,
) {
    val type = MishTheme.type
    val reduce = MishTheme.reduceMotion
    // Colour wash: a radial burst in the role colour that holds at full strength (34 %) — the OUT is the peak of the
    // round — plus soft stage-light rays (7 %, faded out radially). Static in reduced motion.
    val tint = roleColor(role)
    val wedge = remember { Path() }
    Canvas(Modifier.fillMaxSize().fullBleed().clearAndSetSemantics {}) {
        val w = if (reduce) 1f else seq.wash.value
        val alpha = WASH_ALPHA * (w / 0.6f).coerceAtMost(1f)
        val center = Offset(size.width / 2f, size.height * 0.42f)
        drawRect(
            Brush.radialGradient(
                colors = listOf(tint.copy(alpha = alpha), Color.Transparent),
                center = center,
                radius = max(1f, max(size.width, size.height) * (0.2f + 0.45f * w)),
            ),
        )
        // Rays: 6° wedges every 18°, masked by a radial fade (DstIn keeps them only where the mask is opaque).
        val raysCenter = Offset(size.width / 2f, size.height * 0.46f)
        val reach = max(size.width, size.height)
        drawContext.canvas.saveLayer(androidx.compose.ui.geometry.Rect(Offset.Zero, size), androidx.compose.ui.graphics.Paint())
        for (i in 0 until 20) {
            val a0 = Math.toRadians(i * 18.0 - 90.0)
            val a1 = Math.toRadians(i * 18.0 + 6.0 - 90.0)
            wedge.reset()
            wedge.moveTo(raysCenter.x, raysCenter.y)
            wedge.lineTo(raysCenter.x + reach * cos(a0).toFloat(), raysCenter.y + reach * sin(a0).toFloat())
            wedge.lineTo(raysCenter.x + reach * cos(a1).toFloat(), raysCenter.y + reach * sin(a1).toFloat())
            wedge.close()
            drawPath(wedge, tint.copy(alpha = RAYS_ALPHA * w))
        }
        drawRect(
            Brush.radialGradient(
                0.3f to Color.Black, 1f to Color.Transparent,
                center = raysCenter,
                radius = size.height * 0.6f,
            ),
            blendMode = BlendMode.DstIn,
        )
        drawContext.canvas.restore()
    }
    // The card takes what the stage leaves after the title and the reaction line (Arabic line heights included),
    // so the reaction — the payoff — is never clipped.
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val cardH = with(LocalDensity.current) {
            maxHeight - type.displayS.lineHeight.toDp() - type.headline.lineHeight.toDp() - 24.dp
        }.coerceIn(150.dp, CARD_H)
        val cardW = cardH * (CARD_W / CARD_H)
        Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
            // Who left stays visible as a colour/shape once the card shows the role: their avatar beside the name.
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Avatar(player.color, 48.dp)
                Text(
                    stringResource(R.string.elim__eliminated, isolate(Names.ellipsize(player.name, 20))),
                    style = type.displayS,
                    color = MishColors.Text,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.widthIn(max = 760.dp).semantics { liveRegion = LiveRegionMode.Polite },
                )
            }
            Spacer(Modifier.height(MishSpace.s2))
            // The card flies from the player's tile to the centre and grows (400 ms), then flips on Y (800 ms).
            val faceUp by remember { derivedStateOf { seq.flip.value >= 90f } }
            val fromScale = tileWidthDp / cardW.value
            Box(Modifier.size(cardW, cardH).onGloballyPositioned { geometry.card = it.centerInRoot() }) {
                Box(
                    Modifier
                        .fillMaxSize()
                        .graphicsLayer {
                            val f = seq.fly.value
                            val tile = geometry.centers[player.id]
                            val card = geometry.card
                            val delta = if (tile != null && card != null) tile - card else Offset.Zero
                            val sc = fromScale + (1f - fromScale) * f
                            translationX = delta.x * (1f - f)
                            translationY = delta.y * (1f - f)
                            scaleX = sc
                            scaleY = sc
                            rotationY = if (reduce) 0f else seq.flip.value
                            cameraDistance = 14f * density
                        },
                ) {
                    if (reduce) {
                        AnimatedContent(faceUp, transitionSpec = { fadeIn(tween(200)) togetherWith fadeOut(tween(200)) }, label = "flip") { up ->
                            if (up) RoleCardFace(role, roleLabel(role), Modifier.fillMaxSize(), emblemSize = 84.dp) else RoleCardBack(player.color, Modifier.fillMaxSize())
                        }
                    } else if (!faceUp) {
                        RoleCardBack(player.color, Modifier.fillMaxSize())
                    } else {
                        RoleCardFace(role, roleLabel(role), Modifier.fillMaxSize().graphicsLayer { rotationY = 180f }, emblemSize = 84.dp)
                    }
                }
            }
            Spacer(Modifier.height(MishSpace.s4))
            if (seq.stage == Stage.Done) {
                Text(
                    reaction(role, view.settings.blankGuess),
                    style = type.headline,
                    color = roleColor(role),
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    modifier = Modifier.widthIn(max = 860.dp),
                )
            }
        }
    }
}

/** No elimination: the stamp and how many did not vote. */
@Composable
private fun NoEliminationEnd(vote: VoteSummary?) {
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        val nobodyVoted = vote?.tally?.isEmpty() ?: true
        Stamp(
            stringResource(if (nobodyVoted) R.string.vote__nobody_voted else R.string.elim__no_elimination),
            MishColors.Accent,
            instant = true,
        )
        val abstained = vote?.abstainIds?.size ?: 0
        if (abstained > 0) {
            Spacer(Modifier.height(MishSpace.s6))
            Text(pluralStringResource(R.plurals.elim__abstained, abstained, abstained), style = MishTheme.type.body, color = MishColors.TextSecondary)
        }
    }
}

private fun bezier(a: Offset, c: Offset, b: Offset, t: Float): Offset {
    val u = 1f - t
    return Offset(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y)
}

@Composable
private fun TallyBadge(count: Int, modifier: Modifier) {
    Box(modifier.size(40.dp).background(MishColors.Bg, CircleShape).padding(2.dp).background(MishColors.Accent, CircleShape), contentAlignment = Alignment.Center) {
        AnimatedContent(
            targetState = count,
            transitionSpec = {
                (slideInVertically(tween(200)) { it } + fadeIn(tween(200))) togetherWith (slideOutVertically(tween(200)) { -it } + fadeOut(tween(200)))
            },
            label = "tally",
        ) { n ->
            Text(n.toString(), style = MishTheme.type.title, color = MishColors.Ink)
        }
    }
}

@Composable
private fun reaction(role: Role, blankGuess: Boolean): String = stringResource(
    when (role) {
        Role.CIVILIAN -> R.string.elim__reaction_civilian
        Role.UNDERCOVER -> R.string.elim__reaction_undercover
        Role.BLANK -> if (blankGuess) R.string.elim__reaction_blank else R.string.elim__reaction_blank_no_guess
    },
)

/**
 * Random-pick variant: the tied avatars on a 150 dp ring, a highlight decelerating onto the server's pick
 * (clockwise). Only the highlighted index is derived from [progress], so it recomposes per step, not per frame.
 */
@Composable
private fun WheelPick(view: TvView, ids: List<String>, pickId: String?, progress: State<Float>) {
    val players = ids.mapNotNull { view.player(it) }
    if (players.isEmpty()) return
    val n = players.size
    val target = players.indexOfFirst { it.id == pickId }.coerceAtLeast(0)
    val totalSteps = n * 4 + target // a few full turns, then land on the pick
    val current by remember(n, totalSteps) { derivedStateOf { ((totalSteps * progress.value).toInt()).mod(n) } }
    val titleLh = with(LocalDensity.current) { MishTheme.type.displayS.lineHeight.toDp() }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        // Radius from the space left under the title (≤ 150 dp), counting the highlighted avatar's 1.2× scale, so no
        // avatar spills over the action bar.
        val avatar = 84.dp
        val radius = ((maxHeight - titleLh - avatar * 1.2f) / 2).coerceIn(60.dp, 150.dp)
        Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(stringResource(R.string.elim__random_pick), style = MishTheme.type.displayS, color = MishColors.Accent, maxLines = 1)
            Box(Modifier.size(radius * 2 + avatar * 1.2f), contentAlignment = Alignment.Center) {
                players.forEachIndexed { i, p ->
                    val angle = -PI / 2 + 2 * PI * i / n
                    val x = (radius.value * cos(angle)).toFloat()
                    val y = (radius.value * sin(angle)).toFloat()
                    val on = i == current
                    Box(
                        Modifier
                            .offset(x = x.dp, y = y.dp)
                            .graphicsLayer {
                                val s = if (on) 1.2f else 0.9f
                                scaleX = s
                                scaleY = s
                                alpha = if (on) 1f else 0.5f
                            },
                    ) {
                        Avatar(p.color, avatar, state = AvatarState(speaking = on))
                    }
                }
            }
        }
    }
}
