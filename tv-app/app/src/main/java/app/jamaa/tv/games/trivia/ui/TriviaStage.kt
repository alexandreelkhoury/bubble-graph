package app.jamaa.tv.games.trivia.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.game.Names
import app.jamaa.tv.games.trivia.QuestionType
import app.jamaa.tv.games.trivia.TileState
import app.jamaa.tv.games.trivia.TriviaBoard
import app.jamaa.tv.games.trivia.TriviaMoments
import app.jamaa.tv.games.trivia.TriviaPhase
import app.jamaa.tv.games.trivia.TriviaToken
import app.jamaa.tv.games.trivia.TriviaView
import app.jamaa.tv.ui.characters.Character
import app.jamaa.tv.ui.components.Confetti
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.platform.keyText
import app.jamaa.tv.ui.screens.localizedTitle
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme
import kotlin.math.PI
import kotlin.math.roundToInt
import kotlin.math.sin

// ---------------------------------------------------------------- QUIZ_INTRO (TR-TV-01)

/** The marquee quiz card: scales in, stars fill one by one, chips stagger in, "10 questions" (DESIGN-JAMAA §5.4). */
@Composable
internal fun QuizIntroCard(view: TriviaView, clock: PhaseClock, modifier: Modifier = Modifier) {
    val q = view.quiz
    val reduce = JamaaTheme.reduceMotion
    Box(
        modifier
            .widthIn(max = 560.dp)
            .graphicsLayer {
                val p = clock.p("card")
                alpha = p.coerceIn(0f, 1f)
                val s = 0.6f + 0.4f * p
                scaleX = s
                scaleY = s
            }
            .background(Studio.surface, RoundedCornerShape(24.dp))
            .drawBehind { marqueeBulbs(clock.t(), reduce) }
            .padding(horizontal = 40.dp, vertical = 28.dp),
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                localizedTitle(q.title),
                style = JamaaTheme.type.displayS.copy(textDirection = TextDirection.Content),
                color = JamaaColors.Text,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            StarsLine(q.stars, size = 26.dp, fill = { i -> clock.p("stars", i) })
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                DomainChip(q.domain, Modifier.layerAppear { clock.p("chips", 0) })
                TopicChips(q.featuredTopics.take(3), (q.topicCount - q.featuredTopics.take(3).size).coerceAtLeast(0), appear = { i -> clock.p("chips", i + 1) })
            }
            Row(Modifier.layerAppear { clock.p("count") }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    pluralStringResource(R.plurals.game__trivia__quiz__questions, view.total, view.total),
                    style = JamaaTheme.type.title,
                    color = Studio.accentText,
                )
                if (view.rerun) TopicChip(keyText("game.trivia.quiz.rerun"))
            }
        }
    }
}

/** The marquee panel's edge bulbs (world.glow), chasing on entrance. */
private fun androidx.compose.ui.graphics.drawscope.DrawScope.marqueeBulbs(t: Long, reduce: Boolean) {
    val r = 3.dp.toPx()
    val inset = 10.dp.toPx()
    val w = size.width - 2 * inset
    val h = size.height - 2 * inset
    val per = 12.dp.toPx() * 2f
    val nx = (w / per).toInt().coerceAtLeast(2)
    val ny = (h / per).toInt().coerceAtLeast(2)
    val chase = if (reduce) -1 else ((t / 80L) % 3).toInt()
    var k = 0
    fun bulb(x: Float, y: Float) {
        val lit = chase < 0 || k % 3 != chase
        drawCircle(Studio.glow.copy(alpha = if (lit) 0.95f else 0.3f), r, Offset(x, y))
        k++
    }
    for (i in 0..nx) bulb(inset + w * i / nx, inset)
    for (i in 1..ny) bulb(inset + w, inset + h * i / ny)
    for (i in nx - 1 downTo 0) bulb(inset + w * i / nx, inset + h)
    for (i in ny - 1 downTo 1) bulb(inset, inset + h * i / ny)
}

// ---------------------------------------------------------------- READ / ANSWER / REVEAL (TR-TV-02, 02a, 03)

@Composable
internal fun QuestionStage(view: TriviaView, clock: PhaseClock, clockOffsetMs: Long, positions: StagePositions) {
    val q = view.question ?: return
    val reduce = JamaaTheme.reduceMotion
    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            QuestionCard(view, clock, clockOffsetMs, reduce, Modifier.fillMaxWidth().height(128.dp))
            Spacer(Modifier.height(12.dp))
            AnswerGrid(view, clock, positions, Modifier.fillMaxWidth().height(140.dp))
            Spacer(Modifier.height(8.dp))
            if (view.phase == TriviaPhase.REVEAL) RevealHeadline(view, clock, Modifier.fillMaxWidth().height(34.dp))
        }
        val r = view.reveal
        if (r != null) {
            // "Time!" stamp: lands with the lock, leaves as the wrong tiles go out.
            Text(
                keyText("game.trivia.reveal.time"),
                style = JamaaTheme.type.displayM,
                color = JamaaColors.Accent,
                modifier = Modifier.align(Alignment.Center).graphicsLayer {
                    val l = clock.p("lock")
                    alpha = (l * (1f - clock.p("wrongOut"))).coerceIn(0f, 1f)
                    val s = 1.6f - 0.6f * l
                    scaleX = s
                    scaleY = s
                    rotationZ = -8f
                },
            )
            if (r.genius) {
                val burst by remember(clock) { derivedStateOf { clock.t() >= TriviaMoments.JUMP_AT } }
                if (burst) Confetti(Modifier.fillMaxSize(), durationMs = 1_200, seed = view.index + 3)
            }
            val explain = r.explain
            if (explain != null) ExplainCard(explain, clock, Modifier.align(Alignment.BottomCenter))
        }
    }
}

/**
 * The question card. READ: it slams in from above and a thin "get ready" bar fills under the text. ANSWER: the ring
 * of 20 bulbs around its edge goes dark one by one clockwise (server deadline), pulsing amber in the last 5 s
 * (no pulse in calm motion; the bulbs still go dark). REVEAL: the bulbs flash once with the lock.
 */
@Composable
private fun QuestionCard(view: TriviaView, clock: PhaseClock, clockOffsetMs: Long, reduce: Boolean, modifier: Modifier) {
    val q = view.question ?: return
    val deadline = view.deadline
    val duration = view.durationMs ?: 0L
    Box(
        modifier
            .graphicsLayer {
                val p = clock.p("slam")
                translationY = (1f - p) * -220.dp.toPx()
                alpha = if (view.phase == TriviaPhase.READ) p.coerceIn(0f, 1f) else 1f
            }
            .background(Studio.surface, RoundedCornerShape(20.dp))
            .drawBehind {
                clock.t() // a frame-clock read: this draw runs every frame while the phase ticks
                val now = System.currentTimeMillis() + clockOffsetMs
                val rem = if (deadline == null) 0L else (deadline - now).coerceAtLeast(0L)
                val lit = when (view.phase) {
                    TriviaPhase.ANSWER -> TriviaBoard.bulbsLit(rem, duration)
                    TriviaPhase.READ -> TriviaBoard.BULBS
                    else -> 0
                }
                val pulse = view.phase == TriviaPhase.ANSWER && TriviaBoard.pulsing(rem) && !reduce
                val flash = view.phase == TriviaPhase.REVEAL && clock.p("lock") in 0.01f..0.99f
                bulbRing(lit, pulse, flash, rem, dim = view.phase == TriviaPhase.READ)
            }
            .padding(horizontal = 28.dp, vertical = 18.dp),
        contentAlignment = Alignment.Center,
    ) {
        BasicText(
            q.text,
            style = JamaaTheme.type.headline.copy(color = JamaaColors.Text, textAlign = TextAlign.Center, textDirection = TextDirection.Content),
            maxLines = 3,
            overflow = TextOverflow.Ellipsis,
            autoSize = TextAutoSize.StepBased(minFontSize = 20.sp, maxFontSize = 34.sp, stepSize = 1.sp),
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        )
        if (view.phase == TriviaPhase.READ && deadline != null) {
            Canvas(Modifier.align(Alignment.BottomCenter).fillMaxWidth().height(4.dp).offset(y = 10.dp)) {
                clock.t()
                val now = System.currentTimeMillis() + clockOffsetMs
                val f = TriviaBoard.fill((deadline - now).coerceAtLeast(0L), duration)
                val rtl = layoutDirection == LayoutDirection.Rtl
                drawRoundRect(JamaaColors.Text.copy(alpha = 0.12f), cornerRadius = CornerRadius(size.height / 2f))
                val w = size.width * f
                drawRoundRect(Studio.glow, topLeft = Offset(if (rtl) size.width - w else 0f, 0f), size = Size(w, size.height), cornerRadius = CornerRadius(size.height / 2f))
            }
        }
    }
}

/** The 20 bulbs along the card's edge, clockwise from the top centre; [lit] of them still on. */
private fun androidx.compose.ui.graphics.drawscope.DrawScope.bulbRing(lit: Int, pulse: Boolean, flash: Boolean, remainingMs: Long, dim: Boolean) {
    val n = TriviaBoard.BULBS
    val inset = 7.dp.toPx()
    val w = size.width - 2 * inset
    val h = size.height - 2 * inset
    val perimeter = 2 * (w + h)
    val pulseScale = if (pulse) 1f + 0.25f * ((sin(remainingMs / 1_000.0 * 2 * PI) + 1) / 2).toFloat() else 1f
    for (i in 0 until n) {
        // Distance along the edge from the top centre, clockwise.
        var d = (perimeter * i / n + w / 2f) % perimeter
        val pt = when {
            d < w -> Offset(inset + d, inset)
            d < w + h -> { d -= w; Offset(inset + w, inset + d) }
            d < 2 * w + h -> { d -= w + h; Offset(inset + w - d, inset + h) }
            else -> { d -= 2 * w + h; Offset(inset, inset + h - d) }
        }
        // Bulbs switch off clockwise: bulb i is lit while i < lit (the last ones go dark first... from the end).
        val on = i < lit
        val color = when {
            flash -> Color.White
            on && pulse -> JamaaColors.Accent
            on -> Studio.glow.copy(alpha = if (dim) 0.55f else 1f)
            else -> Studio.elevated
        }
        drawCircle(color, 4.dp.toPx() * (if (on && pulse) pulseScale else 1f), pt)
    }
}

/**
 * The never-mirrored answer grid (A top-left … D bottom-right; True left, False right), laid out under a forced
 * left-to-right direction; each tile's text keeps its own direction. READ: outlined ghosts. ANSWER: the tiles flip in
 * A→D. REVEAL: wrong tiles dim to 30 % and shrink to 0.96, the right one glows and its shape spins once.
 */
@Composable
private fun AnswerGrid(view: TriviaView, clock: PhaseClock, positions: StagePositions, modifier: Modifier) {
    val q = view.question ?: return
    val tokens = TriviaToken.forType(q.type)
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        BoxWithConstraints(modifier) {
            val rects = TriviaBoard.tiles(q.type, maxWidth.value, maxHeight.value, 12f)
            tokens.forEachIndexed { i, token ->
                val rect = rects[i]
                val state = TriviaBoard.tileState(view, i)
                key(i) {
                    Box(
                        Modifier
                            .offset(rect.x.dp, rect.y.dp)
                            .size(rect.w.dp, rect.h.dp)
                            .onGloballyPositioned { c ->
                                val at = c.positionInRoot() to Size(c.size.width.toFloat(), c.size.height.toFloat())
                                if (positions.tiles[i] != at) positions.tiles[i] = at
                            },
                    ) {
                        if (state == TileState.GHOST) {
                            Box(
                                Modifier.fillMaxSize()
                                    .layerAppear { clock.p("ghosts") }
                                    .border(BorderStroke(2.dp, Studio.elevated), RoundedCornerShape(16.dp)),
                            )
                        } else {
                            AnswerTile(token, view.options.getOrNull(i).orEmpty(), state, clock, i, Modifier.fillMaxSize())
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AnswerTile(token: TriviaToken, text: String, state: TileState, clock: PhaseClock, index: Int, modifier: Modifier) {
    val fill = token.color()
    val shape = RoundedCornerShape(16.dp)
    Box(
        modifier
            .graphicsLayer {
                val flip = clock.p("tiles", index)
                rotationY = 90f * (1f - flip)
                cameraDistance = 12f * density
                val out = clock.p("wrongOut")
                when (state) {
                    TileState.WRONG, TileState.VOID -> {
                        alpha = (1f - 0.7f * out) * (if (flip > 0f) 1f else 0f)
                        val s = 1f - 0.04f * out
                        scaleX = s
                        scaleY = s
                    }
                    else -> alpha = if (flip > 0f) 1f else 0f
                }
            }
            .drawBehind {
                if (state == TileState.CORRECT) {
                    val g = clock.p("wrongOut")
                    val spread = 10.dp.toPx() * g
                    drawRoundRect(
                        JamaaColors.Success.copy(alpha = 0.45f * g),
                        topLeft = Offset(-spread, -spread),
                        size = Size(size.width + 2 * spread, size.height + 2 * spread),
                        cornerRadius = CornerRadius(16.dp.toPx() + spread),
                    )
                }
            }
            .background(fill, shape)
            .then(if (state == TileState.CORRECT) Modifier.border(BorderStroke(4.dp, JamaaColors.Success), shape) else Modifier)
            .then(if (token == TriviaToken.FALSE) Modifier.border(BorderStroke(2.dp, JamaaColors.Text.copy(alpha = 0.24f)), shape) else Modifier),
    ) {
        Row(Modifier.fillMaxSize().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.fillMaxHeight().width(56.dp)) {
                token.letter?.let {
                    Text(it, style = JamaaTheme.type.label, color = Ink, modifier = Modifier.align(Alignment.TopStart))
                }
                TokenGlyph(
                    token.shape,
                    Ink,
                    40.dp,
                    Modifier.align(Alignment.Center),
                    spin = { if (state == TileState.CORRECT) clock.p("spin") else 0f },
                )
            }
            Spacer(Modifier.width(8.dp))
            val label = if (token.letter == null && text.isEmpty()) keyText(token.labelKey) else text
            if (token.textOnFill) {
                BasicText(
                    label,
                    style = JamaaTheme.type.title.copy(color = Ink, textDirection = TextDirection.Content),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    autoSize = TextAutoSize.StepBased(minFontSize = 18.sp, maxFontSize = 26.sp, stepSize = 1.sp),
                    modifier = Modifier.weight(1f),
                )
            } else {
                // False: ink on coral is 4.497:1, so the word sits on a cream strip (GAME-TRIVIA §8.2).
                Box(Modifier.weight(1f).background(JamaaColors.Text, RoundedCornerShape(8.dp)).padding(horizontal = 10.dp, vertical = 2.dp)) {
                    Text(label, style = JamaaTheme.type.title.copy(textDirection = TextDirection.Content), color = Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

/** The one-line verdict under the grid: Fastest finger / Genius / Stumped / Too slow / voided. */
@Composable
private fun RevealHeadline(view: TriviaView, clock: PhaseClock, modifier: Modifier) {
    val r = view.reveal ?: return
    val h = TriviaBoard.headline(r)
    val text = when (h) {
        TriviaBoard.Headline.VOIDED -> keyText("game.trivia.pause.voided")
        TriviaBoard.Headline.TOO_SLOW -> keyText("game.trivia.reveal.tooSlow")
        TriviaBoard.Headline.STUMPED -> keyText("game.trivia.reveal.stumped")
        TriviaBoard.Headline.GENIUS -> keyText("game.trivia.reveal.genius")
        TriviaBoard.Headline.FASTEST -> keyText(
            "game.trivia.reveal.fastest",
            app.jamaa.tv.i18n.nameList(r.fastestIds.mapNotNull { view.player(it)?.name }),
        )
        TriviaBoard.Headline.NONE -> return
    }
    val step = if (h == TriviaBoard.Headline.FASTEST || h == TriviaBoard.Headline.GENIUS) "fastest" else "stamp"
    Row(modifier.semantics { liveRegion = LiveRegionMode.Polite }, horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
        if (h == TriviaBoard.Headline.FASTEST) {
            Icon(app.jamaa.tv.ui.components.AvatarGlyphs.of(app.jamaa.tv.AvatarShape.Bolt), contentDescription = null, tint = Lemon, modifier = Modifier.size(24.dp).layerAppear { clock.p(step) })
            Spacer(Modifier.width(8.dp))
        }
        Text(
            text,
            style = JamaaTheme.type.title,
            color = if (h == TriviaBoard.Headline.STUMPED || h == TriviaBoard.Headline.TOO_SLOW) JamaaColors.Accent else JamaaColors.Text,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.graphicsLayer {
                val p = clock.p(step)
                alpha = p.coerceIn(0f, 1f)
                val s = 1.2f - 0.2f * p
                scaleX = s
                scaleY = s
            },
        )
    }
}

/** "Did you know?" slides up with the question's fact at 6 s (+3 s of REVEAL). */
@Composable
private fun ExplainCard(text: String, clock: PhaseClock, modifier: Modifier) {
    Column(
        modifier
            .fillMaxWidth()
            .graphicsLayer {
                val p = clock.p("explain")
                alpha = if (clock.t() < TriviaMoments.EXPLAIN_AT && clock.moment.step("explain") != null) 0f else p.coerceIn(0f, 1f)
                translationY = (1f - p.coerceIn(0f, 1f)) * 60.dp.toPx()
            }
            .background(Studio.elevated, RoundedCornerShape(16.dp))
            .border(BorderStroke(2.dp, JamaaColors.Success), RoundedCornerShape(16.dp))
            .padding(horizontal = 20.dp, vertical = 10.dp),
    ) {
        Text(keyText("game.trivia.reveal.didYouKnow"), style = JamaaTheme.type.label, color = JamaaColors.Success)
        Text(text, style = JamaaTheme.type.body.copy(textDirection = TextDirection.Content), color = JamaaColors.Text, maxLines = 3, overflow = TextOverflow.Ellipsis)
    }
}

// ---------------------------------------------------------------- LEADERBOARD (TR-TV-04)

/**
 * The leaderboard race: full-width bars grow from the previous totals to the new ones (1.2 s, numbers roll), the rows
 * re-sort with a spring, the leader's crown drops, the biggest climber gets "+n places!". Top 8 (12 players: the
 * tower pages on the side screens; the race shows the top 8, GAME-TRIVIA §6).
 */
@Composable
internal fun LeaderboardRace(view: TriviaView, clock: PhaseClock, modifier: Modifier) {
    val before = TriviaBoard.towerOrderBefore(view).take(TriviaBoard.TOWER_ROWS)
    val after = TriviaBoard.towerOrder(view)
    val max = (view.players.maxOfOrNull { it.score } ?: 0).coerceAtLeast(1)
    val leaders = TriviaBoard.leaders(view)
    val climber = TriviaBoard.biggestClimber(view)
    val places = TriviaBoard.places(after)
    Column(modifier.padding(horizontal = 24.dp)) {
        Text(keyText("game.trivia.leaderboard.title"), style = JamaaTheme.type.headline, color = Studio.accentText, modifier = Modifier.padding(vertical = 8.dp))
        BoxWithConstraints(Modifier.fillMaxWidth().weight(1f)) {
            val rowH = (maxHeight / TriviaBoard.TOWER_ROWS).coerceAtMost(52.dp)
            before.forEachIndexed { from, p ->
                key(p.id) {
                    val to = after.indexOf(p).coerceAtLeast(0)
                    val place = places.getOrNull(to) ?: (to + 1)
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .height(rowH)
                            .graphicsLayer {
                                val appear = clock.p("rows", from)
                                alpha = appear.coerceIn(0f, 1f) * (if (p.left) 0.5f else 1f)
                                val y = from + (to - from) * clock.p("reorder")
                                translationY = y * rowH.toPx() + (1f - appear.coerceIn(0f, 1f)) * 16.dp.toPx()
                            },
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text("$place", style = JamaaTheme.type.title, color = JamaaColors.TextSecondary, modifier = Modifier.width(32.dp), textAlign = TextAlign.End)
                        Box(Modifier.size(44.dp)) {
                            if (TriviaBoard.flameVisible(view, p)) FlameOverlay(TriviaBoard.flameLevel(p.streak), 44.dp)
                            Character(p.color, 44.dp, TriviaBoard.expression(view, p))
                            if (p.id in leaders) {
                                Icon(
                                    JamaaIcons.Crown,
                                    contentDescription = null,
                                    tint = JamaaColors.Accent,
                                    modifier = Modifier.size(20.dp).align(Alignment.TopCenter).graphicsLayer {
                                        val c = clock.p("crown")
                                        alpha = c.coerceIn(0f, 1f)
                                        translationY = (1f - c) * -24.dp.toPx() - 10.dp.toPx()
                                    },
                                )
                            }
                        }
                        Text(Names.ellipsize(p.name, 12), style = JamaaTheme.type.titleS, color = JamaaColors.Text, maxLines = 1, modifier = Modifier.width(150.dp))
                        val color = app.jamaa.tv.ui.theme.PlayerSwatch.byId(p.color).color
                        Canvas(Modifier.weight(1f).height(18.dp)) {
                            val b = clock.p("bars")
                            val from0 = TriviaBoard.barShare(p.scoreBefore, max)
                            val to1 = TriviaBoard.barShare(p.score, max)
                            val f = from0 + (to1 - from0) * b
                            val rtl = layoutDirection == LayoutDirection.Rtl
                            val w = (size.width * f).coerceAtLeast(size.height)
                            drawRoundRect(Studio.surface, cornerRadius = CornerRadius(size.height / 2f))
                            drawRoundRect(color, topLeft = Offset(if (rtl) size.width - w else 0f, 0f), size = Size(w, size.height), cornerRadius = CornerRadius(size.height / 2f))
                        }
                        val shown by remember(p.id, view) { derivedStateOf { (p.scoreBefore + (p.score - p.scoreBefore) * clock.p("bars")).roundToInt() } }
                        Text(shown.toString(), style = JamaaTheme.type.title, color = JamaaColors.Text, modifier = Modifier.width(84.dp), textAlign = TextAlign.End)
                        if (climber?.first == p.id) {
                            Text(
                                pluralStringResource(R.plurals.game__trivia__leaderboard__climb, climber.second, climber.second),
                                style = JamaaTheme.type.label,
                                color = Ink,
                                maxLines = 1,
                                modifier = Modifier
                                    .graphicsLayer {
                                        val c = clock.p("climb")
                                        alpha = c.coerceIn(0f, 1f)
                                        scaleX = 0.6f + 0.4f * c
                                        scaleY = 0.6f + 0.4f * c
                                    }
                                    .background(JamaaColors.Success, RoundedCornerShape(50))
                                    .padding(horizontal = 10.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- FINAL_INTRO (TR-TV-05)

@Composable
internal fun FinalIntro(clock: PhaseClock, modifier: Modifier) {
    Box(modifier, contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Text(
                keyText("game.trivia.final.title"),
                style = JamaaTheme.type.displayS,
                color = JamaaColors.Text,
                textAlign = TextAlign.Center,
                modifier = Modifier.graphicsLayer {
                    val p = clock.p("title")
                    alpha = p.coerceIn(0f, 1f)
                    val s = 1.2f - 0.2f * p
                    scaleX = s
                    scaleY = s
                },
            )
            Text(
                keyText("game.trivia.final.stamp"),
                style = JamaaTheme.type.displayL.copy(fontSize = 120.sp, lineHeight = 128.sp),
                color = JamaaColors.Accent,
                modifier = Modifier
                    .graphicsLayer {
                        val p = clock.p("stamp")
                        alpha = p.coerceIn(0f, 1f)
                        val s = 1.6f - 0.6f * p
                        scaleX = s
                        scaleY = s
                        rotationZ = -8f
                    }
                    .border(BorderStroke(6.dp, JamaaColors.Accent), RoundedCornerShape(24.dp))
                    .padding(horizontal = 32.dp),
            )
        }
    }
}

// ---------------------------------------------------------------- HOLD

@Composable
internal fun HoldCard(modifier: Modifier) {
    Column(
        modifier.widthIn(max = 520.dp).background(Studio.surface, RoundedCornerShape(24.dp)).padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(keyText("game.trivia.hold.title"), style = JamaaTheme.type.headline, color = JamaaColors.Text, textAlign = TextAlign.Center)
        Text(keyText("game.trivia.hold.body"), style = JamaaTheme.type.body, color = JamaaColors.TextSecondary, textAlign = TextAlign.Center)
    }
}
