package app.jamaa.tv.games.likely.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.LayoutDirection
import androidx.tv.material3.Text
import app.jamaa.tv.games.GameScreenArgs
import app.jamaa.tv.games.likely.LikelyChoreo
import app.jamaa.tv.games.likely.LikelyLayout
import app.jamaa.tv.games.likely.LikelyPhase
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
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.math.sin

// LK-TV-01..03 (DESIGN-JAMAA §7.8, GAME-LIKELY §12.2): the play stage in 864 × 442 stage units (the whole safe area under
// the 44 dp header). Owner redesign 2026-11-12: one centred composition. The card on top; the players as ONE row; in
// the reveal the card lifts, the row glides up, and every vote lands under the person it picked, one by one (public
// mode: the voter's own character in miniature, so the room reads who voted for whom; secret votes: identical
// envelopes). Then the counts, the spotlight and the award stamp, with the award and its winner(s) named in a banner
// between the card and the row. Positions: LikelyLayout (fixture-tested against layout.ts); time: the phase clock.

private val L = LikelyLayout

/** Places [content] of stage size [w] × [h] with its centre (or [anchorY] fraction) at stage point [x], [y]. */
private fun Modifier.at(stage: StageScope, x: () -> Double, y: () -> Double, w: Double, h: Double, anchorY: Double = 0.5): Modifier =
    this.absoluteOffset {
        IntOffset(((x() - w / 2) * stage.unit * density).roundToInt(), ((y() - h * anchorY) * stage.unit * density).roundToInt())
    }.size(stage.dp(w), stage.dp(h))

/** Linear blend of two stage points. */
private fun mix(a: LikelyPt, b: LikelyPt, t: Double) = LikelyPt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)

@Composable
internal fun LikelyPlayStage(view: LikelyView, args: GameScreenArgs, clock: LikelyClock, rtl: Boolean, stage: StageScope) {
    val plan = remember(timelineKey(view), rtl) { if (view.phase == LikelyPhase.REVEAL) LikelyStage.revealPlan(view, rtl) else null }
    val seats = remember(view.jury.map { it.id }, rtl) { LikelyStage.seats(view, rtl) }
    Box(Modifier.fillMaxSize()) {
        // Gold bulb arch behind the card; it dims with the room in the reveal.
        Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
            val u = size.width / 864f
            val dim = if (plan != null) clock.p("dim") else 0f
            bulbArch(Offset(432f * u, 250f * u), 300f * u, lit = clock.p("deal").coerceIn(0f, 1f).let { if (view.phase == LikelyPhase.CARD) it else 1f }, dim = dim)
        }
        when (view.phase) {
            LikelyPhase.HOLD -> HoldPanel(view, args, stage, Modifier.align(Alignment.TopCenter).padding(top = stage.dp(20f)))
            else -> if (view.card != null) {
                LikelyCardFace(
                    view, clock, stage,
                    Modifier.align(Alignment.TopCenter).padding(top = stage.dp(L.CARD_TOP)).size(stage.dp(L.CARD_WIDTH), stage.dp(L.CARD_HEIGHT)),
                )
            }
        }
        if (plan != null) Spotlights(plan, clock)
        Jury(view, args, clock, plan, seats, stage)
        if (plan != null) RevealFront(view, plan, clock, stage)
        if (view.phase == LikelyPhase.VOTING) {
            VoteProgress(view, stage, Modifier.align(Alignment.BottomCenter).padding(bottom = stage.dp(4f)))
        }
    }
}

/** VOTING: "3/5 voted" under the row (web `lkvoted`), so the room sees who is still deciding. */
@Composable
private fun VoteProgress(view: LikelyView, stage: StageScope, modifier: Modifier) {
    val (count, total) = LikelyStage.voteProgress(view)
    CompositionLocalProvider(LocalLayoutDirection provides if (stage.rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
        Row(
            modifier
                .background(Rooftop.deep.copy(alpha = 0.8f), RoundedCornerShape(50))
                .padding(horizontal = stage.dp(14f), vertical = stage.dp(3f)),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            androidx.tv.material3.Icon(app.jamaa.tv.ui.components.JamaaIcons.Check, contentDescription = null, tint = JamaaColors.Success, modifier = Modifier.size(stage.dp(20f)))
            Spacer(Modifier.width(stage.dp(6f)))
            Text(keyText("game.likely.vote.progress", count, total), style = JamaaTheme.type.title, color = JamaaColors.Text, maxLines = 1)
        }
    }
}

// ---------------------------------------------------------------- the row of players

@Composable
private fun Jury(view: LikelyView, args: GameScreenArgs, clock: LikelyClock, plan: LikelyRevealPlan?, seats: Map<String, LikelyPt>, stage: StageScope) {
    val type = JamaaTheme.type
    val env = args.game.envelope
    val n = view.jury.size
    // Name plates are as wide as the row step allows (12 players: 72 units), names ellipsize (DESIGN: names only).
    val plateW = (LikelyLayout.rowStep(n) - 4).coerceAtMost(140.0)
    val nameStyle = if (n > 8) type.label else type.titleS
    view.jury.forEachIndexed { index, p ->
        val seat = seats[p.id] ?: return@forEachIndexed
        val rowAt = plan?.row?.get(p.id) ?: seat
        val member = args.room.member(p.id)
        val top = plan?.topIds?.contains(p.id) == true
        fun pos(): LikelyPt {
            if (plan == null) {
                // The named player (Spicy) steps forward on its card.
                val fwd = if (view.card?.namedPlayerId == p.id) 12.0 else 0.0
                return LikelyPt(seat.x, seat.y + fwd)
            }
            val lift = clock.p("dim").coerceIn(0f, 1f).toDouble()
            var at = mix(seat, rowAt, lift)
            if (plan.kind == LikelyChoreo.RevealKind.CHAOS) {
                // Chaos: everyone jitters in place and hops (1 s), then laughs; nobody leaves their spot.
                val s = clock.p("scramble").toDouble()
                val e = sin(PI * s)
                val t = clock.t() / 1000.0
                at = LikelyPt(at.x + sin(t * (11.0 + index) + index) * 10.0 * e, at.y - abs(sin(t * 9.0 + index * 1.7)) * 14.0 * e)
            }
            return at
        }
        // Derived: recomposes only when the expression changes, not on every frame of the reveal.
        val base = derived(clock, plan, p.id, view.card?.namedPlayerId) {
            if (plan != null) LikelyStage.revealExpression(plan, p.id, clock.t()) else LikelyStage.cardExpression(view, p.id)
        }
        val expr = if (member != null) CharacterRules.expression(member, env, null, base) else if (!p.connected) Expression.AWAY else base
        // A voter looks toward its pick while its token flies.
        val look = plan?.let { pl ->
            val tk = pl.tokens.firstOrNull { it.voterId == p.id } ?: return@let 0f
            pl.row[tk.targetId]?.let { LikelyStage.look(rowAt, it) } ?: 0f
        } ?: 0f
        Box(
            Modifier
                .at(stage, { pos().x }, { pos().y }, L.CHAR_SIZE, L.CHAR_SIZE, anchorY = 1.0)
                .graphicsLayer {
                    transformOrigin = TransformOrigin(0.5f, 1f)
                    val lift = if (plan != null) clock.p("dim").coerceIn(0f, 1f) else 0f
                    val spot = if (plan != null && plan.topIds.isNotEmpty()) clock.p("spot").coerceIn(0f, 1f) else 0f
                    // 72 → 64 as the row rises; the most-voted step up 12 % under the spotlight, the others dim to 55 %.
                    val sc = (1f - (1f - (L.REVEAL_CHAR / L.CHAR_SIZE).toFloat()) * lift) * (if (top) 1f + 0.12f * spot else 1f)
                    scaleX = sc
                    scaleY = sc
                    alpha = if (top || plan == null) 1f else 1f - 0.45f * spot
                },
        ) {
            Character(p.color, stage.dp(L.CHAR_SIZE), expr, look = Offset(look, 0f))
            if (expr == Expression.DONE) CheckBadge(stage, Modifier.align(Alignment.TopEnd))
        }
        // The name plate under the feet, gliding with the character.
        Box(
            Modifier
                .at(stage, { pos().x }, { pos().y + 13.0 }, plateW, 26.0)
                .graphicsLayer {
                    val spot = if (plan != null && plan.topIds.isNotEmpty()) clock.p("spot").coerceIn(0f, 1f) else 0f
                    alpha = if (top || plan == null) 1f else 1f - 0.35f * spot
                },
            contentAlignment = Alignment.Center,
        ) {
            Text(
                shortName(p.name),
                style = nameStyle,
                color = if (top) GoldHi else if (p.connected) JamaaColors.Text else JamaaColors.TextMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
            )
        }
        if (p.isNew && view.phase == LikelyPhase.CARD) {
            Box(Modifier.at(stage, { seat.x }, { seat.y - L.CHAR_SIZE - 14.0 }, 72.0, 24.0), contentAlignment = Alignment.Center) {
                Tag(keyText("game.likely.card.new"), Rooftop.accent)
            }
        }
    }
}

@Composable
private fun CheckBadge(stage: StageScope, modifier: Modifier) {
    Box(modifier.size(stage.dp(24f)).background(JamaaColors.Success, CircleShape), contentAlignment = Alignment.Center) {
        androidx.tv.material3.Icon(app.jamaa.tv.ui.components.JamaaIcons.Check, contentDescription = null, tint = JamaaColors.Ink, modifier = Modifier.size(stage.dp(16f)))
    }
}

// ---------------------------------------------------------------- reveal layers

/** Behind the characters: a soft spotlight cone on each most-voted player (it drops from the rig, no blur). */
@Composable
private fun Spotlights(plan: LikelyRevealPlan, clock: LikelyClock) {
    if (plan.topIds.isEmpty()) return
    Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
        val u = size.width / 864f
        val drop = clock.p("spot")
        for (id in plan.topIds) {
            val at = plan.row[id] ?: continue
            spotlight(Offset(at.x.toFloat() * u, (at.y + 2).toFloat() * u), drop, u)
        }
    }
}

/** In front of the characters: the vote tokens, the counts, the stamps, the banner, confetti. */
@Composable
private fun RevealFront(view: LikelyView, plan: LikelyRevealPlan, clock: LikelyClock, stage: StageScope) {
    val type = JamaaTheme.type
    val cell = plan.cell
    val cardDrop = LikelyPt(L.WIDTH / 2, L.CARD_TOP + L.CARD_HEIGHT * L.CARD_REVEAL_SCALE)
    val spot = { if (plan.topIds.isNotEmpty()) clock.p("spot").coerceIn(0f, 1f) else 0f }
    // The votes, one by one, along a soft arc from the voter (public) or from the card (secret) to their slot.
    plan.tokens.forEachIndexed { i, tk ->
        val voter = tk.voterId?.let { view.player(it) }
        val from = if (tk.voterId != null) plan.row[tk.voterId]?.let { LikelyPt(it.x, it.y - L.REVEAL_CHAR / 2) } ?: tk.at else cardDrop
        val lift = if (tk.voterId == tk.targetId) 24.0 else 70.0
        fun at(): LikelyPt {
            val q = clock.p("token", i).coerceIn(0f, 1f).toDouble()
            val cx = (from.x + tk.at.x) / 2
            val cy = minOf(from.y, tk.at.y) - lift
            val u = 1 - q
            return LikelyPt(u * u * from.x + 2 * u * q * cx + q * q * tk.at.x, u * u * from.y + 2 * u * q * cy + q * q * tk.at.y)
        }
        val dimmed = tk.targetId !in plan.topIds
        Box(
            Modifier
                .at(stage, { at().x }, { at().y }, cell, cell)
                .graphicsLayer {
                    val q = clock.p("token", i).coerceIn(0f, 1f)
                    val s = 0.55f + 0.45f * q
                    scaleX = s
                    scaleY = s
                    alpha = (if (q > 0f) 1f else 0f) * (if (dimmed) 1f - 0.3f * spot() else 1f)
                },
            contentAlignment = Alignment.Center,
        ) {
            if (voter != null) {
                Character(voter.color, stage.dp(cell * 0.92), Expression.IDLE)
            } else {
                Canvas(Modifier.fillMaxSize()) { envelope(center, size.minDimension * 0.92f, tilt = ((i % 3) - 1) * 6f) }
            }
        }
    }
    // The count bubble above each voted player: votes (public) or the percentage (secret votes, §8.1).
    val lang = androidx.compose.ui.text.intl.Locale.current.language
    for ((id, c) in plan.counts) {
        val at = plan.row[id] ?: continue
        val text = if (plan.kind == LikelyChoreo.RevealKind.SECRET) LikelyStage.percentText(c.percent, lang) else c.count.toString()
        val w = if (plan.kind == LikelyChoreo.RevealKind.SECRET) 64.0 else 38.0
        Box(
            Modifier
                .at(stage, { at.x + L.REVEAL_CHAR * 0.42 }, { at.y - L.REVEAL_CHAR + 10.0 }, w, 34.0)
                .graphicsLayer {
                    val p = clock.p("count")
                    alpha = p.coerceIn(0f, 1f)
                    scaleX = 0.5f + 0.5f * p
                    scaleY = 0.5f + 0.5f * p
                }
                .background(if (id in plan.topIds) Gold else Rooftop.surface, RoundedCornerShape(50))
                .border(stage.dp(1.5f), Gold.copy(alpha = 0.7f), RoundedCornerShape(50)),
            contentAlignment = Alignment.Center,
        ) {
            Text(text, style = type.title, color = if (id in plan.topIds) JamaaColors.Ink else JamaaColors.Text, maxLines = 1, softWrap = false)
        }
    }
    // The award stamp lands on each most-voted player's chest, spinning 180° → 0.
    plan.topIds.forEachIndexed { i, id ->
        val at = plan.row[id] ?: return@forEachIndexed
        Canvas(Modifier.at(stage, { at.x + 22.0 }, { at.y - 22.0 }, 44.0, 44.0).clearAndSetSemantics {}) {
            val p = clock.p("stamp", i)
            if (p <= 0f) return@Canvas
            val drop = (1f - p.coerceIn(0f, 1f)) * size.height
            rosette(Offset(center.x, center.y - drop), size.minDimension * 0.36f * (0.6f + 0.4f * p), spin = 180f * (1f - p), alpha = p.coerceIn(0f, 1f))
        }
    }
    // The banner between the shrunk card and the row, in the room's reading direction.
    CompositionLocalProvider(LocalLayoutDirection provides if (stage.rtl) LayoutDirection.Rtl else LayoutDirection.Ltr) {
        Box(Modifier.at(stage, { L.WIDTH / 2 }, { L.BANNER_Y }, L.WIDTH, 40.0), contentAlignment = Alignment.Center) {
            Banner(view, plan, clock, stage)
        }
    }
    val confetti = derived(clock, plan) { plan.unanimous && clock.t() >= (plan.timeline.step("confetti")?.startMs ?: Int.MAX_VALUE) }
    if (confetti) Confetti(Modifier.fillMaxSize(), durationMs = LikelyChoreo.CONFETTI_MS, seed = view.cardIndex + 3)
}

/** The result in one line: the award and its winner(s) (with "Unanimous!" / "{name} AGAIN?!"), or chaos, or no votes. */
@Composable
private fun Banner(view: LikelyView, plan: LikelyRevealPlan, clock: LikelyClock, stage: StageScope) {
    val type = JamaaTheme.type
    val styles = listOf(type.headline, type.title, type.titleS, type.label)
    when (plan.kind) {
        LikelyChoreo.RevealKind.NONE, LikelyChoreo.RevealKind.CHAOS -> {
            val text = keyText(if (plan.kind == LikelyChoreo.RevealKind.NONE) "game.likely.reveal.none" else "game.likely.reveal.chaos")
            val step = if (plan.kind == LikelyChoreo.RevealKind.NONE) "hold" else "count"
            FitText(
                text, styles, JamaaColors.Text, maxLines = 1,
                modifier = Modifier
                    .graphicsLayer {
                        val p = clock.p(step)
                        alpha = p.coerceIn(0f, 1f)
                        scaleX = 0.85f + 0.15f * p
                        scaleY = 0.85f + 0.15f * p
                    }
                    .background(Rooftop.deep.copy(alpha = 0.85f), RoundedCornerShape(50))
                    .padding(horizontal = stage.dp(22f), vertical = stage.dp(4f)),
            )
        }
        else -> {
            val award = view.card?.award.orEmpty()
            if (plan.topIds.isEmpty() || award.isEmpty()) return
            val names = plan.topIds.mapNotNull { view.player(it)?.name }.joinToString(" · ") { shortName(it) }
            val again = plan.againId?.let { view.player(it)?.name }
            val text = buildAnnotatedString {
                if (plan.unanimous) {
                    withStyle(SpanStyle(color = Rooftop.accentText)) { append(keyText("game.likely.reveal.unanimous")) }
                    append("  ")
                } else if (again != null) {
                    withStyle(SpanStyle(color = Rooftop.accentText)) { append(keyText("game.likely.reveal.again", shortName(again))) }
                    append("  ")
                }
                withStyle(SpanStyle(color = Gold)) { append(award) }
                append("  ·  ")
                withStyle(SpanStyle(color = JamaaColors.Text)) { append(names) }
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .graphicsLayer {
                        val p = clock.p("stamp")
                        alpha = p.coerceIn(0f, 1f)
                        scaleX = 1.25f - 0.25f * p
                        scaleY = 1.25f - 0.25f * p
                    }
                    .background(Rooftop.deep.copy(alpha = 0.88f), RoundedCornerShape(50))
                    .border(stage.dp(2f), Gold.copy(alpha = 0.65f), RoundedCornerShape(50))
                    .padding(horizontal = stage.dp(18f), vertical = stage.dp(3f)),
            ) {
                Canvas(Modifier.size(stage.dp(30f)).clearAndSetSemantics {}) { rosette(center, size.minDimension * 0.36f, 0f) }
                Spacer(Modifier.width(stage.dp(8f)))
                FitText(text, styles, JamaaColors.Text, maxLines = 1, textAlign = TextAlign.Start)
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
