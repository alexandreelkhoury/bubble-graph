package app.jamaa.tv.games.bluff.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.heightIn
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.sp
import app.jamaa.tv.games.bluff.BluffFit
import app.jamaa.tv.games.bluff.BluffPlayer
import app.jamaa.tv.ui.components.Avatar
import app.jamaa.tv.ui.components.AvatarState
import app.jamaa.tv.ui.theme.JamaaMotion
import app.jamaa.tv.ui.theme.JamaaShapes
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.game.Names
import app.jamaa.tv.games.GameScreenArgs
import app.jamaa.tv.games.bluff.AwardId
import app.jamaa.tv.games.bluff.BluffAward
import app.jamaa.tv.games.bluff.BluffInput
import app.jamaa.tv.games.bluff.BluffMoments
import app.jamaa.tv.games.bluff.BluffRanking
import app.jamaa.tv.games.bluff.BluffView
import app.jamaa.tv.i18n.isolate
import app.jamaa.tv.platform.Expression
import app.jamaa.tv.platform.RemoteKey
import app.jamaa.tv.ui.characters.Character
import app.jamaa.tv.ui.components.ButtonKind
import app.jamaa.tv.ui.components.Confetti
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.JamaaButton
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.platform.RoundIconButton
import app.jamaa.tv.ui.platform.remoteKey
import app.jamaa.tv.ui.platform.repeats
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme
import app.jamaa.tv.ui.theme.PlayerSwatch
import kotlin.math.roundToInt

// ---------------------------------------------------------------- SCORES (GAME-BLUFF §12.3, 6 s)

/**
 * The scoreboard race: rows slide in (30 ms stagger), bars in each player's colour grow from `scoreBefore` to `score`
 * with the number counting up beside them and the "+N" of the prompt in its own column (nothing can overlap: every cell
 * owns its width), then the rows re-sort (FLIP, the overtaker hops over), the new leader's crown hops on; "Comeback
 * time!" for a far last place and, before the final, "The final pays up to +400 for one answer!". Row height follows
 * the player count ([BluffFit.raceRowDp]), so 12 players fit.
 */
@Composable
internal fun ScoresRace(view: BluffView, clock: PhaseClock) {
    val type = JamaaTheme.type
    val reduce = JamaaTheme.reduceMotion
    val rows = remember(view) { BluffRanking.race(view) }
    val before = remember(view) { view.players.sortedWith(compareByDescending<BluffPlayer> { it.scoreBefore }.thenBy { it.seat }).map { it.id } }
    val top = (rows.maxOfOrNull { it.player.score } ?: 0).coerceAtLeast(1)
    val leader = remember(view) { BluffRanking.newLeader(view) }
    val comeback = remember(view) { BluffRanking.comeback(view) }
    val rowDp = BluffFit.raceRowDp(rows.size)
    val charDp = minOf(44f, rowDp - 4f)
    val textMax = minOf(26f, rowDp * 0.62f)
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    Column(Modifier.fillMaxSize().padding(horizontal = 24.dp)) {
        Row(Modifier.fillMaxWidth().height(BluffFit.SCORES_TITLE.dp).padding(end = (BluffFit.BACK_HINT_W - 24f).dp), verticalAlignment = Alignment.CenterVertically) {
            AutoText(stringResource(R.string.game__bluff__scores__title), type.headline, Paper, Modifier.weight(1f, fill = false), maxSp = 32f, minSp = 20f, maxLines = 1, textAlign = TextAlign.Start)
            if (view.voided) {
                Spacer(Modifier.width(16.dp))
                Text(stringResource(R.string.game__bluff__prompt__voided), style = type.body, color = JamaaColors.TextMuted, maxLines = 1)
            }
        }
        Box(Modifier.weight(1f).fillMaxWidth()) {
            for ((finalIndex, r) in rows.withIndex()) {
                val startIndex = before.indexOf(r.player.id)
                val p = r.player
                Row(
                    Modifier
                        .fillMaxWidth()
                        .height(rowDp.dp)
                        .graphicsLayer {
                            val q = clock.p("reorder")
                            val y = startIndex + (finalIndex - startIndex) * q
                            translationY = y * rowDp * density
                            // An overtaking character hops over the one it passes (−0.3 row height arc).
                            if (finalIndex < startIndex) translationY -= kotlin.math.sin(q * Math.PI).toFloat() * rowDp * 0.3f * density
                            // Rows slide in one by one as the phase opens.
                            val enter = if (clock.completed.value) 1f else ((clock.t() - 30L * startIndex) / 260f).coerceIn(0f, 1f)
                            if (!reduce) translationX = (1f - JamaaMotion.Decel.transform(enter)) * (if (rtl) 40f else -40f) * density
                            alpha = enter * if (p.left) 0.5f else 1f
                        },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(r.rank.toString(), Modifier.width(26.dp), style = type.label.copy(fontSize = minOf(20f, textMax).sp), color = JamaaColors.TextMuted, maxLines = 1)
                    Box(Modifier.size(charDp.dp)) {
                        Character(p.color, charDp.dp, if (leader?.id == p.id && clock.p("crown") >= 1f) Expression.CHEER else Expression.IDLE)
                        if (r.rank == 1 && p.score > 0) {
                            Canvas(Modifier.size(charDp.dp, (charDp / 2).dp).graphicsLayer {
                                val q = if (leader?.id == p.id) clock.p("crown") else 1f
                                translationY = (-0.45f - (1f - q) * 0.8f) * charDp * density
                                alpha = if (q > 0f) 1f else 0f
                            }.clearAndSetSemantics {}) {
                                val w = size.width * 0.5f
                                val x0 = (size.width - w) / 2f
                                val h = size.height
                                val path = Path().apply {
                                    moveTo(x0, h); lineTo(x0, h * 0.35f); lineTo(x0 + w * 0.25f, h * 0.65f); lineTo(x0 + w * 0.5f, h * 0.1f)
                                    lineTo(x0 + w * 0.75f, h * 0.65f); lineTo(x0 + w, h * 0.35f); lineTo(x0 + w, h); close()
                                }
                                drawPath(path, Gold)
                            }
                        }
                    }
                    Spacer(Modifier.width(10.dp))
                    Row(Modifier.width(176.dp), verticalAlignment = Alignment.CenterVertically) {
                        AutoText(p.name, type.title, Paper, Modifier.weight(1f, fill = false), maxSp = textMax, minSp = 13f, maxLines = 1, textAlign = TextAlign.Start)
                        if (p.isNew) {
                            Spacer(Modifier.width(6.dp))
                            Text(stringResource(R.string.game__bluff__scores__new), Modifier.background(Gold, JamaaShapes.xs).padding(horizontal = 6.dp), style = type.caption, color = Cafe.onAccent, maxLines = 1)
                        }
                    }
                    Spacer(Modifier.width(12.dp))
                    // The bar: a quiet track, the colour fill growing from the score before to the score after.
                    Box(Modifier.weight(1f).height((rowDp * 0.5f).dp).background(Cafe.surface, JamaaShapes.sm)) {
                        Box(
                            Modifier.fillMaxSize().graphicsLayer {
                                val q = clock.p("bars")
                                val v = p.scoreBefore + (p.score - p.scoreBefore) * q
                                scaleX = (v / top).coerceIn(0.015f, 1f)
                                transformOrigin = TransformOrigin(if (rtl) 1f else 0f, 0.5f)
                            }.background(PlayerSwatch.byId(p.color).color, JamaaShapes.sm),
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Box(Modifier.width(72.dp), contentAlignment = Alignment.CenterEnd) {
                        if (r.delta != 0) {
                            Text(
                                (if (r.delta > 0) "+" else "") + r.delta,
                                Modifier.graphicsLayer { val q = clock.p("bars"); alpha = minOf(1f, q * 3f); translationY = (1f - minOf(1f, q * 3f)) * 8f * density },
                                style = type.titleS.copy(fontSize = minOf(22f, textMax).sp), color = if (r.delta > 0) JamaaColors.Success else JamaaColors.TextMuted, maxLines = 1,
                            )
                        }
                    }
                    val shown by remember(view, p.id) { derivedStateOf { (p.scoreBefore + (p.score - p.scoreBefore) * clock.p("bars")).roundToInt() } }
                    Box(Modifier.width(84.dp), contentAlignment = Alignment.CenterEnd) {
                        Text(shown.toString(), style = type.title.copy(fontSize = textMax.sp), color = Gold, maxLines = 1)
                    }
                }
            }
        }
        Row(
            Modifier.fillMaxWidth().height(BluffFit.SCORES_TEASE.dp).graphicsLayer { val q = clock.p("tease"); alpha = q; translationY = (1f - q) * 10f * density },
            horizontalArrangement = Arrangement.spacedBy(24.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            val lines = buildList {
                if (leader != null) add(stringResource(R.string.game__bluff__scores__new_leader) + " " + isolate(leader.name) to Gold)
                if (comeback != null) add(isolate(comeback.name) + ": " + stringResource(R.string.game__bluff__scores__comeback) to JamaaColors.TextSecondary)
                if (BluffRanking.finalTease(view)) add(stringResource(R.string.game__bluff__scores__final_tease) to Cafe.accentText)
            }
            for ((text, color) in lines) AutoText(text, type.title, color, Modifier.weight(1f, fill = false), maxSp = 24f, minSp = 14f, maxLines = 1)
        }
    }
}

// ---------------------------------------------------------------- AWARDS (GAME-BLUFF §6.6, §12.5)

/**
 * Award cards drop in one by one like trophies on a velvet stand; the winner runs in and lifts it. The newest card is
 * big in the middle (it takes the height there is, its texts auto-size); earlier ones line up underneath with the
 * winners' full names.
 */
@Composable
internal fun AwardsStage(view: BluffView, clock: PhaseClock) {
    val type = JamaaTheme.type
    val shown by remember(view) { derivedStateOf { view.awards.indices.count { clock.t() >= BluffMoments.awardAtMs(it) || clock.completed.value } } }
    // The title starts under the platform back hint (y 88 dp), which shares the top of this stage at the end side.
    Column(Modifier.fillMaxSize().padding(start = 16.dp, end = 16.dp, top = (BluffFit.BACK_HINT_BOTTOM - BluffFit.HEADER).dp, bottom = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        AutoText(
            stringResource(R.string.game__bluff__awards__title), type.displayS, Paper,
            Modifier.fillMaxWidth().height(58.dp).graphicsLayer { val p = clock.p("title"); alpha = p; scaleX = 1.15f - 0.15f * p; scaleY = scaleX },
            minSp = 24f, maxLines = 1,
        )
        Box(Modifier.weight(1f).fillMaxWidth().padding(vertical = 6.dp), contentAlignment = Alignment.Center) {
            if (shown > 0) BigAward(view, view.awards[shown - 1], shown - 1, clock)
        }
        if (shown > 1) {
            Row(Modifier.fillMaxWidth().height(96.dp), horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally)) {
                for (i in 0 until shown - 1) {
                    val a = view.awards[i]
                    Column(
                        Modifier
                            .weight(1f, fill = false)
                            .widthIn(max = 270.dp)
                            .fillMaxHeight()
                            .graphicsLayer {
                                // Each card settles here as the next one drops in above it.
                                val q = if (clock.completed.value) 1f else ((clock.t() - BluffMoments.awardAtMs(i + 1)) / 320f).coerceIn(0f, 1f)
                                alpha = q
                                translationY = (1f - JamaaMotion.Decel.transform(q)) * -40f * density
                            }
                            .background(Cafe.elevated, JamaaShapes.tile)
                            .border(2.dp, Gold.copy(alpha = 0.7f), JamaaShapes.tile)
                            .padding(horizontal = 14.dp, vertical = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        AutoText(awardTitle(a.id), type.label, Gold, Modifier.fillMaxWidth(), minSp = 13f, maxLines = 1)
                        AutoText(a.playerIds.mapNotNull { view.player(it)?.name }.joinToString(", ") { isolate(it) }, type.body, Paper, Modifier.fillMaxWidth().weight(1f, fill = false), maxSp = 20f, minSp = 12f, maxLines = 2)
                    }
                }
            }
        }
    }
}

@Composable
private fun BigAward(view: BluffView, a: BluffAward, index: Int, clock: PhaseClock) {
    val type = JamaaTheme.type
    val winners = a.playerIds.mapNotNull { view.player(it) }
    val charDp = when {
        winners.size <= 3 -> 64
        winners.size <= 6 -> 52
        else -> 40
    }
    Column(
        Modifier
            .widthIn(max = 680.dp)
            .fillMaxWidth()
            .graphicsLayer {
                val p = clock.p("card", index)
                alpha = minOf(1f, p * 2f)
                translationY = (1f - p) * -80f * density
            }
            .background(Brush.verticalGradient(listOf(Cafe.elevated, Cafe.surface)), JamaaShapes.card)
            .border(2.dp, Gold, JamaaShapes.card)
            .padding(horizontal = 28.dp, vertical = 14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        AutoText(awardTitle(a.id), type.headline, Gold, Modifier.fillMaxWidth(), minSp = 20f, maxLines = 1)
        if (a.id == AwardId.BLUFF_OF_THE_NIGHT && a.text != null) {
            Spacer(Modifier.height(6.dp))
            OptionCard(a.text, Modifier.fillMaxWidth().weight(1f, fill = false).heightIn(max = 72.dp), maxSp = 24f)
        }
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), modifier = Modifier.fillMaxWidth()) {
            for ((j, w) in winners.withIndex()) {
                Column(
                    Modifier.weight(1f, fill = false).width((charDp + 56).dp).graphicsLayer {
                        val p = clock.p("winner", index)
                        translationX = (1f - p) * (if (j % 2 == 0) -240f else 240f) * density
                        alpha = minOf(1f, p * 3f)
                    },
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Character(w.color, charDp.dp, Expression.CHEER)
                    // Full names (2 lines, auto-sized): an award is about who won it.
                    AutoText(w.name, type.titleS, Paper, Modifier.fillMaxWidth(), maxSp = 20f, minSp = 12f, maxLines = 2)
                }
            }
        }
        Spacer(Modifier.height(4.dp))
        // "fooled ×N" counts up (the value ticks from 0 over the count step).
        val count by remember(a, index) { derivedStateOf { (a.value * clock.p("count", index)).roundToInt() } }
        AutoText(pluralStringResource(awardBody(a.id), a.value, count), type.title, JamaaColors.TextSecondary, Modifier.fillMaxWidth(), maxSp = 24f, minSp = 15f, maxLines = 2)
    }
}

@Composable
private fun awardTitle(id: AwardId): String = stringResource(
    when (id) {
        AwardId.BLUFF_OF_THE_NIGHT -> R.string.game__bluff__awards__bluff_of_the_night
        AwardId.LIE_DETECTOR -> R.string.game__bluff__awards__lie_detector
        AwardId.CROWD_FAVOURITE -> R.string.game__bluff__awards__crowd_favourite
        AwardId.HOOK_LINE_SINKER -> R.string.game__bluff__awards__hook_line_sinker
    },
)

private fun awardBody(id: AwardId): Int = when (id) {
    AwardId.BLUFF_OF_THE_NIGHT -> R.plurals.game__bluff__awards__bluff_of_the_night__body
    AwardId.LIE_DETECTOR -> R.plurals.game__bluff__awards__lie_detector__body
    AwardId.CROWD_FAVOURITE -> R.plurals.game__bluff__awards__crowd_favourite__body
    AwardId.HOOK_LINE_SINKER -> R.plurals.game__bluff__awards__hook_line_sinker__body
}

// ---------------------------------------------------------------- RESULTS (HUB-05)

/**
 * Three zones over the full safe area: the podium (characters jump onto steps 3, 2, 1 in that order, confetti on 1;
 * ties share a step), the full scoreboard (row height from the player count, so 12 fit), and the cup panel; the three
 * HUB-05 buttons under them. OK first completes the podium; the buttons accept OK only after the moment ended +
 * INPUT_GUARD_MS and never on a key repeat (OK mashed through the final reveal never presses Play again).
 */
@Composable
internal fun BluffResults(view: BluffView, clock: PhaseClock, args: GameScreenArgs) {
    val type = JamaaTheme.type
    val playAgain = remember { FocusRequester() }
    var interactiveAt by remember(view.n) { mutableStateOf<Long?>(null) }
    LaunchedEffect(clock) {
        snapshotFlow { !clock.running() }.collect { done -> if (done && interactiveAt == null) interactiveAt = System.currentTimeMillis() }
    }
    val podium = remember(view) { BluffRanking.podium(view) }
    val board = remember(view) { BluffRanking.race(view) }
    Column(
        Modifier
            .fillMaxSize()
            .onPreviewKeyEvent { e ->
                if (e.remoteKey() != RemoteKey.OK) return@onPreviewKeyEvent false
                if (e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent !BluffInput.resultsAccepts(System.currentTimeMillis(), interactiveAt, 0)
                if (clock.running()) {
                    clock.complete()
                    return@onPreviewKeyEvent true
                }
                !BluffInput.resultsAccepts(System.currentTimeMillis(), interactiveAt, e.repeats)
            },
    ) {
        Row(Modifier.fillMaxWidth().height(BluffFit.RESULTS_TITLE.dp), verticalAlignment = Alignment.CenterVertically) {
            NeonTitle(type.title)
            Spacer(Modifier.weight(1f))
            RoundIconButton(JamaaIcons.Info, stringResource(R.string.rules__open), args.onRules, size = 36.dp)
        }
        Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
            // Podium: 2 · 1 · 3 (steps), visually centred on 1.
            BoxWithConstraints(Modifier.weight(1.15f).fillMaxHeight()) {
                val stepW = minOf(120.dp, (maxWidth - 16.dp) / 3)
                Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.Bottom) {
                    for (place in listOf(2, 1, 3)) {
                        val entry = podium.firstOrNull { it.first == place } ?: continue
                        val order = 3 - place // steps 3, 2, 1 in that order
                        val ps = entry.second.take(4)
                        val big = if (place == 1) 80.dp else 64.dp
                        val charDp = minOf(big, (stepW + 10.dp * (ps.size - 1)) / ps.size)
                        Column(
                            Modifier.width(stepW).graphicsLayer {
                                val p = clock.p("podium", order)
                                translationY = (1f - p) * -200f * density
                                alpha = if (p > 0f) 1f else 0f
                            },
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Row(horizontalArrangement = Arrangement.spacedBy((-10).dp)) {
                                for (p in ps) Character(p.color, charDp, Expression.CHEER)
                            }
                            AutoText(entry.second.joinToString(", ") { isolate(it.name) }, type.label, Paper, Modifier.fillMaxWidth(), maxSp = 20f, minSp = 12f, maxLines = 2)
                            Spacer(Modifier.height(4.dp))
                            Box(
                                Modifier.fillMaxWidth().height(when (place) { 1 -> 110.dp; 2 -> 80.dp; else -> 56.dp })
                                    .background(
                                        if (place == 1) Brush.verticalGradient(listOf(GoldLight, Gold)) else Brush.verticalGradient(listOf(Cafe.elevated, Cafe.surface)),
                                        RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp),
                                    ),
                                contentAlignment = Alignment.Center,
                            ) { Text(place.toString(), style = type.displayS, color = if (place == 1) Cafe.onAccent else Paper) }
                        }
                    }
                }
            }
            val rowDp = BluffFit.boardRowDp(board.size)
            val textMax = minOf(22f, rowDp * 0.62f)
            Column(
                Modifier.weight(1f).fillMaxHeight().graphicsLayer { val q = clock.p("board"); alpha = q; translationY = (1f - q) * 16f * density },
                verticalArrangement = Arrangement.Center,
            ) {
                for (r in board) {
                    Row(Modifier.fillMaxWidth().height(rowDp.dp).graphicsLayer { alpha = if (r.player.left) 0.5f else 1f }, verticalAlignment = Alignment.CenterVertically) {
                        Text("${r.rank}", Modifier.width(26.dp), style = type.label.copy(fontSize = minOf(20f, textMax).sp), color = JamaaColors.TextMuted, maxLines = 1)
                        Avatar(r.player.color, minOf(22f, rowDp - 8f).dp, state = AvatarState(left = r.player.left))
                        Spacer(Modifier.width(8.dp))
                        AutoText(r.player.name, type.body, Paper, Modifier.weight(1f), maxSp = textMax, minSp = 13f, maxLines = 1, textAlign = TextAlign.Start)
                        Spacer(Modifier.width(8.dp))
                        Text(r.player.score.toString(), style = type.title.copy(fontSize = textMax.sp), color = Gold, maxLines = 1)
                    }
                }
            }
            Column(
                Modifier.widthIn(max = 250.dp).fillMaxHeight().graphicsLayer { val q = clock.p("board"); alpha = q },
                verticalArrangement = Arrangement.Center,
            ) {
                args.cupPanel()
                args.passHook?.let {
                    Spacer(Modifier.height(6.dp))
                    AutoText(it, type.caption, JamaaColors.TextMuted, Modifier.fillMaxWidth(), minSp = 12f, maxLines = 3)
                }
            }
        }
        Row(
            Modifier.fillMaxWidth().height(BluffFit.RESULTS_BUTTONS.dp).graphicsLayer { val q = clock.p("buttons"); alpha = q; translationY = (1f - q) * 12f * density },
            horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            val ready = { BluffInput.resultsAccepts(System.currentTimeMillis(), interactiveAt, 0) }
            JamaaButton(stringResource(R.string.results__play_again), { if (ready()) args.results.onReplay() }, Modifier.focusRequester(playAgain), kind = ButtonKind.Primary, icon = JamaaIcons.Refresh, minWidth = 220.dp)
            JamaaButton(stringResource(R.string.results__change_settings), { if (ready()) args.results.onChangeSettings() }, icon = JamaaIcons.Settings)
            JamaaButton(stringResource(R.string.cup__other_games), { if (ready()) args.results.onOtherGames() }, icon = JamaaIcons.Users)
        }
    }
    val confetti by remember(clock) { derivedStateOf { clock.p("confetti") > 0f && clock.p("confetti") < 1f } }
    if (confetti) Confetti(Modifier.fillMaxSize(), durationMs = 1_600, seed = view.n)
    InitialFocus(playAgain)
}
