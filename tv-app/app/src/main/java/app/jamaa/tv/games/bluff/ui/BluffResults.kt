package app.jamaa.tv.games.bluff.ui

import androidx.compose.foundation.Canvas
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
 * The scoreboard race: bars in each player's colour grow from `scoreBefore` to `score` with an odometer number, then
 * the rows re-sort (FLIP, the overtaker hops over), the new leader's crown hops on; "Comeback time!" for a far last
 * place and, before the final, "The final pays up to +400 for one answer!".
 */
@Composable
internal fun ScoresRace(view: BluffView, clock: PhaseClock) {
    val type = JamaaTheme.type
    val rows = remember(view) { BluffRanking.race(view) }
    val before = remember(view) { view.players.sortedWith(compareByDescending<app.jamaa.tv.games.bluff.BluffPlayer> { it.scoreBefore }.thenBy { it.seat }).map { it.id } }
    val top = (rows.maxOfOrNull { it.player.score } ?: 0).coerceAtLeast(1)
    val leader = remember(view) { BluffRanking.newLeader(view) }
    val comeback = remember(view) { BluffRanking.comeback(view) }
    val rowDp = if (rows.size > 8) 34 else 44
    Column(Modifier.fillMaxSize().padding(horizontal = 48.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.game__bluff__scores__title), style = type.headline, color = Paper)
            if (view.voided) {
                Spacer(Modifier.width(16.dp))
                Text(stringResource(R.string.game__bluff__prompt__voided), style = type.body, color = JamaaColors.TextMuted)
            }
        }
        Spacer(Modifier.height(8.dp))
        val rtl = androidx.compose.ui.platform.LocalLayoutDirection.current == androidx.compose.ui.unit.LayoutDirection.Rtl
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            val barMax = maxWidth - 300.dp
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
                            // An overtaking character hops over the one it passes (−0.3 body height arc).
                            if (finalIndex < startIndex) translationY -= kotlin.math.sin(q * Math.PI).toFloat() * rowDp * 0.3f * density
                            alpha = if (p.left) 0.5f else 1f
                        },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(rowDp.dp)) {
                        Character(p.color, rowDp.dp, if (leader?.id == p.id && clock.p("crown") >= 1f) Expression.CHEER else Expression.IDLE)
                        if (r.rank == 1 && p.score > 0) {
                            Canvas(Modifier.size(rowDp.dp, (rowDp / 2).dp).graphicsLayer {
                                val q = if (leader?.id == p.id) clock.p("crown") else 1f
                                translationY = (-0.45f - (1f - q) * 0.8f) * rowDp * density
                                alpha = if (q > 0f) 1f else 0f
                            }.clearAndSetSemantics {}) {
                                val w = size.width * 0.5f
                                val x0 = (size.width - w) / 2f
                                val h = size.height
                                val path = androidx.compose.ui.graphics.Path().apply {
                                    moveTo(x0, h); lineTo(x0, h * 0.35f); lineTo(x0 + w * 0.25f, h * 0.65f); lineTo(x0 + w * 0.5f, h * 0.1f)
                                    lineTo(x0 + w * 0.75f, h * 0.65f); lineTo(x0 + w, h * 0.35f); lineTo(x0 + w, h); close()
                                }
                                drawPath(path, Gold)
                            }
                        }
                    }
                    Spacer(Modifier.width(10.dp))
                    Text(Names.ellipsize(p.name, 12), Modifier.width(130.dp), style = type.title, color = Paper, maxLines = 1)
                    if (p.isNew) Text(stringResource(R.string.game__bluff__scores__new), Modifier.background(Gold, RoundedCornerShape(6.dp)).padding(horizontal = 6.dp), style = type.caption, color = Cafe.onAccent)
                    Box(Modifier.width(barMax).height((rowDp - 14).dp)) {
                        Box(
                            Modifier.fillMaxHeight().fillMaxWidth().graphicsLayer {
                                val q = clock.p("bars")
                                val v = p.scoreBefore + (p.score - p.scoreBefore) * q
                                scaleX = (v / top).coerceIn(0.02f, 1f)
                                transformOrigin = androidx.compose.ui.graphics.TransformOrigin(if (rtl) 1f else 0f, 0.5f)
                            }.background(PlayerSwatch.byId(p.color).color, RoundedCornerShape(8.dp)),
                        )
                    }
                    Spacer(Modifier.width(10.dp))
                    val shown by remember(view, p.id) { derivedStateOf { (p.scoreBefore + (p.score - p.scoreBefore) * clock.p("bars")).roundToInt() } }
                    Text(shown.toString(), Modifier.width(80.dp), style = type.title, color = Gold, textAlign = TextAlign.End, maxLines = 1)
                    if (r.delta > 0) Text(" +${r.delta}", style = type.caption, color = JamaaColors.Success, maxLines = 1)
                }
            }
        }
        Row(Modifier.fillMaxWidth().height(40.dp).graphicsLayer { alpha = clock.p("tease") }, horizontalArrangement = Arrangement.spacedBy(24.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
            if (leader != null) Text(stringResource(R.string.game__bluff__scores__new_leader) + " " + isolate(leader.name), style = type.title, color = Gold)
            if (comeback != null) Text(isolate(comeback.name) + ": " + stringResource(R.string.game__bluff__scores__comeback), style = type.body, color = JamaaColors.TextSecondary)
            if (BluffRanking.finalTease(view)) Text(stringResource(R.string.game__bluff__scores__final_tease), style = type.body, color = Cafe.accentText)
        }
    }
}

// ---------------------------------------------------------------- AWARDS (GAME-BLUFF §6.6, §12.5)

/** Award cards drop in one by one like trophies on a velvet stand; the winner runs in and lifts it. */
@Composable
internal fun AwardsStage(view: BluffView, clock: PhaseClock) {
    val type = JamaaTheme.type
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            stringResource(R.string.game__bluff__awards__title),
            Modifier.graphicsLayer { val p = clock.p("title"); alpha = p; scaleX = 1.2f - 0.2f * p; scaleY = scaleX },
            style = type.displayS, color = Paper,
        )
        Spacer(Modifier.height(16.dp))
        // The newest card is big in the middle; the earlier ones line up small underneath.
        val shown by remember(view) { derivedStateOf { view.awards.indices.count { clock.t() >= BluffMoments.awardAtMs(it) } } }
        Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
            if (shown > 0) AwardCard(view, view.awards[shown - 1], shown - 1, clock, big = true)
        }
        Row(Modifier.height(120.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            for (i in 0 until (shown - 1).coerceAtLeast(0)) AwardCard(view, view.awards[i], i, clock, big = false)
        }
    }
}

@Composable
private fun AwardCard(view: BluffView, a: BluffAward, index: Int, clock: PhaseClock, big: Boolean) {
    val type = JamaaTheme.type
    val winners = a.playerIds.mapNotNull { view.player(it) }
    Column(
        Modifier
            .widthIn(max = if (big) 620.dp else 200.dp)
            .graphicsLayer {
                if (big) {
                    val p = clock.p("card", index)
                    alpha = minOf(1f, p * 2f)
                    translationY = (1f - p) * -80f * density
                }
            }
            .background(Cafe.elevated, RoundedCornerShape(20.dp))
            .border(2.dp, Gold, RoundedCornerShape(20.dp))
            .padding(horizontal = if (big) 32.dp else 12.dp, vertical = if (big) 20.dp else 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(awardTitle(a.id), style = if (big) type.headline else type.label, color = Gold, textAlign = TextAlign.Center, maxLines = 2)
        if (big) {
            if (a.id == AwardId.BLUFF_OF_THE_NIGHT && a.text != null) {
                Spacer(Modifier.height(8.dp))
                OptionCard(a.text, Modifier.widthIn(max = 520.dp))
            }
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                for ((j, w) in winners.withIndex()) {
                    Column(
                        Modifier.graphicsLayer {
                            val p = clock.p("winner", index)
                            translationX = (1f - p) * (if (j % 2 == 0) -240f else 240f) * density
                            alpha = minOf(1f, p * 3f)
                        },
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Character(w.color, 72.dp, Expression.CHEER)
                        Text(Names.ellipsize(w.name, 10), style = type.caption, color = Paper, maxLines = 1)
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
            // "fooled ×N" counts up (the value ticks from 0 over the count step).
            val count by remember(a, index) { derivedStateOf { (a.value * clock.p("count", index)).roundToInt() } }
            Text(pluralStringResource(awardBody(a.id), a.value, count), style = type.title, color = JamaaColors.TextSecondary, textAlign = TextAlign.Center)
        } else {
            Text(winners.joinToString(", ") { isolate(it.name) }, style = type.caption, color = Paper, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
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
 * The podium (characters jump onto steps 3, 2, 1 in that order, confetti on 1; ties share a step), the full scoreboard,
 * the cup panel and the three HUB-05 buttons. OK first completes the podium; the buttons accept OK only after the
 * moment ended + INPUT_GUARD_MS and never on a key repeat (OK mashed through the final reveal never presses Play again).
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
        Row(Modifier.fillMaxWidth().height(44.dp), verticalAlignment = Alignment.CenterVertically) {
            NeonTitle(type.title)
            Spacer(Modifier.weight(1f))
            RoundIconButton(JamaaIcons.Info, stringResource(R.string.rules__open), args.onRules, size = 36.dp)
        }
        Row(Modifier.weight(1f).fillMaxWidth()) {
            // Podium: 2 · 1 · 3 (steps), visually centred on 1.
            Row(Modifier.weight(1.2f).fillMaxHeight(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.Bottom) {
                for (place in listOf(2, 1, 3)) {
                    val entry = podium.firstOrNull { it.first == place } ?: continue
                    val order = 3 - place // steps 3, 2, 1 in that order
                    Column(
                        Modifier.graphicsLayer {
                            val p = clock.p("podium", order)
                            translationY = (1f - p) * -200f * density
                            alpha = if (p > 0f) 1f else 0f
                        },
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy((-12).dp)) {
                            for (p in entry.second.take(4)) Character(p.color, if (place == 1) 88.dp else 72.dp, Expression.CHEER)
                        }
                        Text(entry.second.joinToString(", ") { isolate(Names.ellipsize(it.name, 10)) }, style = type.label, color = Paper, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Box(
                            Modifier.width(140.dp).height(when (place) { 1 -> 120.dp; 2 -> 86.dp; else -> 60.dp })
                                .background(if (place == 1) Gold else Cafe.elevated, RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp)),
                            contentAlignment = Alignment.Center,
                        ) { Text(place.toString(), style = type.displayS, color = if (place == 1) Cafe.onAccent else Paper) }
                    }
                }
            }
            Column(
                Modifier.weight(1f).fillMaxHeight().padding(start = 24.dp).graphicsLayer { alpha = clock.p("board") },
                verticalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterVertically),
            ) {
                for (r in board) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.graphicsLayer { alpha = if (r.player.left) 0.5f else 1f }) {
                        Text("${r.rank}", Modifier.width(28.dp), style = type.label, color = JamaaColors.TextMuted)
                        Box(Modifier.size(12.dp).background(PlayerSwatch.byId(r.player.color).color, RoundedCornerShape(50)))
                        Spacer(Modifier.width(8.dp))
                        Text(Names.ellipsize(r.player.name, 14), Modifier.weight(1f), style = type.body, color = Paper, maxLines = 1)
                        Text(r.player.score.toString(), style = type.title, color = Gold)
                    }
                }
                args.cupPanel()
                args.passHook?.let { Text(it, style = type.caption, color = JamaaColors.TextMuted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
            }
        }
        Row(
            Modifier.fillMaxWidth().height(58.dp).graphicsLayer { alpha = clock.p("buttons") },
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
