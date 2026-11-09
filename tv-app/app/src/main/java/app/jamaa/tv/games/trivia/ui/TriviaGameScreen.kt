package app.jamaa.tv.games.trivia.ui

import androidx.compose.animation.core.animateFloat
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
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
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.AbsoluteAlignment
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.jamaa.tv.game.CuePlay
import app.jamaa.tv.game.Names
import app.jamaa.tv.games.GameScreenArgs
import app.jamaa.tv.games.trivia.TriviaBoard
import app.jamaa.tv.games.trivia.TriviaCues
import app.jamaa.tv.games.trivia.TriviaGameView
import app.jamaa.tv.games.trivia.TriviaInput
import app.jamaa.tv.games.trivia.TriviaMoments
import app.jamaa.tv.games.trivia.TriviaPhase
import app.jamaa.tv.games.trivia.TriviaPlayer
import app.jamaa.tv.games.trivia.TriviaView
import app.jamaa.tv.platform.CharacterRules
import app.jamaa.tv.platform.Moment
import app.jamaa.tv.platform.RemoteKey
import app.jamaa.tv.protocol.member
import app.jamaa.tv.ui.characters.Character
import app.jamaa.tv.ui.components.Avatar
import app.jamaa.tv.ui.components.AvatarState
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.components.LocalSounds
import app.jamaa.tv.ui.platform.keyText
import app.jamaa.tv.ui.platform.remoteKey
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme
import app.jamaa.tv.ui.theme.PlayerSwatch
import app.jamaa.tv.ui.theme.WorldStage
import kotlin.math.roundToInt

/**
 * Quiz Night on the TV (GAME-TRIVIA §8.3, §12; DESIGN-JAMAA §5.4, §7.9): the studio stage, the question card with the
 * bulb ring, the never-mirrored answer grid, the podium row of characters, the leaderboard tower, the reveal
 * choreography (jump-on, fastest finger, points flight, re-sort), the leaderboard race, the final question and the
 * podium. Every timed move samples [TriviaMoments] through the platform sampler on the server clock; nothing here
 * sends an intent except the results buttons (host actions are pause-menu items). Remote: no focusable control in
 * game; OK completes the running moment (platform §3.10 E).
 */
@Composable
fun TriviaGameScreen(game: TriviaGameView, args: GameScreenArgs) {
    val view = game.view
    val reduce = JamaaTheme.reduceMotion
    val clock = rememberPhaseClock(view, args.clockOffsetMs, reduce)
    TriviaSounds(view, clock, args.clockOffsetMs)

    Box(Modifier.fillMaxSize()) {
        WorldStage(Studio)
        StudioLights(view, clock)
        if (view.phase == TriviaPhase.RESULTS) {
            TriviaResults(view, clock, args)
            return@Box
        }
        val positions = remember { StagePositions() }
        val root = remember { FocusRequester() }
        val sounds = LocalSounds.current
        Box(
            Modifier
                .fillMaxSize()
                .focusRequester(root)
                .focusable()
                .onKeyEvent { e ->
                    if (e.remoteKey() != RemoteKey.OK) return@onKeyEvent false
                    if (e.type == KeyEventType.KeyDown && !args.overlayOpen &&
                        TriviaInput.okCompletes(clock.t(), clock.moment, clock.completed.value)
                    ) {
                        clock.complete(System.currentTimeMillis())
                        sounds.stopAll()
                    }
                    true // OK in game never does anything else (no host action on screen, GAME-TRIVIA §6)
                }
                .onGloballyPositioned {
                    positions.origin.value = it.positionInRoot()
                    positions.height.value = it.size.height.toFloat()
                },
        ) {
            val full = view.phase == TriviaPhase.LEADERBOARD
            Column(Modifier.fillMaxSize()) {
                Header(view)
                Row(Modifier.weight(1f).fillMaxWidth()) {
                    Box(Modifier.weight(1f).fillMaxHeight()) {
                        when (view.phase) {
                            TriviaPhase.QUIZ_INTRO -> QuizIntroCard(view, clock, Modifier.align(Alignment.Center))
                            TriviaPhase.READ, TriviaPhase.ANSWER, TriviaPhase.REVEAL -> QuestionStage(view, clock, args.clockOffsetMs, positions)
                            TriviaPhase.LEADERBOARD -> LeaderboardRace(view, clock, Modifier.fillMaxSize())
                            TriviaPhase.FINAL_INTRO -> FinalIntro(clock, Modifier.fillMaxSize())
                            TriviaPhase.HOLD -> HoldCard(Modifier.align(Alignment.Center))
                            TriviaPhase.RESULTS -> Unit
                        }
                    }
                    if (view.phase in TOWER_PHASES) {
                        Spacer(Modifier.width(16.dp))
                        Tower(view, clock, positions, Modifier.width(196.dp).fillMaxHeight())
                    }
                }
                if (!full) PodiumRow(view, args, clock, positions, Modifier.fillMaxWidth().height(PODIUM_ROW_DP.dp))
            }
            if (view.phase == TriviaPhase.REVEAL) RevealOverlay(view, clock, positions)
        }
        InitialFocus(root, key = "trivia:${view.n}")
    }
}

private val TOWER_PHASES = setOf(TriviaPhase.READ, TriviaPhase.ANSWER, TriviaPhase.REVEAL)
private const val PODIUM_ROW_DP = 104
private const val PODIUM_CHAR_DP = 56
internal const val TILE_CHAR_DP = 40

// ---------------------------------------------------------------- the phase clock

/**
 * The current phase's moment on the server clock (TriviaMoments.elapsed): [t] and [p] are read in layer, draw and
 * placement lambdas only, so a running moment never recomposes the screen by itself. OK sets [completed]: every step
 * jumps to its end state at once.
 */
@Stable
internal class PhaseClock(val key: String, val moment: Moment) {
    val elapsed = mutableLongStateOf(0L)
    val completed = mutableStateOf(false)
    var startedAtLocal: Long = System.currentTimeMillis()
    var completedAtLocal: Long? = null

    fun t(): Long = if (completed.value) maxOf(elapsed.longValue, moment.totalMs) else elapsed.longValue

    /** Progress of step [id] (element [index]); a step this variant dropped (calm motion, no data) is done (1). */
    fun p(id: String, index: Int = 0): Float = moment.step(id)?.progress(t(), index) ?: 1f

    fun complete(nowLocal: Long) {
        if (completed.value) return
        completed.value = true
        completedAtLocal = nowLocal
    }
}

@Composable
internal fun rememberPhaseClock(view: TriviaView, clockOffsetMs: Long, reduced: Boolean): PhaseClock {
    val key = TriviaMoments.key(view)
    val clock = remember(key, reduced) { PhaseClock(key, TriviaMoments.of(view, reduced)) }
    val current by rememberUpdatedState(view)
    val offset by rememberUpdatedState(clockOffsetMs)
    val shownAt = remember(key) { System.currentTimeMillis() + clockOffsetMs }
    LaunchedEffect(clock) {
        clock.startedAtLocal = System.currentTimeMillis()
        while (true) {
            withFrameMillis { }
            val serverNow = System.currentTimeMillis() + offset
            val v = current
            clock.elapsed.longValue = TriviaMoments.elapsed(v, serverNow, shownAt)
            // Frames are needed while the moment runs, while a deadline drives the bulbs or the bar, and to page the tower.
            val ticking = v.deadline?.let { serverNow < it + 500 } ?: false
            if (clock.t() >= clock.moment.totalMs && !ticking && v.players.size <= TriviaBoard.TOWER_ROWS) break
        }
    }
    return clock
}

/** Sound cues: the phase entry (timed to its moment), answer locks, and the last-5-s ticks of ANSWER. */
@Composable
private fun TriviaSounds(view: TriviaView, clock: PhaseClock, clockOffsetMs: Long) {
    val sounds = LocalSounds.current
    val last = remember { arrayOfNulls<TriviaView>(1) }
    LaunchedEffect(view) {
        val before = last[0]
        last[0] = view
        val sinceStart = TriviaMoments.elapsed(view, System.currentTimeMillis() + clockOffsetMs, System.currentTimeMillis() + clockOffsetMs)
        // A TV that reconnects in the middle of a phase stays quiet until the next one.
        val fresh = sinceStart < 1_500 || view.deadline == null
        for (c in TriviaCues.transition(before, view, fresh)) sounds.play(c)
    }
    val offset by rememberUpdatedState(clockOffsetMs)
    LaunchedEffect(clock.key) {
        val d = view.deadline ?: return@LaunchedEffect
        if (view.phase != TriviaPhase.ANSWER) return@LaunchedEffect
        var prev: Long? = null
        while (true) {
            val rem = (d - (System.currentTimeMillis() + offset)).coerceAtLeast(0L)
            TriviaCues.tick(prev, rem)?.let { sounds.play(CuePlay(it)) }
            if (rem <= 0L) break
            prev = rem
            withFrameMillis { }
        }
    }
}

// ---------------------------------------------------------------- stage positions (root px) for jumps and coins

@Stable
internal class StagePositions {
    val origin = mutableStateOf(Offset.Zero)

    /** The stage height (px): the coin arc bends down when both ends are in its top half. */
    val height = mutableStateOf(1_000f)

    /** Feet point of each player's podium character. */
    val podium = mutableStateMapOf<String, Offset>()

    /** Tile rectangles (top-left, size) by displayed position. */
    val tiles = mutableStateMapOf<Int, Pair<Offset, androidx.compose.ui.geometry.Size>>()

    /** Score badge of each player's tower row. */
    val tower = mutableStateMapOf<String, Offset>()
}

/** Fades and lifts an element in with a progress lambda (read in the layer: no recomposition). */
internal fun Modifier.layerAppear(lift: Float = 8f, p: () -> Float): Modifier = this.graphicsLayer {
    val v = p()
    alpha = v.coerceIn(0f, 1f)
    translationY = (1f - v.coerceIn(0f, 1f)) * lift * density
}

// ---------------------------------------------------------------- studio lights

/**
 * The studio around the stage: a bulb arch across the top that chases while a moment runs, two spotlight cones
 * that cross at the centre, red-amber in FINAL_INTRO (DESIGN-JAMAA §5.4 "Final"). Lite/calm motion keep it still.
 */
@Composable
private fun StudioLights(view: TriviaView, clock: PhaseClock) {
    val final = view.phase == TriviaPhase.FINAL_INTRO || (view.isFinal && view.phase != TriviaPhase.RESULTS)
    val reduce = JamaaTheme.reduceMotion
    Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
        val shift = if (final) clock.p("lights").let { if (view.phase == TriviaPhase.FINAL_INTRO) it else 1f } else 0f
        val cone = lerpColor(Studio.glow, Flame, shift).copy(alpha = 0.10f + 0.06f * shift)
        val w = size.width
        val h = size.height
        val sweep = if (view.phase == TriviaPhase.QUIZ_INTRO) clock.p("lights") else 1f
        for (side in 0..1) {
            val x0 = if (side == 0) w * 0.08f else w * 0.92f
            val x1 = if (side == 0) w * (0.35f + 0.25f * sweep) else w * (0.65f - 0.25f * sweep)
            val path = androidx.compose.ui.graphics.Path().apply {
                moveTo(x0, -10f)
                lineTo(x1 - w * 0.12f, h)
                lineTo(x1 + w * 0.12f, h)
                close()
            }
            drawPath(path, Brush.verticalGradient(listOf(cone, Color.Transparent), startY = 0f, endY = h))
        }
        // The bulb arch: 24 bulbs; a chase runs while the moment plays (still in calm motion).
        val n = 24
        val chase = if (reduce) -1 else ((clock.t() / 90L) % n).toInt()
        for (i in 0 until n) {
            val x = w * (0.1f + 0.8f * i / (n - 1))
            val y = 6.dp.toPx() + kotlin.math.sin(Math.PI * i / (n - 1)).toFloat() * -2f
            val lit = chase < 0 || (i + chase) % 4 != 0
            val bulb = lerpColor(Studio.glow, Flame, shift)
            drawCircle(bulb.copy(alpha = if (lit) 0.9f else 0.25f), 3.dp.toPx(), Offset(x, y))
        }
    }
}

internal fun lerpColor(a: Color, b: Color, t: Float): Color = androidx.compose.ui.graphics.lerp(a, b, t.coerceIn(0f, 1f))

// ---------------------------------------------------------------- header

@Composable
private fun Header(view: TriviaView) {
    Row(Modifier.fillMaxWidth().height(40.dp).padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        val q = view.question
        if (view.phase in TOWER_PHASES && q != null) {
            Text(
                keyText("game.trivia.read.questionOf", view.number.toString(), view.total.toString()).uppercase(),
                style = JamaaTheme.type.label,
                color = Studio.accentText,
                maxLines = 1,
            )
            TopicChip(keyText(TriviaBoard.topicKey(q.topic)))
        } else {
            Text(app.jamaa.tv.ui.screens.localizedTitle(view.quiz.title), style = JamaaTheme.type.label, color = JamaaColors.TextSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (view.isFinal && view.phase != TriviaPhase.RESULTS) {
            Text(
                keyText("game.trivia.final.stamp"),
                style = JamaaTheme.type.label,
                color = Ink,
                modifier = Modifier.background(JamaaColors.Accent, RoundedCornerShape(50)).padding(horizontal = 10.dp),
            )
        }
    }
}

// ---------------------------------------------------------------- podium row

/**
 * Characters behind their podiums with name plates (DESIGN-JAMAA §4.5 `podium`): the front light ring turns white
 * when the player has answered (no colour, no shape, no position: nothing hints at the choice). During REVEAL the
 * players who answered are drawn by the jump-on overlay instead; no-answer players stay with a "z" bubble.
 */
@Composable
private fun PodiumRow(view: TriviaView, args: GameScreenArgs, clock: PhaseClock, positions: StagePositions, modifier: Modifier) {
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val jumpers = if (view.phase == TriviaPhase.REVEAL) TriviaBoard.stacks(view).values.flatten().toSet() else emptySet()
    val density = LocalDensity.current
    BoxWithConstraints(modifier) {
        val players = view.players.filter { !it.left }
        val slots = TriviaBoard.podiumSlots(players.size, maxWidth.value)
        val podiumW = minOf(64f, (maxWidth.value / players.size.coerceAtLeast(1)) - 6f).coerceAtLeast(40f)
        players.forEachIndexed { i, p ->
            val cx = if (rtl) maxWidth.value - slots[i] else slots[i]
            Box(
                Modifier
                    .absoluteOffset(x = (cx - podiumW / 2f).dp, y = 0.dp) // already mirrored for RTL above
                    .width(podiumW.dp)
                    .fillMaxHeight()
                    .onGloballyPositioned { c ->
                        val pos = c.positionInRoot()
                        val feet = with(density) { Offset(pos.x + c.size.width / 2f, pos.y + (PODIUM_CHAR_DP + 4).dp.toPx()) }
                        if (positions.podium[p.id] != feet) positions.podium[p.id] = feet
                    },
            ) {
                Podium(view, p, args, clock, drawCharacter = p.id !in jumpers, width = podiumW.dp)
            }
        }
    }
}

@Composable
private fun Podium(view: TriviaView, p: TriviaPlayer, args: GameScreenArgs, clock: PhaseClock, drawCharacter: Boolean, width: Dp) {
    val member = args.room.member(p.id)
    val expression = if (member != null) {
        CharacterRules.expression(member, args.game.envelope, null, TriviaBoard.expression(view, p))
    } else {
        TriviaBoard.expression(view, p)
    }
    val answered = view.phase == TriviaPhase.ANSWER && p.answered
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(PODIUM_CHAR_DP.dp + 4.dp), contentAlignment = Alignment.BottomCenter) {
            if (drawCharacter) {
                if (TriviaBoard.flameVisible(view, p)) FlameOverlay(TriviaBoard.flameLevel(p.streak), PODIUM_CHAR_DP.dp)
                Character(p.color, PODIUM_CHAR_DP.dp, expression, state = AvatarState(away = !p.connected))
                if (TriviaBoard.snoozing(view, p)) ZBubble(Modifier.align(Alignment.TopEnd))
            }
            if (p.isNew) NewRibbon(Modifier.align(Alignment.TopStart))
        }
        // The podium front with its light ring and the name plate.
        Box(
            Modifier
                .width(width)
                .height(40.dp)
                .background(Brush.verticalGradient(listOf(Studio.elevated, Studio.surface)), RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Canvas(Modifier.fillMaxSize()) {
                val ring = if (answered) Color.White else Studio.glow.copy(alpha = 0.18f)
                drawLine(ring, Offset(6.dp.toPx(), 3.dp.toPx()), Offset(size.width - 6.dp.toPx(), 3.dp.toPx()), 3.dp.toPx(), androidx.compose.ui.graphics.StrokeCap.Round)
            }
            Text(
                Names.ellipsize(p.name, 7),
                style = JamaaTheme.type.caption,
                color = if (p.connected) JamaaColors.Text else JamaaColors.TextMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 6.dp, start = 2.dp, end = 2.dp),
            )
        }
    }
}

/** The streak flame (DESIGN-JAMAA §4.5 `flame`): orange tongues with a lemon core, flickering by scale only. */
@Composable
internal fun FlameOverlay(level: Int, size: Dp, modifier: Modifier = Modifier) {
    val reduce = JamaaTheme.reduceMotion
    val flicker = if (reduce) null else androidx.compose.animation.core.rememberInfiniteTransition(label = "flame").animateFloat(
        0.94f, 1.06f,
        androidx.compose.animation.core.infiniteRepeatable(androidx.compose.animation.core.tween(220), androidx.compose.animation.core.RepeatMode.Reverse),
        label = "f",
    )
    val grow = 1f + 0.14f * (level - 1).coerceAtLeast(0)
    Canvas(
        modifier.size(size).graphicsLayer {
            val f = flicker?.value ?: 1f
            transformOrigin = TransformOrigin(0.5f, 1f)
            scaleX = grow * (2f - f)
            scaleY = grow * f
        }.clearAndSetSemantics {},
    ) {
        val w = this.size.width
        val h = this.size.height
        fun tongue(cx: Float, top: Float, half: Float, color: Color) {
            val p = androidx.compose.ui.graphics.Path().apply {
                moveTo(cx - half, h)
                quadraticTo(cx - half * 1.2f, h - (h - top) * 0.6f, cx, top)
                quadraticTo(cx + half * 1.2f, h - (h - top) * 0.6f, cx + half, h)
                close()
            }
            drawPath(p, color)
        }
        tongue(w * 0.2f, h * 0.35f, w * 0.16f, Flame.copy(alpha = 0.85f))
        tongue(w * 0.8f, h * 0.35f, w * 0.16f, Flame.copy(alpha = 0.85f))
        tongue(w * 0.5f, h * 0.05f, w * 0.3f, Flame.copy(alpha = 0.7f))
        tongue(w * 0.5f, h * 0.45f, w * 0.14f, FlameCore.copy(alpha = 0.9f))
    }
}

@Composable
private fun ZBubble(modifier: Modifier = Modifier) {
    Text("z", style = JamaaTheme.type.label, color = JamaaColors.TextSecondary, modifier = modifier.background(Studio.elevated, RoundedCornerShape(50)).padding(horizontal = 6.dp))
}

@Composable
private fun NewRibbon(modifier: Modifier = Modifier) {
    Text(
        keyText("game.trivia.pad.newRibbon"),
        style = JamaaTheme.type.caption,
        color = Ink,
        maxLines = 1,
        modifier = modifier.background(JamaaColors.Accent, RoundedCornerShape(6.dp)).padding(horizontal = 6.dp),
    )
}

// ---------------------------------------------------------------- the leaderboard tower

/**
 * The side tower (top 8, paging the rest every 2 s). In REVEAL it starts in the order before this question's points,
 * each score badge pops and ticks up when its coin lands (counter 600 ms, decel), then the rows re-sort (FLIP 400 ms)
 * and overtakers hop. Reduced motion: final numbers at once, the re-sort crossfades.
 */
@Composable
private fun Tower(view: TriviaView, clock: PhaseClock, positions: StagePositions, modifier: Modifier) {
    val reveal = view.phase == TriviaPhase.REVEAL
    val after = TriviaBoard.towerOrder(view)
    val before = if (reveal) TriviaBoard.towerOrderBefore(view) else after
    val coins = if (reveal) TriviaBoard.coins(view) else emptyList()
    val coinIndex = coins.withIndex().associate { it.value.playerId to it.index }
    val hoppers = if (reveal) TriviaBoard.overtakers(view) else emptySet()
    val leaders = TriviaBoard.leaders(view)
    val page by remember(view) { derivedStateOf { TriviaBoard.towerPage(before, clock.t()) } }
    Column(modifier.background(Studio.surface.copy(alpha = 0.85f), RoundedCornerShape(16.dp)).padding(8.dp)) {
        Text(keyText("game.trivia.leaderboard.title"), style = JamaaTheme.type.label, color = Studio.accentText, modifier = Modifier.padding(start = 6.dp, bottom = 4.dp))
        Box(Modifier.fillMaxWidth().weight(1f)) {
            val rowH = 36.dp
            page.forEachIndexed { slot, p -> androidx.compose.runtime.key(p.id) {
                val from = slot
                val to = after.indexOf(p).let { idx -> if (idx in page.indices || page.size == before.size) idx else slot }
                val ci = coinIndex[p.id]
                Row(
                    Modifier
                        .fillMaxWidth()
                        .height(rowH)
                        .graphicsLayer {
                            val r = clock.p("reorder")
                            val y = from + (to - from) * r
                            translationY = y * rowH.toPx()
                            val hop = if (p.id in hoppers) clock.p("hop") else 0f
                            translationY -= kotlin.math.sin(Math.PI * hop).toFloat() * 10.dp.toPx()
                            alpha = if (p.left) 0.5f else 1f
                        },
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Avatar(p.color, 26.dp, state = AvatarState(away = !p.connected, left = p.left))
                    Text(Names.ellipsize(p.name, 8), style = JamaaTheme.type.caption, color = JamaaColors.Text, maxLines = 1, modifier = Modifier.weight(1f))
                    if (p.id in leaders) Icon(JamaaIcons.Crown, contentDescription = null, tint = JamaaColors.Accent, modifier = Modifier.size(16.dp))
                    val shown by remember(p.id, view) {
                        derivedStateOf {
                            if (ci == null) p.score else {
                                val c = clock.p("counter", ci)
                                (p.scoreBefore + (p.score - p.scoreBefore) * c).roundToInt()
                            }
                        }
                    }
                    Text(
                        shown.toString(),
                        style = JamaaTheme.type.label,
                        color = JamaaColors.Text,
                        maxLines = 1,
                        modifier = Modifier
                            .onGloballyPositioned { c ->
                                // Coin targets: the rows before the re-sort (the coins have landed by then).
                                if (clock.t() >= TriviaMoments.REORDER_AT) return@onGloballyPositioned
                                val pos = c.positionInRoot()
                                val at = Offset(pos.x + c.size.width / 2f, pos.y + c.size.height / 2f)
                                if (positions.tower[p.id] != at) positions.tower[p.id] = at
                            }
                            .graphicsLayer {
                                if (ci != null) {
                                    val pop = clock.p("badgePop", ci)
                                    val s = 1f + 0.15f * kotlin.math.sin(Math.PI * pop).toFloat()
                                    scaleX = s
                                    scaleY = s
                                }
                            },
                    )
                }
            } }
        }
    }
}

// ---------------------------------------------------------------- the reveal overlay: jump-on, bolt, coins

/**
 * Draws the players who answered: from their podium to their stack slot on the tile they chose along a 100 dp arc
 * (spring.hop, 60 ms stagger), 56 → 40 dp; the bolt on the fastest; the coins with their "+870 +200" labels flying
 * to the tower (ease.coin, 70 ms stagger). Positions come from the stage's onGloballyPositioned map (root px).
 */
@Composable
private fun RevealOverlay(view: TriviaView, clock: PhaseClock, positions: StagePositions) {
    val stacks = TriviaBoard.stacks(view)
    val r = view.reveal ?: return
    val density = LocalDensity.current
    val order = stacks.entries.sortedBy { it.key }.flatMap { (tile, ids) -> ids.mapIndexed { i, id -> Triple(tile, i, id) } }
    val jumpIndex = order.withIndex().associate { it.value.third to it.index }
    val origin = positions.origin.value
    val charPx = with(density) { PODIUM_CHAR_DP.dp.toPx() }
    val tilePx = with(density) { TILE_CHAR_DP.dp.toPx() }

    /** Where a jumper stands on its tile (feet point, local px), or null before the tile was laid out. */
    fun slot(tile: Int, i: Int): Offset? {
        val (pos, size) = positions.tiles[tile] ?: return null
        val rect = app.jamaa.tv.games.trivia.Rect(0f, 0f, size.width / density.density, size.height / density.density)
        val (x, y) = TriviaBoard.stackOffset(i, rect, TILE_CHAR_DP.toFloat())
        return Offset(pos.x + (x + TILE_CHAR_DP / 2f) * density.density, pos.y + (y + TILE_CHAR_DP) * density.density) - origin
    }

    // Absolute top-left: every child is placed by its layer translation in root px (no RTL mirroring).
    Box(Modifier.fillMaxSize(), contentAlignment = AbsoluteAlignment.TopLeft) {
        for ((tile, i, id) in order) {
            val p = view.player(id) ?: continue
            val from = positions.podium[id]?.minus(origin) ?: continue
            val to = slot(tile, i) ?: continue
            val k = jumpIndex.getValue(id)
            val expression = TriviaBoard.expression(view, p)
            Box(
                Modifier
                    .graphicsLayer {
                        val t = clock.p("jump", k)
                        val tc = t.coerceIn(0f, 1.2f)
                        val x = from.x + (to.x - from.x) * tc
                        val arc = kotlin.math.sin(Math.PI * tc.coerceIn(0f, 1f)).toFloat() * TriviaMoments.JUMP_ARC_DP * density.density
                        val y = from.y + (to.y - from.y) * tc - arc
                        val s = 1f + (tilePx / charPx - 1f) * t.coerceIn(0f, 1f)
                        transformOrigin = TransformOrigin(0.5f, 1f)
                        translationX = x - charPx / 2f
                        translationY = y - charPx
                        scaleX = s
                        scaleY = s
                    },
            ) {
                Box(Modifier.size(PODIUM_CHAR_DP.dp), contentAlignment = Alignment.BottomCenter) {
                    if (TriviaBoard.flameVisible(view, p)) FlameOverlay(TriviaBoard.flameLevel(p.streak), PODIUM_CHAR_DP.dp)
                    Character(p.color, PODIUM_CHAR_DP.dp, expression)
                    if (id in r.fastestIds) Bolt(clock)
                }
            }
        }

        // Coins (one per correct player), label chip riding with it.
        val coins = TriviaBoard.coins(view)
        coins.forEachIndexed { ci, coin ->
            val p = view.player(coin.playerId) ?: return@forEachIndexed
            val idx = order.indexOfFirst { it.third == coin.playerId }.takeIf { it >= 0 } ?: return@forEachIndexed
            val (tile, i, _) = order[idx]
            val start = slot(tile, i)?.let { it - Offset(0f, tilePx * 0.6f) } ?: return@forEachIndexed
            val end = positions.tower[coin.playerId]?.minus(origin) ?: return@forEachIndexed
            val swatch = PlayerSwatch.byId(p.color)
            Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
                val t = clock.p("coin", ci)
                if (t <= 0f || t >= 1f) return@Canvas
                val pt = coinPoint(start, end, t, size.height, 90.dp.toPx())
                if (coin.flame) {
                    for (k in 1..4) {
                        val back = coinPoint(start, end, (t - 0.04f * k).coerceAtLeast(0f), size.height, 90.dp.toPx())
                        drawCircle(Flame.copy(alpha = 0.5f - 0.1f * k), (5 - k * 0.8f).dp.toPx(), back)
                    }
                }
                drawCircle(swatch.color, 5.dp.toPx(), pt)
                drawCircle(JamaaColors.Text, 5.dp.toPx(), pt, style = Stroke(1.5.dp.toPx()))
            }
            val label = buildString {
                append(TriviaBoard.plus(coin.points))
                if (coin.bonus > 0) append(" ").append(TriviaBoard.plus(coin.bonus))
                if (coin.doubled) append(" ×2")
            }
            Text(
                label,
                style = JamaaTheme.type.label,
                color = if (coin.doubled) Ink else JamaaColors.Text,
                maxLines = 1,
                modifier = Modifier
                    .graphicsLayer {
                        val t = clock.p("coin", ci)
                        val pt = coinPoint(start, end, t, positions.height.value, 90.dp.toPx())
                        translationX = pt.x + 8.dp.toPx()
                        translationY = pt.y - 28.dp.toPx()
                        alpha = if (t <= 0f || t >= 1f) 0f else 1f
                    }
                    .background(if (coin.doubled) JamaaColors.Accent else Studio.elevated, RoundedCornerShape(50))
                    .padding(horizontal = 8.dp),
            )
        }
    }
}

/** Quadratic Bézier with the control point [lift] above the chord midpoint (below when both ends are in the top half). */
internal fun coinPoint(a: Offset, b: Offset, t: Float, height: Float, lift: Float): Offset {
    val mid = Offset((a.x + b.x) / 2f, (a.y + b.y) / 2f)
    val up = if (a.y < height / 2f && b.y < height / 2f) lift else -lift
    val c = Offset(mid.x, mid.y + up)
    val u = 1f - t
    return Offset(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y)
}

/** The fastest finger's lightning bolt (the DESIGN §5.2 bolt glyph, lemon) with a 100 ms flash on the character only. */
@Composable
private fun Bolt(clock: PhaseClock) {
    Box(Modifier.size(PODIUM_CHAR_DP.dp)) {
        Box(
            Modifier.fillMaxSize().graphicsLayer {
                val local = clock.t() - 2_400L
                alpha = if (local in 0..100) 0.7f else 0f
            }.background(Color.White, RoundedCornerShape(50)),
        )
        Icon(
            app.jamaa.tv.ui.components.AvatarGlyphs.of(app.jamaa.tv.AvatarShape.Bolt),
            contentDescription = null,
            tint = Lemon,
            modifier = Modifier
                .size(30.dp)
                .align(Alignment.TopEnd)
                .graphicsLayer {
                    val p = clock.p("fastest")
                    alpha = p.coerceIn(0f, 1f)
                    scaleX = 0.4f + 0.6f * p
                    scaleY = 0.4f + 0.6f * p
                    translationY = (1f - p.coerceIn(0f, 1f)) * -40.dp.toPx()
                },
        )
    }
}

