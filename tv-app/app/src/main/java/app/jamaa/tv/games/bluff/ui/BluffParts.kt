package app.jamaa.tv.games.bluff.ui

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
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

/** The café: world stage, two hanging lanterns (a slow sway, off in calm motion) and a corkboard glow. */
@Composable
internal fun CafeStage(view: BluffView, clock: PhaseClock) {
    WorldStage(Cafe)
    val reduce = JamaaTheme.reduceMotion
    val sway = if (reduce) null else rememberInfiniteTransition(label = "lanterns").animateFloat(-2f, 2f, infiniteRepeatable(tween(3_200), RepeatMode.Reverse), label = "sway")
    // The intro beat of the reveal narrows the lantern light to the centre (DESIGN-JAMAA §5.2: glow 100 % → 55 %).
    val narrow = view.phase == BluffPhase.REVEAL
    Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
        val glowScale = if (narrow) 0.55f + 0.45f * (1f - minOf(1f, clock.t() / 600f)) else 1f
        drawRect(Brush.radialGradient(listOf(Cafe.glow.copy(alpha = 0.10f), Color.Transparent), center = Offset(size.width / 2f, size.height * 0.42f), radius = size.width * 0.5f * glowScale))
        for ((i, fx) in listOf(0.16f, 0.84f).withIndex()) {
            val a = (sway?.value ?: 0f) * if (i == 0) 1f else -1f
            rotate(a, Offset(size.width * fx, 0f)) { lantern(Offset(size.width * fx, size.height * 0.13f)) }
        }
    }
}

private fun DrawScope.lantern(c: Offset) {
    val s = size.height / 540f
    drawLine(Cafe.elevated, Offset(c.x, 0f), Offset(c.x, c.y - 26f * s), strokeWidth = 2f * s)
    drawCircle(Brush.radialGradient(listOf(Cafe.glow.copy(alpha = 0.28f), Color.Transparent), center = c, radius = 90f * s), radius = 90f * s, center = c)
    drawRoundRect(Gold, topLeft = Offset(c.x - 14f * s, c.y - 24f * s), size = Size(28f * s, 44f * s), cornerRadius = CornerRadius(8f * s))
    drawRoundRect(GoldLight.copy(alpha = 0.9f), topLeft = Offset(c.x - 9f * s, c.y - 16f * s), size = Size(18f * s, 28f * s), cornerRadius = CornerRadius(5f * s))
    drawRect(Cafe.elevated, topLeft = Offset(c.x - 16f * s, c.y - 28f * s), size = Size(32f * s, 5f * s))
}

/** The neon "BLUFF!" sign (DESIGN-JAMAA §1.6: cream tube over an amber glow, no fill); [flicker] dims the "!" once. */
@Composable
internal fun NeonTitle(style: TextStyle, modifier: Modifier = Modifier, flicker: Float = 1f) {
    val title = stringResource(R.string.game__bluff__title)
    val glow = style.copy(shadow = Shadow(Cafe.accent, Offset.Zero, 28f))
    Text(title, modifier.graphicsLayer { alpha = 0.3f + 0.7f * flicker }, style = glow, color = Paper, maxLines = 1)
}

/** Top bar: round · rule chip · prompt counter, and the timer ring (WRITING, VOTING) at the end. */
@Composable
internal fun Header(view: BluffView, args: GameScreenArgs) {
    val type = JamaaTheme.type
    Row(Modifier.fillMaxWidth().height(HEADER_DP.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        val round = if (view.isFinal) stringResource(R.string.game__bluff__round__final) else stringResource(R.string.game__bluff__round__number, view.round.toString())
        Text(round.uppercase(), style = type.label, color = Cafe.accentText)
        Spacer(Modifier.width(12.dp))
        Chip(roundName(view.roundKind), fill = Cafe.surface, ink = JamaaColors.Text)
        if (view.multiplier > 1 && !view.isFinal) {
            Spacer(Modifier.width(8.dp))
            Chip("×${view.multiplier}", fill = Gold, ink = Cafe.onAccent)
        }
        if (view.phase in PROMPT_PHASES) {
            Spacer(Modifier.width(12.dp))
            Text(stringResource(R.string.game__bluff__prompt__counter, view.promptNumber.toString(), view.promptCount), style = type.caption, color = JamaaColors.TextMuted)
        }
        Spacer(Modifier.weight(1f))
        val deadline = view.deadline
        if (deadline != null && (view.phase == BluffPhase.WRITING || view.phase == BluffPhase.VOTING)) {
            val duration = remember(view.n, view.phase, view.promptIndex, view.prompt?.id) {
                val left = deadline - Countdown.serverNow(System.currentTimeMillis(), args.clockOffsetMs)
                maxOf(left, phaseEstimateMs(view))
            }
            TimerRing(DeadlineView(DeadlineKind.VOTE, deadline, duration), args.clockOffsetMs, 52.dp, 5.dp, number = type.title, calmColor = Paper)
            Spacer(Modifier.width(16.dp))
        }
        CompositionLocalProvider(androidx.compose.ui.platform.LocalLayoutDirection provides LayoutDirection.Ltr) {
            Text(args.room.roomCode, style = type.label.copy(letterSpacing = type.code.letterSpacing), color = Cafe.accentText)
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

@Composable
internal fun roundName(kind: RoundKind): String = stringResource(
    when (kind) {
        RoundKind.SAYING -> R.string.game__bluff__round__saying
        RoundKind.FACT -> R.string.game__bluff__round__fact
        RoundKind.NO_TRUTH -> R.string.game__bluff__round__no_truth
    },
)

@Composable
internal fun hintText(h: LengthHint): String = stringResource(
    when (h) {
        LengthHint.SHORT -> R.string.game__bluff__hint__short
        LengthHint.FEW -> R.string.game__bluff__hint__few
        LengthHint.SENTENCE -> R.string.game__bluff__hint__sentence
        LengthHint.FREE -> R.string.game__bluff__hint__free
    },
)

// ---------------------------------------------------------------- ROUND_INTRO

/** Full-screen round card (GAME-BLUFF §8.2); the final is the dramatic version with the "No truth" stamp. */
@Composable
internal fun RoundIntroCard(view: BluffView, clock: PhaseClock) {
    val type = JamaaTheme.type
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            Modifier
                .widthIn(max = 720.dp)
                .graphicsLayer {
                    val p = clock.p("card")
                    alpha = minOf(1f, p * 2f)
                    scaleX = 0.86f + 0.14f * p
                    scaleY = scaleX
                    translationY = (1f - p) * 60f * density
                }
                .background(Cafe.surface, RoundedCornerShape(28.dp))
                .border(2.dp, Cafe.accent.copy(alpha = 0.5f), RoundedCornerShape(28.dp))
                .padding(horizontal = 48.dp, vertical = 36.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // The café's neon sign flickers on once with the card (one flicker, never a strobe; DESIGN-JAMAA §1.6).
            NeonTitle(type.title, flicker = 1f, modifier = Modifier.graphicsLayer {
                val p = clock.p("card")
                alpha = if (p < 0.55f) p else if (p < 0.7f) 0.3f else 1f
            })
            val label = if (view.isFinal) stringResource(R.string.game__bluff__round__final) else stringResource(R.string.game__bluff__round__number, view.round.toString())
            Text(label.uppercase(), style = type.label, color = Cafe.accentText)
            Spacer(Modifier.height(8.dp))
            Text(
                roundName(view.roundKind),
                Modifier.graphicsLayer { val p = clock.p("title"); alpha = minOf(1f, p * 2f); scaleX = 1.2f - 0.2f * p; scaleY = scaleX },
                style = type.displayM.copy(shadow = Shadow(Cafe.accent, Offset.Zero, 24f)),
                color = Paper,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(16.dp))
            val rule = stringResource(
                when (view.roundKind) {
                    RoundKind.SAYING -> R.string.game__bluff__round__saying__intro
                    RoundKind.FACT -> R.string.game__bluff__round__fact__intro
                    RoundKind.NO_TRUTH -> R.string.game__bluff__round__no_truth__intro
                },
            )
            Text(
                rule,
                Modifier.graphicsLayer { val p = clock.p("rule"); alpha = p; translationY = (1f - p) * 16f * density },
                style = if (view.isFinal) type.headline else type.title,
                color = JamaaColors.TextSecondary,
                textAlign = TextAlign.Center,
            )
            if (view.isFinal) {
                Spacer(Modifier.height(20.dp))
                StampLabel(stringResource(R.string.game__bluff__no_truth__chip).uppercase(), LieRed, { clock.p("stamp") })
            }
        }
    }
}

/**
 * A rubber stamp driven by a choreography progress (−8°, scale 1.6 → 1 with `ease.overshoot`; DESIGN-JAMAA §5.2): at
 * progress 1 it is fully landed, so OK-completion shows it in place.
 */
@Composable
internal fun StampLabel(text: String, color: Color, progress: () -> Float, modifier: Modifier = Modifier, style: TextStyle = JamaaTheme.type.displayS) {
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
            .background(PaperInk.copy(alpha = 0.55f), RoundedCornerShape(10.dp))
            .border(5.dp, color, RoundedCornerShape(10.dp))
            .padding(horizontal = 22.dp, vertical = 4.dp),
    ) {
        Text(text, style = style, color = color, textAlign = TextAlign.Center, maxLines = 2)
    }
}

// ---------------------------------------------------------------- WRITING

/** The prompt card with its type chip, the length hint and, in the final, the permanent "No right answer" chip. */
@Composable
internal fun PromptCard(view: BluffView, prompt: BluffPrompt, modifier: Modifier = Modifier, compact: Boolean = false) {
    val type = JamaaTheme.type
    Column(
        modifier
            .widthIn(max = if (compact) 640.dp else 760.dp)
            .background(Paper, RoundedCornerShape(22.dp))
            .padding(horizontal = 36.dp, vertical = if (compact) 16.dp else 26.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Chip(typeLabel(prompt), fill = Cafe.deep, ink = Cafe.accentText)
            if (view.isFinal) Chip(stringResource(R.string.game__bluff__no_truth__chip), fill = LieRed, ink = Paper)
            if (prompt.rerun) Chip(stringResource(R.string.game__bluff__prompt__rerun), fill = Cafe.elevated, ink = Paper)
        }
        Spacer(Modifier.height(if (compact) 8.dp else 14.dp))
        // The room-language text is the headline. Only an Arabic proverb (translit set) keeps its original on top, then
        // the transliteration, then the room-language translation (smaller): GAME-BLUFF §8.2, the web's promptLines.
        val lines = PromptLines.of(prompt)
        Text(lines.main, style = (if (compact) type.headline else type.displayS).contentDir(), color = PaperInk, textAlign = TextAlign.Center)
        lines.translit?.let {
            Spacer(Modifier.height(4.dp))
            Text(it, style = type.body.contentDir(), color = PaperInk.copy(alpha = 0.62f), textAlign = TextAlign.Center)
        }
        lines.sub?.let {
            Spacer(Modifier.height(6.dp))
            Text(it, style = type.title.contentDir(), color = PaperInk.copy(alpha = 0.85f), textAlign = TextAlign.Center)
        }
    }
}

@Composable
private fun typeLabel(p: BluffPrompt): String = stringResource(
    when (p.type) {
        app.jamaa.tv.games.bluff.BluffType.PROVERB_END -> R.string.game__bluff__type__proverb_end
        app.jamaa.tv.games.bluff.BluffType.FACT_BLANK -> R.string.game__bluff__type__fact_blank
        app.jamaa.tv.games.bluff.BluffType.WORD_MEANING -> R.string.game__bluff__type__word_meaning
        app.jamaa.tv.games.bluff.BluffType.EXPRESSION_MEANING -> R.string.game__bluff__type__expression_meaning
        app.jamaa.tv.games.bluff.BluffType.NO_TRUTH -> R.string.game__bluff__type__no_truth
    },
)

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
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        if (view.notice == app.jamaa.tv.games.bluff.BluffNotice.TOO_FAMOUS) {
            StampLabel(stringResource(R.string.game__bluff__prompt__too_famous), Gold, { clock.p("card") }, style = type.title)
            Spacer(Modifier.height(12.dp))
        }
        PromptCard(
            view, prompt,
            Modifier.graphicsLayer { val p = clock.p("card"); alpha = p; translationY = (1f - p) * -40f * density; rotationZ = (1f - p) * -2f },
        )
        Spacer(Modifier.height(14.dp))
        Row(
            Modifier.graphicsLayer { alpha = clock.p("hint") },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Chip(hintText(prompt.lengthHint), fill = Cafe.elevated, ink = Paper)
            val waiting = view.active.filter { it.connected && !it.submitted }
            if (lastTen && waiting.isNotEmpty()) {
                Text("${stringResource(R.string.game__bluff__write__waiting_for)} ${nameList(waiting.map { it.name })}", style = type.caption, color = Cafe.accentText, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

// ---------------------------------------------------------------- VOTING

/** All options as cards pinned on the corkboard (≤ 6: 1 column; 7–13: 2 columns, RTL mirrored). No author, no counts. */
@Composable
internal fun VotingBoard(view: BluffView, clock: PhaseClock, rtl: Boolean) {
    val type = JamaaTheme.type
    val n = view.options.size
    val cols = BluffBoard.columns(n)
    val letters = OptionLetters.shared.of(view)
    Column(Modifier.fillMaxSize().padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                stringResource(if (view.isFinal) R.string.game__bluff__vote__title_no_truth else R.string.game__bluff__vote__title),
                style = type.headline, color = Paper,
            )
            view.prompt?.let { Chip(hintText(it.lengthHint), fill = Cafe.elevated, ink = Paper) }
            if (BluffBoard.easyOne(n)) Chip(stringResource(R.string.game__bluff__vote__easy_one), fill = Gold, ink = Cafe.onAccent)
        }
        view.prompt?.let {
            Text(it.display ?: it.original, style = type.body.contentDir(), color = JamaaColors.TextSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.height(10.dp))
        Box(Modifier.weight(1f).fillMaxWidth()) {
            // The "Knew it!" banner opens round 1 when someone was Spot on (their +150 is already paid).
            val knew = view.spotOnPlayers
            if (knew.isNotEmpty() && view.round == 1) {
                val names = nameList(knew.map { it.name })
                Box(
                    Modifier.align(Alignment.Center).graphicsLayer {
                        val t = clock.t()
                        alpha = when {
                            clock.completed.value -> 0f
                            t < 200 -> t / 200f
                            t < BluffMoments.KNEW_IT_MS - 200 -> 1f
                            else -> ((BluffMoments.KNEW_IT_MS - t) / 200f).coerceIn(0f, 1f)
                        }
                    },
                ) { StampLabel(stringResource(R.string.game__bluff__vote__knew_it, names), Gold, { 1f }, style = type.headline) }
            }
            Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically)) {
                for (row in 0 until BluffBoard.rows(n)) {
                    // Cells are placed by visual column (absolute order), so RTL fills from the right edge.
                    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterHorizontally)) {
                            for (col in 0 until cols) {
                                val index = (0 until n).firstOrNull { val c = BluffBoard.cell(it, n, rtl); c.row == row && c.col == col }
                                Box(Modifier.weight(1f)) {
                                    if (index != null) {
                                        CompositionLocalProvider(LocalLayoutDirection provides if (rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
                                            OptionCard(
                                                view.options[index].text,
                                                letter = letters[view.options[index].id] ?: OptionLetters.letterOf(index),
                                                modifier = Modifier.fillMaxWidth().graphicsLayer {
                                                    val p = clock.p("pins", index)
                                                    alpha = minOf(1f, p * 2f)
                                                    scaleX = 0.9f + 0.1f * p
                                                    scaleY = scaleX
                                                    rotationZ = (if (index % 2 == 0) -1f else 1f) * (1f - p) * 4f
                                                },
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
        }
    }
}

/**
 * A pinned answer card: cream paper, 2 lines max (60 graphemes fit at body size, GAME-BLUFF §7). With a [letter], the
 * brass pin becomes a brass letter badge (A, B, C … as on the phones, DESIGN-JAMAA §7.6 BL-TV-03) at the start edge
 * (mirrored in RTL by the layout direction; the letter itself stays Western), so the room can say "I went for C".
 */
@Composable
internal fun OptionCard(text: String, modifier: Modifier = Modifier, dense: Boolean = false, fill: Color = Paper, ink: Color = PaperInk, letter: Char? = null) {
    val badge = if (dense) 26.dp else 32.dp
    Box(
        modifier
            .background(fill, RoundedCornerShape(14.dp))
            .padding(horizontal = if (letter != null) 12.dp else 20.dp, vertical = if (dense) 8.dp else 12.dp),
    ) {
        Text(
            text,
            Modifier.fillMaxWidth().padding(start = if (letter != null) badge + 12.dp else 18.dp),
            style = (if (dense) JamaaTheme.type.body else JamaaTheme.type.title).contentDir(),
            color = ink,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        if (letter != null) {
            Box(
                Modifier.align(Alignment.CenterStart).size(badge).background(Brush.radialGradient(listOf(GoldLight, Gold)), RoundedCornerShape(50)),
                contentAlignment = Alignment.Center,
            ) {
                Text(letter.toString(), style = (if (dense) JamaaTheme.type.caption else JamaaTheme.type.titleS).copy(textDirection = TextDirection.Ltr), color = PaperInk, maxLines = 1)
            }
        } else {
            Canvas(Modifier.align(Alignment.CenterStart).size(12.dp).clearAndSetSemantics {}) {
                drawCircle(Gold, radius = size.minDimension / 2f)
                drawCircle(GoldLight, radius = size.minDimension / 5f, center = Offset(size.width * 0.38f, size.height * 0.38f))
            }
        }
    }
}

// ---------------------------------------------------------------- HOLD

@Composable
internal fun HoldCard(view: BluffView, args: GameScreenArgs) {
    val type = JamaaTheme.type
    val connected = view.active.count { it.connected }
    Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(40.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(stringResource(R.string.game__bluff__hold__waiting, connected), style = type.headline, color = Paper, textAlign = TextAlign.Center)
            Spacer(Modifier.height(12.dp))
            RoomCode(args.room.roomCode, centered = true, glow = true)
        }
        QrCode(args.room.joinUrl, panel = 200.dp)
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
