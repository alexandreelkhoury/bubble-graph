package app.jamaa.tv.games.likely.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.games.GameScreenArgs
import app.jamaa.tv.games.likely.LikelyAwardEntry
import app.jamaa.tv.games.likely.LikelyAwardKind
import app.jamaa.tv.games.likely.LikelyAwardsPage
import app.jamaa.tv.games.likely.LikelyAwardsPlan
import app.jamaa.tv.games.likely.LikelyChoreo
import app.jamaa.tv.games.likely.LikelyStage
import app.jamaa.tv.games.likely.LikelyTimeline
import app.jamaa.tv.games.likely.LikelyView
import app.jamaa.tv.games.likely.LikelyWallGrid
import app.jamaa.tv.platform.Expression
import app.jamaa.tv.ui.characters.Character
import app.jamaa.tv.ui.components.ButtonKind
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.JamaaButton
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.components.LocalSounds
import app.jamaa.tv.ui.components.focusFallback
import app.jamaa.tv.ui.platform.RoundIconButton
import app.jamaa.tv.ui.platform.keyText
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme
import kotlin.math.roundToInt

// LK-TV-04 awards ceremony (GAME-LIKELY §12.4) on the server's AWARDS clock, and LK-TV-05 results: the awards wall
// (§8.2 RESULTS). No points, no Mind Reader, no ranking (owner decision 2026-11-12).

/**
 * The AWARDS pages on the server clock: page = [LikelyAwardsPlan.at] of the time since AWARDS started (derived from the
 * deadline), so a TV that reconnects lands on the right trio. OK completes the current page's animation only; "Next"
 * (HOST_ADVANCE) is in the pause menu (GAME-LIKELY §4.1).
 */
@Stable
internal class AwardsClock(val plan: LikelyAwardsPlan, val reduced: Boolean) {
    val elapsed = mutableLongStateOf(0L)
    val completedPage = mutableIntStateOf(-1)

    fun page(): Int = plan.at(elapsed.longValue).first

    fun timeline(i: Int): LikelyTimeline = when (plan.pages[i]) {
        LikelyAwardsPage.Intro -> LikelyChoreo.awardsIntro
        is LikelyAwardsPage.Trio -> LikelyChoreo.awardsTrio
    }

    /** Time into the current page (its end when OK completed it). */
    fun t(): Double {
        val (i, inPage) = plan.at(elapsed.longValue)
        return if (completedPage.intValue == i) maxOf(inPage.toDouble(), timeline(i).totalMs.toDouble()) else inPage.toDouble()
    }

    fun p(id: String, index: Int = 0): Float = LikelyChoreo.progress(timeline(page()).step(id), t(), index, reduced)

    fun complete(): Boolean {
        val i = page()
        val running = completedPage.intValue != i && t() < timeline(i).totalMs
        completedPage.intValue = i
        return running
    }
}

@Composable
internal fun rememberAwardsClock(view: LikelyView, clockOffsetMs: Long, reduced: Boolean): AwardsClock {
    val clock = remember(view.n, view.awards, reduced) { AwardsClock(LikelyStage.awardsPlan(view), reduced) }
    val offset by rememberUpdatedState(clockOffsetMs)
    val deadline by rememberUpdatedState(view.deadline)
    val sounds = LocalSounds.current
    LaunchedEffect(clock) {
        var prevPage = -1
        var prevT = 0.0
        while (true) {
            withFrameMillis { }
            val d = deadline ?: break
            val remaining = d - (System.currentTimeMillis() + offset)
            clock.elapsed.longValue = (clock.plan.totalMs - remaining).coerceAtLeast(0L)
            val page = clock.page()
            val t = clock.t()
            if (page != prevPage) prevT = -0.5
            if (clock.completedPage.intValue != page) playMarks(LikelyChoreo.marksBetween(clock.timeline(page), prevT, t)) { sounds.play(it) }
            prevPage = page
            prevT = t
            if (remaining <= 0L) break
        }
    }
    return clock
}

@Composable
internal fun LikelyAwards(view: LikelyView, clock: AwardsClock, rtl: Boolean, args: GameScreenArgs) {
    LikelyStageBox(Modifier.fillMaxSize()) {
        val page = clock.plan.pages[derived(clock) { clock.page() }]
        Box(Modifier.fillMaxSize()) {
            when (page) {
                LikelyAwardsPage.Intro -> AwardsIntro(clock, this@LikelyStageBox)
                is LikelyAwardsPage.Trio -> AwardsTrio(view, page.entries, clock, this@LikelyStageBox)
            }
        }
    }
}

@Composable
private fun AwardsIntro(clock: AwardsClock, stage: StageScope) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) { curtain(clock.p("curtain")) }
        GoldTitle(keyText("game.likely.awards.title"), Modifier.graphicsLayer {
            val p = clock.p("title")
            alpha = p.coerceIn(0f, 1f)
            scaleX = 1.3f - 0.3f * p
            scaleY = 1.3f - 0.3f * p
        })
    }
}

/** Award-gold title text (DESIGN-JAMAA §1.6): Cairo Black in a vertical gold gradient. */
@Composable
internal fun GoldTitle(text: String, modifier: Modifier = Modifier, small: Boolean = false) {
    val style = (if (small) JamaaTheme.type.headline else JamaaTheme.type.displayM).copy(brush = Brush.verticalGradient(listOf(GoldHi, Gold, GoldLo)))
    Text(text, style = style, textAlign = TextAlign.Center, maxLines = 1, modifier = modifier)
}

/** Three holders walk to podium marks; rosettes drop with their award name and the original prompt underneath. */
@Composable
private fun AwardsTrio(view: LikelyView, entries: List<LikelyAwardEntry>, clock: AwardsClock, stage: StageScope) {
    val type = JamaaTheme.type
    val slots = entries.size
    Row(Modifier.fillMaxSize().padding(horizontal = stage.dp(24f)), horizontalArrangement = Arrangement.SpaceEvenly) {
        // Seat order reads in the room's direction: in RTL the first holder stands on the right.
        val ordered = if (stage.rtl) entries.reversed() else entries
        ordered.forEach { e ->
            val i = entries.indexOf(e)
            val p = view.player(e.playerId) ?: return@forEach
            Column(
                Modifier.width(stage.dp(250f)).fillMaxHeight(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(Modifier.size(stage.dp(110f)), contentAlignment = Alignment.Center) {
                    Canvas(Modifier.fillMaxSize().clearAndSetSemantics {}) {
                        val r = clock.p("rosette", i)
                        if (e.kind == LikelyAwardKind.MYSTERY) {
                            puff(center, size.minDimension * 0.3f, r)
                            if (r >= 0.5f) rosette(center, size.minDimension * 0.3f, 0f, alpha = ((r - 0.5f) * 2f).coerceIn(0f, 1f))
                        } else {
                            rosette(Offset(center.x, center.y - 40f * (1f - r.coerceIn(0f, 1f))), size.minDimension * 0.3f, 180f * (1f - r), alpha = r.coerceIn(0f, 1f))
                        }
                    }
                }
                val title = when (e.kind) {
                    LikelyAwardKind.MYSTERY -> keyText("game.likely.awards.mystery.title")
                    else -> e.card?.award ?: ""
                }
                val line = when (e.kind) {
                    LikelyAwardKind.MYSTERY -> keyText("game.likely.awards.mystery.line")
                    else -> e.card?.let { keyText("game.likely.card.question", it.prompt) } ?: ""
                }
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .heightIn(min = stage.dp(96f))
                        .graphicsLayer { alpha = clock.p("name", i).coerceIn(0f, 1f) }
                        .drawWithContent {
                            drawContent()
                            glint(clock.p("glint", i))
                        },
                ) {
                    // The award name in full (never cut): it steps down a size, then wraps, before it could overflow.
                    FitText(title, listOf(type.headline, type.title, type.titleS), Gold, maxLines = 2)
                    Spacer(Modifier.height(stage.dp(4f)))
                    // The whole question in the locale's own punctuation (game.likely.card.question), never cut.
                    FitText(line, listOf(type.body, type.caption), JamaaColors.TextSecondary, maxLines = 4)
                }
                Spacer(Modifier.weight(1f))
                Box(
                    Modifier.graphicsLayer {
                        val w = clock.p("walk", i)
                        translationY = (1f - w.coerceIn(0f, 1.2f)) * 120f * density
                        alpha = w.coerceIn(0f, 1f) * (if (e.left) 0.5f else 1f)
                    },
                    contentAlignment = Alignment.BottomCenter,
                ) {
                    Canvas(Modifier.size(stage.dp(140f), stage.dp(22f)).clearAndSetSemantics {}) {
                        drawOval(Brush.radialGradient(listOf(Gold.copy(alpha = 0.55f), GoldLo.copy(alpha = 0f))), size = size)
                    }
                    Character(
                        p.color,
                        stage.dp(96f),
                        derived(clock, e, i) { if (e.left) Expression.AWAY else if (e.kind == LikelyAwardKind.MYSTERY) Expression.SHOCK else if (clock.p("rosette", i) >= 1f) Expression.SHY else Expression.IDLE },
                        modifier = Modifier.padding(bottom = stage.dp(8f)),
                    )
                }
                Text(shortName(p.name), style = type.title, color = if (e.left) JamaaColors.TextMuted else JamaaColors.Text, maxLines = 1)
                if (e.left) Text(keyText("game.likely.awards.left"), style = type.caption, color = JamaaColors.TextMuted, maxLines = 1)
                Row(horizontalArrangement = Arrangement.spacedBy(stage.dp(6f)), modifier = Modifier.height(stage.dp(30f)).padding(top = stage.dp(4f))) {
                    for (x in e.extras) Tag(extraTitle(x.kind), GoldHi)
                }
            }
        }
        if (slots == 0) Spacer(Modifier.weight(1f))
    }
}

@Composable
internal fun extraTitle(kind: LikelyAwardKind): String = when (kind) {
    LikelyAwardKind.STAR -> keyText("game.likely.awards.star.title")
    LikelyAwardKind.MYSTERY -> keyText("game.likely.awards.mystery.title")
    LikelyAwardKind.SIGNATURE -> ""
}

// ---------------------------------------------------------------- RESULTS (LK-TV-05)

/**
 * The awards wall (owner redesign 2026-11-12): every player's award in full (the title steps down a size and wraps,
 * never an ellipsis; only names ellipsize), the player under it, Tonight's Star as a chip. No ranking and no cup panel:
 * Most Likely has no points, so it never changes the night's cup (it would only repeat unchanged rows). Then the three
 * HUB-05 buttons (the only focusable controls of the game, with the top-bar ⓘ).
 */
@Composable
internal fun LikelyResults(view: LikelyView, args: GameScreenArgs) {
    val type = JamaaTheme.type
    val playAgain = remember { FocusRequester() }
    val entries = remember(view.awards) { LikelyStage.awardEntries(view) }
    val grid = LikelyStage.wallGrid(entries.size)
    Column(Modifier.fillMaxSize().focusFallback(playAgain)) {
        Row(Modifier.fillMaxWidth().height(48.dp), verticalAlignment = Alignment.CenterVertically) {
            GoldTitle(keyText("game.likely.results.title"), Modifier.weight(1f, fill = false), small = true)
            Spacer(Modifier.weight(1f))
            RoundIconButton(JamaaIcons.Info, androidx.compose.ui.res.stringResource(R.string.rules__open), args.onRules, size = 36.dp)
        }
        Spacer(Modifier.height(6.dp))
        Column(Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            entries.chunked(grid.cols).forEachIndexed { r, row ->
                Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    row.forEachIndexed { c, e -> AwardTile(view, e, grid, r * grid.cols + c, Modifier.weight(1f).fillMaxHeight()) }
                    repeat(grid.cols - row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
        args.passHook?.let { Text(it, style = type.caption, color = JamaaColors.TextMuted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 4.dp)) }
        Row(
            Modifier.fillMaxWidth().height(64.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            JamaaButton(
                androidx.compose.ui.res.stringResource(R.string.results__play_again),
                args.results.onReplay,
                Modifier.focusRequester(playAgain),
                kind = ButtonKind.Primary,
                icon = JamaaIcons.Refresh,
                minWidth = 220.dp,
            )
            JamaaButton(androidx.compose.ui.res.stringResource(R.string.results__change_settings), args.results.onChangeSettings, icon = JamaaIcons.Settings)
            JamaaButton(androidx.compose.ui.res.stringResource(R.string.cup__other_games), args.results.onOtherGames, icon = JamaaIcons.Users)
        }
    }
    InitialFocus(playAgain, key = "likely:results:${view.n}")
}

/** One award on the wall: the award title (gold, in full), the card's question when there is room, the player at the bottom. */
@Composable
private fun AwardTile(view: LikelyView, e: LikelyAwardEntry, grid: LikelyWallGrid, index: Int, modifier: Modifier) {
    val type = JamaaTheme.type
    val p = view.player(e.playerId) ?: return
    val reduce = JamaaTheme.reduceMotion
    // Tiles rise in one after the other (60 ms apart), once.
    val shown = remember { androidx.compose.animation.core.Animatable(if (reduce) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (!reduce) {
            kotlinx.coroutines.delay(60L * index)
            shown.animateTo(1f, androidx.compose.animation.core.tween(380, easing = androidx.compose.animation.core.FastOutSlowInEasing))
        }
    }
    val mystery = e.kind == LikelyAwardKind.MYSTERY
    val title = if (mystery) keyText("game.likely.awards.mystery.title") else e.card?.award.orEmpty()
    val big = grid.rows <= 2
    Column(
        modifier
            .graphicsLayer {
                alpha = shown.value
                translationY = (1f - shown.value) * 24f * density
            }
            .background(Rooftop.surface.copy(alpha = 0.88f), RoundedCornerShape(18.dp))
            .border(1.5.dp, Gold.copy(alpha = if (mystery) 0.35f else 0.75f), RoundedCornerShape(18.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Canvas(Modifier.size(if (big) 30.dp else 22.dp).clearAndSetSemantics {}) { rosette(center, size.minDimension * 0.36f, 0f, alpha = if (mystery) 0.45f else 1f) }
            Spacer(Modifier.width(6.dp))
            FitText(
                title,
                if (big) listOf(type.headline, type.title, type.titleS, type.label) else listOf(type.title, type.titleS, type.label, type.caption),
                Gold,
                maxLines = 2,
            )
        }
        if (grid.withPrompt) {
            val line = if (mystery) keyText("game.likely.awards.mystery.line") else e.card?.let { keyText("game.likely.card.question", it.prompt) }.orEmpty()
            Spacer(Modifier.height(2.dp))
            FitText(line, listOf(type.body, type.caption), JamaaColors.TextSecondary, maxLines = 3, modifier = Modifier.weight(1f, fill = false))
        }
        Spacer(Modifier.weight(1f))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Character(p.color, if (big) 52.dp else 40.dp, if (e.left) Expression.AWAY else if (mystery) Expression.SMUG else Expression.HAPPY)
            Spacer(Modifier.width(8.dp))
            Column {
                Text(shortName(p.name), style = if (big) type.title else type.titleS, color = if (e.left) JamaaColors.TextMuted else JamaaColors.Text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                for (x in e.extras) Tag(extraTitle(x.kind), GoldHi)
            }
        }
    }
}
