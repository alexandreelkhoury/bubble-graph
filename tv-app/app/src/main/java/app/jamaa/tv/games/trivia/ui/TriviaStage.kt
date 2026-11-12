package app.jamaa.tv.games.trivia.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.isSpecified
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.games.trivia.TileState
import app.jamaa.tv.games.trivia.TriviaBoard
import app.jamaa.tv.games.trivia.TriviaLayout
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

/**
 * The marquee quiz card, landscape so it fits the stage between the header and the podium row: the cover art on the
 * start side, title (auto-sized, 2 lines), stars, chips and "10 questions" on the other. It scales in, the stars fill
 * one by one, the chips stagger in (DESIGN-JAMAA §5.4); a too-tall card (long title, big font) shrinks as a whole.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun QuizIntroCard(view: TriviaView, clock: PhaseClock, modifier: Modifier = Modifier) {
    val q = view.quiz
    val reduce = JamaaTheme.reduceMotion
    Box(
        modifier
            .widthIn(max = 720.dp)
            .fitInside()
            .graphicsLayer {
                val p = clock.p("card")
                alpha = p.coerceIn(0f, 1f)
                val s = 0.6f + 0.4f * p
                scaleX = s
                scaleY = s
            }
            .background(Studio.surface, RoundedCornerShape(24.dp))
            .drawBehind { marqueeBulbs(clock.t(), reduce) }
            .padding(horizontal = 32.dp, vertical = 28.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(28.dp)) {
            // The flat cover (coast, hills and sunset in the studio palette), the same art as the shelf card.
            QuizCover(q.domain, Modifier.size(196.dp).clip(RoundedCornerShape(18.dp)), parallax = { 1f - clock.p("card").coerceIn(0f, 1f) })
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                FitLines(localizedTitle(q.title), JamaaTheme.type.displayS, JamaaColors.Text, max = 44.sp, min = 28.sp, maxLines = 2)
                StarsLine(q.stars, size = 26.dp, fill = { i -> clock.p("stars", i) })
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    DomainChip(q.domain, Modifier.layerAppear { clock.p("chips", 0) })
                    val featured = q.featuredTopics.take(3)
                    featured.forEachIndexed { i, t -> TopicChip(keyText(TriviaBoard.topicKey(t)), Modifier.layerAppear { clock.p("chips", i + 1) }) }
                    val more = (q.topicCount - featured.size).coerceAtLeast(0)
                    if (more > 0) TopicChip(keyText("content.more", more), Modifier.layerAppear { clock.p("chips", featured.size + 1) })
                }
                Row(Modifier.layerAppear { clock.p("count") }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        pluralStringResource(R.plurals.game__trivia__quiz__questions, view.total, view.total),
                        style = JamaaTheme.type.title,
                        color = Studio.accentText,
                        maxLines = 1,
                    )
                    if (view.rerun) TopicChip(keyText("game.trivia.quiz.rerun"))
                }
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

/**
 * The question stage (TriviaLayout): the question card (118 dp) and, under it, the answer grid in the rest of the
 * column (~208 dp: two rows of ~98 dp tiles). REVEAL adds the "Time!" stamp over the grid, the confetti of a Genius
 * and the "Did you know?" card, which flips down over the question card at 6 s.
 */
@Composable
internal fun QuestionStage(view: TriviaView, clock: PhaseClock, clockOffsetMs: Long, positions: StagePositions) {
    if (view.question == null) return
    val reduce = JamaaTheme.reduceMotion
    val r = view.reveal
    // The answer text glides to the tile's top only when characters will stand on the tiles.
    val moveText = r != null && TriviaBoard.stacks(view).isNotEmpty()
    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxWidth().height(TriviaLayout.QUESTION.dp)) {
                QuestionCard(view, clock, clockOffsetMs, reduce, Modifier.fillMaxSize())
                r?.explain?.let { ExplainCard(it, clock, Modifier.fillMaxSize()) }
            }
            Spacer(Modifier.height(TriviaLayout.CARD_GAP.dp))
            Box(Modifier.fillMaxWidth().weight(1f)) {
                AnswerGrid(view, clock, positions, moveText, Modifier.fillMaxSize())
                if (r != null) TimeStamp(clock, Modifier.align(Alignment.Center))
            }
        }
        if (r?.genius == true) {
            val burst by remember(clock) { derivedStateOf { clock.t() >= TriviaMoments.JUMP_AT } }
            if (burst) Confetti(Modifier.fillMaxSize(), durationMs = 1_200, seed = view.index + 3)
        }
    }
}

/** "Time!": an amber stamp that lands with the lock (scale 1.5 → 1, tilted) and leaves as the wrong tiles go out. */
@Composable
private fun TimeStamp(clock: PhaseClock, modifier: Modifier) {
    Text(
        keyText("game.trivia.reveal.time"),
        style = JamaaTheme.type.displayM,
        color = Ink,
        maxLines = 1,
        modifier = modifier
            .graphicsLayer {
                val l = clock.p("lock")
                alpha = (l * (1f - clock.p("wrongOut"))).coerceIn(0f, 1f)
                val s = 1.5f - 0.5f * l
                scaleX = s
                scaleY = s
                rotationZ = -6f
            }
            .background(JamaaColors.Accent, RoundedCornerShape(20.dp))
            .border(BorderStroke(3.dp, JamaaColors.Text), RoundedCornerShape(20.dp))
            .padding(horizontal = 28.dp),
    )
}

/**
 * The question card. READ: it slams in from above and a thin "get ready" bar fills under the text. ANSWER: the ring
 * of 20 bulbs around its edge goes dark one by one clockwise (server deadline), pulsing amber in the last 5 s
 * (no pulse in calm motion; the bulbs still go dark). REVEAL: the bulbs flash once with the lock. The question is
 * never cut: it steps from 34 sp down to 18 sp, then wraps (up to 4 lines), with em line heights (Arabic: taller).
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
            .background(androidx.compose.ui.graphics.Brush.verticalGradient(listOf(Studio.elevated, Studio.surface)), RoundedCornerShape(20.dp))
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
            .padding(horizontal = 32.dp, vertical = 16.dp),
        contentAlignment = Alignment.Center,
    ) {
        FitLines(
            q.text,
            JamaaTheme.type.headline,
            JamaaColors.Text,
            max = 34.sp,
            min = 18.sp,
            maxLines = 4,
            align = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
        )
        if (view.phase == TriviaPhase.READ && deadline != null) {
            Canvas(Modifier.align(Alignment.BottomCenter).fillMaxWidth(0.6f).height(4.dp).offset(y = 10.dp)) {
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
        // Darkness runs clockwise from the top centre: bulb 0 goes first, then 1, 2…
        val on = i >= n - lit
        val color = when {
            flash -> Color.White
            on && pulse -> JamaaColors.Accent
            on -> Studio.glow.copy(alpha = if (dim) 0.55f else 1f)
            else -> Studio.deep
        }
        if (on && !dim) drawCircle(color.copy(alpha = 0.22f), 8.dp.toPx() * pulseScale, pt) // the bulb's halo
        drawCircle(color, 4.dp.toPx() * (if (on && pulse) pulseScale else 1f), pt)
    }
}

/**
 * The never-mirrored answer grid (A top-left … D bottom-right; True left, False right), laid out under a forced
 * left-to-right direction; each tile's text keeps its own direction. READ: outlined ghosts. ANSWER: the tiles flip in
 * A→D. REVEAL: wrong tiles dim to 30 % and shrink to 0.96, the right one grows, glows, spins its shape and gets a check.
 */
@Composable
private fun AnswerGrid(view: TriviaView, clock: PhaseClock, positions: StagePositions, moveText: Boolean, modifier: Modifier) {
    val q = view.question ?: return
    val tokens = TriviaToken.forType(q.type)
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        BoxWithConstraints(modifier) {
            val rects = TriviaBoard.tiles(q.type, maxWidth.value, maxHeight.value, TriviaLayout.TILE_GAP)
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
                            GhostTile(token, clock, i, Modifier.fillMaxSize())
                        } else {
                            AnswerTile(token, view.options.getOrNull(i).orEmpty(), state, clock, i, moveText, Modifier.fillMaxSize())
                        }
                    }
                }
            }
        }
    }
}

/** READ's ghost slot: a dashed outline in the token's colour with its faint shape, so ANSWER only fills it in. */
@Composable
private fun GhostTile(token: TriviaToken, clock: PhaseClock, index: Int, modifier: Modifier) {
    val ink = token.color()
    Box(
        modifier
            .layerAppear { clock.p("ghosts") }
            .drawBehind {
                val stroke = androidx.compose.ui.graphics.drawscope.Stroke(
                    width = 2.dp.toPx(),
                    pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(10.dp.toPx(), 8.dp.toPx())),
                )
                drawRoundRect(ink.copy(alpha = 0.10f), cornerRadius = CornerRadius(16.dp.toPx()))
                drawRoundRect(ink.copy(alpha = 0.55f), cornerRadius = CornerRadius(16.dp.toPx()), style = stroke)
            },
        contentAlignment = Alignment.CenterStart,
    ) {
        TokenGlyph(token.shape, ink.copy(alpha = 0.45f), 36.dp, Modifier.padding(start = 20.dp))
        token.letter?.let { Text(it, style = JamaaTheme.type.label, color = ink.copy(alpha = 0.6f), modifier = Modifier.align(Alignment.TopStart).padding(start = 12.dp, top = 6.dp)) }
    }
}

@Composable
private fun AnswerTile(token: TriviaToken, text: String, state: TileState, clock: PhaseClock, index: Int, moveText: Boolean, modifier: Modifier) {
    val fill = token.color()
    val shape = RoundedCornerShape(16.dp)
    val correct = state == TileState.CORRECT
    val reveal = correct || state == TileState.WRONG || state == TileState.VOID
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
                    TileState.CORRECT -> {
                        alpha = if (flip > 0f) 1f else 0f
                        val s = 1f + 0.03f * out
                        scaleX = s
                        scaleY = s
                    }
                    else -> alpha = if (flip > 0f) 1f else 0f
                }
            }
            .drawBehind {
                if (correct) {
                    val g = clock.p("wrongOut").coerceIn(0f, 1f)
                    for (k in 1..2) {
                        val spread = (6 * k).dp.toPx() * g
                        drawRoundRect(
                            JamaaColors.Success.copy(alpha = 0.30f * g / k),
                            topLeft = Offset(-spread, -spread),
                            size = Size(size.width + 2 * spread, size.height + 2 * spread),
                            cornerRadius = CornerRadius(16.dp.toPx() + spread),
                        )
                    }
                }
            }
            .background(fill, shape)
            .then(if (correct) Modifier.border(BorderStroke(4.dp, JamaaColors.Success), shape) else Modifier)
            .then(if (token == TriviaToken.FALSE) Modifier.border(BorderStroke(2.dp, JamaaColors.Text.copy(alpha = 0.24f)), shape) else Modifier),
    ) {
        Row(Modifier.fillMaxSize().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.fillMaxHeight().width(52.dp)) {
                token.letter?.let {
                    Text(it, style = JamaaTheme.type.label, color = Ink, modifier = Modifier.align(Alignment.TopStart))
                }
                TokenGlyph(
                    token.shape,
                    Ink,
                    40.dp,
                    Modifier.align(Alignment.Center),
                    spin = { if (correct) clock.p("spin") else 0f },
                )
            }
            Spacer(Modifier.width(10.dp))
            val label = if (token.letter == null && text.isEmpty()) keyText(token.labelKey) else text
            // REVEAL with a crowd: the text glides (same wrap, no re-layout) into the tile's top band and shrinks so
            // the characters standing below never cover the wording (TriviaBoard.REVEAL_TEXT_BAND).
            val boxH = remember { mutableIntStateOf(0) }
            val textH = remember { mutableIntStateOf(0) }
            val rtlText = startsRtl(label)
            val glide = Modifier
                .onSizeChanged { textH.intValue = it.height }
                .graphicsLayer {
                    val m = if (moveText && reveal) clock.p("wrongOut").coerceIn(0f, 1f) else 0f
                    if (m > 0f && textH.intValue > 0) {
                        // The text box starts 8 dp into the tile: it must end above the band's lower edge.
                        val band = (TriviaBoard.REVEAL_TEXT_BAND - 10f).dp.toPx()
                        val target = minOf(0.85f, band / textH.intValue)
                        val s = 1f - (1f - target) * m
                        transformOrigin = TransformOrigin(if (rtlText) 1f else 0f, 0f)
                        scaleX = s
                        scaleY = s
                        translationY = -((boxH.intValue - textH.intValue) / 2f) * m
                    }
                }
            Box(
                Modifier.weight(1f).fillMaxHeight().onSizeChanged { boxH.intValue = it.height },
                contentAlignment = Alignment.CenterStart,
            ) {
                if (token.textOnFill) {
                    FitLines(label, JamaaTheme.type.title, Ink, max = 28.sp, min = 16.sp, maxLines = 3, modifier = Modifier.fillMaxWidth().then(glide))
                } else {
                    // False: ink on coral is 4.497:1, so the word sits on a cream strip (GAME-TRIVIA §8.2).
                    Box(glide.background(JamaaColors.Text, RoundedCornerShape(8.dp)).padding(horizontal = 12.dp, vertical = 2.dp)) {
                        FitLines(label, JamaaTheme.type.title, Ink, max = 28.sp, min = 16.sp, maxLines = 2)
                    }
                }
            }
        }
        if (correct) {
            // The right answer's check badge pops on its top end corner with the spin.
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = 8.dp, y = (-10).dp)
                    .size(30.dp)
                    .graphicsLayer {
                        val p = clock.p("spin").coerceIn(0f, 1f)
                        alpha = p
                        val s = 0.3f + 0.7f * app.jamaa.tv.ui.theme.JamaaMotion.Overshoot.transform(p)
                        scaleX = s
                        scaleY = s
                    }
                    .background(JamaaColors.Success, CircleShape)
                    .border(2.dp, JamaaColors.Text, CircleShape),
                contentAlignment = Alignment.Center,
            ) { Icon(JamaaIcons.Check, contentDescription = null, tint = Ink, modifier = Modifier.size(18.dp)) }
        }
    }
}

/**
 * The reveal's verdict in the header's status slot: Lightning thumb (bolt) / Genius / Stumped / Too slow / voided.
 * It pops in (1.3 → 1) with its step; one line, auto-sized, never cut mid-name.
 */
@Composable
internal fun RevealHeadline(view: TriviaView, clock: PhaseClock, modifier: Modifier) {
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
    val (bg, ink) = when (h) {
        TriviaBoard.Headline.GENIUS -> JamaaColors.Success to Ink
        TriviaBoard.Headline.STUMPED, TriviaBoard.Headline.TOO_SLOW -> JamaaColors.Accent to Ink
        else -> Studio.elevated to JamaaColors.Text
    }
    Row(
        modifier
            .semantics { liveRegion = LiveRegionMode.Polite }
            .graphicsLayer {
                val p = clock.p(step)
                alpha = p.coerceIn(0f, 1f)
                val s = 1.3f - 0.3f * p
                scaleX = s
                scaleY = s
            }
            .background(bg, RoundedCornerShape(50))
            .then(if (h == TriviaBoard.Headline.FASTEST) Modifier.border(BorderStroke(2.dp, Lemon), RoundedCornerShape(50)) else Modifier)
            .padding(horizontal = 16.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (h == TriviaBoard.Headline.FASTEST) {
            Icon(app.jamaa.tv.ui.components.AvatarGlyphs.of(app.jamaa.tv.AvatarShape.Bolt), contentDescription = null, tint = Lemon, modifier = Modifier.size(24.dp))
        }
        FitLines(text, JamaaTheme.type.title, ink, max = 26.sp, min = 16.sp, maxLines = 1, modifier = Modifier.weight(1f, fill = false))
    }
}

/**
 * "Did you know?" flips down over the question card at 6 s (+3 s of REVEAL): the right tile stays lit below it, the
 * fact gets the card's full width (auto-sized up to 3 lines, never cut).
 */
@Composable
private fun ExplainCard(text: String, clock: PhaseClock, modifier: Modifier) {
    Column(
        modifier
            .graphicsLayer {
                val p = clock.p("explain").coerceIn(0f, 1f)
                val hidden = clock.t() < TriviaMoments.EXPLAIN_AT && clock.moment.step("explain") != null
                alpha = if (hidden) 0f else p
                transformOrigin = TransformOrigin(0.5f, 0f)
                rotationX = -70f * (1f - p)
                cameraDistance = 14f * density
            }
            .background(Studio.elevated, RoundedCornerShape(20.dp))
            .border(BorderStroke(2.dp, JamaaColors.Success), RoundedCornerShape(20.dp))
            .padding(horizontal = 24.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(JamaaIcons.Star, contentDescription = null, tint = JamaaColors.Success, modifier = Modifier.size(18.dp))
            Text(keyText("game.trivia.reveal.didYouKnow"), style = JamaaTheme.type.label, color = JamaaColors.Success, maxLines = 1)
        }
        FitLines(text, JamaaTheme.type.body, JamaaColors.Text, max = 22.sp, min = 15.sp, maxLines = 3, modifier = Modifier.fillMaxWidth().weight(1f))
    }
}

// ---------------------------------------------------------------- LEADERBOARD (TR-TV-04)

/**
 * The leaderboard race over the whole safe area: a big title band (its end side stays clear for the platform's back
 * hint), then one row per player sharing the rest of the height (up to 84 dp each, centred: no dead zone under a
 * short board, compact rows above 8 players). Bars grow from the previous totals to the new ones (1.2 s, odometer
 * numbers), the rows re-sort with a spring, the leader's crown drops, the biggest climber gets "+n places!" in a slot
 * every row reserves (so every bar has the same length). No clip: the rows always fit (raceRowHeight), and the
 * crown drop and hops may draw past the area.
 */
@Composable
internal fun LeaderboardRace(view: TriviaView, clock: PhaseClock, modifier: Modifier) {
    val rows = TriviaBoard.raceRows(view)
    val after = TriviaBoard.towerOrder(view)
    val max = (view.players.maxOfOrNull { it.score } ?: 0).coerceAtLeast(1)
    val leaders = TriviaBoard.leaders(view)
    val climber = TriviaBoard.biggestClimber(view)
    val places = TriviaBoard.places(after)
    Column(modifier) {
        Column(Modifier.fillMaxWidth().height((TriviaLayout.HINT_BOTTOM - 8f).dp), verticalArrangement = Arrangement.Center) {
            Text(keyText("game.trivia.leaderboard.title"), style = JamaaTheme.type.displayS, color = Studio.accentText, maxLines = 1)
            Text(
                localizedTitle(view.quiz.title) + "  ·  " + keyText("game.trivia.read.questionOf", view.number.toString(), view.total.toString()),
                style = JamaaTheme.type.label,
                color = JamaaColors.TextSecondary,
                maxLines = 1,
                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                modifier = Modifier.fillMaxWidth(0.7f),
            )
        }
        Spacer(Modifier.height(8.dp))
        BoxWithConstraints(Modifier.fillMaxWidth().weight(1f)) {
            val rowH = TriviaBoard.raceRowHeight(rows.size, maxHeight.value).dp
            val top = ((maxHeight - rowH * rows.size) / 2).coerceAtLeast(0.dp)
            val charDp = (rowH.value * 0.72f).coerceIn(26f, 60f).dp
            val compact = rowH < 44.dp
            val numberStyle = when {
                rowH >= 64.dp -> JamaaTheme.type.headline
                compact -> JamaaTheme.type.label
                else -> JamaaTheme.type.title
            }
            val barH = (rowH.value * 0.28f).coerceIn(10f, 24f).dp
            rows.forEach { (p, from, to) ->
                key(p.id) {
                    val place = places.getOrNull(to) ?: (to + 1)
                    val color = app.jamaa.tv.ui.theme.PlayerSwatch.byId(p.color).color
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .height(rowH)
                            .graphicsLayer {
                                val appear = clock.p("rows", from)
                                alpha = appear.coerceIn(0f, 1f) * (if (p.left) 0.5f else 1f)
                                val y = from + (to - from) * clock.p("reorder")
                                translationY = top.toPx() + y * rowH.toPx() + (1f - appear.coerceIn(0f, 1f)) * 16.dp.toPx()
                            }
                            .drawBehind {
                                // A quiet lane per row; the leader's lane is lit in amber once the crown lands.
                                val inset = (if (compact) 2 else 4).dp.toPx()
                                val lead = if (p.id in leaders) clock.p("crown").coerceIn(0f, 1f) else 0f
                                drawRoundRect(
                                    lerpColor(Studio.surface.copy(alpha = 0.55f), JamaaColors.Accent.copy(alpha = 0.18f), lead),
                                    topLeft = Offset(0f, inset),
                                    size = Size(size.width, size.height - 2 * inset),
                                    cornerRadius = CornerRadius((size.height - 2 * inset) / 2f),
                                )
                            }
                            .padding(horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(if (compact) 8.dp else 14.dp),
                    ) {
                        Text("$place", style = numberStyle, color = if (place == 1) JamaaColors.Accent else JamaaColors.TextSecondary, modifier = Modifier.width(36.dp), textAlign = TextAlign.End, maxLines = 1)
                        Box(Modifier.size(charDp)) {
                            if (TriviaBoard.flameVisible(view, p)) FlameOverlay(TriviaBoard.flameLevel(p.streak), charDp)
                            Character(p.color, charDp, TriviaBoard.expression(view, p))
                            if (p.id in leaders) {
                                Icon(
                                    JamaaIcons.Crown,
                                    contentDescription = null,
                                    tint = JamaaColors.Accent,
                                    modifier = Modifier.size(charDp * 0.4f).align(Alignment.TopCenter).graphicsLayer {
                                        val c = clock.p("crown")
                                        alpha = c.coerceIn(0f, 1f)
                                        translationY = (1f - c) * -24.dp.toPx() - charDp.toPx() * 0.28f
                                    },
                                )
                            }
                        }
                        FitLines(
                            p.name,
                            if (compact) JamaaTheme.type.label else JamaaTheme.type.title,
                            JamaaColors.Text,
                            max = if (compact) 20.sp else 26.sp,
                            min = 14.sp,
                            maxLines = 1,
                            modifier = Modifier.width(190.dp),
                        )
                        Canvas(Modifier.weight(1f).height(barH)) {
                            val b = clock.p("bars")
                            val from0 = TriviaBoard.barShare(p.scoreBefore, max)
                            val to1 = TriviaBoard.barShare(p.score, max)
                            val f = from0 + (to1 - from0) * b
                            val rtl = layoutDirection == LayoutDirection.Rtl
                            val w = (size.width * f).coerceAtLeast(size.height)
                            drawRoundRect(Studio.deep.copy(alpha = 0.7f), cornerRadius = CornerRadius(size.height / 2f))
                            drawRoundRect(color, topLeft = Offset(if (rtl) size.width - w else 0f, 0f), size = Size(w, size.height), cornerRadius = CornerRadius(size.height / 2f))
                        }
                        Box(Modifier.width(100.dp), contentAlignment = Alignment.CenterEnd) {
                            Odometer(p.scoreBefore, p.score, { clock.p("bars") }, numberStyle, JamaaColors.Text)
                        }
                        Box(Modifier.width(if (climber != null) 132.dp else 0.dp), contentAlignment = Alignment.CenterStart) {
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
}

/**
 * A score counter (DESIGN-JAMAA §5.1): below 100 it ticks; from 100 it is an odometer, one digit column per place
 * rolling on translationY (TriviaBoard.odometer), sampled from [progress] in a layer lambda so a running count never
 * recomposes. Western digits, always left-to-right; spoken as the final value.
 */
@Composable
internal fun Odometer(from: Int, to: Int, progress: () -> Float, style: TextStyle, color: Color, modifier: Modifier = Modifier) {
    if (maxOf(from, to) < 100) {
        val shown by remember(from, to) { derivedStateOf { (from + (to - from) * progress().coerceIn(0f, 1f)).roundToInt() } }
        Text(shown.toString(), style = style, color = color, maxLines = 1, modifier = modifier)
        return
    }
    val places = TriviaBoard.odometerPlaces(from, to)
    val lineH = with(LocalDensity.current) { (if (style.lineHeight.isSpecified) style.lineHeight else style.fontSize * 1.25f).toDp() }
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Row(modifier.clearAndSetSemantics { contentDescription = to.toString() }) {
            for (k in places - 1 downTo 0) {
                Box(Modifier.height(lineH).clipToBounds()) {
                    Column(
                        Modifier
                            .wrapContentHeight(align = Alignment.Top, unbounded = true)
                            .graphicsLayer {
                                val v = from + (to - from) * progress().coerceIn(0f, 1f).toDouble()
                                val unit = Math.pow(10.0, k.toDouble())
                                // No leading zeros: a column above the current magnitude stays hidden.
                                alpha = if (k > 0 && v + 1e-6 < unit) 0f else 1f
                                translationY = -TriviaBoard.odometer(v, places)[k] * lineH.toPx()
                            },
                    ) {
                        for (d in 0..10) Text("${d % 10}", style = style, color = color, maxLines = 1, modifier = Modifier.height(lineH))
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- FINAL_INTRO (TR-TV-05)

/**
 * "Final question: double points!" hits (auto-sized, up to 2 lines in any language), then the "×2" stamp lands with
 * a burst of amber rays behind it. The block shrinks as a whole if a long translation would not fit.
 */
@Composable
internal fun FinalIntro(clock: PhaseClock, modifier: Modifier) {
    Box(modifier, contentAlignment = Alignment.Center) {
        Column(
            Modifier.widthIn(max = 760.dp).fitInside(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            FitLines(
                keyText("game.trivia.final.title"),
                JamaaTheme.type.displayM,
                JamaaColors.Text,
                max = 56.sp,
                min = 32.sp,
                maxLines = 2,
                align = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().graphicsLayer {
                    val p = clock.p("title")
                    alpha = p.coerceIn(0f, 1f)
                    val s = 1.2f - 0.2f * p
                    scaleX = s
                    scaleY = s
                },
            )
            Box(contentAlignment = Alignment.Center) {
                // The rays take no layout room (they draw past the stamp's box), so the block stays short.
                Canvas(Modifier.matchParentSize().clearAndSetSemantics {}) {
                    val p = clock.p("stamp").coerceIn(0f, 1f)
                    if (p <= 0f) return@Canvas
                    val c = Offset(size.width / 2f, size.height / 2f)
                    val r0 = size.maxDimension * 0.62f
                    val r1 = size.maxDimension * (0.68f + 0.30f * p)
                    for (i in 0 until 12) {
                        val a = i * PI / 6 + PI / 12
                        val dx = kotlin.math.cos(a).toFloat()
                        val dy = sin(a).toFloat()
                        drawLine(Lemon.copy(alpha = 0.55f * p), Offset(c.x + dx * r0, c.y + dy * r0), Offset(c.x + dx * r1, c.y + dy * r1), 5.dp.toPx(), androidx.compose.ui.graphics.StrokeCap.Round)
                    }
                }
                Text(
                    keyText("game.trivia.final.stamp"),
                    style = JamaaTheme.type.displayL.copy(fontSize = 112.sp, lineHeight = 120.sp),
                    color = JamaaColors.Accent,
                    maxLines = 1,
                    modifier = Modifier
                        .graphicsLayer {
                            val p = clock.p("stamp")
                            alpha = p.coerceIn(0f, 1f)
                            val s = 1.6f - 0.6f * p
                            scaleX = s
                            scaleY = s
                            rotationZ = -8f
                        }
                        .background(Studio.deep.copy(alpha = 0.6f), RoundedCornerShape(24.dp))
                        .border(BorderStroke(6.dp, JamaaColors.Accent), RoundedCornerShape(24.dp))
                        .padding(horizontal = 32.dp),
                )
            }
        }
    }
}

// ---------------------------------------------------------------- HOLD

@Composable
internal fun HoldCard(modifier: Modifier) {
    Column(
        modifier
            .widthIn(max = 560.dp)
            .fitInside()
            .background(Studio.surface, RoundedCornerShape(24.dp))
            .border(BorderStroke(1.dp, Studio.elevated), RoundedCornerShape(24.dp))
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(JamaaIcons.Pause, contentDescription = null, tint = Studio.glow, modifier = Modifier.size(36.dp))
        Text(keyText("game.trivia.hold.title"), style = JamaaTheme.type.headline, color = JamaaColors.Text, textAlign = TextAlign.Center)
        Text(keyText("game.trivia.hold.body"), style = JamaaTheme.type.body, color = JamaaColors.TextSecondary, textAlign = TextAlign.Center)
    }
}
