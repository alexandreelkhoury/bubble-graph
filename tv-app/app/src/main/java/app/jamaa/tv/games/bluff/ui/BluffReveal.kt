package app.jamaa.tv.games.bluff.ui

import androidx.compose.foundation.Canvas
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
 * script's event expressions. A character travelling to the spotlight card leaves an empty chair here.
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
    val sizeDp = BluffBoard.rowCharacterDp(view.players.size)
    val reactions = rememberReactions(room)
    Box(Modifier.fillMaxSize()) {
        Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
            // Café tables: a marble top under each pair of seats.
            val y = geo.rowCenterY + geo.dp(sizeDp) * 0.52f
            drawLine(Cafe.elevated, Offset((if (rtl) geo.railWidth else 0f) + geo.dp(24), y), Offset((if (rtl) geo.width else geo.rowWidth) - geo.dp(24), y), strokeWidth = geo.dp(5))
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
            val w = geo.dp(sizeDp + 40)
            Column(
                Modifier
                    .align(AbsoluteAlignment.TopLeft)
                    .absoluteOffset { IntOffset((x - w / 2f).roundToInt(), (geo.rowCenterY - geo.dp(sizeDp) / 2f).roundToInt()) }
                    .width((sizeDp + 40).dp)
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
                    if (prop != null) PropGlyph(prop, 26.dp, Modifier.align(Alignment.BottomEnd))
                }
                Text(Names.ellipsize(p.name, 10), style = type.caption, color = if (p.left) JamaaColors.TextMuted else Paper, maxLines = 1)
                if (p.isNew) {
                    Text(stringResource(R.string.game__bluff__scores__new), Modifier.background(Gold, RoundedCornerShape(6.dp)).padding(horizontal = 6.dp), style = type.caption, color = Cafe.onAccent)
                } else if (view.phase == BluffPhase.VOTING && p.spotOn) {
                    Text(stringResource(R.string.game__bluff__reveal__knew_it_pin), style = type.caption, color = Gold)
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

private const val CARD_W_DP = 600
private const val CARD_H_DP = 120

/** The reveal script drawn over the stage: spotlight card, travellers, stamps, the liar, coins, pills, montages. */
@Composable
internal fun RevealStage(view: BluffView, clock: PhaseClock, script: BluffScript, geo: StageGeometry, rtl: Boolean) {
    val seg by remember(script) { derivedStateOf { script.segmentAt(clock.t()) } }
    val current = seg ?: return
    Box(Modifier.fillMaxSize()) {
        ScoreRail(view, clock, script, geo, rtl)
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

/**
 * The resting frame after the script (natural end or OK-completion), held until SCORES. Rounds 1–2: the gold TRUTH
 * card with its stamp landed, the note and the found-early tag, the stamped lies in the strip, the rail at the final
 * scores (characters back in their chairs). Final: the MOST CONVINCING card(s) with the crown, under the
 * "No truth: it was all made up!" stamp.
 */
@Composable
private fun RestingFrame(view: BluffView, clock: PhaseClock, script: BluffScript, geo: StageGeometry, rtl: Boolean) {
    val rest = script.rest ?: return
    if (rest.kind != SegmentKind.CROWN) {
        SpotlightCard(view, clock, rest, script, geo, rtl, resting = true)
        return
    }
    CrownBeat(view, clock, rest, script, geo, rtl)
    Box(Modifier.fillMaxSize()) {
        Box(
            Modifier.align(AbsoluteAlignment.TopLeft).at(geo, CARD_W_DP, 56) { Offset(geo.cardCenterX(rtl), geo.contentTop + geo.dp(28)) }.size(CARD_W_DP.dp, 56.dp),
            contentAlignment = Alignment.Center,
        ) {
            StampLabel(stringResource(R.string.game__bluff__reveal__no_truth_stamp), LieRed, { 1f }, style = JamaaTheme.type.title)
        }
    }
}

/** Positions a composable centred on an absolute stage point (px), recomputed in the layout phase only. */
private fun Modifier.at(geo: StageGeometry, wDp: Int, hDp: Int, center: () -> Offset): Modifier =
    this.absoluteOffset {
        val c = center()
        IntOffset((c.x - geo.dp(wDp) / 2f).roundToInt(), (c.y - geo.dp(hDp) / 2f).roundToInt())
    }

@Composable
private fun IntroBeat(view: BluffView, clock: PhaseClock, seg: Segment, script: BluffScript, geo: StageGeometry, rtl: Boolean) {
    val type = JamaaTheme.type
    Box(Modifier.fillMaxSize()) {
        // The corkboard slides down out of view while the lantern light narrows (DESIGN-JAMAA §5.2 intro beat).
        Column(
            Modifier
                .align(AbsoluteAlignment.TopLeft)
                .at(geo, CARD_W_DP, 300) { Offset(geo.cardCenterX(rtl), geo.cardCenterY) }
                .width(CARD_W_DP.dp)
                .graphicsLayer {
                    val p = seg.p("dim", clock.t())
                    translationY = p * 260f * density
                    alpha = 1f - p
                },
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            val letters = OptionLetters.shared.of(view)
            for ((i, o) in view.options.take(6).withIndex()) OptionCard(o.text, dense = true, letter = letters[o.id] ?: OptionLetters.letterOf(i))
        }
        Text(
            if (script.reveal.final) stringResource(R.string.game__bluff__reveal__final_intro)
            else view.prompt?.let { it.display ?: it.original } ?: "",
            Modifier
                .align(AbsoluteAlignment.TopLeft)
                .at(geo, CARD_W_DP, 80) { Offset(geo.cardCenterX(rtl), geo.cardCenterY) }
                .width(CARD_W_DP.dp)
                .graphicsLayer { val p = seg.p("title", clock.t()); alpha = minOf(1f, p * 2f); scaleX = 1.15f - 0.15f * p; scaleY = scaleX },
            style = type.headline.contentDir(),
            color = Paper,
            textAlign = TextAlign.Center,
        )
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

/** One revealed option: spotlight → travellers hop on → drumroll tremble → stamp → the liar pops out → coins. */
@Composable
private fun SpotlightCard(view: BluffView, clock: PhaseClock, seg: Segment, script: BluffScript, geo: StageGeometry, rtl: Boolean, resting: Boolean = false) {
    val type = JamaaTheme.type
    val st = seg.step
    val reduce = JamaaTheme.reduceMotion
    val truth = seg.kind == SegmentKind.TRUTH
    val center = { Offset(geo.cardCenterX(rtl), geo.cardCenterY) }
    val text = st?.text ?: script.reveal.truth?.text ?: ""
    Box(Modifier.fillMaxSize()) {
        // Already-stamped cards wait in a small strip at the top (dimmed to 35 %).
        StampedStrip(clock, seg, script, geo, rtl, Modifier.align(AbsoluteAlignment.TopLeft))

        // The liar(s) burst up from behind the card (`spring.bouncy`), smug, holding the moustache on a stick.
        if (st != null && st.kind != OptionKind.TRUTH) {
            val authors = st.authorIds.mapNotNull { view.player(it) }
            if (st.kind == OptionKind.HOUSE || authors.isEmpty()) {
                HouseCharacter(
                    84.dp, laugh = 1f,
                    Modifier.align(AbsoluteAlignment.TopLeft).at(geo, 84, 84) {
                        val p = seg.p("liar", clock.t())
                        Offset(center().x, center().y + geo.dp(CARD_H_DP) * (0.4f - 1.25f * p))
                    },
                )
            } else {
                for ((k, a) in authors.withIndex()) {
                    val dx = (k - (authors.size - 1) / 2f) * 96f
                    Box(
                        Modifier.align(AbsoluteAlignment.TopLeft).at(geo, 84, 84) {
                            val p = seg.p("liar", clock.t())
                            Offset(center().x + geo.dp(dx), center().y + geo.dp(CARD_H_DP) * (0.4f - 1.3f * p))
                        },
                    ) {
                        val e by remember(script, a.id) { derivedStateOf { script.expressionOf(a.id, clock.t()) ?: Expression.IDLE } }
                        Character(a.color, 84.dp, e)
                        Canvas(Modifier.size(84.dp).clearAndSetSemantics {}) {
                            if (seg.p("liar", clock.t()) > 0.05f) moustache(Offset(size.width * 0.78f, size.height * 0.62f), size.width * 0.42f)
                        }
                    }
                }
            }
        }

        // The card itself (spotlight: to centre, grows; truth turns gold with a light sweep).
        Box(
            Modifier
                .align(AbsoluteAlignment.TopLeft)
                .at(geo, CARD_W_DP, CARD_H_DP, center)
                .size(CARD_W_DP.dp, CARD_H_DP.dp)
                .graphicsLayer {
                    val t = clock.t()
                    val p = seg.p("spotlight", t)
                    val s = 0.8f + 0.2f * p
                    scaleX = s
                    scaleY = s
                    alpha = minOf(1f, p * 3f)
                    // Drumroll: a ±1 dp tremble at 12 Hz (not in lite/calm motion).
                    val d = seg.sub("drumroll")
                    if (d != null && !reduce) {
                        val local = t - seg.startMs - d.step.startMs
                        if (local in 0 until d.step.durationMs) translationX = kotlin.math.sin(local / 1000f * 12f * 6.283f) * density
                    }
                },
        ) {
            val gold = if (truth) ({ seg.p("gold", clock.t()) }) else ({ 0f })
            Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
                val g = gold()
                drawRoundRect(Paper, cornerRadius = androidx.compose.ui.geometry.CornerRadius(18.dp.toPx()))
                if (g > 0f) {
                    drawRoundRect(Brush.linearGradient(listOf(GoldLight, Gold)), alpha = g, cornerRadius = androidx.compose.ui.geometry.CornerRadius(18.dp.toPx()))
                    val sw = seg.p("sweep", clock.t())
                    if (sw in 0.001f..0.999f) {
                        val x = -size.width * 0.2f + size.width * 1.4f * sw
                        drawRect(Brush.linearGradient(listOf(Color.Transparent, Color.White.copy(alpha = 0.55f), Color.Transparent), start = Offset(x - 40.dp.toPx(), 0f), end = Offset(x + 40.dp.toPx(), size.height)))
                    }
                }
            }
            Text(
                text,
                Modifier.align(Alignment.Center).padding(horizontal = 28.dp),
                style = type.headline.contentDir(),
                color = PaperInk,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }

        // Final: identical cream envelopes drop onto the card, one per vote (no voter identity, GAME-BLUFF §6.5).
        if (seg.kind == SegmentKind.FINAL_ANSWER && st != null) {
            for (k in 0 until minOf(st.voteCount, 12)) {
                PropGlyph(
                    Prop.ENVELOPE, 34.dp,
                    Modifier.align(AbsoluteAlignment.TopLeft).at(geo, 34, 34) {
                        val p = seg.p("envelopes", clock.t(), k)
                        val slot = Offset(center().x + geo.dp((k - (minOf(st.voteCount, 12) - 1) / 2f) * 38f), center().y - geo.dp(CARD_H_DP / 2 + 22))
                        Offset(slot.x, slot.y - (1f - p) * geo.dp(140))
                    }.graphicsLayer { alpha = minOf(1f, seg.p("envelopes", clock.t(), k) * 4f) },
                )
            }
            // The neutral ballot box the coins leave from.
            BallotBox(Modifier.align(AbsoluteAlignment.TopLeft).at(geo, 64, 48) { ballotBoxCenter(geo, rtl) })
        }

        // Travellers hop from their chairs onto the top edge of the card (arc 120 dp, `spring.bouncy`). At rest they are
        // back in their chairs (the café row draws them), so nobody is drawn twice.
        val ts = if (resting) emptyList() else travellers(seg)
        for ((k, pair) in ts.withIndex()) {
            val (id, sub) = pair
            val p = view.player(id) ?: continue
            val idx = view.players.indexOf(p)
            val subIndex = ts.take(k).count { it.second == sub }
            Box(
                Modifier.align(AbsoluteAlignment.TopLeft).at(geo, 48, 48) {
                    val q = seg.p(sub, clock.t(), subIndex)
                    val from = Offset(geo.seatX(idx, rtl), geo.rowCenterY)
                    val to = Offset(center().x + geo.dp(BluffBoard.travellerDx(k, ts.size)), center().y - geo.dp(CARD_H_DP / 2 + 24))
                    val arc = -geo.dp(120) * 4f * q.coerceIn(0f, 1f) * (1f - q.coerceIn(0f, 1f))
                    Offset(from.x + (to.x - from.x) * q, from.y + (to.y - from.y) * q + arc)
                }.graphicsLayer { alpha = if (seg.p(sub, clock.t(), subIndex) > 0f) 1f else 0f },
            ) {
                val e by remember(script, id) { derivedStateOf { script.expressionOf(id, clock.t()) ?: Expression.IDLE } }
                Character(p.color, 48.dp, e)
            }
        }

        // The stamp lands at −8° on the card's top end corner.
        if (st != null || truth) {
            val kind = st?.kind ?: OptionKind.TRUTH
            if (seg.kind != SegmentKind.FINAL_ANSWER) {
                Box(Modifier.align(AbsoluteAlignment.TopLeft).at(geo, 220, 60) { Offset(center().x + geo.dp(CARD_W_DP * 0.3f) * (if (rtl) -1f else 1f), center().y - geo.dp(CARD_H_DP * 0.42f)) }.size(220.dp, 60.dp), contentAlignment = Alignment.Center) {
                    StampLabel(stringResource(stampText(kind)), stampColor(kind), { seg.p("stamp", clock.t()) })
                }
            }
        }

        // Caption under the card: who fooled whom, the house, co-authors, the help badge, the truth's verdict and note.
        Column(
            Modifier.align(AbsoluteAlignment.TopLeft).at(geo, CARD_W_DP, 90) { Offset(center().x, center().y + geo.dp(CARD_H_DP / 2 + 56)) }.size(CARD_W_DP.dp, 90.dp)
                .graphicsLayer { alpha = seg.p(if (truth) "stamp" else "liar", clock.t()) },
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            val names = st?.authorIds?.mapNotNull { view.player(it)?.name }.orEmpty()
            val line = when {
                truth && view.notice == BluffNotice.ALL_KNEW -> stringResource(R.string.game__bluff__reveal__all_knew)
                truth && script.nobodyFound -> stringResource(R.string.game__bluff__reveal__nobody_found)
                truth && script.tooEasy -> stringResource(R.string.game__bluff__reveal__too_easy)
                truth -> null
                st?.kind == OptionKind.HOUSE -> stringResource(R.string.game__bluff__reveal__house_wrote)
                seg.kind == SegmentKind.FINAL_ANSWER && st != null && names.isNotEmpty() && st.voteCount == script.reveal.steps.sumOf { it.voteCount } && script.reveal.steps.size == 1 && st.voteCount > 1 ->
                    stringResource(R.string.game__bluff__reveal__unanimous)
                st != null && names.size > 1 -> stringResource(R.string.game__bluff__reveal__same_lie)
                st != null && names.isNotEmpty() -> pluralStringResource(R.plurals.game__bluff__reveal__fooled, st.voteCount, isolate(names.first()), st.voteCount)
                else -> null
            }
            if (line != null) Text(line, style = type.title, color = Paper, textAlign = TextAlign.Center, maxLines = 1)
            if (st?.helped == true) Text(stringResource(R.string.game__bluff__reveal__helped), style = type.caption, color = JamaaColors.TextMuted)
            if (truth) {
                val tr = script.reveal.truth
                if (tr?.note != null) {
                    Text(
                        stringResource(R.string.game__bluff__reveal__it_means, tr.note),
                        Modifier.graphicsLayer { val p = seg.p("note", clock.t()); alpha = p; translationY = (1f - p) * 20f * density },
                        style = type.body.contentDir(), color = JamaaColors.TextSecondary, textAlign = TextAlign.Center, maxLines = 2,
                    )
                }
                if (tr?.original != null && tr.original != tr.text) {
                    Text("${stringResource(R.string.game__bluff__reveal__in_arabic)} ${tr.original}", style = type.caption.contentDir(), color = JamaaColors.TextMuted, maxLines = 1)
                }
                if (st != null && st.foundEarlyIds.isNotEmpty()) {
                    Text("${names(view, st.foundEarlyIds)} · ${stringResource(R.string.game__bluff__reveal__found_early)}", style = type.caption, color = JamaaColors.TextMuted, maxLines = 1)
                }
            }
        }

        // Confetti from the card corners for the finders (paper white + amber, 1.2 s; none in calm motion).
        if (truth && st != null && st.voteCount + st.spotOnIds.size > 0) {
            val burst by remember(seg) { derivedStateOf { seg.p("confetti", clock.t()) > 0f && clock.t() < seg.endMs } }
            if (burst) Confetti(Modifier.fillMaxSize(), durationMs = 1_200, seed = seg.index)
        }
    }
}

private fun names(view: BluffView, ids: List<String>): String = ids.mapNotNull { view.player(it)?.name }.joinToString(", ") { isolate(it) }

private fun ballotBoxCenter(geo: StageGeometry, rtl: Boolean): Offset {
    val dx = geo.dp(CARD_W_DP / 2 + 60) * (if (rtl) 1f else -1f)
    return Offset(geo.cardCenterX(rtl) + dx, geo.cardCenterY + geo.dp(CARD_H_DP / 2))
}

@Composable
private fun BallotBox(modifier: Modifier) {
    Canvas(modifier.size(64.dp, 48.dp).clearAndSetSemantics {}) {
        drawRoundRect(Cafe.elevated, cornerRadius = androidx.compose.ui.geometry.CornerRadius(8.dp.toPx()))
        drawRect(PaperInk, topLeft = Offset(size.width * 0.25f, size.height * 0.18f), size = androidx.compose.ui.geometry.Size(size.width * 0.5f, 4.dp.toPx()))
    }
}

/** Cards revealed earlier in this prompt, small and dimmed, each with its stamp colour. */
@Composable
private fun StampedStrip(clock: PhaseClock, seg: Segment, script: BluffScript, geo: StageGeometry, rtl: Boolean, modifier: Modifier) {
    val done by remember(script, seg) { derivedStateOf { script.stamped(clock.t()).filter { it.optionId != seg.step?.optionId }.takeLast(6) } }
    if (done.isEmpty()) return
    Row(
        modifier.absoluteOffset { IntOffset(((if (rtl) geo.railWidth else 0f) + geo.dp(16)).roundToInt(), (geo.contentTop + geo.dp(4)).roundToInt()) },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        for (s in done) {
            Box(Modifier.width(120.dp).graphicsLayer { alpha = 0.6f }.background(Paper, RoundedCornerShape(8.dp)).border(3.dp, stampColor(s.kind), RoundedCornerShape(8.dp)).padding(horizontal = 8.dp, vertical = 4.dp)) {
                Text(s.text, style = JamaaTheme.type.caption.contentDir(), color = PaperInk, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

/** Final: the top answer(s) grow, MOST CONVINCING lands, a crown hops onto the author; or nobody wins the crown. */
@Composable
private fun CrownBeat(view: BluffView, clock: PhaseClock, seg: Segment, script: BluffScript, geo: StageGeometry, rtl: Boolean) {
    val type = JamaaTheme.type
    val tops = script.reveal.steps.filter { it.top }
    Box(Modifier.fillMaxSize()) {
        if (tops.isEmpty()) {
            Text(
                stringResource(R.string.game__bluff__reveal__no_crown),
                Modifier.align(AbsoluteAlignment.TopLeft).at(geo, CARD_W_DP, 80) { Offset(geo.cardCenterX(rtl), geo.cardCenterY) }.width(CARD_W_DP.dp)
                    .graphicsLayer { alpha = seg.p("grow", clock.t()) },
                style = type.headline, color = Paper, textAlign = TextAlign.Center,
            )
            return@Box
        }
        for ((k, st) in tops.withIndex()) {
            val dx = (k - (tops.size - 1) / 2f) * (CARD_W_DP / tops.size.coerceAtMost(3) + 12f)
            val w = (CARD_W_DP / tops.size.coerceAtMost(3)) - 12
            val c = { Offset(geo.cardCenterX(rtl) + geo.dp(dx), geo.cardCenterY) }
            Box(
                Modifier.align(AbsoluteAlignment.TopLeft).at(geo, w, CARD_H_DP, c).size(w.dp, CARD_H_DP.dp)
                    .graphicsLayer { val p = seg.p("grow", clock.t()); scaleX = 0.9f + 0.15f * p; scaleY = scaleX },
                contentAlignment = Alignment.Center,
            ) {
                OptionCard(st.text, fill = GoldLight)
            }
            Box(Modifier.align(AbsoluteAlignment.TopLeft).at(geo, 280, 60) { Offset(c().x, c().y - geo.dp(CARD_H_DP * 0.55f)) }.size(280.dp, 60.dp), contentAlignment = Alignment.Center) {
                StampLabel(stringResource(R.string.game__bluff__reveal__most_convincing), Gold, { seg.p("stamp", clock.t()) }, style = type.title)
            }
            for ((j, id) in st.authorIds.withIndex()) {
                val p = view.player(id) ?: continue
                Box(Modifier.align(AbsoluteAlignment.TopLeft).at(geo, 84, 110) { Offset(c().x + geo.dp((j - (st.authorIds.size - 1) / 2f) * 90f), c().y + geo.dp(CARD_H_DP / 2 + 60)) }) {
                    val e by remember(script, id) { derivedStateOf { script.expressionOf(id, clock.t()) ?: Expression.IDLE } }
                    Character(p.color, 84.dp, e, Modifier.align(Alignment.BottomCenter))
                    Canvas(Modifier.size(84.dp, 40.dp).align(Alignment.TopCenter).graphicsLayer {
                        val q = seg.p("crown", clock.t())
                        alpha = if (q > 0f) 1f else 0f
                        translationY = (1f - q) * -60f * density
                    }.clearAndSetSemantics {}) { crown(Gold) }
                }
            }
        }
        val confetti by remember(seg) { derivedStateOf { seg.p("confetti", clock.t()) > 0f && clock.t() < seg.endMs } }
        if (confetti) Confetti(Modifier.fillMaxSize(), durationMs = 1_200, seed = 41)
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.crown(color: Color) {
    val w = size.width * 0.5f
    val x0 = (size.width - w) / 2f
    val h = size.height * 0.8f
    val p = Path().apply {
        moveTo(x0, h); lineTo(x0, h * 0.35f); lineTo(x0 + w * 0.25f, h * 0.65f); lineTo(x0 + w * 0.5f, h * 0.1f)
        lineTo(x0 + w * 0.75f, h * 0.65f); lineTo(x0 + w, h * 0.35f); lineTo(x0 + w, h); close()
    }
    drawPath(p, color)
}

/** Final twist: every card flips at once to "No truth: it was all made up!" and every character laughs. */
@Composable
private fun TwistBeat(clock: PhaseClock, seg: Segment, script: BluffScript, geo: StageGeometry, rtl: Boolean) {
    val type = JamaaTheme.type
    val cards = script.reveal.steps.map { it.text } + script.reveal.unpicked.map { it.text }
    Box(Modifier.fillMaxSize()) {
        Column(
            Modifier.align(AbsoluteAlignment.TopLeft).at(geo, CARD_W_DP, 320) { Offset(geo.cardCenterX(rtl), geo.cardCenterY) }.width(CARD_W_DP.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            for ((i, text) in cards.take(8).withIndex()) {
                val flip = { seg.p("flip", clock.t(), i) }
                Box(Modifier.graphicsLayer { val f = flip(); scaleY = kotlin.math.abs(1f - 2f * f).coerceAtLeast(0.02f) }) {
                    val back by remember(seg, i) { derivedStateOf { flip() >= 0.5f } }
                    if (back) OptionCard("✕", dense = true, fill = Cafe.elevated, ink = Paper) else OptionCard(text, dense = true)
                }
            }
        }
        Box(Modifier.align(AbsoluteAlignment.TopLeft).at(geo, CARD_W_DP, 90) { Offset(geo.cardCenterX(rtl), geo.cardCenterY) }.size(CARD_W_DP.dp, 90.dp), contentAlignment = Alignment.Center) {
            StampLabel(stringResource(R.string.game__bluff__reveal__no_truth_stamp), LieRed, { seg.p("stamp", clock.t()) }, style = type.headline)
        }
    }
}

/** "Nobody bought it…": the unpicked lies fan out like a hand of cards, each with its author's sad face, then fall. */
@Composable
private fun NobodyMontage(view: BluffView, clock: PhaseClock, seg: Segment, script: BluffScript, geo: StageGeometry, rtl: Boolean) {
    val type = JamaaTheme.type
    val cards = script.reveal.unpicked.take(6)
    val rest = script.reveal.unpicked.drop(6)
    Box(Modifier.fillMaxSize()) {
        Text(
            stringResource(R.string.game__bluff__reveal__nobody),
            Modifier.align(AbsoluteAlignment.TopLeft).at(geo, CARD_W_DP, 50) { Offset(geo.cardCenterX(rtl), geo.contentTop + geo.dp(30)) }.width(CARD_W_DP.dp)
                .graphicsLayer { alpha = seg.p("fan", clock.t()) * (1f - seg.p("fall", clock.t())) },
            style = type.headline, color = Paper, textAlign = TextAlign.Center,
        )
        for ((i, u) in cards.withIndex()) {
            val spread = if (cards.size == 1) 0f else (i / (cards.size - 1f) - 0.5f) * 2f // −1 … 1
            Box(
                Modifier.align(AbsoluteAlignment.TopLeft).at(geo, 260, 110) {
                    val f = seg.p("fan", clock.t())
                    val fall = seg.p("fall", clock.t())
                    Offset(geo.cardCenterX(rtl) + geo.dp(spread * 200f) * f, geo.cardCenterY + geo.dp(20) + fall * geo.height)
                }.size(260.dp, 110.dp).graphicsLayer {
                    rotationZ = spread * 12f * seg.p("fan", clock.t())
                    alpha = seg.p("fan", clock.t())
                },
            ) {
                OptionCard(u.text, dense = true)
                u.authorIds.firstOrNull()?.let { view.player(it) }?.let { a ->
                    Character(a.color, 40.dp, Expression.SAD, Modifier.align(Alignment.BottomCenter))
                }
            }
        }
        if (rest.isNotEmpty()) {
            Text(
                rest.joinToString(" · ") { it.text },
                Modifier.align(AbsoluteAlignment.TopLeft).at(geo, CARD_W_DP, 40) { Offset(geo.cardCenterX(rtl), geo.contentBottom - geo.dp(24)) }.width(CARD_W_DP.dp)
                    .graphicsLayer { alpha = seg.p("fan", clock.t()) * (1f - seg.p("fall", clock.t())) },
                style = type.caption.contentDir(), color = JamaaColors.TextMuted, textAlign = TextAlign.Center, maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun LikesTally(clock: PhaseClock, seg: Segment, geo: StageGeometry, rtl: Boolean) {
    Text(
        stringResource(R.string.game__bluff__vote__like),
        Modifier.absoluteOffset { IntOffset((geo.cardCenterX(rtl) - geo.dp(150)).roundToInt(), geo.cardCenterY.roundToInt()) }.width(300.dp)
            .graphicsLayer { alpha = minOf(1f, (clock.t() - seg.startMs) / 200f) },
        style = JamaaTheme.type.headline, color = Color(0xFFFF96C5), textAlign = TextAlign.Center,
    )
}

/** The score rail at the end side: one pill per player (seat order), the odometer counting as each coin lands. */
@Composable
private fun ScoreRail(view: BluffView, clock: PhaseClock, script: BluffScript, geo: StageGeometry, rtl: Boolean) {
    val type = JamaaTheme.type
    // The platform's back hint sits at the top end corner for 3 s after each phase change (first seen, like the hint):
    // the rail waits below it, then eases up (no pill is ever covered).
    val phaseSeenAt = remember(view.n, view.phase) { System.currentTimeMillis() }
    for ((i, p) in view.players.withIndex()) {
        Row(
            Modifier
                .absoluteOffset {
                    clock.t() // re-placed every frame while the reveal clock ticks
                    val shift = geo.dp(BluffBoard.railHintShiftDp(System.currentTimeMillis() - phaseSeenAt))
                    val (x, y) = geo.pillCenter(i, rtl)
                    IntOffset((x - geo.dp(RAIL_DP - 24) / 2f).roundToInt(), (y + shift - geo.dp(RAIL_ROW_DP - 6) / 2f).roundToInt())
                }
                .size((RAIL_DP - 24).dp, (RAIL_ROW_DP - 6).dp)
                .graphicsLayer { val pop = script.pillPop(p.id, clock.t()); scaleX = 1f + 0.15f * pop; scaleY = scaleX; alpha = if (p.left) 0.5f else 1f }
                .background(Cafe.surface, RoundedCornerShape(50))
                .padding(horizontal = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // The player's shape avatar, not a bare colour dot (DESIGN §5.1: colour is never the only cue).
            Avatar(p.color, 20.dp, state = AvatarState(left = p.left))
            Spacer(Modifier.width(8.dp))
            Text(Names.ellipsize(p.name, 9), Modifier.weight(1f), style = type.caption, color = Paper, maxLines = 1)
            PillNumber(script, p.id, clock, type.titleS, Gold)
        }
    }
}

/**
 * A pill's score: under [BluffOdometer.FROM] it ticks as a plain integer; from it, an odometer (DESIGN-JAMAA §5.1),
 * one Western-digit column per place rolling on translationY in a layer lambda (a running count never recomposes).
 */
@Composable
private fun PillNumber(script: BluffScript, playerId: String, clock: PhaseClock, style: TextStyle, color: Color) {
    val final = remember(script, playerId) { script.pillValue(playerId, script.totalMs) }
    if (final < BluffOdometer.FROM) {
        val value by remember(script, playerId) { derivedStateOf { script.pillValue(playerId, clock.t()) } }
        Text(value.toString(), style = style, color = color, maxLines = 1)
        return
    }
    val places = BluffOdometer.places(final)
    val lineH = 26.dp
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
    val labelStyle = JamaaTheme.type.caption
    val measurer = androidx.compose.ui.text.rememberTextMeasurer()
    // Each coin carries the scorer's shape glyph (DESIGN §5.1 CVD: colour is never the only cue). Fixed count: 12.
    val glyphs = PlayerSwatch.entries.map { rememberVectorPainter(AvatarGlyphs.of(it.shape)) }
    Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
        val t = clock.t()
        for (c in script.coinsInFlight(t)) {
            val toIdx = view.players.indexOfFirst { it.id == c.toPlayerId }.takeIf { it >= 0 } ?: continue
            val (tx, ty) = geo.pillCenter(toIdx, rtl)
            val from = sourceOf(c, script, view, geo, rtl)
            val to = Offset(tx - geo.dp(RAIL_DP / 2 - 30), ty)
            val p = script.coinProgress(c, t)
            val ctrl = Offset((from.x + to.x) / 2f, minOf(from.y, to.y) - geo.dp(90))
            val u = 1f - p
            val pos = Offset(u * u * from.x + 2 * u * p * ctrl.x + p * p * to.x, u * u * from.y + 2 * u * p * ctrl.y + p * p * to.y)
            val swatch = view.player(c.toPlayerId)?.color?.let { PlayerSwatch.byId(it) }
            if (c.heart) {
                heart(pos, geo.dp(9), Color(0xFFFF96C5))
            } else {
                drawCircle(Paper, radius = geo.dp(10f), center = pos)
                drawCircle(swatch?.color ?: Gold, radius = geo.dp(8.5f), center = pos)
                if (swatch != null) {
                    val gs = geo.dp(10.5f)
                    translate(pos.x - gs / 2f, pos.y - gs / 2f) {
                        with(glyphs[swatch.ordinal]) { draw(Size(gs, gs), colorFilter = ColorFilter.tint(swatch.glyph)) }
                    }
                }
            }
            c.label?.let { amount ->
                val layout = measurer.measure("+$amount", labelStyle.copy(color = Paper))
                drawText(layout, topLeft = Offset(pos.x + geo.dp(8), pos.y - layout.size.height))
            }
        }
    }
}

/**
 * Where coin [c] leaves from. A fooled voter's coin leaves from that voter's own slot on the card (where the traveller
 * landed), so the room sees who paid whom; truth and crown coins from the card centre.
 */
private fun sourceOf(c: Coin, script: BluffScript, view: BluffView, geo: StageGeometry, rtl: Boolean): Offset = when (val s = c.from) {
    is CoinSource.Voter -> {
        val ts = script.segments.getOrNull(c.segment)?.let(::travellers).orEmpty()
        val k = ts.indexOfFirst { it.first == s.playerId }
        val dx = if (k >= 0) geo.dp(BluffBoard.travellerDx(k, ts.size)) else 0f
        Offset(geo.cardCenterX(rtl) + dx, geo.cardCenterY - geo.dp(CARD_H_DP / 2 + 24))
    }
    is CoinSource.Card -> Offset(geo.cardCenterX(rtl), geo.cardCenterY - geo.dp(CARD_H_DP / 2 + 24))
    CoinSource.BallotBox -> ballotBoxCenter(geo, rtl)
    is CoinSource.Liker -> {
        val i = view.players.indexOfFirst { it.id == s.playerId }.coerceAtLeast(0)
        Offset(geo.seatX(i, rtl), geo.rowCenterY - geo.dp(30))
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.heart(c: Offset, r: Float, color: Color) {
    val p = Path().apply {
        moveTo(c.x, c.y + r)
        cubicTo(c.x - r * 1.6f, c.y - r * 0.2f, c.x - r * 0.6f, c.y - r * 1.4f, c.x, c.y - r * 0.4f)
        cubicTo(c.x + r * 0.6f, c.y - r * 1.4f, c.x + r * 1.6f, c.y - r * 0.2f, c.x, c.y + r)
        close()
    }
    drawPath(p, color)
    drawPath(p, Paper, style = Stroke(r * 0.15f))
}

@Suppress("unused")
private fun BluffPlayer.swatch(): Color = PlayerSwatch.byId(color).color
