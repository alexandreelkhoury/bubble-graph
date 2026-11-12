package app.jamaa.tv.games.bluff.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.sp
import app.jamaa.tv.games.bluff.BluffFit
import app.jamaa.tv.ui.theme.JamaaMotion
import app.jamaa.tv.ui.theme.JamaaShapes
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.key
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.ui.AbsoluteAlignment
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.game.Names
import app.jamaa.tv.games.bluff.BluffBoard
import app.jamaa.tv.games.bluff.BluffNotice
import app.jamaa.tv.games.bluff.BluffOdometer
import app.jamaa.tv.games.bluff.BluffPhase
import app.jamaa.tv.games.bluff.BluffPlayer
import app.jamaa.tv.games.bluff.BluffScript
import app.jamaa.tv.games.bluff.BluffView
import app.jamaa.tv.games.bluff.Coin
import app.jamaa.tv.games.bluff.CoinSource
import app.jamaa.tv.games.bluff.OptionLetters
import app.jamaa.tv.games.bluff.OptionKind
import app.jamaa.tv.games.bluff.RevealStep
import app.jamaa.tv.games.bluff.Segment
import app.jamaa.tv.games.bluff.SegmentKind
import app.jamaa.tv.i18n.isolate
import app.jamaa.tv.platform.CharacterRules
import app.jamaa.tv.platform.Expression
import app.jamaa.tv.platform.ReactionTracker
import app.jamaa.tv.protocol.GameEnvelope
import app.jamaa.tv.protocol.RoomPublic
import app.jamaa.tv.protocol.member
import app.jamaa.tv.ui.characters.Character
import app.jamaa.tv.ui.components.Avatar
import app.jamaa.tv.ui.components.AvatarGlyphs
import app.jamaa.tv.ui.components.AvatarState
import app.jamaa.tv.ui.components.Confetti
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme
import app.jamaa.tv.ui.theme.PlayerSwatch
import kotlin.math.roundToInt

// ---------------------------------------------------------------- the café row (every phase but SCORES / AWARDS)

/**
 * Every player's character at a café table, in seat order (mirrored in RTL). Public data only (DESIGN-JAMAA §4.3):
 * `doneIds` / `awaitedIds` (scribbling `think`, envelope or ballot `done`), reactions from phones, `away`; in REVEAL the
 * script's event expressions. A character travelling to the spotlight card leaves an empty chair here. Name plates are
 * bounded by the seat width and auto-size down (12 players beside the score rail), never overlapping a neighbour's.
 */
@Composable
internal fun CafeRow(
    view: BluffView,
    env: GameEnvelope,
    room: RoomPublic,
    clock: PhaseClock,
    script: BluffScript?,
    geo: StageGeometry,
    rtl: Boolean,
    clockOffsetMs: Long,
) {
    val type = JamaaTheme.type
    val sizeDp = geo.row.characterDp
    val reactions = rememberReactions(room)
    val seatDp = (geo.seatW / geo.density).coerceAtMost(sizeDp + 64f)
    Box(Modifier.fillMaxSize()) {
        Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
            // The café's long marble counter under the chairs.
            val y = geo.rowCenterY + geo.dp(sizeDp) * 0.52f
            val x0 = geo.stageLeft(rtl) + geo.dp(16)
            val x1 = geo.stageLeft(rtl) + geo.rowWidth - geo.dp(16)
            drawLine(Cafe.elevated, Offset(x0, y), Offset(x1, y), strokeWidth = geo.dp(5), cap = StrokeCap.Round)
            drawLine(Cafe.accent.copy(alpha = 0.18f), Offset(x0, y - geo.dp(3)), Offset(x1, y - geo.dp(3)), strokeWidth = geo.dp(1))
        }
        for ((i, p) in view.players.withIndex()) {
            val member = room.member(p.id)
            val away by remember(script, p.id) {
                derivedStateOf { script != null && travelling(script, p.id, clock.t()) }
            }
            val event by remember(script, p.id) {
                derivedStateOf { script?.expressionOf(p.id, clock.t()) }
            }
            val expr = when {
                member == null || p.left -> Expression.AWAY
                // A reveal beat (fooled, smug, cheering…) outranks a phone reaction; between beats reactions play.
                else -> CharacterRules.expression(member, env, if (event != null) null else reactions[p.id], event ?: Expression.IDLE)
            }
            val x = geo.seatX(i, rtl)
            val w = geo.dp(seatDp)
            Column(
                Modifier
                    .align(AbsoluteAlignment.TopLeft)
                    .absoluteOffset { IntOffset((x - w / 2f).roundToInt(), (geo.rowCenterY - geo.dp(sizeDp) / 2f).roundToInt()) }
                    .width(seatDp.dp)
                    .graphicsLayer {
                        // The row slides in with the WRITING moment (characters sit down at their tables, 40 ms stagger).
                        val q = if (view.phase == BluffPhase.WRITING) clock.p("row", i) else 1f
                        translationY = (1f - q) * 40f * density
                        alpha = if (away) 0.18f else 1f
                    },
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box {
                    Character(p.color, sizeDp.dp, expr, state = AvatarState(away = !p.connected, host = p.isHost, left = p.left))
                    val prop = when {
                        view.phase == BluffPhase.WRITING && p.submitted -> Prop.ENVELOPE
                        view.phase == BluffPhase.WRITING && p.connected && !p.left -> Prop.PENCIL
                        view.phase == BluffPhase.VOTING && p.id in env.doneIds -> Prop.BALLOT
                        view.phase == BluffPhase.VOTING && p.spotOn -> Prop.PIN
                        else -> null
                    }
                    if (prop != null) PropGlyph(prop, (sizeDp * 0.42f).dp, Modifier.align(Alignment.BottomEnd))
                }
                if (geo.row.names) {
                    val tag = when {
                        p.isNew -> stringResource(R.string.game__bluff__scores__new)
                        view.phase == BluffPhase.VOTING && p.spotOn -> stringResource(R.string.game__bluff__reveal__knew_it_pin)
                        else -> null
                    }
                    if (tag != null) {
                        AutoText(tag, type.caption, Cafe.onAccent, Modifier.background(Gold, JamaaShapes.xs).padding(horizontal = 6.dp), maxSp = 18f, minSp = 12f, maxLines = 1)
                    } else {
                        AutoText(p.name, type.caption, if (p.left) JamaaColors.TextMuted else Paper, Modifier.fillMaxWidth().padding(horizontal = 2.dp), maxSp = 20f, minSp = 13f, maxLines = 1)
                    }
                }
            }
        }
    }
}

/**
 * Phone reactions (REACT) currently playing, keyed by member id; each ends [CharacterRules.REACTION_MS] after it
 * started. A members snapshot only feeds the tracker (it never suspends, so a later snapshot cannot cancel anything);
 * each reaction is removed by its own effect, keyed by (member, start), which a newer reaction of that member replaces.
 * JAMAA-GAP: GameViewModel's tracker is not exposed through GameScreenArgs, so the screen keeps its own (same rule).
 */
@Composable
private fun rememberReactions(room: RoomPublic): Map<String, String> {
    val tracker = remember { ReactionTracker() }
    val active = remember { mutableStateMapOf<String, Pair<String, Long>>() }
    LaunchedEffect(room.members) {
        val now = System.currentTimeMillis()
        for (id in tracker.update(room.members, now)) tracker.activeFor(id, now)?.let { active[id] = it to now }
    }
    for ((id, entry) in active.toList()) {
        key(id, entry.second) {
            LaunchedEffect(id, entry.second) {
                kotlinx.coroutines.delay((CharacterRules.REACTION_MS - (System.currentTimeMillis() - entry.second)).coerceAtLeast(0L))
                if (active[id]?.second == entry.second) active.remove(id)
            }
        }
    }
    return active.mapValues { it.value.first }
}

/** Who sits on the spotlight card in [seg] (truth: Spot-on players first, then the finders), with their hop sub-step. */
private fun travellers(seg: Segment): List<Pair<String, String>> {
    val st = seg.step ?: return emptyList()
    return when (seg.kind) {
        SegmentKind.LIE, SegmentKind.HOUSE, SegmentKind.QUICK -> st.voterIds.map { it to "jump" }
        SegmentKind.TRUTH -> st.spotOnIds.map { it to "pins" } + st.voterIds.map { it to "jump" }
        else -> emptyList()
    }
}

private fun travelling(script: BluffScript, id: String, t: Long): Boolean {
    if (t >= script.totalMs) return false
    val seg = script.segmentAt(t) ?: return false
    val local = t - seg.startMs
    val sub = travellers(seg).firstOrNull { it.first == id }?.second ?: return false
    return local >= (seg.sub(sub)?.step?.startMs ?: 0)
}

// ---------------------------------------------------------------- the reveal (GAME-BLUFF §12.2 / §12.2.1)

/**
 * The reveal script drawn over the stage. One layout for every count (BL-TV-05, [BluffFit]): the progress strip of
 * stamped answers (their letter badges) at the top, the fooled players perched on the spotlight card's top edge, the
 * card with its stamp on the end corner, and under it the liar(s) popping out with "Rami fooled 2!" (or the truth's
 * verdict and note). The score rail holds the end side. Every beat enters and leaves on the script clock: a stamped
 * card shrinks into its strip badge while its voters hop back to their chairs, so nothing ever snaps.
 */
@Composable
internal fun RevealStage(view: BluffView, clock: PhaseClock, script: BluffScript, geo: StageGeometry, rtl: Boolean) {
    val seg by remember(script) { derivedStateOf { script.segmentAt(clock.t()) } }
    val current = seg ?: return
    Box(Modifier.fillMaxSize()) {
        ScoreRail(view, clock, script, geo, rtl)
        if (current.kind != SegmentKind.INTRO && current.kind != SegmentKind.TWIST && current.kind != SegmentKind.NOBODY &&
            !(current.kind == SegmentKind.END && script.rest?.kind == SegmentKind.CROWN) && current.kind != SegmentKind.CROWN
        ) {
            ProgressStrip(view, clock, script, geo, rtl)
        }
        when (current.kind) {
            SegmentKind.INTRO -> IntroBeat(view, clock, current, script, geo, rtl)
            SegmentKind.QUICK, SegmentKind.LIE, SegmentKind.HOUSE, SegmentKind.TRUTH, SegmentKind.FINAL_ANSWER ->
                SpotlightCard(view, clock, current, script, geo, rtl)
            SegmentKind.CROWN -> CrownBeat(view, clock, current, script, geo, rtl)
            SegmentKind.TWIST -> TwistBeat(clock, current, script, geo, rtl)
            SegmentKind.NOBODY -> NobodyMontage(view, clock, current, script, geo, rtl)
            SegmentKind.LIKES -> LikesTally(clock, current, geo, rtl)
            SegmentKind.END -> RestingFrame(view, clock, script, geo, rtl)
        }
        Coins(view, clock, script, geo, rtl)
    }
}

/** Segments that put one answer card under the spotlight. */
private val CARD_KINDS = setOf(SegmentKind.QUICK, SegmentKind.LIE, SegmentKind.HOUSE, SegmentKind.TRUTH, SegmentKind.FINAL_ANSWER)

/**
 * The exit of [seg]'s card in the segment's last [BluffScript.HOLD_MS] (no step runs there): 0 → 1, accelerating. None
 * for the resting card, nor for the script's last card (it stays as the resting frame).
 */
private fun exitP(seg: Segment, t: Long, script: BluffScript, resting: Boolean): Float {
    if (resting || seg.index == script.segments.lastIndex) return 0f
    val q = ((t - (seg.endMs - BluffScript.HOLD_MS)).toFloat() / BluffScript.HOLD_MS).coerceIn(0f, 1f)
    return q * q
}

/** The strip slot of [seg]'s card: how many answers were stamped before it (earlier badges never move). */
private fun slotOf(seg: Segment, script: BluffScript): Int = script.segments.count { it.index < seg.index && it.kind in CARD_KINDS && it.step != null }

/** A strip badge's ring: red lie, violet house, gold truth; the final's answers are all brass (no stamp exists). */
private fun badgeColor(kind: OptionKind, final: Boolean): Color = if (final) Gold else stampColor(kind)

/**
 * The answers already revealed, as their letter badges (A, C, B…) in reveal order from the start edge: full words
 * never fit 12 chips, a letter always does, and the room voted by letter. Each badge pops in as its card arrives.
 */
@Composable
private fun BoxScope.ProgressStrip(view: BluffView, clock: PhaseClock, script: BluffScript, geo: StageGeometry, rtl: Boolean) {
    val letters = OptionLetters.shared.of(view)
    val arrivals = remember(script) { script.segments.filter { it.kind in CARD_KINDS && it.step != null }.map { it.step!! to it.endMs } }
    val shown by remember(script) { derivedStateOf { arrivals.count { clock.t() >= it.second || clock.t() >= script.totalMs } } }
    for (k in 0 until shown) {
        val (st, at) = arrivals[k]
        Box(
            Modifier
                .align(AbsoluteAlignment.TopLeft)
                .atPx(geo, geo.dp(30), geo.dp(30)) { Offset(geo.stripX(k, rtl), geo.stripY) }
                .size(30.dp)
                .graphicsLayer {
                    val q = if (clock.completed.value) 1f else ((clock.t() - at) / 220f).coerceIn(0f, 1f)
                    val s = if (script.reduced) 1f else 0.4f + 0.6f * overshoot(q)
                    scaleX = s
                    scaleY = s
                    alpha = if (script.reduced) q else 1f
                }
                .background(if (st.kind == OptionKind.TRUTH && !script.reveal.final) Gold else Cafe.surface, JamaaShapes.pill)
                .border(3.dp, badgeColor(st.kind, script.reveal.final), JamaaShapes.pill),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                (letters[st.optionId] ?: '·').toString(),
                style = JamaaTheme.type.caption.copy(fontWeight = FontWeight.Bold, textDirection = TextDirection.Ltr),
                color = if (st.kind == OptionKind.TRUTH && !script.reveal.final) PaperInk else Paper,
                maxLines = 1,
            )
        }
    }
}

private fun overshoot(q: Float): Float = JamaaMotion.Overshoot.transform(q.coerceIn(0f, 1f))

/**
 * The resting frame after the script (natural end or OK-completion), held until SCORES. Rounds 1–2: the gold TRUTH
 * card with its stamp landed, the note and the found-early tag, every badge in the strip, the rail at the final
 * scores (characters back in their chairs). Final: the MOST CONVINCING card(s) with the crown, under the
 * "No truth: it was all made up!" banner. When a montage ran after the last card, the frame fades back in.
 */
@Composable
private fun RestingFrame(view: BluffView, clock: PhaseClock, script: BluffScript, geo: StageGeometry, rtl: Boolean) {
    val rest = script.rest ?: return
    val direct = rest.index == script.segments.lastIndex
    Box(
        Modifier.fillMaxSize().graphicsLayer {
            alpha = if (direct || clock.completed.value) 1f else ((clock.t() - script.totalMs) / 300f).coerceIn(0f, 1f)
        },
    ) {
        if (rest.kind != SegmentKind.CROWN) {
            SpotlightCard(view, clock, rest, script, geo, rtl, resting = true)
            return@Box
        }
        CrownBeat(view, clock, rest, script, geo, rtl)
        Box(
            Modifier.align(AbsoluteAlignment.TopLeft).atPx(geo, geo.rowWidth, geo.dp(BluffFit.STRIP + 6)) { Offset(geo.cardCenterX(rtl), geo.stripY + geo.dp(4)) }
                .size((geo.rowWidth / geo.density).dp, (BluffFit.STRIP + 6).dp),
            contentAlignment = Alignment.Center,
        ) {
            AutoText(
                stringResource(R.string.game__bluff__reveal__no_truth_stamp), JamaaTheme.type.title, Paper,
                Modifier.background(LieRed, JamaaShapes.pill).padding(horizontal = 18.dp), maxSp = 22f, minSp = 14f, maxLines = 1,
            )
        }
    }
}

/** Positions a composable of [wPx] × [hPx] centred on an absolute stage point (px), recomputed in the layout phase only. */
private fun Modifier.atPx(geo: StageGeometry, wPx: Float, hPx: Float, center: () -> Offset): Modifier =
    this.absoluteOffset {
        val c = center()
        IntOffset((c.x - wPx / 2f).roundToInt(), (c.y - hPx / 2f).roundToInt())
    }

private fun Modifier.at(geo: StageGeometry, wDp: Int, hDp: Int, center: () -> Offset): Modifier = atPx(geo, geo.dp(wDp), geo.dp(hDp), center)

private fun StageGeometry.dpOf(px: Float) = (px / density).dp

/**
 * The intro beat: the corkboard's letter badges slide down and away while the lantern light narrows, and the prompt
 * comes back up as a cream card in the spotlight's place (final: "Which one did you believe?" over it).
 */
@Composable
private fun IntroBeat(view: BluffView, clock: PhaseClock, seg: Segment, script: BluffScript, geo: StageGeometry, rtl: Boolean) {
    val type = JamaaTheme.type
    val letters = OptionLetters.shared.of(view)
    Box(Modifier.fillMaxSize()) {
        Row(
            Modifier
                .align(AbsoluteAlignment.TopLeft)
                .atPx(geo, geo.cardW, geo.dp(40)) { Offset(geo.cardCenterX(rtl), geo.liarY) }
                .size(geo.dpOf(geo.cardW), 40.dp)
                .graphicsLayer {
                    val p = seg.p("dim", clock.t())
                    translationY = p * 120f * density
                    alpha = 1f - p
                },
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            for ((i, o) in view.options.withIndex()) {
                Box(Modifier.size(32.dp).background(Brush.radialGradient(listOf(GoldLight, Gold)), JamaaShapes.pill), contentAlignment = Alignment.Center) {
                    Text((letters[o.id] ?: OptionLetters.letterOf(i)).toString(), style = type.caption.copy(fontWeight = FontWeight.Bold, textDirection = TextDirection.Ltr), color = PaperInk)
                }
            }
        }
        Column(
            Modifier
                .align(AbsoluteAlignment.TopLeft)
                .atPx(geo, geo.cardW, geo.cardH + geo.dp(BluffFit.PERCH)) { Offset(geo.cardCenterX(rtl), geo.cardCenterY - geo.dp(BluffFit.PERCH) / 2f) }
                .size(geo.dpOf(geo.cardW), geo.dpOf(geo.cardH + geo.dp(BluffFit.PERCH)))
                .graphicsLayer {
                    val p = seg.p("title", clock.t())
                    alpha = minOf(1f, p * 2f)
                    scaleX = 0.94f + 0.06f * p
                    scaleY = scaleX
                    translationY = (1f - p) * 24f * density
                },
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Bottom,
        ) {
            if (script.reveal.final) {
                AutoText(stringResource(R.string.game__bluff__reveal__final_intro), type.headline, Paper, Modifier.fillMaxWidth(), maxSp = 30f, minSp = 18f, maxLines = 1)
                Spacer(Modifier.height(6.dp))
            }
            Box(
                Modifier.fillMaxWidth().height(geo.dpOf(geo.cardH)).background(Paper.copy(alpha = 0.94f), JamaaShapes.card).padding(horizontal = 28.dp, vertical = 12.dp),
                contentAlignment = Alignment.Center,
            ) {
                view.prompt?.let { AutoText(it.display ?: it.original, type.headline, PaperInk, Modifier.fillMaxWidth(), minSp = 18f, maxLines = 4) }
            }
        }
    }
}

private fun stampText(kind: OptionKind): Int = when (kind) {
    OptionKind.LIE -> R.string.game__bluff__reveal__lie
    OptionKind.HOUSE -> R.string.game__bluff__reveal__house
    OptionKind.TRUTH -> R.string.game__bluff__reveal__truth
}

private fun stampColor(kind: OptionKind): Color = when (kind) {
    OptionKind.LIE -> LieRed
    OptionKind.HOUSE -> HouseViolet
    OptionKind.TRUTH -> JamaaColors.Success
}

/**
 * The spotlight card: cream paper (gold for the truth, with a light sweep), the answer's letter badge at the start
 * edge and its text auto-sized to the card (34 → 18 sp, 3 lines), so a 60-grapheme lie is always read in full.
 */
@Composable
private fun RevealCard(text: String, letter: Char?, gold: () -> Float, sweep: () -> Float, modifier: Modifier) {
    Box(modifier) {
        Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
            val r = CornerRadius(24.dp.toPx())
            drawRoundRect(PaperInk.copy(alpha = 0.35f), topLeft = Offset(0f, 6.dp.toPx()), size = size, cornerRadius = r)
            drawRoundRect(Paper, cornerRadius = r)
            val g = gold()
            if (g > 0f) {
                drawRoundRect(Brush.linearGradient(listOf(GoldLight, Gold)), alpha = g, cornerRadius = r)
                val sw = sweep()
                if (sw in 0.001f..0.999f) {
                    val x = -size.width * 0.2f + size.width * 1.4f * sw
                    drawRect(Brush.linearGradient(listOf(Color.Transparent, Color.White.copy(alpha = 0.55f), Color.Transparent), start = Offset(x - 40.dp.toPx(), 0f), end = Offset(x + 40.dp.toPx(), size.height)))
                }
            }
        }
        Row(Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            if (letter != null) {
                Box(Modifier.size(40.dp).background(PaperInk, JamaaShapes.pill), contentAlignment = Alignment.Center) {
                    Text(letter.toString(), style = JamaaTheme.type.title.copy(textDirection = TextDirection.Ltr), color = GoldLight, maxLines = 1)
                }
                Spacer(Modifier.width(12.dp))
            }
            Box(Modifier.weight(1f).fillMaxHeight(), contentAlignment = Alignment.Center) {
                AutoText(text, JamaaTheme.type.headline, PaperInk, Modifier.fillMaxWidth(), minSp = 18f, maxLines = 3)
            }
            if (letter != null) Spacer(Modifier.width(52.dp)) // keeps the text optically centred on the card
        }
    }
}

/**
 * One revealed option: spotlight → the fooled hop onto its top edge → drumroll tremble → stamp → the liar pops out from
 * under it with the moustache → coins; then the card shrinks into its strip badge as the voters hop home.
 */
@Composable
private fun SpotlightCard(view: BluffView, clock: PhaseClock, seg: Segment, script: BluffScript, geo: StageGeometry, rtl: Boolean, resting: Boolean = false) {
    val type = JamaaTheme.type
    val st = seg.step
    val reduce = script.reduced || JamaaTheme.reduceMotion
    val truth = seg.kind == SegmentKind.TRUTH
    val center = { Offset(geo.cardCenterX(rtl), geo.cardCenterY) }
    val text = st?.text ?: script.reveal.truth?.text ?: ""
    val exit = { exitP(seg, clock.t(), script, resting) }
    val slot = remember(seg, script) { slotOf(seg, script) }
    val letter = st?.optionId?.let { OptionLetters.shared.of(view)[it] }
    Box(Modifier.fillMaxSize()) {
        // 1. Under the card (drawn first, so it emerges from behind it): the liar row, or the truth's verdict and note.
        if (st != null && !truth) {
            LiarRow(view, clock, seg, script, geo, rtl, exit)
        } else if (truth) {
            TruthCaption(view, clock, seg, script, geo, rtl, exit)
        }

        // 2. The card: to the spotlight, grows; trembles on the drumroll; the truth turns gold with a light sweep. On
        // exit it flies into its strip badge.
        RevealCard(
            text, letter,
            gold = if (truth) ({ seg.p("gold", clock.t()) }) else ({ 0f }),
            sweep = { seg.p("sweep", clock.t()) },
            modifier = Modifier
                .align(AbsoluteAlignment.TopLeft)
                .atPx(geo, geo.cardW, geo.cardH, center)
                .size(geo.dpOf(geo.cardW), geo.dpOf(geo.cardH))
                .graphicsLayer {
                    val t = clock.t()
                    val p = seg.p("spotlight", t)
                    var s = if (reduce) 1f else 0.86f + 0.14f * p
                    var a = minOf(1f, p * 3f)
                    if (!reduce) translationY = (1f - p) * 30f * density
                    // Drumroll: a ±1 dp tremble at 12 Hz (not in lite/calm motion).
                    val d = seg.sub("drumroll")
                    if (d != null && !reduce) {
                        val local = t - seg.startMs - d.step.startMs
                        if (local in 0 until d.step.durationMs) translationX = kotlin.math.sin(local / 1000f * 12f * 6.283f) * density
                    }
                    val e = exit()
                    if (e > 0f) {
                        if (!reduce) {
                            val c = center()
                            translationX = (geo.stripX(slot, rtl) - c.x) * e
                            translationY = (geo.stripY - c.y) * e
                            s *= 1f - 0.94f * e
                        }
                        a *= 1f - e
                    }
                    scaleX = s
                    scaleY = s
                    alpha = a
                },
        )

        // 3. Final: identical cream envelopes drop onto the card's top edge, one per vote (no voter identity, §6.5).
        if (seg.kind == SegmentKind.FINAL_ANSWER && st != null) {
            val n = minOf(st.voteCount, 12)
            for (k in 0 until n) {
                PropGlyph(
                    Prop.ENVELOPE, 34.dp,
                    Modifier.align(AbsoluteAlignment.TopLeft).at(geo, 34, 34) {
                        val p = seg.p("envelopes", clock.t(), k)
                        Offset(geo.perchX(k, n, rtl), geo.perchY + geo.dp(6) - (1f - p) * geo.dp(120))
                    }.graphicsLayer { alpha = minOf(1f, seg.p("envelopes", clock.t(), k) * 4f) * (1f - exit()) },
                )
            }
            // The neutral ballot box the coins leave from, at the card's bottom start corner.
            BallotBox(Modifier.align(AbsoluteAlignment.TopLeft).at(geo, 64, 48) { ballotBoxCenter(geo, rtl) }.graphicsLayer { alpha = 1f - exit() })
        }

        // 4. Travellers hop from their chairs onto the card's top edge (arc 120 dp, `spring.bouncy`), and back on exit.
        // At rest they are back in their chairs (the café row draws them), so nobody is drawn twice.
        val ts = if (resting) emptyList() else travellers(seg)
        for ((k, pair) in ts.withIndex()) {
            val (id, sub) = pair
            val p = view.player(id) ?: continue
            val idx = view.players.indexOf(p)
            val subIndex = ts.take(k).count { it.second == sub }
            Box(
                Modifier.align(AbsoluteAlignment.TopLeft).at(geo, BluffFit.PERCH_CHARACTER, BluffFit.PERCH_CHARACTER) {
                    val q = seg.p(sub, clock.t(), subIndex).coerceIn(0f, 1.2f)
                    val e = exit()
                    val seat = Offset(geo.seatX(idx, rtl), geo.rowCenterY)
                    val perch = Offset(geo.perchX(k, ts.size, rtl), geo.perchY)
                    if (reduce) return@at perch
                    val (from, to, u) = if (e > 0f) Triple(perch, seat, e) else Triple(seat, perch, q)
                    val uc = u.coerceIn(0f, 1f)
                    val arc = -geo.dp(120) * 4f * uc * (1f - uc)
                    Offset(from.x + (to.x - from.x) * u, from.y + (to.y - from.y) * u + arc)
                }.graphicsLayer {
                    val q = seg.p(sub, clock.t(), subIndex)
                    alpha = (if (reduce) q else if (q > 0f) 1f else 0f) * (if (reduce) 1f - exit() else 1f)
                },
            ) {
                val e by remember(script, id) { derivedStateOf { script.expressionOf(id, clock.t()) ?: Expression.IDLE } }
                Character(p.color, BluffFit.PERCH_CHARACTER.dp, e)
            }
        }

        // 5. The stamp lands at −8° on the card's top end corner (none in the final: there is no truth to stamp).
        if ((st != null || truth) && seg.kind != SegmentKind.FINAL_ANSWER) {
            val kind = st?.kind ?: OptionKind.TRUTH
            Box(
                Modifier.align(AbsoluteAlignment.TopLeft).at(geo, 240, 72) { geo.stampCenter(rtl) }.size(240.dp, 72.dp).graphicsLayer { alpha = 1f - exit() },
                contentAlignment = Alignment.Center,
            ) {
                StampLabel(stringResource(stampText(kind)), stampColor(kind), { seg.p("stamp", clock.t()) }, style = type.displayS, maxWidth = 240.dp)
            }
        }

        // Confetti from the card for the finders (paper white + amber, 1.2 s; none in calm motion).
        if (truth && st != null && st.voteCount + st.spotOnIds.size > 0) {
            val burst by remember(seg) { derivedStateOf { seg.p("confetti", clock.t()) > 0f && clock.t() < seg.endMs } }
            if (burst) Confetti(Modifier.fillMaxSize(), durationMs = 1_200, seed = seg.index)
        }
    }
}

/**
 * Under a lie: its author(s) rise out from behind the card (`spring.bouncy`), `smug`, holding the moustache on a stick,
 * each with a full name plate; beside them who they fooled ("Rami fooled 2!", co-authors, the help badge). A house lie
 * shows the moustached house character and "The house wrote that one!".
 */
@Composable
private fun BoxScope.LiarRow(view: BluffView, clock: PhaseClock, seg: Segment, script: BluffScript, geo: StageGeometry, rtl: Boolean, exit: () -> Float) {
    val type = JamaaTheme.type
    val st = seg.step ?: return
    val authors = st.authorIds.mapNotNull { view.player(it) }
    val house = st.kind == OptionKind.HOUSE || authors.isEmpty()
    val names = authors.map { it.name }
    val line = when {
        house -> stringResource(R.string.game__bluff__reveal__house_wrote)
        seg.kind == SegmentKind.FINAL_ANSWER && names.isNotEmpty() && st.voteCount == script.reveal.steps.sumOf { it.voteCount } && script.reveal.steps.size == 1 && st.voteCount > 1 ->
            stringResource(R.string.game__bluff__reveal__unanimous)
        names.size > 1 -> stringResource(R.string.game__bluff__reveal__same_lie)
        names.isNotEmpty() -> pluralStringResource(R.plurals.game__bluff__reveal__fooled, st.voteCount, isolate(names.first()), st.voteCount)
        else -> null
    }
    val charDp = if (authors.size > 2) 48 else 58
    Row(
        Modifier
            .align(AbsoluteAlignment.TopLeft)
            .atPx(geo, geo.cardW, geo.dp(BluffFit.LIAR)) { Offset(geo.cardCenterX(rtl), geo.liarY) }
            .size(geo.dpOf(geo.cardW), BluffFit.LIAR.dp)
            .graphicsLayer {
                val p = seg.p("liar", clock.t())
                // From behind the card (half a row up, hidden by it) to its place under it.
                translationY = if (script.reduced) 0f else -(1f - p) * BluffFit.LIAR * 0.8f * density
                alpha = minOf(1f, p * 2f) * (1f - exit())
            },
        horizontalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (house) {
            HouseCharacter(charDp.dp, laugh = 1f)
        } else {
            for (a in authors.take(4)) {
                Column(Modifier.width((charDp + 44).dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box {
                        val e by remember(script, a.id) { derivedStateOf { script.expressionOf(a.id, clock.t()) ?: Expression.IDLE } }
                        Character(a.color, charDp.dp, e)
                        Canvas(Modifier.size(charDp.dp).clearAndSetSemantics {}) {
                            moustache(Offset(size.width * 0.8f, size.height * 0.64f), size.width * 0.42f)
                        }
                    }
                    AutoText(a.name, type.caption, Paper, Modifier.fillMaxWidth(), maxSp = 18f, minSp = 12f, maxLines = 1)
                }
            }
        }
        if (line != null || st.helped) {
            Column(Modifier.weight(1f, fill = false), horizontalAlignment = Alignment.Start) {
                if (line != null) AutoText(line, type.title, Paper, maxSp = 26f, minSp = 16f, maxLines = 2, textAlign = TextAlign.Start)
                if (st.helped) Text(stringResource(R.string.game__bluff__reveal__helped), style = type.caption, color = JamaaColors.TextMuted, maxLines = 1)
            }
        }
    }
}

/** Under the truth: the verdict (nobody found it / too easy / all knew), the note "It means…", the Arabic original. */
@Composable
private fun BoxScope.TruthCaption(view: BluffView, clock: PhaseClock, seg: Segment, script: BluffScript, geo: StageGeometry, rtl: Boolean, exit: () -> Float) {
    val type = JamaaTheme.type
    val st = seg.step
    val tr = script.reveal.truth
    Column(
        Modifier
            .align(AbsoluteAlignment.TopLeft)
            .atPx(geo, geo.cardW, geo.dp(BluffFit.LIAR)) { Offset(geo.cardCenterX(rtl), geo.liarY) }
            .size(geo.dpOf(geo.cardW), BluffFit.LIAR.dp)
            .graphicsLayer { alpha = seg.p("stamp", clock.t()) * (1f - exit()) },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        val line = when {
            view.notice == BluffNotice.ALL_KNEW -> stringResource(R.string.game__bluff__reveal__all_knew)
            script.nobodyFound -> stringResource(R.string.game__bluff__reveal__nobody_found)
            script.tooEasy -> stringResource(R.string.game__bluff__reveal__too_easy)
            else -> null
        }
        if (line != null) AutoText(line, type.title, Paper, Modifier.fillMaxWidth(), maxSp = 26f, minSp = 16f, maxLines = 1)
        if (tr?.note != null) {
            AutoText(
                stringResource(R.string.game__bluff__reveal__it_means, tr.note),
                type.body, JamaaColors.TextSecondary,
                Modifier.weight(1f, fill = false).fillMaxWidth().graphicsLayer { val p = seg.p("note", clock.t()); alpha = p; translationY = (1f - p) * 14f * density },
                minSp = 14f, maxLines = 2,
            )
        }
        if (tr?.original != null && tr.original != tr.text) {
            AutoText("${stringResource(R.string.game__bluff__reveal__in_arabic)} ${tr.original}", type.caption, JamaaColors.TextMuted, Modifier.fillMaxWidth(), minSp = 13f, maxLines = 1)
        }
        if (st != null && st.foundEarlyIds.isNotEmpty()) {
            AutoText("${names(view, st.foundEarlyIds)} · ${stringResource(R.string.game__bluff__reveal__found_early)}", type.caption, JamaaColors.TextMuted, Modifier.fillMaxWidth(), minSp = 13f, maxLines = 1)
        }
    }
}

private fun names(view: BluffView, ids: List<String>): String = ids.mapNotNull { view.player(it)?.name }.joinToString(", ") { isolate(it) }

private fun ballotBoxCenter(geo: StageGeometry, rtl: Boolean): Offset {
    val dx = (geo.cardW / 2f - geo.dp(44)) * (if (rtl) 1f else -1f)
    return Offset(geo.cardCenterX(rtl) + dx, geo.cardBottom)
}

@Composable
private fun BallotBox(modifier: Modifier) {
    Canvas(modifier.size(64.dp, 48.dp).clearAndSetSemantics {}) {
        drawRoundRect(Cafe.elevated, cornerRadius = CornerRadius(8.dp.toPx()))
        drawRoundRect(Cafe.accent.copy(alpha = 0.5f), cornerRadius = CornerRadius(8.dp.toPx()), style = Stroke(2.dp.toPx()))
        drawRect(PaperInk, topLeft = Offset(size.width * 0.25f, size.height * 0.18f), size = Size(size.width * 0.5f, 4.dp.toPx()))
    }
}

/**
 * Final: the top answer(s) grow in gold, MOST CONVINCING lands on each, and a crown hops onto each author standing
 * under their card (full names); or nobody wins the crown.
 */
@Composable
private fun CrownBeat(view: BluffView, clock: PhaseClock, seg: Segment, script: BluffScript, geo: StageGeometry, rtl: Boolean) {
    val type = JamaaTheme.type
    val tops = script.reveal.steps.filter { it.top }.take(3)
    Box(Modifier.fillMaxSize()) {
        if (tops.isEmpty()) {
            Box(
                Modifier.align(AbsoluteAlignment.TopLeft).atPx(geo, geo.cardW, geo.cardH) { Offset(geo.cardCenterX(rtl), geo.cardCenterY) }
                    .size(geo.dpOf(geo.cardW), geo.dpOf(geo.cardH))
                    .graphicsLayer { alpha = seg.p("grow", clock.t()) },
                contentAlignment = Alignment.Center,
            ) { AutoText(stringResource(R.string.game__bluff__reveal__no_crown), type.headline, Paper, Modifier.fillMaxWidth(), minSp = 18f, maxLines = 3) }
            return@Box
        }
        val m = tops.size
        val gap = geo.dp(14)
        val w = (geo.cardW - gap * (m - 1)) / m
        val letters = OptionLetters.shared.of(view)
        for ((k, st) in tops.withIndex()) {
            val order = if (rtl) m - 1 - k else k
            val cx = geo.cardCenterX(rtl) - geo.cardW / 2f + w / 2f + order * (w + gap)
            val c = { Offset(cx, geo.cardCenterY) }
            RevealCard(
                st.text, if (m == 1) letters[st.optionId] else null, gold = { 1f }, sweep = { seg.p("grow", clock.t()) },
                modifier = Modifier.align(AbsoluteAlignment.TopLeft).atPx(geo, w, geo.cardH, c).size(geo.dpOf(w), geo.dpOf(geo.cardH))
                    .graphicsLayer { val p = seg.p("grow", clock.t()); scaleX = 0.9f + 0.1f * p; scaleY = scaleX; alpha = minOf(1f, p * 2f + 0.3f) },
            )
            Box(
                Modifier.align(AbsoluteAlignment.TopLeft).atPx(geo, w + geo.dp(20), geo.dp(64)) { Offset(cx, geo.cardTop - geo.dp(2)) }.size(geo.dpOf(w + geo.dp(20)), 64.dp),
                contentAlignment = Alignment.Center,
            ) {
                StampLabel(stringResource(R.string.game__bluff__reveal__most_convincing), Gold, { seg.p("stamp", clock.t()) }, style = if (m == 1) type.headline else type.title, maxWidth = geo.dpOf(w))
            }
            Row(
                Modifier.align(AbsoluteAlignment.TopLeft).atPx(geo, w, geo.dp(BluffFit.LIAR)) { Offset(cx, geo.liarY) }.size(geo.dpOf(w), BluffFit.LIAR.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
                verticalAlignment = Alignment.Bottom,
            ) {
                for (id in st.authorIds.take(3)) {
                    val p = view.player(id) ?: continue
                    Column(Modifier.width(96.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Box {
                            val e by remember(script, id) { derivedStateOf { script.expressionOf(id, clock.t()) ?: Expression.IDLE } }
                            Character(p.color, 52.dp, e, Modifier.padding(top = 14.dp))
                            Canvas(Modifier.size(52.dp, 24.dp).align(Alignment.TopCenter).graphicsLayer {
                                val q = seg.p("crown", clock.t())
                                alpha = if (q > 0f) 1f else 0f
                                translationY = (1f - q) * -60f * density
                            }.clearAndSetSemantics {}) { crown(Gold) }
                        }
                        AutoText(p.name, type.caption, Paper, Modifier.fillMaxWidth(), maxSp = 18f, minSp = 12f, maxLines = 1)
                    }
                }
            }
        }
        val confetti by remember(seg) { derivedStateOf { seg.p("confetti", clock.t()) > 0f && clock.t() < seg.endMs } }
        if (confetti) Confetti(Modifier.fillMaxSize(), durationMs = 1_200, seed = 41)
    }
}

private fun DrawScope.crown(color: Color) {
    val w = size.width * 0.6f
    val x0 = (size.width - w) / 2f
    val h = size.height
    val p = Path().apply {
        moveTo(x0, h); lineTo(x0, h * 0.35f); lineTo(x0 + w * 0.25f, h * 0.65f); lineTo(x0 + w * 0.5f, h * 0.1f)
        lineTo(x0 + w * 0.75f, h * 0.65f); lineTo(x0 + w, h * 0.35f); lineTo(x0 + w, h); close()
    }
    drawPath(p, color)
}

/**
 * Final twist: every answer card flips at once (40 ms stagger) to its back, the same words crossed out on dark paper,
 * and "No truth: it was all made up!" stamps over them; every character laughs. Up to 12 cards, 2 columns past 4.
 */
@Composable
private fun TwistBeat(clock: PhaseClock, seg: Segment, script: BluffScript, geo: StageGeometry, rtl: Boolean) {
    val type = JamaaTheme.type
    val cards = (script.reveal.steps.map { it.text } + script.reveal.unpicked.map { it.text }).take(12)
    val cols = if (cards.size > 4) 2 else 1
    val rows = (cards.size + cols - 1) / cols
    val zoneTop = geo.contentTop + geo.dp(10)
    val zoneH = geo.contentBottom - zoneTop - geo.dp(10)
    val gap = geo.dp(8)
    val cardH = ((zoneH - gap * (rows - 1)) / rows.coerceAtLeast(1)).coerceAtMost(geo.dp(60))
    Box(Modifier.fillMaxSize()) {
        Column(
            Modifier.align(AbsoluteAlignment.TopLeft)
                .absoluteOffset { IntOffset((geo.cardCenterX(rtl) - geo.cardW / 2f).roundToInt(), zoneTop.roundToInt()) }
                .size(geo.dpOf(geo.cardW), geo.dpOf(zoneH)),
            verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically),
        ) {
            for (r in 0 until rows) {
                Row(Modifier.fillMaxWidth().height(geo.dpOf(cardH)), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    for (c in 0 until cols) {
                        val i = r * cols + c
                        Box(Modifier.weight(1f).fillMaxHeight()) {
                            if (i < cards.size) {
                                val flip = { seg.p("flip", clock.t(), i) }
                                val back by remember(seg, i) { derivedStateOf { flip() >= 0.5f } }
                                Box(Modifier.fillMaxSize().graphicsLayer { scaleY = kotlin.math.abs(1f - 2f * flip()).coerceAtLeast(0.02f) }) {
                                    if (back) OptionCard(cards[i], Modifier.fillMaxSize(), dense = true, fill = Cafe.elevated, ink = JamaaColors.TextMuted, strike = true, maxSp = BluffFit.cardTextMaxSp(cardH / geo.density))
                                    else OptionCard(cards[i], Modifier.fillMaxSize(), dense = true, maxSp = BluffFit.cardTextMaxSp(cardH / geo.density))
                                }
                            }
                        }
                    }
                }
            }
        }
        Box(
            Modifier.align(AbsoluteAlignment.TopLeft).atPx(geo, geo.cardW, geo.dp(120)) { Offset(geo.cardCenterX(rtl), zoneTop + zoneH / 2f) }.size(geo.dpOf(geo.cardW), 120.dp),
            contentAlignment = Alignment.Center,
        ) {
            StampLabel(stringResource(R.string.game__bluff__reveal__no_truth_stamp), LieRed, { seg.p("stamp", clock.t()) }, style = type.headline, maxWidth = geo.dpOf(geo.cardW - geo.dp(40)))
        }
    }
}

/**
 * "Nobody bought it…": the unpicked lies fan out like a hand of cards (up to 6, 2 rows of 3), each with its author's
 * small `sad` face on the corner and the text in full, then fall off-screen together (`ease.accel`); "+N" for the rest.
 */
@Composable
private fun NobodyMontage(view: BluffView, clock: PhaseClock, seg: Segment, script: BluffScript, geo: StageGeometry, rtl: Boolean) {
    val type = JamaaTheme.type
    val cards = script.reveal.unpicked.take(6)
    val rest = script.reveal.unpicked.size - cards.size
    val cols = minOf(cards.size, 3).coerceAtLeast(1)
    val rows = (cards.size + cols - 1) / cols
    val gap = geo.dp(18)
    val w = minOf(geo.dp(240), (geo.rowWidth - geo.dp(40) - gap * (cols - 1)) / cols)
    val h = geo.dp(78)
    val zoneTop = geo.contentTop + geo.dp(BluffFit.STRIP + 18)
    val zoneH = geo.contentBottom - zoneTop
    val fan = { seg.p("fan", clock.t()) }
    val fall = { seg.p("fall", clock.t()) }
    Box(Modifier.fillMaxSize()) {
        Box(
            Modifier.align(AbsoluteAlignment.TopLeft).atPx(geo, geo.cardW, geo.dp(BluffFit.STRIP + 12)) { Offset(geo.cardCenterX(rtl), geo.contentTop + geo.dp(BluffFit.STRIP + 12) / 2f) }
                .size(geo.dpOf(geo.cardW), (BluffFit.STRIP + 12).dp).graphicsLayer { alpha = fan() * (1f - fall()) },
            contentAlignment = Alignment.Center,
        ) {
            AutoText(
                stringResource(R.string.game__bluff__reveal__nobody) + if (rest > 0) "  +$rest" else "",
                type.headline, Paper, Modifier.fillMaxWidth(), maxSp = 32f, minSp = 18f, maxLines = 1,
            )
        }
        for ((i, u) in cards.withIndex()) {
            val r = i / cols
            val c = i % cols
            val inRow = minOf(cols, cards.size - r * cols)
            val spread = if (inRow == 1) 0f else (c / (inRow - 1f) - 0.5f) * 2f // −1 … 1 within the row
            val visualC = if (rtl) inRow - 1 - c else c
            val cx = geo.cardCenterX(rtl) + (visualC - (inRow - 1) / 2f) * (w + gap)
            val cy = zoneTop + zoneH / 2f + (r - (rows - 1) / 2f) * (h + gap)
            Box(
                Modifier.align(AbsoluteAlignment.TopLeft).atPx(geo, w, h) {
                    val f = fan()
                    val x = geo.cardCenterX(rtl) + (cx - geo.cardCenterX(rtl)) * f
                    Offset(x, cy + fall() * fall() * geo.height)
                }.size(geo.dpOf(w), geo.dpOf(h)).graphicsLayer {
                    rotationZ = (if (rtl) -spread else spread) * 6f * fan() + fall() * spread * 20f
                    alpha = minOf(1f, fan() * 2f)
                },
            ) {
                OptionCard(u.text, Modifier.fillMaxSize().padding(top = 6.dp), dense = true, maxSp = 22f, maxLines = 3)
                u.authorIds.firstOrNull()?.let { view.player(it) }?.let { a ->
                    Character(a.color, 34.dp, Expression.SAD, Modifier.align(if (rtl) Alignment.TopStart else Alignment.TopEnd).padding(end = 4.dp).graphicsLayer { translationY = -14f * density })
                }
            }
        }
    }
}

@Composable
private fun BoxScope.LikesTally(clock: PhaseClock, seg: Segment, geo: StageGeometry, rtl: Boolean) {
    Box(
        Modifier.align(AbsoluteAlignment.TopLeft).atPx(geo, geo.cardW, geo.dp(80)) { Offset(geo.cardCenterX(rtl), geo.cardCenterY) }.size(geo.dpOf(geo.cardW), 80.dp)
            .graphicsLayer {
                val q = ((clock.t() - seg.startMs) / 260f).coerceIn(0f, 1f)
                alpha = q
                scaleX = 0.9f + 0.1f * q
                scaleY = scaleX
            },
        contentAlignment = Alignment.Center,
    ) {
        AutoText(stringResource(R.string.game__bluff__vote__like), JamaaTheme.type.displayS, Color(0xFFFF96C5), Modifier.fillMaxWidth(), minSp = 20f, maxLines = 1)
    }
}

/**
 * The score rail at the end side: under the platform's back-hint slot (kept empty), one pill per player in seat order, sized to the count (12 fit), the odometer counting as each coin lands. Name and number each
 * own their space in the pill: they can never overlap.
 */
@Composable
private fun ScoreRail(view: BluffView, clock: PhaseClock, script: BluffScript, geo: StageGeometry, rtl: Boolean) {
    val type = JamaaTheme.type
    val pillW = BluffFit.RAIL - 16f
    val rowDp = geo.railRow / geo.density
    val pillH = (rowDp - 6f).coerceAtLeast(24f)
    Box(Modifier.fillMaxSize()) {
        for ((i, p) in view.players.withIndex()) {
            Row(
                Modifier
                    .align(AbsoluteAlignment.TopLeft)
                    .absoluteOffset {
                        val (x, y) = geo.pillCenter(i, rtl)
                        IntOffset((x - geo.dp(pillW) / 2f).roundToInt(), (y - geo.dp(pillH) / 2f).roundToInt())
                    }
                    .size(pillW.dp, pillH.dp)
                    .graphicsLayer { val pop = script.pillPop(p.id, clock.t()); scaleX = 1f + 0.12f * pop; scaleY = scaleX; alpha = if (p.left) 0.5f else 1f }
                    .background(Cafe.surface, JamaaShapes.pill)
                    .padding(horizontal = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // The player's shape avatar, not a bare colour dot (DESIGN §5.1: colour is never the only cue).
                Avatar(p.color, minOf(20f, pillH - 8f).dp, state = AvatarState(left = p.left))
                Spacer(Modifier.width(8.dp))
                AutoText(p.name, type.caption, Paper, Modifier.weight(1f), maxSp = 19f, minSp = 13f, maxLines = 1, textAlign = TextAlign.Start)
                Spacer(Modifier.width(6.dp))
                PillNumber(script, p.id, clock, type.titleS.copy(fontSize = minOf(22f, pillH * 0.68f).sp), Gold, minOf(26f, pillH - 2f).dp)
            }
        }
    }
}

/**
 * A pill's score: under [BluffOdometer.FROM] it ticks as a plain integer; from it, an odometer (DESIGN-JAMAA §5.1),
 * one Western-digit column per place rolling on translationY in a layer lambda (a running count never recomposes).
 * Each column clips to one line ([lineH]), so a rolling digit never spills over the pill.
 */
@Composable
private fun PillNumber(script: BluffScript, playerId: String, clock: PhaseClock, style: TextStyle, color: Color, lineH: Dp) {
    val final = remember(script, playerId) { script.pillValue(playerId, script.totalMs) }
    if (final < BluffOdometer.FROM) {
        val value by remember(script, playerId) { derivedStateOf { script.pillValue(playerId, clock.t()) } }
        Text(value.toString(), style = style, color = color, maxLines = 1)
        return
    }
    val places = BluffOdometer.places(final)
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Row(Modifier.clearAndSetSemantics {}) {
            for (k in places - 1 downTo 0) {
                var unit = 1.0
                repeat(k) { unit *= 10.0 }
                Box(
                    Modifier.height(lineH).clipToBounds().graphicsLayer {
                        // A leading column fades in as the count reaches its place (no "080").
                        alpha = if (k == 0) 1f else (script.pillValueExact(playerId, clock.t()) - (unit - 1.0)).toFloat().coerceIn(0f, 1f)
                    },
                ) {
                    Column(
                        Modifier.wrapContentHeight(Alignment.Top, unbounded = true).graphicsLayer {
                            translationY = -BluffOdometer.column(script.pillValueExact(playerId, clock.t()), k).toFloat() * lineH.toPx()
                        },
                    ) {
                        for (d in 0..10) Box(Modifier.height(lineH), contentAlignment = Alignment.Center) { Text((d % 10).toString(), style = style, color = color, maxLines = 1) }
                    }
                }
            }
        }
    }
}

/**
 * Coins (and hearts) in flight, drawn on one canvas in the draw phase: quadratic Bézier with the control point 90 dp
 * above the chord midpoint (platform §3.10 C), `ease.coin`, the scorer's colour with a cream rim; the first coin of an
 * award carries its "+N" label. Calm motion: no flight, the label chip simply appears on the pill.
 */
@Composable
private fun Coins(view: BluffView, clock: PhaseClock, script: BluffScript, geo: StageGeometry, rtl: Boolean) {
    val labelStyle = JamaaTheme.type.label
    val measurer = androidx.compose.ui.text.rememberTextMeasurer()
    // Each coin carries the scorer's shape glyph (DESIGN §5.1 CVD: colour is never the only cue). Fixed count: 12.
    val glyphs = PlayerSwatch.entries.map { rememberVectorPainter(AvatarGlyphs.of(it.shape)) }
    Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
        val t = clock.t()
        for (c in script.coinsInFlight(t)) {
            val toIdx = view.players.indexOfFirst { it.id == c.toPlayerId }.takeIf { it >= 0 } ?: continue
            val (tx, ty) = geo.pillCenter(toIdx, rtl)
            val from = sourceOf(c, script, view, geo, rtl)
            val to = Offset(tx + geo.dp(BluffFit.RAIL / 2 - 30) * (if (rtl) 1f else -1f), ty)
            val p = script.coinProgress(c, t)
            val ctrl = Offset((from.x + to.x) / 2f, minOf(from.y, to.y) - geo.dp(90))
            val u = 1f - p
            val pos = Offset(u * u * from.x + 2 * u * p * ctrl.x + p * p * to.x, u * u * from.y + 2 * u * p * ctrl.y + p * p * to.y)
            val swatch = view.player(c.toPlayerId)?.color?.let { PlayerSwatch.byId(it) }
            if (c.heart) {
                heart(pos, geo.dp(10), Color(0xFFFF96C5))
            } else {
                drawCircle(Paper, radius = geo.dp(11f), center = pos)
                drawCircle(swatch?.color ?: Gold, radius = geo.dp(9.5f), center = pos)
                if (swatch != null) {
                    val gs = geo.dp(11.5f)
                    translate(pos.x - gs / 2f, pos.y - gs / 2f) {
                        with(glyphs[swatch.ordinal]) { draw(Size(gs, gs), colorFilter = ColorFilter.tint(swatch.glyph)) }
                    }
                }
            }
            c.label?.let { amount ->
                val layout = measurer.measure("+$amount", labelStyle.copy(color = Paper, shadow = androidx.compose.ui.graphics.Shadow(PaperInk, Offset(0f, 2f), 6f)))
                drawText(layout, topLeft = Offset(pos.x + geo.dp(10), pos.y - layout.size.height))
            }
        }
    }
}

/**
 * Where coin [c] leaves from. A fooled voter's coin leaves from that voter's own perch on the card (where the traveller
 * landed), so the room sees who paid whom; truth and crown coins from the card's top edge.
 */
private fun sourceOf(c: Coin, script: BluffScript, view: BluffView, geo: StageGeometry, rtl: Boolean): Offset = when (val s = c.from) {
    is CoinSource.Voter -> {
        val ts = script.segments.getOrNull(c.segment)?.let(::travellers).orEmpty()
        val k = ts.indexOfFirst { it.first == s.playerId }
        if (k >= 0) Offset(geo.perchX(k, ts.size, rtl), geo.perchY) else Offset(geo.cardCenterX(rtl), geo.cardTop)
    }
    is CoinSource.Card -> Offset(geo.cardCenterX(rtl), geo.cardTop)
    CoinSource.BallotBox -> ballotBoxCenter(geo, rtl)
    is CoinSource.Liker -> {
        val i = view.players.indexOfFirst { it.id == s.playerId }.coerceAtLeast(0)
        Offset(geo.seatX(i, rtl), geo.rowCenterY - geo.dp(30))
    }
}

private fun DrawScope.heart(c: Offset, r: Float, color: Color) {
    val p = Path().apply {
        moveTo(c.x, c.y + r)
        cubicTo(c.x - r * 1.6f, c.y - r * 0.2f, c.x - r * 0.6f, c.y - r * 1.4f, c.x, c.y - r * 0.4f)
        cubicTo(c.x + r * 0.6f, c.y - r * 1.4f, c.x + r * 1.6f, c.y - r * 0.2f, c.x, c.y + r)
        close()
    }
    drawPath(p, color)
    drawPath(p, Paper, style = Stroke(r * 0.15f))
}
