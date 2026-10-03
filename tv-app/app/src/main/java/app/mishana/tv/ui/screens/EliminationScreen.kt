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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
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
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalDensity
import androidx.tv.material3.Text
import app.mishana.tv.ui.components.fullBleed
import app.mishana.tv.AvatarShape
import app.mishana.tv.R
import app.mishana.tv.game.Countdown
import app.mishana.tv.game.Names
import app.mishana.tv.i18n.isolate
import app.mishana.tv.protocol.ClientIntent
import app.mishana.tv.protocol.HostAdvance
import app.mishana.tv.protocol.PublicPlayer
import app.mishana.tv.protocol.Role
import app.mishana.tv.protocol.TvView
import app.mishana.tv.protocol.VoteOutcome
import app.mishana.tv.ui.components.ActionPill
import app.mishana.tv.ui.components.Avatar
import app.mishana.tv.ui.components.AvatarGlyphs
import app.mishana.tv.ui.components.AvatarState
import app.mishana.tv.ui.components.InitialFocus
import app.mishana.tv.ui.components.PlayerTile
import app.mishana.tv.ui.components.RoleCardBack
import app.mishana.tv.ui.components.RoleCardFace
import app.mishana.tv.ui.components.Stamp
import app.mishana.tv.ui.components.rememberFrameClock
import app.mishana.tv.ui.components.roleColor
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishMotion
import app.mishana.tv.ui.theme.MishTheme
import app.mishana.tv.ui.theme.PlayerSwatch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/** Stages of the local reveal sequence (DESIGN §6.2-B/C). */
private enum class Stage { Board, Verdict, Wheel, Card, Done }

/** Nominal durations (ms) before budget scaling. B ≤ 3 s, C ≤ 4.5 s (binding, DESIGN §6.2). */
private object Timing {
    const val LOCK = 300
    const val ARROWS_SPREAD = 1_500
    const val FLIGHT = 600
    const val SUSPENSE = 600
    const val VERDICT = 400
    const val WHEEL = 2_000
    const val GROW = 400
    const val HOLD = 600
    const val FLIP = 800
    const val WASH = 600
}

private val CARD_W = 192.dp
private val CARD_H = 250.dp

private data class Flight(val voterId: String, val targetId: String?, val startMs: Int, val stackIndex: Int)

/**
 * TV-07 vote reveal + TV-09 elimination card in one screen, played locally on `lastVote` and budgeted against the
 * ELIMINATION deadline (never local constants). OK on the pill first jumps to the end state, then the pill logic applies.
 * Variants: random pick (wheel), no elimination, the Blank's reaction. Reduced motion: no flying chips, cross-fades, halved.
 */
@Composable
fun EliminationScreen(view: TvView, clockOffsetMs: Long, paused: Boolean, send: (ClientIntent) -> Unit) {
    val type = MishTheme.type
    val pill = remember { FocusRequester() }
    val reduce = MishTheme.reduceMotion
    val vote = view.lastVote
    val elim = view.eliminated
    val eliminatedPlayer = view.player(elim?.playerId)
    val board = view.players.filter { (it.alive || it.id == elim?.playerId) && !it.left }
    val spec = boardSpec(board.size)

    // Flights: in seat order, voter → target; abstentions → the "No vote" bin.
    val flights = remember(vote) {
        if (vote == null) {
            emptyList()
        } else {
            val byVoter = mutableListOf<Pair<String, String?>>()
            for (t in vote.tally) for (v in t.voterIds) byVoter += v to t.targetId
            for (a in vote.abstainIds) byVoter += a to null
            val seat = view.players.associate { it.id to it.seat }
            val ordered = byVoter.sortedBy { seat[it.first] ?: Int.MAX_VALUE }
            val n = ordered.size.coerceAtLeast(1)
            val stackCount = mutableMapOf<String?, Int>()
            ordered.mapIndexed { i, (v, t) ->
                val idx = stackCount.getOrDefault(t, 0)
                stackCount[t] = idx + 1
                Flight(v, t, Timing.LOCK + i * Timing.ARROWS_SPREAD / n, idx)
            }
        }
    }
    val maxVotes = vote?.tally?.maxOfOrNull { it.voterIds.size } ?: 0
    val topIds = vote?.tally?.filter { it.voterIds.size == maxVotes }?.map { it.targetId }.orEmpty()

    // ---- budget: everything must end ≥ 0.5 s before the deadline ----
    val sequenceKey = "${view.gameNumber}:${view.round}:${vote?.revote}:${elim?.playerId}"
    val nominal = run {
        val b = Timing.LOCK + Timing.ARROWS_SPREAD + Timing.FLIGHT + Timing.SUSPENSE + Timing.VERDICT
        val wheel = if (vote?.outcome == VoteOutcome.RANDOM) Timing.WHEEL else 0
        val c = if (elim != null) Timing.GROW + Timing.HOLD + Timing.FLIP + Timing.WASH else 600
        (b + wheel + c).toFloat()
    }
    val k = remember(sequenceKey) {
        val deadline = view.deadline
        val available = if (deadline == null) 8_000L else Countdown.remainingMs(deadline.at, clockOffsetMs, System.currentTimeMillis())
        val base = if (reduce) 0.5f else 1f
        if (available < 1_500) 0f else min(base, (available - 500) / nominal)
    }

    var stage by remember(sequenceKey) { mutableStateOf(if (k == 0f) Stage.Done else Stage.Board) }
    val arrowsMs = remember(sequenceKey) { Animatable(0f) }
    val dim = remember(sequenceKey) { Animatable(0f) }
    val wheel = remember(sequenceKey) { Animatable(0f) }
    val fly = remember(sequenceKey) { Animatable(0f) }
    val flip = remember(sequenceKey) { Animatable(0f) }
    val wash = remember(sequenceKey) { Animatable(0f) }
    val isPaused by rememberUpdatedState(paused)
    var skipToken by remember(sequenceKey) { mutableStateOf(0) }
    val arrowsEnd = (flights.maxOfOrNull { it.startMs } ?: Timing.LOCK) + Timing.FLIGHT

    suspend fun waitUnpaused() {
        if (isPaused) snapshotFlow { isPaused }.first { !it }
    }

    suspend fun snapToEnd() {
        arrowsMs.snapTo(arrowsEnd.toFloat())
        dim.snapTo(1f)
        wheel.snapTo(1f)
        fly.snapTo(1f)
        flip.snapTo(180f)
        wash.snapTo(1f)
        stage = Stage.Done
    }

    LaunchedEffect(sequenceKey, skipToken) {
        if (stage == Stage.Done || skipToken > 0) {
            snapToEnd()
            return@LaunchedEffect
        }
        fun d(ms: Int) = (ms * k).toInt().coerceAtLeast(1)
        // B. vote reveal
        waitUnpaused()
        if (reduce) {
            arrowsMs.snapTo(arrowsEnd.toFloat())
        } else {
            arrowsMs.animateTo(arrowsEnd.toFloat(), tween(d(arrowsEnd), easing = LinearEasing))
        }
        waitUnpaused()
        dim.animateTo(1f, tween(d(Timing.SUSPENSE)))
        stage = Stage.Verdict
        kotlinx.coroutines.delay(d(Timing.VERDICT).toLong() + d(250).toLong())
        waitUnpaused()
        if (vote?.outcome == VoteOutcome.RANDOM) {
            stage = Stage.Wheel
            wheel.animateTo(1f, tween(d(Timing.WHEEL), easing = FastOutSlowInEasing))
            waitUnpaused()
        }
        if (elim == null) {
            stage = Stage.Done
            return@LaunchedEffect
        }
        // C. card
        stage = Stage.Card
        fly.animateTo(1f, tween(d(Timing.GROW), easing = MishMotion.Decel))
        kotlinx.coroutines.delay(d(Timing.HOLD).toLong())
        waitUnpaused()
        launch { wash.animateTo(1f, tween(d(Timing.FLIP + Timing.WASH), easing = MishMotion.Decel)) }
        if (reduce) {
            flip.snapTo(180f)
        } else {
            flip.animateTo(180f, tween(d(Timing.FLIP), easing = FastOutSlowInEasing))
        }
        stage = Stage.Done
    }

    // Tile centres (root coordinates) for the flights.
    val centers = remember { mutableStateMapOf<String, Offset>() }
    val tileTops = remember { mutableStateMapOf<String, Offset>() }
    var binCenter by remember { mutableStateOf(Offset.Zero) }
    var boardOrigin by remember { mutableStateOf(Offset.Zero) }
    val painters: Map<AvatarShape, VectorPainter> = AvatarShape.entries.associateWith { rememberVectorPainter(AvatarGlyphs.of(it)) }

    val now by rememberFrameClock()

    InGameScaffold(
        defaultFocus = pill,
        actionBar = {
            val deadline = view.deadline
            if (deadline != null && stage == Stage.Done) {
                val secs = Countdown.remainingSeconds(deadline.at, clockOffsetMs, now)
                Text(
                    stringResource(R.string.elim__next_round, secs),
                    style = type.body,
                    color = MishColors.TextSecondary,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                )
            } else {
                Text(stringResource(R.string.tv__skip_hint), style = type.caption, color = MishColors.TextMuted, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
            }
            ActionPill(
                stringResource(R.string.common__continue),
                { send(HostAdvance) },
                pill,
                onFirstPress = {
                    if (stage != Stage.Done) {
                        skipToken++
                        true
                    } else {
                        false
                    }
                },
            )
        },
    ) {
        Box(Modifier.fillMaxSize()) {

            // ---------- board (TV-07) ----------
            val boardVisible = stage == Stage.Board || stage == Stage.Verdict
            val boardAlpha by animateFloatAsState(if (boardVisible) 1f else 0f, tween(MishMotion.Base), label = "boardAlpha")
            if (boardAlpha > 0.01f) {
                Box(
                    Modifier
                        .fillMaxSize()
                        .alpha(boardAlpha)
                        .onGloballyPositioned { boardOrigin = it.positionInRoot() },
                ) {
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
                                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                    for (p in row) {
                                        val landed = flights.count { it.targetId == p.id && arrowsMs.value >= it.startMs + Timing.FLIGHT }
                                        val isTop = p.id in topIds
                                        val tileAlpha = if (isTop || topIds.isEmpty()) 1f else 1f - 0.65f * dim.value
                                        val verdictScale by animateFloatAsState(
                                            if (stage == Stage.Verdict && isTop && topIds.size == 1) 1.15f else 1f,
                                            tween(Timing.VERDICT, easing = MishMotion.Overshoot),
                                            label = "verdict",
                                        )
                                        Box(
                                            Modifier
                                                .graphicsLayer { scaleX = verdictScale; scaleY = verdictScale }
                                                .alpha(tileAlpha)
                                                .onGloballyPositioned { c -> record(c, p.id, centers, tileTops) },
                                        ) {
                                            PlayerTile(p, spec.tileW, spec.tileH, spec.avatar, state = AvatarState(away = !p.connected))
                                            if (landed > 0) TallyBadge(landed, Modifier.align(Alignment.TopEnd).offset(x = 12.dp, y = (-12).dp))
                                        }
                                    }
                                }
                            }
                        }
                        Spacer(Modifier.weight(1f))
                    }
                    // "No vote" bin at the bottom end.
                    val abstained = vote?.abstainIds?.size ?: 0
                    if (abstained > 0) {
                        val landedBin = flights.count { it.targetId == null && arrowsMs.value >= it.startMs + Timing.FLIGHT }
                        Column(
                            Modifier
                                .align(Alignment.BottomEnd)
                                .background(MishColors.Surface, RoundedCornerShape(16.dp))
                                .padding(horizontal = 16.dp, vertical = 8.dp)
                                .onGloballyPositioned { c ->
                                    val p = c.positionInRoot()
                                    binCenter = Offset(p.x + c.size.width / 2f, p.y + c.size.height / 2f)
                                },
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text(stringResource(R.string.vote__no_vote), style = type.caption, color = MishColors.TextMuted)
                            Text(landedBin.toString(), style = type.title, color = MishColors.TextSecondary)
                        }
                    }
                    // Flights + trails. Reduced motion: no flying chips; the chips sit in their stacks (no trails).
                    run {
                        Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
                            val t = arrowsMs.value
                            val chip = 32.dp.toPx()
                            for (f in flights) {
                                val local = (t - f.startMs) / Timing.FLIGHT
                                if (local <= 0f) continue
                                val from = (centers[f.voterId] ?: continue) - boardOrigin
                                val toBase = if (f.targetId == null) binCenter - boardOrigin else ((tileTops[f.targetId] ?: continue) - boardOrigin)
                                val to = if (f.targetId == null) toBase else toBase + Offset(0f, -chip / 2 - 4.dp.toPx() - f.stackIndex * 10.dp.toPx())
                                val bothBottom = from.y > size.height * 0.55f && to.y > size.height * 0.55f
                                val mid = Offset((from.x + to.x) / 2f, (from.y + to.y) / 2f)
                                val ctrl = mid + Offset(0f, if (bothBottom) 90.dp.toPx() else -90.dp.toPx())
                                val p = local.coerceIn(0f, 1f)
                                val eased = MishMotion.Decel.transform(p)
                                val pos = bezier(from, ctrl, to, eased)
                                val voter = view.player(f.voterId)
                                val swatch = PlayerSwatch.byId(voter?.color ?: "coral")
                                // trail: fades over 600 ms after landing
                                val trailAlpha = when {
                                    reduce -> 0f
                                    local <= 1f -> 0.8f
                                    else -> (0.8f * (1f - (local - 1f) * Timing.FLIGHT / 600f)).coerceAtLeast(0f)
                                }
                                if (trailAlpha > 0f) {
                                    val path = Path().apply {
                                        moveTo(from.x, from.y)
                                        val steps = 18
                                        for (s in 1..steps) {
                                            val q = bezier(from, ctrl, to, eased * s / steps)
                                            lineTo(q.x, q.y)
                                        }
                                    }
                                    drawPath(path, swatch.color.copy(alpha = trailAlpha), style = Stroke(3.dp.toPx()))
                                }
                                // chip
                                drawRoundRect(swatch.color, topLeft = pos - Offset(chip / 2, chip / 2), size = Size(chip, chip), cornerRadius = androidx.compose.ui.geometry.CornerRadius(chip * 0.3f))
                                translate(pos.x - chip * 0.31f, pos.y - chip * 0.31f) {
                                    with(painters.getValue(swatch.shape)) {
                                        draw(Size(chip * 0.62f, chip * 0.62f), colorFilter = ColorFilter.tint(swatch.glyph))
                                    }
                                }
                            }
                        }
                    }
                    // Verdict stamp.
                    if (stage == Stage.Verdict || (stage == Stage.Wheel)) {
                        val outcome = vote?.outcome
                        val stampText = when {
                            outcome == VoteOutcome.NO_ELIMINATION && vote.tally.isEmpty() -> stringResource(R.string.vote__nobody_voted)
                            outcome == VoteOutcome.NO_ELIMINATION -> stringResource(R.string.elim__no_elimination)
                            outcome == VoteOutcome.RANDOM -> stringResource(R.string.stamp__tie)
                            else -> stringResource(R.string.stamp__out)
                        }
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Stamp(stampText, if (outcome == VoteOutcome.ELIMINATED) MishColors.Primary else MishColors.Accent)
                        }
                    }
                }
            }

            // ---------- wheel (random pick variant) ----------
            if (stage == Stage.Wheel && vote != null) {
                WheelPick(view, topIds, elim?.playerId, wheel.value)
            }

            // ---------- card (TV-09) ----------
            if ((stage == Stage.Card || stage == Stage.Done) && elim != null && eliminatedPlayer != null) {
                val role = elim.role
                // Colour wash: radial burst in the role colour (30 %) settling to 8 %; bleeds to the screen edges.
                Canvas(Modifier.fillMaxSize().fullBleed().clearAndSetSemantics {}) {
                    val w = wash.value
                    val alpha = if (reduce) 0.08f else if (w < 0.6f) 0.30f * (w / 0.6f) else 0.30f - (0.22f * ((w - 0.6f) / 0.4f))
                    drawRect(
                        Brush.radialGradient(
                            colors = listOf(roleColor(role).copy(alpha = alpha), Color.Transparent),
                            center = Offset(size.width / 2f, size.height / 2f),
                            radius = max(1f, max(size.width, size.height) * (0.25f + 0.75f * w)),
                        ),
                    )
                }
                // The card takes what the stage leaves after the title and the reaction line (Arabic line heights
                // included), so the reaction — the payoff — is never clipped.
                BoxWithConstraints(Modifier.fillMaxSize()) {
                val cardH = with(LocalDensity.current) {
                    maxHeight - type.displayS.lineHeight.toDp() - type.headline.lineHeight.toDp() - 24.dp
                }.coerceIn(150.dp, CARD_H)
                val cardW = cardH * (CARD_W / CARD_H)
                Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        stringResource(R.string.elim__eliminated, isolate(Names.ellipsize(eliminatedPlayer.name, 20))),
                        style = type.displayS,
                        color = MishColors.Text,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.widthIn(max = 820.dp).semantics { liveRegion = LiveRegionMode.Polite },
                    )
                    Spacer(Modifier.height(8.dp))
                    // The card flies from the player's tile to the centre and grows (400 ms), then flips on Y (800 ms).
                    var cardCenter by remember { mutableStateOf<Offset?>(null) }
                    val tileCenter = centers[elim.playerId]
                    val f = fly.value
                    val fromScale = spec.tileW.value / cardW.value
                    val delta = if (tileCenter != null && cardCenter != null) tileCenter - cardCenter!! else Offset.Zero
                    val sc = fromScale + (1f - fromScale) * f
                    val rot = flip.value
                    Box(
                        Modifier
                            .size(cardW, cardH)
                            .onGloballyPositioned { c ->
                                val p = c.positionInRoot()
                                cardCenter = Offset(p.x + c.size.width / 2f, p.y + c.size.height / 2f)
                            },
                    ) {
                        Box(
                            Modifier
                                .fillMaxSize()
                                .graphicsLayer {
                                    translationX = delta.x * (1f - f)
                                    translationY = delta.y * (1f - f)
                                    scaleX = sc
                                    scaleY = sc
                                    rotationY = if (reduce) 0f else rot
                                    cameraDistance = 14f * this.density
                                },
                        ) {
                            if (reduce) {
                                AnimatedContent(rot >= 90f, transitionSpec = { fadeIn(tween(200)) togetherWith fadeOut(tween(200)) }, label = "flip") { up ->
                                    if (up) {
                                        RoleCardFace(role, roleLabel(role), Modifier.fillMaxSize(), emblemSize = 84.dp)
                                    } else {
                                        RoleCardBack(eliminatedPlayer.color, Modifier.fillMaxSize())
                                    }
                                }
                            } else if (rot < 90f) {
                                RoleCardBack(eliminatedPlayer.color, Modifier.fillMaxSize())
                            } else {
                                RoleCardFace(role, roleLabel(role), Modifier.fillMaxSize().graphicsLayer { rotationY = 180f }, emblemSize = 84.dp)
                            }
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                    if (stage == Stage.Done) {
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

            // ---------- no-elimination end state ----------
            if (stage == Stage.Done && elim == null) {
                Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    val nobodyVoted = vote?.tally?.isEmpty() ?: true
                    Stamp(
                        stringResource(if (nobodyVoted) R.string.vote__nobody_voted else R.string.elim__no_elimination),
                        MishColors.Accent,
                        instant = true,
                    )
                    val abstained = vote?.abstainIds?.size ?: 0
                    if (abstained > 0) {
                        Spacer(Modifier.height(24.dp))
                        Text(pluralStringResource(R.plurals.elim__abstained, abstained, abstained), style = type.body, color = MishColors.TextSecondary)
                    }
                }
            }
        }
    }
    InitialFocus(pill)
}

private fun record(c: LayoutCoordinates, id: String, centers: MutableMap<String, Offset>, tops: MutableMap<String, Offset>) {
    val p = c.positionInRoot()
    centers[id] = Offset(p.x + c.size.width / 2f, p.y + c.size.height / 2f)
    tops[id] = Offset(p.x + c.size.width / 2f, p.y)
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

/** Random-pick variant: the tied avatars on a 150 dp ring, a highlight decelerating onto the server's pick (clockwise). */
@Composable
private fun WheelPick(view: TvView, ids: List<String>, pickId: String?, progress: Float) {
    val players = ids.mapNotNull { view.player(it) }
    if (players.isEmpty()) return
    val n = players.size
    val target = players.indexOfFirst { it.id == pickId }.coerceAtLeast(0)
    val totalSteps = n * 4 + target // a few full turns, then land on the pick
    val current = ((totalSteps * progress).toInt()).mod(n)
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
