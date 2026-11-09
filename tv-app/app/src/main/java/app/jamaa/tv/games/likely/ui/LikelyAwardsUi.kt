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

// LK-TV-04 awards ceremony (GAME-LIKELY §12.4) on the server's AWARDS clock, and LK-TV-05 results (§8.2 RESULTS).

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
        is LikelyAwardsPage.MindReader -> LikelyChoreo.mindReader
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
                is LikelyAwardsPage.MindReader -> MindReaderPodium(view, page, clock, this@LikelyStageBox)
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
internal fun GoldTitle(text: String, modifier: Modifier = Modifier) {
    val style = JamaaTheme.type.displayM.copy(brush = Brush.verticalGradient(listOf(GoldHi, Gold, GoldLo)))
    Text(text, style = style, textAlign = TextAlign.Center, modifier = modifier)
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
                    else -> e.card?.let { keyText("game.likely.card.header") + " " + it.prompt } ?: ""
                }
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .height(stage.dp(96f))
                        .graphicsLayer { alpha = clock.p("name", i).coerceIn(0f, 1f) }
                        .drawWithContent {
                            drawContent()
                            glint(clock.p("glint", i))
                        },
                ) {
                    Text(title, style = type.title, color = Gold, textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Spacer(Modifier.height(stage.dp(4f)))
                    Text(line, style = type.caption, color = JamaaColors.TextSecondary, textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Ellipsis)
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
    LikelyAwardKind.SELF_AWARE -> keyText("game.likely.awards.selfAware.title")
    LikelyAwardKind.MIND_READER -> keyText("game.likely.awards.mindReader.title")
    LikelyAwardKind.MYSTERY -> keyText("game.likely.awards.mystery.title")
    LikelyAwardKind.SIGNATURE -> ""
}

/** Public mode only: the podium (steps 3-2-1) and the glowing crystal ball for the best mind reader. */
@Composable
private fun MindReaderPodium(view: LikelyView, page: LikelyAwardsPage.MindReader, clock: AwardsClock, stage: StageScope) {
    val type = JamaaTheme.type
    val winners = page.award.playerIds.toSet()
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        GoldTitle(keyText("game.likely.awards.mindReader.title"), Modifier.padding(top = stage.dp(12f)))
        Text(keyText("game.likely.awards.mindReader.line"), style = type.body, color = JamaaColors.TextSecondary, textAlign = TextAlign.Center)
        Spacer(Modifier.weight(1f))
        // Podium order on screen: 2nd, 1st, 3rd (mirrored in RTL by the row itself).
        val rows = page.podium
        val display = listOfNotNull(rows.getOrNull(1), rows.getOrNull(0), rows.getOrNull(2)).let { if (stage.rtl) it.reversed() else it }
        Row(horizontalArrangement = Arrangement.spacedBy(stage.dp(12f)), verticalAlignment = Alignment.Bottom) {
            display.forEachIndexed { slot, row ->
                val p = view.player(row.playerId) ?: return@forEachIndexed
                val stepH = when (row.rank) { 1 -> 110f; 2 -> 76f; else -> 50f }
                val idx = rows.indexOf(row)
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.graphicsLayer {
                        val q = clock.p("podium", idx)
                        translationY = (1f - q.coerceIn(0f, 1.2f)) * 80f * density
                        alpha = q.coerceIn(0f, 1f)
                    },
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        if (row.playerId in winners) {
                            Canvas(Modifier.size(stage.dp(120f)).clearAndSetSemantics {}) {
                                val c = clock.p("crystal")
                                drawCircle(Brush.radialGradient(listOf(Rooftop.glow.copy(alpha = 0.55f * c), Rooftop.glow.copy(alpha = 0f))), size.minDimension / 2f)
                                drawCircle(Rooftop.glow.copy(alpha = 0.9f * c), size.minDimension * 0.12f, Offset(size.width * 0.82f, size.height * 0.55f))
                                drawCircle(JamaaColors.Text.copy(alpha = 0.8f * c), size.minDimension * 0.04f, Offset(size.width * 0.79f, size.height * 0.51f))
                            }
                        }
                        Character(p.color, stage.dp(96f), if (row.playerId in winners) Expression.CHEER else Expression.HAPPY)
                    }
                    Text(shortName(p.name), style = type.title, color = JamaaColors.Text, maxLines = 1)
                    Box(
                        Modifier
                            .size(stage.dp(150f), stage.dp(stepH))
                            .background(Brush.verticalGradient(listOf(Rooftop.elevated, Rooftop.surface)), RoundedCornerShape(topStart = stage.dp(10f), topEnd = stage.dp(10f)))
                            .border(stage.dp(2f), Gold.copy(alpha = 0.7f), RoundedCornerShape(topStart = stage.dp(10f), topEnd = stage.dp(10f))),
                        contentAlignment = Alignment.TopCenter,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(row.rank.toString(), style = type.headline, color = Gold)
                            // The score rolls up as the step rises (counter, ease.decel).
                            val shown = derived(clock, row, idx) { (row.score * clock.p("podium", idx).coerceIn(0f, 1f)).roundToInt() }
                            Text(shown.toString(), style = type.label, color = JamaaColors.TextSecondary)
                        }
                    }
                }
                if (slot < display.size - 1) Spacer(Modifier.width(stage.dp(4f)))
            }
        }
    }
}

// ---------------------------------------------------------------- RESULTS (LK-TV-05)

/**
 * Public: the Mind Reader ranking + the awards wall; secret votes: the awards wall only. Then the platform cup panel
 * and the three HUB-05 buttons (the only focusable controls of the game, with the top-bar ⓘ).
 */
@Composable
internal fun LikelyResults(view: LikelyView, args: GameScreenArgs) {
    val type = JamaaTheme.type
    val playAgain = remember { FocusRequester() }
    val entries = remember(view.awards) { LikelyStage.awardEntries(view) }
    val ranking = remember(view.players, view.showVoters) { LikelyStage.ranking(view) }
    Column(Modifier.fillMaxSize().focusFallback(playAgain)) {
        Row(Modifier.fillMaxWidth().height(44.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(keyText("game.likely.results.title"), style = type.headline, color = Gold)
            Spacer(Modifier.weight(1f))
            RoundIconButton(JamaaIcons.Info, androidx.compose.ui.res.stringResource(R.string.rules__open), args.onRules, size = 36.dp)
        }
        Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
            if (ranking.isNotEmpty()) {
                Column(Modifier.width(260.dp).fillMaxHeight().background(Rooftop.surface.copy(alpha = 0.85f), RoundedCornerShape(20.dp)).padding(12.dp)) {
                    Text(keyText("game.likely.results.mindReader"), style = type.label, color = Rooftop.accentText)
                    Spacer(Modifier.height(6.dp))
                    for (r in ranking.take(8)) {
                        val p = view.player(r.playerId) ?: continue
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.height(30.dp)) {
                            Text(r.rank.toString(), style = type.label, color = if (r.rank == 1) Gold else JamaaColors.TextSecondary, modifier = Modifier.width(22.dp))
                            Character(p.color, 28.dp, if (r.rank == 1) Expression.CHEER else Expression.IDLE)
                            Spacer(Modifier.width(8.dp))
                            Text(shortName(p.name), style = type.label, color = if (p.left) JamaaColors.TextMuted else JamaaColors.Text, maxLines = 1, modifier = Modifier.weight(1f))
                            Text(r.score.toString(), style = type.label, color = JamaaColors.Text)
                        }
                    }
                }
            }
            Column(Modifier.weight(1f).fillMaxHeight()) {
                Text(keyText("game.likely.results.awardsWall"), style = type.label, color = Rooftop.accentText)
                Spacer(Modifier.height(6.dp))
                val cols = if (entries.size > 9) 4 else 3
                for (row in entries.chunked(cols)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(bottom = 8.dp)) {
                        for (e in row) AwardTile(view, e, Modifier.weight(1f))
                        repeat(cols - row.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
        args.cupPanel()
        args.passHook?.let { Text(it, style = type.caption, color = JamaaColors.TextMuted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
        Row(
            Modifier.fillMaxWidth().height(58.dp),
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

@Composable
private fun AwardTile(view: LikelyView, e: LikelyAwardEntry, modifier: Modifier) {
    val type = JamaaTheme.type
    val p = view.player(e.playerId) ?: return
    Row(
        modifier
            .height(64.dp)
            .background(Rooftop.surface.copy(alpha = 0.85f), RoundedCornerShape(16.dp))
            .border(1.5.dp, Gold.copy(alpha = if (e.kind == LikelyAwardKind.MYSTERY) 0.3f else 0.7f), RoundedCornerShape(16.dp))
            .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(contentAlignment = Alignment.BottomEnd) {
            Character(p.color, 44.dp, if (e.left) Expression.AWAY else Expression.HAPPY)
            Canvas(Modifier.size(18.dp).clearAndSetSemantics {}) { rosette(center, size.minDimension * 0.4f, 0f, alpha = if (e.kind == LikelyAwardKind.MYSTERY) 0.4f else 1f) }
        }
        Spacer(Modifier.width(8.dp))
        Column(Modifier.weight(1f)) {
            Text(shortName(p.name), style = type.label, color = if (e.left) JamaaColors.TextMuted else JamaaColors.Text, maxLines = 1)
            val title = if (e.kind == LikelyAwardKind.MYSTERY) keyText("game.likely.awards.mystery.title") else e.card?.award.orEmpty()
            Text(title, style = type.caption, color = Gold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (e.extras.isNotEmpty()) {
                Text(e.extras.map { extraTitle(it.kind) }.joinToString(" · "), style = type.caption, color = GoldHi, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

