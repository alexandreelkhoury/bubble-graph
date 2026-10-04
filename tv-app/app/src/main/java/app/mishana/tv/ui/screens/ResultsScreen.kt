package app.mishana.tv.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.mishana.tv.ui.components.fullBleed
import app.mishana.tv.R
import androidx.compose.foundation.layout.heightIn
import app.mishana.tv.ui.components.MishFocus
import app.mishana.tv.ui.components.MishFocusSurface
import app.mishana.tv.ui.components.inertWhen
import app.mishana.tv.ui.theme.MishShapes
import app.mishana.tv.ui.theme.MishSpace
import app.mishana.tv.protocol.player
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import app.mishana.tv.game.Names
import app.mishana.tv.game.Ranking
import androidx.compose.ui.platform.LocalDensity
import app.mishana.tv.i18n.isolate
import app.mishana.tv.protocol.ClientIntent
import app.mishana.tv.protocol.GuessStatus
import app.mishana.tv.protocol.HistoryCause
import app.mishana.tv.protocol.PlayAgain
import app.mishana.tv.protocol.PublicPlayer
import app.mishana.tv.protocol.ResultView
import app.mishana.tv.protocol.Role
import app.mishana.tv.protocol.TvView
import app.mishana.tv.protocol.Winner
import app.mishana.tv.protocol.WordRef
import app.mishana.tv.ui.components.Avatar
import app.mishana.tv.ui.components.AvatarState
import app.mishana.tv.ui.components.ButtonKind
import app.mishana.tv.ui.components.FloatingEmblems
import app.mishana.tv.ui.components.InitialFocus
import app.mishana.tv.ui.components.LocalFocusBlocked
import app.mishana.tv.ui.components.MishButton
import app.mishana.tv.ui.components.MishDialog
import app.mishana.tv.ui.components.MishIcons
import app.mishana.tv.ui.components.RoleEmblem
import app.mishana.tv.ui.components.RoleEmblems
import app.mishana.tv.ui.components.focusFallback
import app.mishana.tv.ui.components.roleColor
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishMotion
import app.mishana.tv.ui.theme.MishTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** How long Play again / Change settings / New room ignore OK after the summary appears. */
private const val STAGE2_GUARD_MS = 800L

/**
 * TV-11 Results. Stage 1 (≈ 5 s, local): the victory moment and both words meeting in the middle. Stage 2: the
 * compact summary with the scoreboard, history and actions. OK during stage 1 jumps to stage 2.
 * Focus: Play again (PLAY_AGAIN); Up enters the score list (scroll only). Back → pause menu (AppRoot).
 */
@Composable
fun ResultsScreen(
    view: TvView,
    send: (ClientIntent) -> Unit,
    onChangeSettings: () -> Unit,
    onNewRoom: () -> Unit,
) {
    val result = view.result ?: return
    val type = MishTheme.type
    val reduce = MishTheme.reduceMotion
    val playAgain = remember { FocusRequester() }
    var confirmNewRoom by remember { mutableStateOf(false) }
    val key = "${view.gameNumber}"
    var stage by remember(key) { mutableIntStateOf(1) }
    // When stage 2 appeared: the press that skipped stage 1 (or a mashed second one) must not chain into PLAY_AGAIN
    // and send everyone back to the lobby before the scoreboard has been read.
    var stage2At by remember(key) { mutableLongStateOf(Long.MAX_VALUE) }
    fun toStage2() {
        if (stage == 1) {
            stage = 2
            stage2At = System.currentTimeMillis()
        }
    }
    fun ready() = System.currentTimeMillis() - stage2At >= STAGE2_GUARD_MS
    LaunchedEffect(key) {
        delay(if (reduce) 2_500 else 5_000)
        toStage2()
    }
    val players = Ranking.order(view.players)
    val winnerTitle = winnerText(view, result)

    CompositionLocalProvider(LocalFocusBlocked provides (LocalFocusBlocked.current || confirmNewRoom)) {
        Box(Modifier.fillMaxSize().inertWhen(confirmNewRoom).focusFallback(playAgain)) {
            VictoryBackdrop(result.winner, stage == 1)
            Column(Modifier.fillMaxSize()) {
                // Header: "Game over" · room code
                Row(Modifier.fillMaxWidth().height(40.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(stringResource(R.string.results__title), style = type.label, color = MishColors.TextSecondary)
                    Spacer(Modifier.weight(1f))
                    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                        Text(view.roomCode, style = type.label.copy(letterSpacing = type.code.letterSpacing), color = MishColors.Accent)
                    }
                }
                AnimatedContent(
                    targetState = stage,
                    transitionSpec = { fadeIn(tween(MishMotion.Slow, easing = MishMotion.Decel)) togetherWith fadeOut(tween(MishMotion.Base)) },
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    label = "resultsStage",
                ) { st ->
                    if (st == 1) {
                        VictoryMoment(winnerTitle, result)
                    } else {
                        Summary(view, result, players, winnerTitle)
                    }
                }
                Row(
                    Modifier.fillMaxWidth().height(58.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterHorizontally),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    MishButton(
                        stringResource(R.string.results__play_again),
                        {
                            if (stage == 1) toStage2() else if (ready()) send(PlayAgain)
                        },
                        Modifier.focusRequester(playAgain),
                        kind = ButtonKind.Primary,
                        icon = MishIcons.Refresh,
                        minWidth = 220.dp,
                    )
                    MishButton(stringResource(R.string.results__change_settings), {
                        if (stage == 1) toStage2() else if (ready()) onChangeSettings()
                    }, icon = MishIcons.Settings)
                    MishButton(stringResource(R.string.results__new_room), {
                        if (stage == 1) toStage2() else if (ready()) confirmNewRoom = true
                    }, icon = MishIcons.Plus)
                }
            }
        }
        InitialFocus(playAgain)
    }
    if (confirmNewRoom) {
        MishDialog(
            title = stringResource(R.string.results__new_room_confirm),
            body = null,
            safeLabel = stringResource(R.string.common__cancel),
            actionLabel = stringResource(R.string.results__new_room),
            onSafe = { confirmNewRoom = false },
            onAction = {
                confirmNewRoom = false
                onNewRoom()
            },
            actionKind = ButtonKind.Primary,
        )
    }
}

@Composable
private fun winnerText(view: TvView, result: ResultView): String = when (result.winner) {
    Winner.CIVILIANS -> stringResource(R.string.winner__civilians)
    Winner.INFILTRATORS -> stringResource(R.string.winner__infiltrators)
    Winner.BLANK -> stringResource(R.string.winner__blank, isolate(view.player(result.winnerIds.firstOrNull())?.name.orEmpty()))
}

/** Full-bleed wash + particles (DESIGN §6.2-E). Static wash in reduced motion. */
@Composable
private fun VictoryBackdrop(winner: Winner, active: Boolean) {
    val wash = remember { Animatable(0f) }
    LaunchedEffect(Unit) { wash.animateTo(1f, tween(900, easing = MishMotion.Decel)) }
    val strength = if (active) 1f else 0.35f
    Canvas(Modifier.fillMaxSize().fullBleed().clearAndSetSemantics {}) {
        val colors = when (winner) {
            Winner.CIVILIANS -> listOf(MishColors.Civilian.copy(alpha = 0.22f * strength * wash.value), Color.Transparent)
            Winner.INFILTRATORS -> listOf(MishColors.Undercover.copy(alpha = 0.22f * strength * wash.value), MishColors.Blank.copy(alpha = 0.06f * strength * wash.value), Color.Transparent)
            Winner.BLANK -> listOf(MishColors.Blank.copy(alpha = 0.16f * strength * wash.value), Color.Transparent)
        }
        drawRect(Brush.radialGradient(colors, center = Offset(size.width / 2f, size.height * 0.35f), radius = size.maxDimension * 0.7f))
    }
    if (active) {
        when (winner) {
            Winner.CIVILIANS -> FloatingEmblems(RoleEmblems.House, MishColors.Civilian)
            Winner.INFILTRATORS -> MaskPeek()
            Winner.BLANK -> Unit
        }
    }
}

/** Masks peek in from the screen edges and wink (a 200 ms scaleY to 0.1 and back). */
@Composable
private fun MaskPeek() {
    if (MishTheme.reduceMotion) return
    val inT = remember { Animatable(0f) }
    val wink = remember { Animatable(1f) }
    LaunchedEffect(Unit) {
        inT.animateTo(1f, tween(700, easing = MishMotion.Overshoot))
        delay(500)
        wink.animateTo(0.1f, tween(100))
        wink.animateTo(1f, tween(100))
    }
    Box(Modifier.fillMaxSize().fullBleed()) {
        for ((i, align) in listOf(Alignment.CenterStart, Alignment.CenterEnd).withIndex()) {
            val dir = if (i == 0) -1f else 1f
            Box(
                Modifier
                    .align(align)
                    .offset(y = if (i == 0) (-70).dp else 70.dp)
                    .graphicsLayer {
                        translationX = dir * (1f - inT.value) * 220f
                        rotationZ = dir * -14f
                        scaleY = wink.value
                    },
            ) {
                RoleEmblem(Role.UNDERCOVER, 150.dp, MishColors.Undercover.copy(alpha = 0.85f))
            }
        }
    }
}

/** Stage 1: winner banner, then the two words slide in from opposite sides and meet in the middle. */
@Composable
private fun VictoryMoment(title: String, result: ResultView) {
    val type = MishTheme.type
    val reduce = MishTheme.reduceMotion
    val words = remember { Animatable(if (reduce) 1f else 0f) }
    val titleIn = remember { Animatable(if (reduce) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (!reduce) {
            launch { titleIn.animateTo(1f, tween(MishMotion.Dramatic, easing = MishMotion.Overshoot)) }
            delay(1_400)
            words.animateTo(1f, tween(MishMotion.Dramatic, easing = MishMotion.Decel))
        }
    }
    val blankGuess = result.guesses.lastOrNull { it.status == GuessStatus.CORRECT }?.text
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        if (result.winner == Winner.BLANK) {
            BlankCardSpin(blankGuess)
            Spacer(Modifier.height(12.dp))
        }
        Text(
            title,
            style = type.displayL,
            color = MishColors.Text,
            textAlign = TextAlign.Center,
            maxLines = 2,
            modifier = Modifier
                .widthIn(max = 840.dp)
                .graphicsLayer { val s = 0.6f + 0.4f * titleIn.value; scaleX = s; scaleY = s; alpha = titleIn.value.coerceIn(0f, 1f) }
                .semantics { liveRegion = LiveRegionMode.Polite },
        )
        Spacer(Modifier.height(28.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(24.dp), verticalAlignment = Alignment.CenterVertically) {
            WordCard(stringResource(R.string.results__civilian_word), result.civilianWord, Role.CIVILIAN, Modifier.graphicsLayer {
                translationX = -(1f - words.value) * 500f
                alpha = words.value
            })
            WordCard(stringResource(R.string.results__undercover_word), result.undercoverWord, Role.UNDERCOVER, Modifier.graphicsLayer {
                translationX = (1f - words.value) * 500f
                alpha = words.value
            })
        }
    }
}

/** Blank wins: an empty card spins in, then fills with the guessed word (public in RESULTS). */
@Composable
private fun BlankCardSpin(text: String?) {
    val reduce = MishTheme.reduceMotion
    val spin = remember { Animatable(if (reduce) 1f else 0f) }
    LaunchedEffect(Unit) { if (!reduce) spin.animateTo(1f, tween(900, easing = MishMotion.Decel)) }
    Box(
        Modifier
            .size(240.dp, 96.dp)
            .graphicsLayer { rotationZ = (1f - spin.value) * 360f; scaleX = spin.value; scaleY = spin.value }
            .background(MishColors.Blank, MishShapes.tile),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.fillMaxSize().padding(8.dp)) {
            drawRoundRect(
                MishColors.Ink.copy(alpha = 0.35f),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(14.dp.toPx()),
                style = Stroke(3.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 8f))),
            )
        }
        if (text != null) {
            Text(text, style = MishTheme.type.headline, color = MishColors.Ink, modifier = Modifier.alpha(((spin.value - 0.6f) / 0.4f).coerceIn(0f, 1f)), maxLines = 1)
        }
    }
}

@Composable
private fun WordCard(label: String, word: WordRef, role: Role, modifier: Modifier = Modifier) {
    val type = MishTheme.type
    Column(
        modifier
            .widthIn(min = 260.dp, max = 400.dp)
            .shadow(24.dp, MishShapes.card)
            .background(MishColors.Surface, MishShapes.card)
            .border(BorderStroke(3.dp, roleColor(role)), MishShapes.card)
            .padding(horizontal = 28.dp, vertical = 18.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            RoleEmblem(role, 24.dp, roleColor(role))
            Spacer(Modifier.width(8.dp))
            Text(label, style = type.caption, color = roleColor(role))
        }
        Text(word.text, style = type.displayM, color = MishColors.Text, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
        if (word.translit != null) {
            Text(word.translit, style = type.body, color = MishColors.TextSecondary, maxLines = 1)
        }
    }
}

/**
 * Stage 2: headline, one 56 dp word strip, one caption line (pack + guesses), scoreboard, history timeline.
 * Budget (486 dp live area − 40 header − 58 buttons = 388 dp): the fixed content stays ≤ 200 dp so the scoreboard
 * always shows 4 × 40 dp rows (+ 3 gaps + the focus padding), in Arabic too. At a large font scale the column
 * header goes, so the 4 (taller) rows still fit (DESIGN TV-11, §11).
 */
@Composable
private fun Summary(view: TvView, result: ResultView, players: List<PublicPlayer>, title: String) {
    val type = MishTheme.type
    Column(Modifier.fillMaxSize()) {
        Text(title, style = type.headline, color = MishColors.Text, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.align(Alignment.CenterHorizontally))
        Spacer(Modifier.height(MishSpace.s1))
        Row(
            Modifier.fillMaxWidth().height(56.dp).background(MishColors.Surface, MishShapes.row).padding(horizontal = 20.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            WordInline(stringResource(R.string.results__civilian_word), result.civilianWord, Role.CIVILIAN, Modifier.weight(1f))
            Box(Modifier.width(2.dp).height(32.dp).background(MishColors.Outline))
            Spacer(Modifier.width(20.dp))
            WordInline(stringResource(R.string.results__undercover_word), result.undercoverWord, Role.UNDERCOVER, Modifier.weight(1f))
        }
        Spacer(Modifier.height(MishSpace.s1))
        CaptionLine(view, result)
        Scoreboard(players, result, Modifier.weight(1f), showHeader = LocalDensity.current.fontScale < LARGE_FONT_SCALE)
        HistoryTimeline(view)
    }
}

/** From this system font scale on, the scoreboard drops its column header to keep 4 rows visible. */
private const val LARGE_FONT_SCALE = 1.15f

/**
 * "Pack: … · Lina guessed: “…”" on one caption line (DESIGN TV-11). The guesses are the payoff: drawn in the
 * primary text colour and measured first, so when the line is too long it is the pack name that ellipsizes.
 */
@Composable
private fun CaptionLine(view: TvView, result: ResultView) {
    val type = MishTheme.type
    val guesses = result.guesses.mapNotNull { g ->
        val name = view.player(g.playerId)?.name ?: return@mapNotNull null
        val text = g.text ?: return@mapNotNull null
        stringResource(R.string.guess__guessed, isolate(name), isolate("“$text”"))
    }
    Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(
            stringResource(R.string.results__pack, localizedTitle(result.pack.title)),
            style = type.caption,
            color = MishColors.TextSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f, fill = false),
        )
        if (guesses.isNotEmpty()) {
            Text("   ·   ", style = type.caption, color = MishColors.TextMuted, maxLines = 1)
            Text(guesses.joinToString("   ·   "), style = type.caption, color = MishColors.Text, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun WordInline(label: String, word: WordRef, role: Role, modifier: Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        RoleEmblem(role, 22.dp, roleColor(role))
        Spacer(Modifier.width(8.dp))
        Text(label, style = MishTheme.type.caption, color = roleColor(role), maxLines = 1)
        Spacer(Modifier.width(12.dp))
        Text(word.text, style = MishTheme.type.title, color = MishColors.Text, maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (word.translit != null) {
            Spacer(Modifier.width(8.dp))
            Text("(${word.translit})", style = MishTheme.type.caption, color = MishColors.TextSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

/**
 * Scoreboard: 40 dp rows, focus-scroll (Up from the buttons enters it). Competition ranking (equal totals share a
 * rank, like the phone and the web TV), so every rank-1 row gets glow.accent + a trophy.
 */
@Composable
private fun Scoreboard(players: List<PublicPlayer>, result: ResultView, modifier: Modifier, showHeader: Boolean) {
    val type = MishTheme.type
    val first = remember { FocusRequester() }
    val ranks = remember(players) { Ranking.ranks(players) }
    Column(modifier.fillMaxWidth()) {
        if (showHeader) Row(Modifier.fillMaxWidth().padding(horizontal = MishFocus.ListPadH + MishSpace.s3), verticalAlignment = Alignment.CenterVertically) {
            HeaderCell(stringResource(R.string.results__col_rank), 40)
            Text(stringResource(R.string.results__col_player), style = type.caption, color = MishColors.TextMuted, modifier = Modifier.weight(1f))
            HeaderCell(stringResource(R.string.results__col_role), 170)
            HeaderCell(stringResource(R.string.results__col_game), 110)
            HeaderCell(stringResource(R.string.results__col_total), 90)
        }
        LazyColumn(
            Modifier.fillMaxWidth().weight(1f).focusRestorer(first),
            // Room for the focused row's scale + ring, which the list would otherwise clip.
            contentPadding = PaddingValues(horizontal = MishFocus.ListPadH, vertical = MishFocus.ListPadV),
            verticalArrangement = Arrangement.spacedBy(MishSpace.s1),
        ) {
            itemsIndexed(players, key = { _, p -> p.id }) { i, p ->
                ScoreRow(ranks[i], p, result.pointsAwarded[p.id] ?: 0, i, if (i == 0) Modifier.focusRequester(first) else Modifier)
            }
        }
    }
}

@Composable
private fun RowScope.HeaderCell(text: String, widthDp: Int) {
    Text(text, style = MishTheme.type.caption, color = MishColors.TextMuted, modifier = Modifier.width(widthDp.dp), textAlign = TextAlign.Center)
}

@Composable
private fun ScoreRow(rank: Int, p: PublicPlayer, earned: Int, index: Int, modifier: Modifier) {
    val type = MishTheme.type
    val reduce = MishTheme.reduceMotion
    val appear = remember { Animatable(if (reduce) 1f else 0f) }
    val counted = remember { Animatable(if (reduce) p.score.toFloat() else (p.score - earned).toFloat()) }
    LaunchedEffect(Unit) {
        if (!reduce) {
            delay(60L * index)
            appear.animateTo(1f, tween(MishMotion.Base, easing = MishMotion.Decel))
            counted.animateTo(p.score.toFloat(), tween(700, easing = LinearEasing))
        }
    }
    val shape = MishShapes.row
    // The one focus style (DESIGN §4.6/§7). OK does nothing: rows are focusable only so Up can scroll the scoreboard.
    MishFocusSurface(
        onClick = {},
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 40.dp)
            .graphicsLayer { alpha = appear.value; translationY = (1f - appear.value) * 24f }
            .then(if (rank == 1) Modifier.shadow(18.dp, shape, ambientColor = MishColors.Accent, spotColor = MishColors.Accent) else Modifier),
        shape = shape,
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 40.dp)
                .padding(horizontal = MishSpace.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.width(40.dp), contentAlignment = Alignment.Center) {
                if (rank == 1) {
                    Icon(MishIcons.Trophy, contentDescription = null, tint = MishColors.Accent, modifier = Modifier.size(24.dp))
                } else {
                    Text(rank.toString(), style = type.titleS, color = MishColors.TextSecondary)
                }
            }
            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                Avatar(p.color, 28.dp, state = AvatarState(away = !p.connected && !p.left, left = p.left))
                Spacer(Modifier.width(10.dp))
                Text(Names.ellipsize(p.name, 16), style = type.titleS, color = MishColors.Text, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Row(Modifier.width(170.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                val role = p.revealedRole
                if (role != null) {
                    RoleEmblem(role, 22.dp, roleColor(role))
                    Spacer(Modifier.width(6.dp))
                    Text(roleLabel(role), style = type.body, color = roleColor(role), maxLines = 1)
                }
            }
            Box(Modifier.width(110.dp), contentAlignment = Alignment.Center) {
                Text(
                    if (earned > 0) stringResource(R.string.results__points_earned, earned) else "0",
                    style = type.titleS,
                    color = if (earned > 0) MishColors.Accent else MishColors.TextMuted,
                )
            }
            Box(Modifier.width(90.dp), contentAlignment = Alignment.Center) {
                Text(counted.value.toInt().toString(), style = type.title, color = MishColors.Text)
            }
        }
    }
}

/** One-line history: round · avatar · role emblem · cause icon (vote / dice / user-x / door-out). */
@Composable
private fun HistoryTimeline(view: TvView) {
    if (view.history.isEmpty()) return
    Row(
        Modifier.fillMaxWidth().heightIn(min = 28.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(stringResource(R.string.history__title), style = MishTheme.type.caption, color = MishColors.TextMuted)
        for (h in view.history.take(8)) {
            Row(
                Modifier.background(MishColors.Surface, MishShapes.pill).padding(horizontal = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                    Text(h.round.toString(), style = MishTheme.type.caption, color = MishColors.TextSecondary)
                }
                val p = view.player(h.eliminatedId)
                if (p != null) Avatar(p.color, 22.dp)
                val role = h.role
                if (role != null) RoleEmblem(role, 18.dp, roleColor(role))
                val icon = when (h.cause) {
                    HistoryCause.VOTE -> MishIcons.Vote
                    HistoryCause.RANDOM -> MishIcons.Dice
                    HistoryCause.KICK -> MishIcons.UserX
                    HistoryCause.LEAVE -> MishIcons.DoorOut
                    HistoryCause.NONE -> MishIcons.X
                }
                Icon(icon, contentDescription = null, tint = MishColors.TextMuted, modifier = Modifier.size(18.dp))
            }
        }
    }
}
