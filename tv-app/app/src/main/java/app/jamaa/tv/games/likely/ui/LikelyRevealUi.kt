package app.jamaa.tv.games.likely.ui

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.LayoutDirection
import androidx.tv.material3.Text
import app.jamaa.tv.games.GameScreenArgs
import app.jamaa.tv.games.likely.LikelyChoreo
import app.jamaa.tv.games.likely.LikelyPhase
import app.jamaa.tv.games.likely.LikelyPlayer
import app.jamaa.tv.games.likely.LikelyPt
import app.jamaa.tv.games.likely.LikelyRevealPlan
import app.jamaa.tv.games.likely.LikelyStage
import app.jamaa.tv.games.likely.LikelyView
import app.jamaa.tv.platform.CharacterRules
import app.jamaa.tv.platform.Expression
import app.jamaa.tv.protocol.member
import app.jamaa.tv.ui.characters.Character
import app.jamaa.tv.ui.components.Confetti
import app.jamaa.tv.ui.platform.keyText
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme
import app.jamaa.tv.ui.theme.PlayerSwatch
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.math.sin

// LK-TV-01..03 (DESIGN-JAMAA §7.8): the play stage in 864 × 486 stage units. Positions come from the shared layout
// math (LikelyLayout / LikelyStage, fixture-tested against layout.ts); time from the phase clock.

private const val CHAR = 72.0
private const val CARD_W = 520.0
private const val CARD_TOP = 8.0

/** Places [content] of stage size [w] × [h] with its centre (or [anchorY] fraction) at stage point [x], [y]. */
private fun Modifier.at(stage: StageScope, x: () -> Double, y: () -> Double, w: Double, h: Double, anchorY: Double = 0.5): Modifier =
    this.absoluteOffset {
        IntOffset(((x() - w / 2) * stage.unit * density).roundToInt(), ((y() - h * anchorY) * stage.unit * density).roundToInt())
    }.size(stage.dp(w), stage.dp(h))

@Composable
internal fun LikelyPlayStage(view: LikelyView, args: GameScreenArgs, clock: LikelyClock, rtl: Boolean, stage: StageScope) {
    val plan = remember(timelineKey(view), rtl) { if (view.phase == LikelyPhase.REVEAL) LikelyStage.revealPlan(view, rtl) else null }
    val seats = remember(view.jury.map { it.id }, rtl) { LikelyStage.seats(view, rtl) }
    Box(Modifier.fillMaxSize()) {
        // Gold bulb arch behind the card.
        Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
            val u = size.width / 864f
            val dim = if (plan != null) clock.p("dim") else 0f
            bulbArch(Offset(432f * u, 250f * u), 250f * u, lit = clock.p("deal").coerceIn(0f, 1f).let { if (view.phase == LikelyPhase.CARD) it else 1f }, dim = dim)
        }
        when (view.phase) {
            LikelyPhase.HOLD -> HoldPanel(view, args, stage, Modifier.align(Alignment.TopCenter).padding(top = stage.dp(20f)))
            else -> if (view.card != null) {
                LikelyCardFace(view, clock, stage, Modifier.align(Alignment.TopCenter).padding(top = stage.dp(CARD_TOP)).size(stage.dp(CARD_W), stage.dp(230.0)))
            }
        }
        if (plan != null) RevealBehind(plan, clock, stage)
        Jury(view, args, clock, plan, seats, stage)
        // Above the score rail: the VOTING progress, or (REVEAL) the captions and the percentage board.
        val railH = LikelyStage.railHeight(view)
        val above = stage.dp(if (railH > 0) RAIL_BOTTOM + railH + 6.0 else 6.0)
        if (view.phase == LikelyPhase.VOTING) VoteProgress(view, stage, Modifier.align(Alignment.BottomCenter).padding(bottom = above))
        if (plan != null) RevealFront(view, plan, clock, stage, above, compact = LikelyStage.railRows(view).size > 1 && railH > 0)
        ScoreRail(view, clock, stage, Modifier.align(Alignment.BottomCenter).padding(bottom = stage.dp(RAIL_BOTTOM)))
    }
}

private const val RAIL_BOTTOM = 6.0

/** VOTING: "3/5 voted" under the jury (web `lkvoted`), so the room sees who is still deciding. */
@Composable
private fun VoteProgress(view: LikelyView, stage: StageScope, modifier: Modifier) {
    val (count, total) = LikelyStage.voteProgress(view)
    CompositionLocalProvider(LocalLayoutDirection provides if (stage.rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
        Row(
            modifier
                .background(Rooftop.deep.copy(alpha = 0.8f), RoundedCornerShape(50))
                .padding(horizontal = stage.dp(12f), vertical = stage.dp(3f)),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            androidx.tv.material3.Icon(app.jamaa.tv.ui.components.JamaaIcons.Check, contentDescription = null, tint = JamaaColors.Success, modifier = Modifier.size(stage.dp(18f)))
            Spacer(Modifier.width(stage.dp(6f)))
            Text(keyText("game.likely.vote.progress", count, total), style = JamaaTheme.type.label, color = JamaaColors.Text, maxLines = 1)
        }
    }
}

/**
 * The public-mode score rail (web `ScoreRail`; DESIGN-JAMAA §5.1/§5.3 counters ticking): one character + score pill per
 * non-left player, in seat order and the room's reading direction, the leader ringed in gold. Never in secret-vote mode
 * (no points exist there). In REVEAL each counter rolls from `scoreBefore` to `score` on the `tick` step, after the
 * agreement coins land. Up to 8 pills in one row, 9–12 in two rows (6 × 96 units: fits the 864-unit stage).
 */
@Composable
private fun ScoreRail(view: LikelyView, clock: LikelyClock, stage: StageScope, modifier: Modifier) {
    if (!LikelyStage.showRail(view)) return
    val rows = LikelyStage.railRows(view)
    val leaders = LikelyStage.railLeaders(view)
    val type = JamaaTheme.type
    val pill = RoundedCornerShape(50)
    CompositionLocalProvider(LocalLayoutDirection provides if (stage.rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
        Column(
            modifier.graphicsLayer { alpha = if (clock.waiting()) 0f else 1f },
            verticalArrangement = Arrangement.spacedBy(stage.dp(4f)),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            for (row in rows) {
                Row(horizontalArrangement = Arrangement.spacedBy(stage.dp(LikelyStage.RAIL_GAP))) {
                    for (p in row) {
                        val lead = p.id in leaders
                        Row(
                            Modifier
                                .size(stage.dp(LikelyStage.RAIL_PILL_W), stage.dp(LikelyStage.RAIL_PILL_H))
                                .background(Rooftop.deep.copy(alpha = 0.8f), pill)
                                .border(stage.dp(if (lead) 2f else 1f), if (lead) Gold.copy(alpha = 0.75f) else JamaaColors.Text.copy(alpha = 0.1f), pill)
                                .padding(start = stage.dp(2f), end = stage.dp(8f)),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Character(p.color, stage.dp(30f), if (p.connected) Expression.IDLE else Expression.AWAY)
                            Spacer(Modifier.width(stage.dp(4f)))
                            // Recomposes only when the shown number changes (the clock is read in the derived state).
                            val shown = derived(clock, view.phase, p.id, p.score, p.scoreBefore) { LikelyStage.railScore(view, p, clock.p("tick")) }
                            Text(shown.toString(), style = type.label, color = Gold, maxLines = 1, softWrap = false, textAlign = TextAlign.Center, modifier = Modifier.weight(1f))
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- jury arc and runners

@Composable
private fun Jury(view: LikelyView, args: GameScreenArgs, clock: LikelyClock, plan: LikelyRevealPlan?, seats: Map<String, LikelyPt>, stage: StageScope) {
    val type = JamaaTheme.type
    val env = args.game.envelope
    // Draw back to front: in a conga the later places stand higher (further back).
    val order = remember(plan, view.jury) {
        val end = { p: LikelyPlayer -> plan?.endOf(p.id)?.y ?: seats[p.id]?.y ?: 0.0 }
        view.jury.sortedBy(end)
    }
    for (p in order) {
        val seat = seats[p.id] ?: continue
        val runner = plan?.runners?.firstOrNull { it.voterId == p.id }
        val member = args.room.member(p.id)
        val chaosIndex = view.jury.indexOf(p)
        fun pos(): LikelyPt {
            if (plan == null) {
                // The named player (Spicy) steps forward on its card.
                val fwd = if (view.card?.namedPlayerId == p.id && view.phase != LikelyPhase.REVEAL) 14.0 else 0.0
                return LikelyPt(seat.x, seat.y + fwd)
            }
            // Chaos: everyone scrambles around their seat and bumps into the others (1.2 s), then the picks show.
            var jx = 0.0
            var jy = 0.0
            if (plan.kind == LikelyChoreo.RevealKind.CHAOS) {
                val s = clock.p("scramble")
                val env01 = sin(PI * s)
                val t = clock.t() / 1000.0
                jx = sin(t * (5.0 + chaosIndex) + chaosIndex) * 46.0 * env01
                jy = -abs(sin(t * 9.0 + chaosIndex * 1.7)) * 18.0 * env01
            }
            if (runner == null) return LikelyPt(seat.x + jx, seat.y + jy)
            val r = clock.p("run", runner.index).coerceIn(0f, 1f).toDouble()
            // Two hops on the way (DESIGN-JAMAA §5.3): the height follows |sin(2πr)|.
            val hop = abs(sin(2 * PI * r)) * 26.0
            return LikelyPt(runner.from.x + (runner.to.x - runner.from.x) * r + jx, runner.from.y + (runner.to.y - runner.from.y) * r - hop + jy)
        }
        // Derived: recomposes only when the expression changes, not on every frame of the reveal.
        val base = derived(clock, plan, p.id, view.card?.namedPlayerId) {
            if (plan != null) LikelyStage.revealExpression(plan, p.id, clock.t()) else LikelyStage.cardExpression(view, p.id)
        }
        val expr = if (member != null) CharacterRules.expression(member, env, null, base) else if (!p.connected) Expression.AWAY else base
        val look = when {
            runner != null -> LikelyStage.look(runner.from, runner.to)
            else -> 0f
        }
        val top = plan?.topIds?.contains(p.id) == true
        Box(
            Modifier
                .at(stage, { pos().x }, { pos().y }, CHAR, CHAR, anchorY = 1.0)
                .graphicsLayer {
                    // Spotlight: everything but the top target(s) dims to 35 % (DESIGN-JAMAA §5.3).
                    val spot = if (plan != null && plan.topIds.isNotEmpty()) clock.p("spot") else 0f
                    alpha = if (top) 1f else 1f - 0.65f * spot.coerceIn(0f, 1f)
                },
        ) {
            Character(p.color, stage.dp(CHAR), expr, look = Offset(look, 0f))
            if (expr == Expression.DONE) CheckBadge(stage, Modifier.align(Alignment.TopEnd))
        }
        // Name plate under the seat; runners' plates fade as they leave (the counters carry the story).
        Box(
            Modifier
                .at(stage, { seat.x }, { seat.y + 14.0 }, 104.0, 24.0)
                .graphicsLayer {
                    alpha = if (runner != null) 1f - clock.p("run", runner.index).coerceIn(0f, 1f) else if (plan != null && !top) 1f - 0.5f * clock.p("spot").coerceIn(0f, 1f) else 1f
                },
            contentAlignment = Alignment.Center,
        ) {
            Text(
                shortName(p.name),
                style = type.titleS,
                color = if (p.connected) JamaaColors.Text else JamaaColors.TextMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
            )
        }
        if (p.isNew && view.phase == LikelyPhase.CARD) {
            Box(Modifier.at(stage, { seat.x }, { seat.y - CHAR - 14.0 }, 64.0, 22.0), contentAlignment = Alignment.Center) {
                Tag(keyText("game.likely.card.new"), Rooftop.accent)
            }
        }
    }
}

@Composable
private fun CheckBadge(stage: StageScope, modifier: Modifier) {
    Box(modifier.size(stage.dp(22f)).background(JamaaColors.Success, CircleShape), contentAlignment = Alignment.Center) {
        androidx.tv.material3.Icon(app.jamaa.tv.ui.components.JamaaIcons.Check, contentDescription = null, tint = JamaaColors.Ink, modifier = Modifier.size(stage.dp(14f)))
    }
}

// ---------------------------------------------------------------- reveal layers

/** Behind the characters: the spotlight cones and the secret ballot box. */
@Composable
private fun RevealBehind(plan: LikelyRevealPlan, clock: LikelyClock, stage: StageScope) {
    Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
        val u = size.width / 864f
        if (plan.kind == LikelyChoreo.RevealKind.SECRET) {
            val box = clock.p("box")
            val run = plan.envelopes.lastOrNull()?.let { clock.p("env", it.index) } ?: 1f
            ballotBox(Offset(432f * u, 205f * u), 64f * u, shake = box.coerceIn(0f, 1f), alpha = (1f - run).coerceIn(0f, 1f).let { if (box <= 0f) 0f else it.coerceAtLeast(0.15f) })
        }
        val drop = clock.p("spot")
        for (id in plan.topIds) {
            val at = plan.seats[id] ?: continue
            spotlight(Offset(at.x.toFloat() * u, (at.y - 4).toFloat() * u), drop, u)
        }
    }
}

/** In front of the characters: envelopes, counters, rosettes, coins, captions, the percentage board, confetti. */
@Composable
private fun RevealFront(view: LikelyView, plan: LikelyRevealPlan, clock: LikelyClock, stage: StageScope, bottom: androidx.compose.ui.unit.Dp, compact: Boolean) {
    val type = JamaaTheme.type
    val outerRtl = stage.rtl
    Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
        val u = size.width / 864f
        // Secret votes: identical envelopes burst from the box to their target, in tally order.
        for (e in plan.envelopes) {
            val p = clock.p("env", e.index).coerceIn(0f, 1f)
            if (p <= 0f) continue
            val from = Offset(432f * u, 190f * u)
            val to = Offset(e.to.x.toFloat() * u, e.to.y.toFloat() * u)
            val at = bezier(from, to, 70f * u, p)
            envelope(at, 22f * u, tilt = ((e.index % 3) - 1) * 9f * p)
        }
        // Rosettes land on the top target(s) (front anchor), spinning 180° → 0.
        if (plan.kind == LikelyChoreo.RevealKind.PUBLIC || plan.kind == LikelyChoreo.RevealKind.SECRET) {
            val r = (if (plan.topIds.size > 1) 20f else 26f) * u
            plan.topIds.forEachIndexed { i, id ->
                val at = plan.seats[id] ?: return@forEachIndexed
                val p = clock.p("stamp", i)
                if (p <= 0f) return@forEachIndexed
                val drop = (1f - p.coerceIn(0f, 1f)) * 60f * u
                rosette(Offset(at.x.toFloat() * u, (at.y - 24).toFloat() * u - drop), r * (0.6f + 0.4f * p), spin = 180f * (1f - p), alpha = p.coerceIn(0f, 1f))
            }
        }
        // Agreement coins: from the head of each voter's line (its pick) to the voter, in its colour.
        for (c in plan.coins) {
            val p = clock.p("coin", c.index)
            if (p <= 0f || p >= 1f) continue
            val a = Offset(c.from.x.toFloat() * u, c.from.y.toFloat() * u)
            val b = Offset(c.to.x.toFloat() * u, c.to.y.toFloat() * u)
            coin(bezier(a, b, 90f * u, p), 7f * u, PlayerSwatch.byId(view.player(c.voterId)?.color ?: "coral").color)
        }
    }
    // Counter bubbles with an odometer-style roll.
    for (c in plan.counters) {
        Box(
            Modifier
                .at(stage, { c.at.x }, { c.at.y }, 40.0, 40.0)
                .graphicsLayer {
                    val p = clock.p("count")
                    alpha = p.coerceIn(0f, 1f)
                    scaleX = 0.6f + 0.4f * p
                    scaleY = 0.6f + 0.4f * p
                }
                .background(Rooftop.surface, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            val shown = derived(clock, c) { (c.count * clock.p("count").coerceIn(0f, 1f)).roundToInt().coerceAtLeast(if (clock.p("count") > 0f) 1 else 0) }
            Text(shown.toString(), style = type.title, color = JamaaColors.Text)
        }
    }
    // The award name types in under each top target (Latin letter by letter; Arabic fades, DESIGN §6.2 F).
    val award = view.card?.award.orEmpty()
    plan.topIds.forEachIndexed { i, id ->
        val at = plan.seats[id] ?: return@forEachIndexed
        Box(Modifier.at(stage, { at.x }, { at.y + 40.0 }, 180.0, 26.0), contentAlignment = Alignment.Center) {
            val arabic = award.any { java.lang.Character.UnicodeBlock.of(it) == java.lang.Character.UnicodeBlock.ARABIC }
            val text = derived(clock, award, i) { if (arabic || clock.reduced) award else award.take((award.length * clock.p("stamp", i).coerceIn(0f, 1f)).roundToInt()) }
            Text(
                text,
                style = type.label,
                color = Gold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .graphicsLayer {
                        val p = clock.p("stamp", i).coerceIn(0f, 1f)
                        alpha = if (arabic || clock.reduced) p else if (p > 0f) 1f else 0f
                    }
                    .background(Rooftop.deep.copy(alpha = 0.75f), RoundedCornerShape(50))
                    .padding(horizontal = stage.dp(10f)),
            )
        }
    }
    // Coin labels ride with the coin and stay by the voter.
    for (c in plan.coins) {
        Box(
            Modifier
                .at(stage, {
                    val p = clock.p("coin", c.index).coerceIn(0f, 1f).toDouble()
                    c.from.x + (c.to.x - c.from.x) * p
                }, {
                    val p = clock.p("coin", c.index).coerceIn(0f, 1f).toDouble()
                    c.from.y + (c.to.y - c.from.y) * p - 22.0
                }, 64.0, 24.0)
                .graphicsLayer { alpha = if (clock.p("coin", c.index) > 0f) 1f else 0f },
            contentAlignment = Alignment.Center,
        ) {
            Text("+${c.points}", style = type.label, color = Gold, modifier = Modifier.background(Rooftop.deep.copy(alpha = 0.8f), RoundedCornerShape(50)).padding(horizontal = stage.dp(6f)))
        }
    }
    // Captions (under the jury), the "AGAIN?!" banner and the percentage board, in the room's reading direction.
    CompositionLocalProvider(LocalLayoutDirection provides if (outerRtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
        Box(Modifier.fillMaxSize()) {
            Column(
                Modifier.align(Alignment.BottomCenter).padding(bottom = bottom).wrapContentSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                RevealCaption(view, plan, clock, stage, compact)
                if (plan.board.isNotEmpty()) PercentBoard(view, plan, clock, stage)
            }
            plan.againId?.let { id ->
                val name = view.player(id)?.name ?: return@let
                Text(
                    keyText("game.likely.reveal.again", shortName(name)),
                    style = type.headline,
                    color = Rooftop.accentText,
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = stage.dp(150f))
                        .graphicsLayer {
                            val p = clock.p("stamp")
                            alpha = p.coerceIn(0f, 1f)
                            rotationZ = -4f
                            scaleX = 1.4f - 0.4f * p
                            scaleY = 1.4f - 0.4f * p
                        },
                )
            }
        }
    }
    val confetti = derived(clock, plan) { plan.unanimous && clock.t() >= (plan.timeline.step("confetti")?.startMs ?: Int.MAX_VALUE) }
    if (confetti) {
        Confetti(Modifier.fillMaxSize(), durationMs = LikelyChoreo.CONFETTI_MS, seed = view.cardIndex + 3)
    }
}

@Composable
private fun RevealCaption(view: LikelyView, plan: LikelyRevealPlan, clock: LikelyClock, stage: StageScope, compact: Boolean) {
    val type = JamaaTheme.type
    val text: String
    val step: String
    when (plan.kind) {
        LikelyChoreo.RevealKind.NONE -> { text = keyText("game.likely.reveal.none"); step = "dim" }
        LikelyChoreo.RevealKind.CHAOS -> { text = keyText("game.likely.reveal.chaos"); step = "scramble" }
        else -> {
            step = "hold"
            text = when {
                plan.unanimous -> keyText(if (view.anonymous) "game.likely.reveal.unanimous" else "game.likely.reveal.unanimousPts")
                plan.topIds.size > 1 -> keyText("game.likely.reveal.tie")
                else -> plan.defendId?.let { view.player(it)?.name }?.let { keyText("game.likely.reveal.defend", shortName(it)) } ?: ""
            }
        }
    }
    if (text.isEmpty()) return
    // A single top target gets the speech bubble (DESIGN-JAMAA §5.3 Hold), bouncing as the hold lands.
    val bubble = (plan.kind == LikelyChoreo.RevealKind.PUBLIC || plan.kind == LikelyChoreo.RevealKind.SECRET) && plan.topIds.size == 1
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.graphicsLayer {
            val p = clock.p(step)
            alpha = p.coerceIn(0f, 1f)
            scaleX = 0.85f + 0.15f * p
            scaleY = 0.85f + 0.15f * p
        },
    ) {
        if (bubble) {
            androidx.tv.material3.Icon(
                SpeechIcon,
                contentDescription = null,
                tint = Rooftop.accentText,
                modifier = Modifier
                    .size(stage.dp(if (compact) 26f else 32f))
                    .graphicsLayer {
                        val q = clock.p("hold").coerceIn(0f, 1f)
                        // Two decaying hops while the hold lands; still under calm motion.
                        translationY = if (clock.reduced) 0f else -abs(sin(q * 2f * PI.toFloat())) * (1f - q) * 10f * density
                    },
            )
            Spacer(Modifier.width(stage.dp(8f)))
        }
        Text(
            text,
            style = if (compact) type.title else type.headline,
            color = JamaaColors.Text,
            textAlign = TextAlign.Center,
            maxLines = 2,
        )
    }
}

/** Secret votes: one line per voted target, largest first, the bar filling to its percent (GAME-LIKELY §12.2). */
@Composable
private fun PercentBoard(view: LikelyView, plan: LikelyRevealPlan, clock: LikelyClock, stage: StageScope) {
    val type = JamaaTheme.type
    val lang = androidx.compose.ui.text.intl.Locale.current.language
    val columns = if (plan.board.size > 3) plan.board.chunked((plan.board.size + 1) / 2) else listOf(plan.board)
    var index = 0
    Row(horizontalArrangement = Arrangement.spacedBy(stage.dp(24f))) {
        for (col in columns) {
            Column(verticalArrangement = Arrangement.spacedBy(stage.dp(4f))) {
                for (line in col) {
                    val i = index++
                    val p = view.player(line.playerId) ?: continue
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.graphicsLayer {
                            val q = clock.p("board", i)
                            alpha = q.coerceIn(0f, 1f)
                            translationX = (if (stage.rtl) 1f else -1f) * 40f * (1f - q.coerceIn(0f, 1f)) * density
                        },
                    ) {
                        // The most-voted look shy, like on the stage (web board).
                        Character(p.color, stage.dp(28f), if (line.playerId in plan.topIds) Expression.SHY else Expression.IDLE)
                        Spacer(Modifier.width(stage.dp(8f)))
                        Box(Modifier.size(stage.dp(90f), stage.dp(10f)).background(Rooftop.elevated, RoundedCornerShape(50))) {
                            Canvas(Modifier.fillMaxSize()) {
                                val q = clock.p("board", i).coerceIn(0f, 1f)
                                val w = size.width * line.percent / 100f * q
                                val x = if (stage.rtl) size.width - w else 0f
                                drawRoundRect(PlayerSwatch.byId(p.color).color, topLeft = Offset(x, 0f), size = Size(w, size.height), cornerRadius = androidx.compose.ui.geometry.CornerRadius(size.height / 2))
                            }
                        }
                        Spacer(Modifier.width(stage.dp(8f)))
                        Text(
                            keyText("game.likely.reveal.percent", LikelyStage.percentText(line.percent, lang), shortName(p.name)),
                            style = type.label,
                            color = JamaaColors.Text,
                            maxLines = 1,
                        )
                    }
                }
            }
        }
    }
}

/** A value computed from the phase clock that recomposes only when it changes (never every frame). */
@Composable
internal fun <T> derived(vararg keys: Any?, calc: () -> T): T {
    val state = remember(*keys) { derivedStateOf(calc) }
    return state.value
}
