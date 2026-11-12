package app.jamaa.tv.games.bluff.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.ui.text.font.FontWeight
import app.jamaa.tv.ui.theme.JamaaMotion
import app.jamaa.tv.ui.theme.JamaaShapes
import app.jamaa.tv.ui.theme.JamaaSpace
import app.jamaa.tv.games.bluff.BluffFit
import app.jamaa.tv.games.bluff.BluffType
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.CompositionLocalProvider
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.game.Countdown
import app.jamaa.tv.games.GameScreenArgs
import app.jamaa.tv.games.bluff.BluffBoard
import app.jamaa.tv.games.bluff.BluffMoments
import app.jamaa.tv.games.bluff.BluffPhase
import app.jamaa.tv.games.bluff.BluffPrompt
import app.jamaa.tv.games.bluff.BluffView
import app.jamaa.tv.games.bluff.LengthHint
import app.jamaa.tv.games.bluff.OptionLetters
import app.jamaa.tv.games.bluff.PromptLines
import app.jamaa.tv.games.bluff.RoundKind
import app.jamaa.tv.i18n.nameList
import app.jamaa.tv.protocol.DeadlineKind
import app.jamaa.tv.protocol.DeadlineView
import app.jamaa.tv.ui.components.QrCode
import app.jamaa.tv.ui.components.RoomCode
import app.jamaa.tv.ui.components.TimerRing
import app.jamaa.tv.ui.components.rememberFrameClock
import app.jamaa.tv.ui.platform.Chip
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme
import app.jamaa.tv.ui.theme.WorldStage
import app.jamaa.tv.ui.theme.Worlds

// The Liars' Café (GAME-BLUFF §12.1, DESIGN-JAMAA §1.5 `hakawati-cafe`): code-drawn, no bitmaps.

internal val Cafe = Worlds.HakawatiCafe
internal val Gold = Color(0xFFE9A23B)
internal val GoldLight = Color(0xFFFFE3A3)
internal val HouseViolet = Color(0xFF9B7BFF)
internal val Paper = Color(0xFFFFF7EC)
internal val PaperInk = Color(0xFF2B1A0C)
internal val Cork = Color(0xFF6B4A26)
internal val LieRed: Color get() = Cafe.signal ?: Color(0xFFFF5A5F)

/** Option and prompt texts render with their own direction (an Arabic lie in an EN room, GAME-BLUFF §7). */
internal fun TextStyle.contentDir(): TextStyle = copy(textDirection = TextDirection.Content)

/**
 * The café: world stage, a warm table glow, and two hanging lanterns in the side gutters (outside the safe area, so
 * they frame the scene and never sit on the top bar's chips or the counter; a slow sway, off in calm motion).
 */
@Composable
internal fun CafeStage(view: BluffView, clock: PhaseClock) {
    WorldStage(Cafe)
    val reduce = JamaaTheme.reduceMotion
    val sway = if (reduce) null else rememberInfiniteTransition(label = "lanterns").animateFloat(-2f, 2f, infiniteRepeatable(tween(3_200, easing = JamaaMotion.Standard), RepeatMode.Reverse), label = "sway")
    // The intro beat of the reveal narrows the lantern light to the centre (DESIGN-JAMAA §5.2: glow 100 % → 55 %).
    val narrow = view.phase == BluffPhase.REVEAL
    Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
        val glowScale = if (narrow) 0.55f + 0.45f * (1f - minOf(1f, clock.t() / 600f)) else 1f
        drawRect(Brush.radialGradient(listOf(Cafe.glow.copy(alpha = 0.12f), Color.Transparent), center = Offset(size.width / 2f, size.height * 0.45f), radius = size.width * 0.55f * glowScale))
        val gutter = 24.dp.toPx()
        for ((i, x) in listOf(-gutter, size.width + gutter).withIndex()) {
            val a = (sway?.value ?: 0f) * if (i == 0) 1f else -1f
            val top = Offset(x, -JamaaSpace.SafeV.toPx())
            rotate(a, top) { lantern(top, Offset(x, size.height * 0.2f)) }
        }
    }
}

private fun DrawScope.lantern(hook: Offset, c: Offset) {
    val s = size.height / 486f
    drawLine(Cafe.elevated, hook, Offset(c.x, c.y - 26f * s), strokeWidth = 2f * s)
    drawCircle(Brush.radialGradient(listOf(Cafe.glow.copy(alpha = 0.30f), Color.Transparent), center = c, radius = 96f * s), radius = 96f * s, center = c)
    drawRoundRect(Gold, topLeft = Offset(c.x - 13f * s, c.y - 22f * s), size = Size(26f * s, 40f * s), cornerRadius = CornerRadius(8f * s))
    drawRoundRect(GoldLight.copy(alpha = 0.9f), topLeft = Offset(c.x - 8f * s, c.y - 15f * s), size = Size(16f * s, 26f * s), cornerRadius = CornerRadius(5f * s))
    drawRect(Cafe.elevated, topLeft = Offset(c.x - 15f * s, c.y - 26f * s), size = Size(30f * s, 5f * s))
}

/** The neon "BLUFF!" sign (DESIGN-JAMAA §1.6: cream tube over an amber glow, no fill); [flicker] dims the "!" once. */
@Composable
internal fun NeonTitle(style: TextStyle, modifier: Modifier = Modifier, flicker: Float = 1f) {
    val title = stringResource(R.string.game__bluff__title)
    val glow = style.copy(shadow = Shadow(Cafe.accent, Offset.Zero, 28f))
    Text(title, modifier.graphicsLayer { alpha = 0.3f + 0.7f * flicker }, style = glow, color = Paper, maxLines = 1)
}

/** Top bar: round · rule chip · ×m · prompt counter, and the timer ring (WRITING, VOTING) and room code at the end. */
@Composable
internal fun Header(view: BluffView, args: GameScreenArgs) {
    val type = JamaaTheme.type
    Row(Modifier.fillMaxWidth().height(HEADER_DP.dp), verticalAlignment = Alignment.CenterVertically) {
        val round = if (view.isFinal) stringResource(R.string.game__bluff__round__final) else stringResource(R.string.game__bluff__round__number, view.round.toString())
        Text(round.uppercase(), style = type.label, color = Cafe.accentText, maxLines = 1)
        Spacer(Modifier.width(12.dp))
        Chip(roundName(view.roundKind), fill = Cafe.surface, ink = JamaaColors.Text)
        if (view.multiplier > 1 && !view.isFinal) {
            Spacer(Modifier.width(8.dp))
            Chip("×${view.multiplier}", fill = Gold, ink = Cafe.onAccent)
        }
        if (view.phase in PROMPT_PHASES) {
            Spacer(Modifier.width(12.dp))
            Text(stringResource(R.string.game__bluff__prompt__counter, view.promptNumber.toString(), view.promptCount), style = type.caption, color = JamaaColors.TextMuted, maxLines = 1)
        }
        Spacer(Modifier.weight(1f))
        val deadline = view.deadline
        if (deadline != null && (view.phase == BluffPhase.WRITING || view.phase == BluffPhase.VOTING)) {
            val duration = remember(view.n, view.phase, view.promptIndex, view.prompt?.id) {
                val left = deadline - Countdown.serverNow(System.currentTimeMillis(), args.clockOffsetMs)
                maxOf(left, phaseEstimateMs(view))
            }
            TimerRing(DeadlineView(DeadlineKind.VOTE, deadline, duration), args.clockOffsetMs, 46.dp, 5.dp, number = type.titleS, calmColor = Paper)
            Spacer(Modifier.width(16.dp))
        }
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            Text(args.room.roomCode, style = type.label.copy(letterSpacing = type.code.letterSpacing), color = Cafe.accentText, maxLines = 1)
        }
    }
}

private val PROMPT_PHASES = setOf(BluffPhase.WRITING, BluffPhase.VOTING, BluffPhase.REVEAL, BluffPhase.SCORES)

/** The ring's full length when the phase is first seen late: GAME-BLUFF §4.1 for pace "normal" (relaxed is longer). */
private fun phaseEstimateMs(v: BluffView): Long = when (v.phase) {
    BluffPhase.WRITING -> if (v.isFinal) 75_000L else 60_000L
    BluffPhase.VOTING -> (20_000L + 2_500L * v.options.size).coerceIn(26_000L, 50_000L)
    else -> 1L
}

/** The round's name from its kind; a kind this build does not know reads "Bluff!" (never a hard-coded rule name). */
@Composable
internal fun roundName(kind: RoundKind): String = stringResource(
    when (kind) {
        RoundKind.SAYING -> R.string.game__bluff__round__saying
        RoundKind.FACT -> R.string.game__bluff__round__fact
        RoundKind.NO_TRUTH -> R.string.game__bluff__round__no_truth
        RoundKind.OTHER -> R.string.game__bluff__title
    },
)

/** The length hint chip's text, or null for a hint this build does not know (no chip). */
@Composable
internal fun hintText(h: LengthHint): String? = when (h) {
    LengthHint.SHORT -> stringResource(R.string.game__bluff__hint__short)
    LengthHint.FEW -> stringResource(R.string.game__bluff__hint__few)
    LengthHint.SENTENCE -> stringResource(R.string.game__bluff__hint__sentence)
    LengthHint.FREE -> stringResource(R.string.game__bluff__hint__free)
    LengthHint.OTHER -> null
}

// ---------------------------------------------------------------- ROUND_INTRO

/**
 * The round card (GAME-BLUFF §8.2): the neon sign, "ROUND 1" with the round dots, the round's name big, its rule. The
 * card fills the stage height when it needs to and every line auto-sizes, so a long rule (the final's, FR/ES/AR) is
 * never cut. The final is the dramatic version: the "No truth" stamp lands last.
 */
@Composable
internal fun RoundIntroCard(view: BluffView, clock: PhaseClock) {
    val type = JamaaTheme.type
    Column(Modifier.fillMaxSize().padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Column(
            Modifier
                .weight(1f, fill = false)
                .widthIn(max = 720.dp)
                .fillMaxWidth()
                .graphicsLayer {
                    val p = clock.p("card")
                    alpha = minOf(1f, p * 2f)
                    scaleX = 0.9f + 0.1f * p
                    scaleY = scaleX
                    translationY = (1f - p) * 48f * density
                }
                .background(Brush.verticalGradient(listOf(Cafe.elevated, Cafe.surface)), JamaaShapes.card)
                .border(2.dp, Cafe.accent.copy(alpha = 0.55f), JamaaShapes.card)
                .padding(horizontal = 40.dp, vertical = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // The café's neon sign flickers on once with the card (one flicker, never a strobe; DESIGN-JAMAA §1.6).
            NeonTitle(type.titleS, modifier = Modifier.graphicsLayer {
                val p = clock.p("card")
                alpha = if (p < 0.55f) p else if (p < 0.7f) 0.3f else 1f
            })
            Spacer(Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                val label = if (view.isFinal) stringResource(R.string.game__bluff__round__final) else stringResource(R.string.game__bluff__round__number, view.round.toString())
                Text(label.uppercase(), style = type.label, color = Cafe.accentText, maxLines = 1)
                RoundDots(view.round, view.roundCount) { clock.p("title") }
            }
            AutoText(
                roundName(view.roundKind),
                type.displayM.copy(shadow = Shadow(Cafe.accent, Offset.Zero, 24f)),
                Paper,
                Modifier.fillMaxWidth().graphicsLayer { val p = clock.p("title"); alpha = minOf(1f, p * 2f); scaleX = 1.12f - 0.12f * p; scaleY = scaleX },
                minSp = 28f,
                maxLines = 1,
            )
            val rule = when (view.roundKind) {
                RoundKind.SAYING -> stringResource(R.string.game__bluff__round__saying__intro)
                RoundKind.FACT -> stringResource(R.string.game__bluff__round__fact__intro)
                RoundKind.NO_TRUTH -> stringResource(R.string.game__bluff__round__no_truth__intro)
                RoundKind.OTHER -> null
            }
            if (rule != null) {
                Spacer(Modifier.height(8.dp))
                AutoText(
                    rule,
                    if (view.isFinal) type.headline else type.title,
                    JamaaColors.TextSecondary,
                    Modifier.weight(1f, fill = false).fillMaxWidth().graphicsLayer { val p = clock.p("rule"); alpha = p; translationY = (1f - p) * 16f * density },
                    minSp = 18f,
                    maxLines = 4,
                )
            }
            if (view.isFinal) {
                Spacer(Modifier.height(14.dp))
                StampLabel(stringResource(R.string.game__bluff__no_truth__chip).uppercase(), LieRed, { clock.p("stamp") })
            }
        }
    }
}

/** ● ● ○: the rounds played and to come; the current dot pops in with the title. */
@Composable
private fun RoundDots(round: Int, count: Int, pop: () -> Float) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        for (r in 1..count.coerceIn(1, 5)) {
            val current = r == round
            Box(
                Modifier.size(10.dp)
                    .graphicsLayer { if (current) { val p = pop(); scaleX = 0.4f + 0.6f * p; scaleY = scaleX } }
                    .background(if (r <= round) Gold else Color.Transparent, JamaaShapes.pill)
                    .border(2.dp, if (r <= round) Gold else Cafe.accent.copy(alpha = 0.5f), JamaaShapes.pill),
            )
        }
    }
}

/**
 * A rubber stamp driven by a choreography progress (−8°, scale 1.6 → 1 with `ease.overshoot`; DESIGN-JAMAA §5.2): at
 * progress 1 it is fully landed, so OK-completion shows it in place. The text auto-sizes (2 lines max) inside [maxWidth].
 */
@Composable
internal fun StampLabel(text: String, color: Color, progress: () -> Float, modifier: Modifier = Modifier, style: TextStyle = JamaaTheme.type.displayS, maxWidth: Dp = 560.dp) {
    Box(
        modifier
            .graphicsLayer {
                val p = progress()
                rotationZ = -8f
                val s = 1.6f - 0.6f * p
                scaleX = s
                scaleY = s
                alpha = minOf(1f, p * 3f)
            }
            .widthIn(max = maxWidth)
            .background(PaperInk.copy(alpha = 0.6f), JamaaShapes.sm)
            .border(5.dp, color, JamaaShapes.sm)
            .padding(horizontal = 20.dp, vertical = 2.dp),
    ) {
        AutoText(text, style, color, minSp = 16f, maxLines = 2)
    }
}

// ---------------------------------------------------------------- WRITING

/**
 * The prompt card: its type chip (or the round's name for a kind this build does not know), the final's permanent
 * "No right answer" chip, then the prompt big. The text auto-sizes from 44 sp down to 22 sp in the height the card is
 * given, then wraps, so a long FR/ES/AR fact is never cut. An Arabic original (a proverb, `translit` set) keeps its
 * place with the transliteration and the room-language translation under it (GAME-BLUFF §8.2, the web's promptLines).
 */
@Composable
internal fun PromptCard(view: BluffView, prompt: BluffPrompt, modifier: Modifier = Modifier) {
    val type = JamaaTheme.type
    Column(
        modifier
            .widthIn(max = 820.dp)
            .fillMaxWidth()
            .background(Paper, JamaaShapes.tile)
            .padding(horizontal = 32.dp, vertical = 18.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Chip(typeLabel(prompt, view), fill = Cafe.deep, ink = Cafe.accentText)
            if (view.isFinal) Chip(stringResource(R.string.game__bluff__no_truth__chip), fill = LieRed, ink = Paper)
            if (prompt.rerun) Chip(stringResource(R.string.game__bluff__prompt__rerun), fill = Cafe.elevated, ink = Paper)
        }
        Spacer(Modifier.height(10.dp))
        val lines = PromptLines.of(prompt)
        AutoText(lines.main, type.displayS, PaperInk, Modifier.weight(1f, fill = false).fillMaxWidth(), minSp = 22f)
        lines.translit?.let {
            Spacer(Modifier.height(4.dp))
            AutoText(it, type.body, PaperInk.copy(alpha = 0.62f), Modifier.fillMaxWidth(), minSp = 15f, maxLines = 2)
        }
        lines.sub?.let {
            Spacer(Modifier.height(4.dp))
            AutoText(it, type.title, PaperInk.copy(alpha = 0.85f), Modifier.fillMaxWidth(), minSp = 17f, maxLines = 3)
        }
    }
}

@Composable
private fun typeLabel(p: BluffPrompt, view: BluffView): String = when (p.type) {
    BluffType.PROVERB_END -> stringResource(R.string.game__bluff__type__proverb_end)
    BluffType.FACT_BLANK -> stringResource(R.string.game__bluff__type__fact_blank)
    BluffType.WORD_MEANING -> stringResource(R.string.game__bluff__type__word_meaning)
    BluffType.EXPRESSION_MEANING -> stringResource(R.string.game__bluff__type__expression_meaning)
    BluffType.NO_TRUTH -> stringResource(R.string.game__bluff__type__no_truth)
    BluffType.OTHER -> roundName(view.roundKind)
}

@Composable
internal fun WritingStage(view: BluffView, clock: PhaseClock, clockOffsetMs: Long) {
    val type = JamaaTheme.type
    val prompt = view.prompt ?: return
    val frame = rememberFrameClock()
    val lastTen by remember(view.deadline) {
        derivedStateOf {
            val d = view.deadline ?: return@derivedStateOf false
            Countdown.remainingMs(d, clockOffsetMs, frame.value) in 1..BluffMoments.WAITING_SPOTLIGHT_MS
        }
    }
    Column(Modifier.fillMaxSize().padding(vertical = 6.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        if (view.notice == app.jamaa.tv.games.bluff.BluffNotice.TOO_FAMOUS) {
            StampLabel(stringResource(R.string.game__bluff__prompt__too_famous), Gold, { clock.p("card") }, style = type.title)
            Spacer(Modifier.height(10.dp))
        }
        // The card drops onto the table: from above, a little tilted, settling with `ease.decel`.
        PromptCard(
            view, prompt,
            Modifier.weight(1f, fill = false).graphicsLayer { val p = clock.p("card"); alpha = minOf(1f, p * 1.6f); translationY = (1f - p) * -36f * density; rotationZ = (1f - p) * -2f },
        )
        Spacer(Modifier.height(12.dp))
        Row(
            Modifier.height(34.dp).graphicsLayer { val p = clock.p("hint"); alpha = p; translationY = (1f - p) * 10f * density },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            hintText(prompt.lengthHint)?.let { Chip(it, fill = Cafe.elevated, ink = Paper) }
            val waiting = view.active.filter { it.connected && !it.submitted }
            if (lastTen && waiting.isNotEmpty()) {
                Text("${stringResource(R.string.game__bluff__write__waiting_for)} ${nameList(waiting.map { it.name })}", style = type.caption, color = Cafe.accentText, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

// ---------------------------------------------------------------- VOTING

/**
 * All options as cards pinned on the corkboard (≤ 6: 1 column; 7–13: 2 columns, RTL mirrored). No author, no counts.
 * The grid takes all the height left under the title and the prompt and splits it into rows ([BluffFit]): 3 options
 * get roomy cards, 13 options 34 dp cards whose text steps down to fit, never past the café row.
 */
@Composable
internal fun VotingBoard(view: BluffView, clock: PhaseClock, rtl: Boolean) {
    val type = JamaaTheme.type
    val n = view.options.size
    val cols = BluffBoard.columns(n)
    val letters = OptionLetters.shared.of(view)
    Column(Modifier.fillMaxSize().padding(horizontal = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        // Start-aligned and clear of the end-side back hint (y 52–84 dp) that shares this line's height.
        Row(
            Modifier.fillMaxWidth().height(BluffFit.VOTE_TITLE.dp).padding(end = (BluffFit.BACK_HINT_W - 8f).dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            AutoText(
                stringResource(if (view.isFinal) R.string.game__bluff__vote__title_no_truth else R.string.game__bluff__vote__title),
                type.headline, Paper, Modifier.weight(1f, fill = false), maxSp = 30f, minSp = 20f, maxLines = 1,
            )
            view.prompt?.let { p -> hintText(p.lengthHint)?.let { Chip(it, fill = Cafe.elevated, ink = Paper) } }
            if (BluffBoard.easyOne(n)) Chip(stringResource(R.string.game__bluff__vote__easy_one), fill = Gold, ink = Cafe.onAccent)
        }
        Box(Modifier.fillMaxWidth().height(BluffFit.VOTE_PROMPT.dp), contentAlignment = Alignment.CenterStart) {
            view.prompt?.let {
                AutoText(it.display ?: it.original, type.title, JamaaColors.TextSecondary, Modifier.fillMaxWidth(), maxSp = 22f, minSp = 15f, maxLines = 2, textAlign = TextAlign.Start)
            }
        }
        Spacer(Modifier.height(8.dp))
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            val cardDp = BluffFit.optionCardDp(n, maxHeight.value)
            val textMax = BluffFit.cardTextMaxSp(cardDp)
            Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(BluffFit.VOTE_GAP.dp, Alignment.CenterVertically)) {
                for (row in 0 until BluffBoard.rows(n)) {
                    // Cells are placed by visual column (absolute order), so RTL fills from the right edge.
                    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                        Row(Modifier.fillMaxWidth().height(cardDp.dp), horizontalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterHorizontally)) {
                            for (col in 0 until cols) {
                                val index = (0 until n).firstOrNull { val c = BluffBoard.cell(it, n, rtl); c.row == row && c.col == col }
                                Box(Modifier.weight(1f).fillMaxHeight()) {
                                    if (index != null) {
                                        CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                                            OptionCard(
                                                view.options[index].text,
                                                letter = letters[view.options[index].id] ?: OptionLetters.letterOf(index),
                                                modifier = Modifier.fillMaxSize().graphicsLayer {
                                                    // Pinned one by one: a small drop and a tilt that settles (80 ms stagger).
                                                    val p = clock.p("pins", index)
                                                    alpha = minOf(1f, p * 2f)
                                                    scaleX = 0.92f + 0.08f * p
                                                    scaleY = scaleX
                                                    translationY = (1f - p) * -14f * density
                                                    rotationZ = (if (index % 2 == 0) -1f else 1f) * (1f - p) * 3f
                                                },
                                                maxSp = textMax,
                                                dense = cols == 2,
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // The "Knew it!" banner opens round 1 when someone was Spot on (their +150 is already paid): it stamps in
            // over the board, then lifts away before the cards are pinned.
            val knew = view.spotOnPlayers
            if (knew.isNotEmpty() && view.round == 1) {
                val names = nameList(knew.map { it.name })
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Box(
                        Modifier.graphicsLayer {
                            val t = clock.t()
                            val out = ((t - (BluffMoments.KNEW_IT_MS - 260)) / 260f).coerceIn(0f, 1f)
                            alpha = if (clock.completed.value) 0f else 1f - out
                            translationY = -out * 30f * density
                        },
                    ) {
                        StampLabel(stringResource(R.string.game__bluff__vote__knew_it, names), Gold, { (clock.t() / 300f).coerceIn(0f, 1f) }, style = type.headline, maxWidth = 680.dp)
                    }
                }
            }
        }
    }
}

/**
 * A pinned answer card: cream paper; the text auto-sizes from [maxSp] down to 14 sp in 2 lines (60 graphemes, GAME-BLUFF
 * §7) inside whatever height the card is given. With a [letter], the brass pin becomes a brass letter badge (A, B, C …
 * as on the phones, DESIGN-JAMAA §7.6 BL-TV-03) at the start edge (mirrored in RTL by the layout direction; the letter
 * itself stays Western), so the room can say "I went for C". [strike] crosses the text (the final's twist).
 */
@Composable
internal fun OptionCard(
    text: String,
    modifier: Modifier = Modifier,
    dense: Boolean = false,
    fill: Color = Paper,
    ink: Color = PaperInk,
    letter: Char? = null,
    maxSp: Float = if (dense) 22f else 26f,
    maxLines: Int = 2,
    strike: Boolean = false,
) {
    val badge = if (dense) 26.dp else 30.dp
    Row(
        modifier
            .background(fill, JamaaShapes.row)
            .padding(horizontal = 12.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (letter != null) {
            Box(
                Modifier.size(badge).background(Brush.radialGradient(listOf(GoldLight, Gold)), JamaaShapes.pill),
                contentAlignment = Alignment.Center,
            ) {
                Text(letter.toString(), style = (if (dense) JamaaTheme.type.caption else JamaaTheme.type.titleS).copy(textDirection = TextDirection.Ltr, fontWeight = FontWeight.Bold), color = PaperInk, maxLines = 1)
            }
        } else {
            Canvas(Modifier.size(12.dp).clearAndSetSemantics {}) {
                drawCircle(Gold, radius = size.minDimension / 2f)
                drawCircle(GoldLight, radius = size.minDimension / 5f, center = Offset(size.width * 0.38f, size.height * 0.38f))
            }
        }
        Spacer(Modifier.width(12.dp))
        Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            AutoText(text, JamaaTheme.type.title, ink, Modifier.fillMaxWidth(), maxSp = maxSp, minSp = 14f, maxLines = maxLines, textAlign = TextAlign.Start, strike = strike)
        }
    }
}

// ---------------------------------------------------------------- HOLD

@Composable
internal fun HoldCard(view: BluffView, args: GameScreenArgs) {
    val type = JamaaTheme.type
    val connected = view.active.count { it.connected }
    Row(Modifier.fillMaxSize().padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(40.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f, fill = false), horizontalAlignment = Alignment.CenterHorizontally) {
            AutoText(stringResource(R.string.game__bluff__hold__waiting, connected), type.headline, Paper, minSp = 20f, maxLines = 2)
            Spacer(Modifier.height(12.dp))
            RoomCode(args.room.roomCode, centered = true, glow = true)
        }
        QrCode(args.room.joinUrl, panel = 180.dp)
    }
}

// ---------------------------------------------------------------- props (DESIGN-JAMAA §4.5)

internal enum class Prop { PENCIL, ENVELOPE, BALLOT, PIN }

@Composable
internal fun PropGlyph(prop: Prop, size: Dp, modifier: Modifier = Modifier) {
    Canvas(modifier.size(size).clearAndSetSemantics {}) {
        val w = this.size.width
        val h = this.size.height
        when (prop) {
            Prop.PENCIL -> rotate(-35f) {
                drawRoundRect(Gold, topLeft = Offset(w * 0.4f, h * 0.05f), size = Size(w * 0.2f, h * 0.7f), cornerRadius = CornerRadius(w * 0.04f))
                val tip = Path().apply { moveTo(w * 0.4f, h * 0.75f); lineTo(w * 0.6f, h * 0.75f); lineTo(w * 0.5f, h * 0.95f); close() }
                drawPath(tip, Paper)
            }
            Prop.ENVELOPE -> {
                drawRoundRect(Paper, topLeft = Offset(0f, h * 0.2f), size = Size(w, h * 0.6f), cornerRadius = CornerRadius(w * 0.06f))
                val flap = Path().apply { moveTo(0f, h * 0.22f); lineTo(w / 2f, h * 0.55f); lineTo(w, h * 0.22f) }
                drawPath(flap, PaperInk, style = Stroke(w * 0.07f, cap = StrokeCap.Round))
            }
            Prop.BALLOT -> {
                drawRoundRect(Paper, topLeft = Offset(w * 0.12f, 0f), size = Size(w * 0.76f, h), cornerRadius = CornerRadius(w * 0.06f))
                val check = Path().apply { moveTo(w * 0.3f, h * 0.5f); lineTo(w * 0.46f, h * 0.66f); lineTo(w * 0.72f, h * 0.34f) }
                drawPath(check, Cafe.accent, style = Stroke(w * 0.09f, cap = StrokeCap.Round))
            }
            Prop.PIN -> {
                drawCircle(Gold, radius = w * 0.42f)
                drawCircle(GoldLight, radius = w * 0.16f, center = Offset(w * 0.4f, h * 0.4f))
            }
        }
    }
}

/** The fake moustache on a stick (DESIGN-JAMAA §4.5): what a liar holds when popping out, and the house's own face. */
internal fun DrawScope.moustache(center: Offset, width: Float, color: Color = PaperInk, stick: Boolean = true) {
    val h = width * 0.32f
    val p = Path().apply {
        moveTo(center.x, center.y - h * 0.2f)
        cubicTo(center.x - width * 0.18f, center.y - h * 0.9f, center.x - width * 0.42f, center.y - h * 0.4f, center.x - width * 0.5f, center.y - h * 0.9f)
        cubicTo(center.x - width * 0.46f, center.y + h * 0.5f, center.x - width * 0.16f, center.y + h * 0.4f, center.x, center.y + h * 0.1f)
        cubicTo(center.x + width * 0.16f, center.y + h * 0.4f, center.x + width * 0.46f, center.y + h * 0.5f, center.x + width * 0.5f, center.y - h * 0.9f)
        cubicTo(center.x + width * 0.42f, center.y - h * 0.4f, center.x + width * 0.18f, center.y - h * 0.9f, center.x, center.y - h * 0.2f)
        close()
    }
    if (stick) drawLine(Gold, Offset(center.x + width * 0.08f, center.y), Offset(center.x + width * 0.3f, center.y + width * 0.9f), strokeWidth = width * 0.07f, cap = StrokeCap.Round)
    drawPath(p, color)
}

/** The house character: a cream circle with a permanent moustache, no player colour (DESIGN-JAMAA §5.2). */
@Composable
internal fun HouseCharacter(size: Dp, laugh: Float, modifier: Modifier = Modifier) {
    Canvas(modifier.size(size).clearAndSetSemantics {}) {
        val r = this.size.minDimension / 2f
        val c = Offset(r, r)
        val bob = kotlin.math.sin(laugh * 12f) * r * 0.06f * laugh
        drawCircle(Paper, radius = r * 0.95f, center = c.copy(y = c.y + bob))
        // Laughing eyes: two squeezed chevrons.
        for (sx in listOf(-1f, 1f)) {
            val e = Path().apply {
                moveTo(c.x + sx * r * 0.42f, c.y - r * 0.32f + bob)
                lineTo(c.x + sx * r * 0.22f, c.y - r * 0.22f + bob)
                lineTo(c.x + sx * r * 0.42f, c.y - r * 0.12f + bob)
            }
            drawPath(e, PaperInk, style = Stroke(r * 0.09f, cap = StrokeCap.Round))
        }
        moustache(Offset(c.x, c.y + r * 0.12f + bob), r * 1.1f, stick = false)
        drawArc(PaperInk, 20f, 140f, true, topLeft = Offset(c.x - r * 0.3f, c.y + r * 0.2f + bob), size = Size(r * 0.6f, r * 0.42f))
    }
}
