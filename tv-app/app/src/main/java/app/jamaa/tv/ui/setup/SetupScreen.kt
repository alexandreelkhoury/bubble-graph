package app.jamaa.tv.ui.setup

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import app.jamaa.tv.platform.Expression
import app.jamaa.tv.ui.theme.JamaaMotion
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
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
import androidx.compose.foundation.BorderStroke
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.game.Names
import app.jamaa.tv.games.TvGameMeta
import app.jamaa.tv.platform.CharacterRules
import app.jamaa.tv.platform.IntroFlow
import app.jamaa.tv.platform.RemoteKey
import app.jamaa.tv.platform.SetupFocus
import app.jamaa.tv.platform.SetupFocusGraph
import app.jamaa.tv.platform.SetupFocusRule
import app.jamaa.tv.platform.SetupRow
import app.jamaa.tv.platform.SetupTarget
import app.jamaa.tv.ui.theme.worldOf
import app.jamaa.tv.platform.steps
import app.jamaa.tv.protocol.RoomPublic
import app.jamaa.tv.protocol.RoomSetup
import app.jamaa.tv.protocol.StartBlocker
import app.jamaa.tv.protocol.blocker
import app.jamaa.tv.settings.PlatformPrefs
import app.jamaa.tv.ui.characters.Character
import app.jamaa.tv.ui.components.AvatarState
import app.jamaa.tv.ui.components.ButtonKind
import app.jamaa.tv.ui.components.FocusKind
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.JamaaButton
import app.jamaa.tv.ui.components.JamaaFocusSurface
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.components.QrCode
import app.jamaa.tv.ui.components.RoomCode
import app.jamaa.tv.ui.components.tryFocus
import app.jamaa.tv.ui.hub.gameTitle
import app.jamaa.tv.ui.hub.languageName
import app.jamaa.tv.ui.platform.RoundIconButton
import app.jamaa.tv.ui.platform.keyText
import app.jamaa.tv.ui.platform.remoteKey
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaShapes
import app.jamaa.tv.ui.theme.JamaaTheme
import app.jamaa.tv.ui.theme.WorldStage

/** What the setup screen asks for; everything else (focus, the intro) is local. */
class SetupActions(
    val onStep: (key: String, delta: Int) -> Unit,
    val onStart: () -> Unit,
    val onRules: () -> Unit,
    val onContentLanguage: () -> Unit,
    val onPacks: (SetupRow.Packs) -> Unit,
    val onAdvanced: () -> Unit,
    /** A premium row without the Pass: OK opens the Pass store (null when billing is off). */
    val onLockedSetting: (() -> Unit)?,
    /** The full-screen intro opened / closed: INFO stays off over it, and closing it arms the §3.10 E guard. */
    val onIntroOpen: (Boolean) -> Unit = {},
)

/**
 * HUB-03 (JAMAA-PLATFORM §3.2, DESIGN-JAMAA §2.3) on the full world stage: the title strip ("‹ Games" hint, title, ⓘ),
 * the How to play pane, the players pane (never focusable) and the settings column (Content, ≤ 4 rows, Advanced,
 * Start). The first visit on this TV opens the full-screen intro (§2.5). Initial focus: Start only if the intro was
 * seen before and `canStart`, else the how-to pane / first row (§3.10 E rule 4). Back (AppRoot) → CLOSE_GAME.
 */
@Composable
fun SetupScreen(
    room: RoomPublic,
    setup: RoomSetup,
    meta: TvGameMeta,
    column: List<SetupRow>,
    prefs: PlatformPrefs,
    actions: SetupActions,
) {
    val world = worldOf(meta.world)
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    // Read once per opening: decides the intro and the initial focus (the intro sets the flag as it goes).
    val seenBefore = remember(meta.id) { prefs.introSeen(meta.id) }
    val intro = remember(meta.id) { IntroFlow(meta.id, meta.howToKeys.size, prefs).also { if (!seenBefore) it.start() } }
    var introOpen by remember(meta.id) { mutableStateOf(intro.open) }
    var introIndex by remember(meta.id) { mutableIntStateOf(0) }
    LaunchedEffect(introOpen) { if (introOpen) actions.onIntroOpen(true) }
    DisposableEffect(meta.id) { onDispose { actions.onIntroOpen(false) } }

    val infoFocus = remember { FocusRequester() }
    val howToFocus = remember { FocusRequester() }
    val rowFocus = remember(column.size) { List(column.size) { FocusRequester() } }
    var target by remember { mutableStateOf<SetupTarget>(SetupTarget.HowTo) }
    var lastColumn by remember { mutableStateOf<Int?>(null) }
    val firstRow = column.indexOfFirst { it !is SetupRow.Content }.takeIf { it >= 0 } ?: 0
    val startIndex = column.indexOfFirst { it is SetupRow.Start }

    fun requester(t: SetupTarget): FocusRequester? = when (t) {
        SetupTarget.Info -> infoFocus
        SetupTarget.HowTo -> howToFocus
        is SetupTarget.Column -> rowFocus.getOrNull(t.index)
    }

    Box(Modifier.fillMaxSize()) {
        WorldStage(world, tint = 1f)
        Column(
            Modifier.fillMaxSize().onPreviewKeyEvent { e ->
                if (introOpen || e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                val k = e.remoteKey()
                if (k != RemoteKey.UP && k != RemoteKey.DOWN && k != RemoteKey.LEFT && k != RemoteKey.RIGHT) return@onPreviewKeyEvent false
                val t = target
                // A stepping row keeps Left/Right for its value (forward = +1, mirrored in RTL).
                if (t is SetupTarget.Column && (k == RemoteKey.LEFT || k == RemoteKey.RIGHT)) {
                    val row = column.getOrNull(t.index)
                    if (row is SetupRow.Step && row.steps) {
                        val forward = if (rtl) RemoteKey.LEFT else RemoteKey.RIGHT
                        actions.onStep(row.key, if (k == forward) 1 else -1)
                        return@onPreviewKeyEvent true
                    }
                }
                val next = SetupFocusGraph.move(t, k, rtl, column.size, { i -> column.getOrNull(i)?.steps == true }, lastColumn, firstRow)
                if (next != null) requester(next)?.tryFocus()
                true
            },
        ) {
            // ---- title strip (y 27–91)
            Row(Modifier.fillMaxWidth().height(56.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("‹ " + stringResource(R.string.hub__title), style = JamaaTheme.type.caption, color = JamaaColors.TextMuted)
                Spacer(Modifier.weight(1f))
                Text(gameTitle(meta.id), style = JamaaTheme.type.headline, color = world.accentText, maxLines = 1)
                Spacer(Modifier.weight(1f))
                RoundIconButton(
                    JamaaIcons.Info, stringResource(R.string.rules__open), actions.onRules,
                    Modifier.focusRequester(infoFocus).onFocusChanged { if (it.isFocused) target = SetupTarget.Info },
                )
            }
            Spacer(Modifier.height(8.dp))
            Row(Modifier.fillMaxWidth().weight(1f), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                HowToPane(
                    meta, introIndex,
                    Modifier.width(324.dp).fillMaxHeight().focusRequester(howToFocus).onFocusChanged { if (it.isFocused) target = SetupTarget.HowTo },
                    onReplay = {
                        intro.start()
                        introIndex = 0
                        introOpen = true
                    },
                )
                PlayersPane(room, meta, Modifier.width(216.dp).fillMaxHeight())
                SettingsColumn(
                    column, room, setup, rowFocus,
                    onFocused = { i ->
                        target = SetupTarget.Column(i)
                        lastColumn = i
                    },
                    actions = actions,
                    modifier = Modifier.weight(1f).fillMaxHeight(),
                    minPlayers = meta.minPlayers,
                )
            }
        }
        if (introOpen) {
            IntroOverlay(
                meta = meta,
                flow = intro,
                room = room,
                onIndex = { introIndex = it },
                onClose = {
                    // Closing (OK on the last card, "Got it", or Back = skip) hands the remote back behind the guard,
                    // so a double OK on "Got it" never replays the intro from the how-to pane.
                    actions.onIntroOpen(false)
                    introOpen = false
                    howToFocus.tryFocus()
                },
            )
        }
    }
    if (!introOpen) {
        val initial = when (SetupFocusRule.initial(seenBefore, setup.canStart)) {
            SetupFocus.START -> rowFocus.getOrNull(startIndex) ?: howToFocus
            SetupFocus.HOW_TO -> howToFocus
            SetupFocus.FIRST_ROW -> rowFocus.getOrNull(firstRow) ?: howToFocus
        }
        InitialFocus(initial, key = meta.id)
    }
}

/** The collapsed How to play pane: the current card (auto-advances every 6 s), dots; OK replays the full intro. */
@Composable
private fun HowToPane(meta: TvGameMeta, index: Int, modifier: Modifier, onReplay: () -> Unit) {
    var shown by remember(meta.id) { mutableIntStateOf(index) }
    LaunchedEffect(meta.id) {
        while (true) {
            kotlinx.coroutines.delay(IntroFlow.AUTO_ADVANCE_MS)
            if (meta.howToKeys.isNotEmpty()) shown = (shown + 1) % meta.howToKeys.size
        }
    }
    JamaaFocusSurface(onClick = onReplay, modifier = modifier, shape = JamaaShapes.tile, kind = FocusKind.Tile) {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Text(stringResource(R.string.howto__title), style = JamaaTheme.type.titleS, color = JamaaColors.TextSecondary)
            Spacer(Modifier.height(12.dp))
            HowToScene(meta.id, shown, Modifier.fillMaxWidth().height(150.dp))
            Spacer(Modifier.height(12.dp))
            meta.howToKeys.getOrNull(shown)?.let { Text(keyText(it), style = JamaaTheme.type.body, color = JamaaColors.Text, maxLines = 4) }
            Spacer(Modifier.weight(1f))
            Dots(meta.howToKeys.size, shown)
        }
    }
}

/** The prop each how-to card acts with (web HowTo.tsx `Prop`): dealt word cards, a speech bubble, the vote mark, the trophy. */
private enum class HowToProp { CARDS, BUBBLE, VOTE, TROPHY }

/** One actor in one beat: expression, look (-1 start, +1 end, 0 ahead; logical), hop. */
private data class Act(val e: Expression, val look: Int = 0, val hop: Boolean = false)

/**
 * Per card (step 1 → 4: receive, talk, vote, finale): a ≤ 3 s loop of three 1 s beats acted with the character rig and
 * one prop — the same table as web `components/HowTo.tsx` SCENES (cast coral, azure, jade). Card 1: the outer two get
 * the SAME word card and smile at each other; the middle one gets a different card and wonders.
 */
private val SCENES: List<Pair<HowToProp, List<List<Act>>>> = listOf(
    HowToProp.CARDS to listOf(
        listOf(Act(Expression.IDLE), Act(Expression.IDLE), Act(Expression.IDLE)),
        listOf(Act(Expression.HAPPY, 1), Act(Expression.THINK), Act(Expression.HAPPY, -1)),
        listOf(Act(Expression.SMUG, 1, true), Act(Expression.SHY, -1), Act(Expression.SMUG, -1, true)),
    ),
    HowToProp.BUBBLE to listOf(
        listOf(Act(Expression.POINT, 1, true), Act(Expression.THINK, -1), Act(Expression.THINK, -1)),
        listOf(Act(Expression.IDLE, 1), Act(Expression.LAUGH, 1, true), Act(Expression.THINK, -1)),
        listOf(Act(Expression.THINK, 1), Act(Expression.THINK, 1), Act(Expression.POINT, -1, true)),
    ),
    HowToProp.VOTE to listOf(
        listOf(Act(Expression.THINK, 1), Act(Expression.IDLE), Act(Expression.THINK, -1)),
        listOf(Act(Expression.POINT, 1), Act(Expression.SHOCK, 0, true), Act(Expression.POINT, -1)),
        listOf(Act(Expression.SMUG, 1, true), Act(Expression.FACEPALM), Act(Expression.SMUG, -1, true)),
    ),
    HowToProp.TROPHY to listOf(
        listOf(Act(Expression.SHOCK), Act(Expression.SHOCK), Act(Expression.SHOCK)),
        listOf(Act(Expression.HAPPY, 1), Act(Expression.CHEER, 0, true), Act(Expression.HAPPY, -1)),
        listOf(Act(Expression.CHEER, 0, true), Act(Expression.CHEER, 0, true), Act(Expression.CHEER, 0, true)),
    ),
)
private val HOWTO_CAST = listOf("coral", "azure", "jade")
private const val HOWTO_BEAT_MS = 1_000L

/**
 * A how-to scene acted by characters (DESIGN-JAMAA §2.5: the character system, no extra assets): three 1 s beats that
 * loop (calm motion: the last beat, still). [gameId] is part of the key so a game switch restarts the loop; the scenes
 * are the platform's shared four steps, as on web (no per-game scene data exists yet).
 */
@Composable
fun HowToScene(gameId: String, card: Int, modifier: Modifier, size: Dp = 72.dp) {
    val (prop, beats) = SCENES[Math.floorMod(card, SCENES.size)]
    val reduce = JamaaTheme.reduceMotion
    var beat by remember(gameId, card) { mutableIntStateOf(if (reduce) beats.size - 1 else 0) }
    LaunchedEffect(gameId, card, reduce) {
        if (reduce) {
            beat = beats.size - 1
            return@LaunchedEffect
        }
        beat = 0
        while (true) {
            kotlinx.coroutines.delay(HOWTO_BEAT_MS)
            beat = (beat + 1) % beats.size
        }
    }
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    Row(modifier, horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.Bottom) {
        beats[beat].forEachIndexed { i, act ->
            val hop = remember(gameId, card, i) { androidx.compose.animation.core.Animatable(0f) }
            LaunchedEffect(beat, act.hop) {
                if (act.hop && !reduce) {
                    hop.animateTo(-0.18f, androidx.compose.animation.core.tween(210))
                    hop.animateTo(0f, androidx.compose.animation.core.tween(210))
                }
            }
            val actorSize = if (i == 1) size * 1.2f else size
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.height(size * 0.42f).width(actorSize), contentAlignment = Alignment.BottomCenter) {
                    HowToPropView(prop, i, beat, size * 0.42f)
                }
                Character(
                    HOWTO_CAST[i],
                    actorSize,
                    act.e,
                    modifier = Modifier.graphicsLayer { translationY = hop.value * actorSize.toPx() },
                    look = Offset(if (rtl) -act.look.toFloat() else act.look.toFloat(), 0f),
                )
            }
        }
    }
}

/** The prop over actor [i] at beat [b] (web `propFor`); nothing when the prop is not for this actor / beat. */
@Composable
private fun HowToPropView(prop: HowToProp, i: Int, b: Int, h: Dp) {
    when (prop) {
        HowToProp.CARDS -> Canvas(Modifier.height(h).width(h * 1.5f)) {
            // A word card: the outer two the same word (two lines), the middle one a different card ("?").
            val u = size.width / 24f
            val stroke = Stroke(1.6f * u, cap = StrokeCap.Round, join = StrokeJoin.Round)
            drawRoundRect(if (i == 1) Color(0xFFC9BFFF) else Color(0xFFFFE7A0), Offset(1f * u, 1f * u), Size(22f * u, 14f * u), CornerRadius(3f * u))
            drawRoundRect(JamaaColors.Bg, Offset(1f * u, 1f * u), Size(22f * u, 14f * u), CornerRadius(3f * u), style = stroke)
            val d = if (i == 1) "M9 6c0-2 6-2 6 0s-3 2-3 4M12 12.5v.1" else "M6 7h12M6 10.5h8"
            withTransform({ scale(u, u, pivot = Offset.Zero) }) { drawPath(propPath(d), JamaaColors.Bg, style = Stroke(1.6f, cap = StrokeCap.Round, join = StrokeJoin.Round)) }
        }
        HowToProp.BUBBLE -> if (i == b) Canvas(Modifier.height(h).width(h * 24f / 18f)) {
            val u = size.width / 24f
            withTransform({ scale(u, u, pivot = Offset.Zero) }) {
                val bubble = propPath("M3 2h18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3v-3H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z")
                drawPath(bubble, Color(0xFFFFF7EC))
                drawPath(bubble, JamaaColors.Bg, style = Stroke(1.6f, join = StrokeJoin.Round))
                drawPath(propPath("M6 7h12M6 10h7"), JamaaColors.Bg, style = Stroke(1.6f, cap = StrokeCap.Round))
            }
        }
        HowToProp.VOTE -> if (i == 1 && b >= 1) Box(Modifier.size(h).background(Color(0xFFFF6B5E), JamaaShapes.pill).padding(h * 0.15f)) {
            androidx.tv.material3.Icon(JamaaIcons.X, contentDescription = null, tint = Color(0xFFFFF7EC), modifier = Modifier.fillMaxSize())
        }
        HowToProp.TROPHY -> if (i == 1 && b >= 1) {
            androidx.tv.material3.Icon(JamaaIcons.Trophy, contentDescription = null, tint = Color(0xFFFFC94D), modifier = Modifier.size(h))
        }
    }
}

private val propPaths = HashMap<String, androidx.compose.ui.graphics.Path>()
private fun propPath(d: String) = propPaths.getOrPut(d) { androidx.compose.ui.graphics.vector.PathParser().parsePathString(d).toPath() }

@Composable
private fun Dots(n: Int, active: Int) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        repeat(n) { i ->
            Box(Modifier.size(if (i == active) 10.dp else 8.dp).background(if (i == active) JamaaColors.Accent else JamaaColors.Outline, JamaaShapes.pill))
        }
    }
}

/** The members on a small stage (64 dp, 3 per row), a ghost per missing player, the QR (200 dp while short). */
@Composable
private fun PlayersPane(room: RoomPublic, meta: TvGameMeta, modifier: Modifier) {
    val members = room.members.filter { !it.left }.sortedBy { it.seat }
    val missing = (meta.minPlayers - members.size).coerceAtLeast(0)
    Column(modifier.background(JamaaColors.Surface.copy(alpha = 0.6f), JamaaShapes.tile).padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(stringResource(R.string.setup__gang), style = JamaaTheme.type.titleS, color = JamaaColors.TextSecondary)
        Spacer(Modifier.height(6.dp))
        val slots = members.map { it as Any } + List(missing) { Unit }
        for (rowItems in slots.chunked(3).take(if (missing > 0) 2 else 4)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                for (s in rowItems) {
                    if (s is app.jamaa.tv.protocol.MemberPublic) {
                        Column(Modifier.width(64.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Character(s.color, 52.dp, CharacterRules.expression(s, null, null), state = AvatarState(host = s.isHost))
                            Text(Names.ellipsize(s.name, 6), style = JamaaTheme.type.caption, color = JamaaColors.TextSecondary, maxLines = 1)
                        }
                    } else {
                        Box(Modifier.size(52.dp).border(BorderStroke(2.dp, JamaaColors.Outline), JamaaShapes.pill))
                    }
                }
            }
        }
        Spacer(Modifier.weight(1f))
        if (missing > 0) {
            Text(pluralStringResource(R.plurals.setup__need_more, missing, missing), style = JamaaTheme.type.label, color = JamaaColors.Danger)
            QrCode(room.joinUrl, panel = 150.dp)
        } else {
            QrCode(room.joinUrl, panel = 120.dp)
        }
        RoomCode(room.roomCode, Modifier.fillMaxWidth().height(32.dp), centered = true)
    }
}

/** Content, the rows, Advanced and Start (one vertical column; Down from Start → nothing). */
@Composable
private fun SettingsColumn(
    column: List<SetupRow>,
    room: RoomPublic,
    setup: RoomSetup,
    focus: List<FocusRequester>,
    onFocused: (Int) -> Unit,
    actions: SetupActions,
    modifier: Modifier,
    minPlayers: Int = 3,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        column.forEachIndexed { i, row ->
            val m = Modifier.fillMaxWidth().focusRequester(focus[i]).onFocusChanged { if (it.isFocused) onFocused(i) }
            when (row) {
                is SetupRow.Content -> RowSurface(stringResource(R.string.setup__content, languageName(row.locale)) + " ▾", null, m.height(40.dp), actions.onContentLanguage)
                is SetupRow.Step -> {
                    val value = row.valueKey?.let { keyText(it) } ?: row.valueText.orEmpty()
                    val label = keyText(row.labelKey) + if (row.premium) "  ◆" else ""
                    RowSurface(
                        label = if (row.inline) "   $label" else label,
                        value = if (row.locked) "$value · " + stringResource(R.string.hub__pass_chip) else "‹ $value ›",
                        modifier = m.height(if (row.inline) 44.dp else 52.dp),
                        onClick = { if (row.locked) actions.onLockedSetting?.invoke() },
                        dim = row.locked,
                    )
                }
                is SetupRow.Packs -> RowSurface(
                    keyText(row.labelKey),
                    pluralStringResource(R.plurals.setup__pack_count, row.selected, row.selected) + " ›",
                    m.height(52.dp),
                    { actions.onPacks(row) },
                )
                SetupRow.Advanced -> RowSurface(stringResource(R.string.setup__advanced) + " ›", null, m.height(44.dp), actions.onAdvanced)
                is SetupRow.Start -> {
                    Spacer(Modifier.weight(1f))
                    blockerText(setup, minPlayers)?.let {
                        Text(it, style = JamaaTheme.type.label, color = JamaaColors.Danger, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                    }
                    JamaaButton(
                        stringResource(R.string.setup__start),
                        { if (row.canStart) actions.onStart() },
                        m.height(56.dp),
                        kind = ButtonKind.Primary,
                        icon = JamaaIcons.Play,
                        dimmed = !row.canStart,
                        focusKind = FocusKind.Row,
                    )
                }
            }
        }
    }
}

@Composable
private fun RowSurface(label: String, value: String?, modifier: Modifier, onClick: () -> Unit, dim: Boolean = false) {
    JamaaFocusSurface(onClick = onClick, modifier = modifier, kind = FocusKind.Row) {
        Row(Modifier.fillMaxSize().padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(label, style = JamaaTheme.type.titleS, maxLines = 1, modifier = Modifier.weight(1f))
            if (value != null) Text(value, style = JamaaTheme.type.titleS, color = if (dim) JamaaColors.TextMuted else JamaaColors.Accent, maxLines = 1)
        }
    }
}

/** One line above Start ("Need 3 players", "No content in this language"). */
@Composable
private fun blockerText(setup: RoomSetup, minPlayers: Int): String? = when (setup.blocker) {
    null -> null
    StartBlocker.NOT_ENOUGH_PLAYERS -> pluralStringResource(R.plurals.setup__blocker_players, minPlayers, minPlayers)
    StartBlocker.NO_CONTENT_AVAILABLE, StartBlocker.NO_WORDS_AVAILABLE -> stringResource(R.string.setup__blocker_content)
    else -> keyText(app.jamaa.tv.game.GameViewModel.errorMessageKey(setup.startBlocker ?: "INTERNAL"))
}

/**
 * The full-screen first-time intro (DESIGN-JAMAA §2.5): a large scene, "1/4", one sentence, a segmented progress bar;
 * OK = next, Back = skip, the last card shows "Got it" and never auto-dismisses; any D-pad pauses auto-advance. While
 * the room is short of players a corner join chip and the members row keep gathering possible.
 */
@Composable
private fun IntroOverlay(meta: TvGameMeta, flow: IntroFlow, room: RoomPublic, onIndex: (Int) -> Unit, onClose: () -> Unit) {
    var index by remember { mutableIntStateOf(flow.index) }
    val gotIt = remember { FocusRequester() }
    LaunchedEffect(flow) {
        var last = withFrameMillis { it }
        while (flow.open) {
            val t = withFrameMillis { it }
            if (flow.tick(t - last)) {
                index = flow.index
                onIndex(index)
            }
            last = t
        }
    }
    androidx.activity.compose.BackHandler {
        flow.onBack()
        onClose()
    }
    Box(
        Modifier.fillMaxSize().background(JamaaColors.Bg.copy(alpha = 0.96f)).onPreviewKeyEvent { e ->
            if (e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
            when (e.remoteKey()) {
                RemoteKey.OK -> {
                    flow.onOk()
                    index = flow.index
                    onIndex(index)
                    if (!flow.open) onClose()
                    true
                }
                RemoteKey.UP, RemoteKey.DOWN, RemoteKey.LEFT, RemoteKey.RIGHT -> {
                    flow.onDpad()
                    true
                }
                else -> false
            }
        },
    ) {
        Column(Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(stringResource(R.string.setup__intro_progress, (index + 1).toString(), flow.cardCount.toString()), style = JamaaTheme.type.label, color = JamaaColors.Accent)
            // The next card slides 48 dp in from the reading end (mirrored in RTL) with a fade, 240 ms.
            val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
            val reduce = JamaaTheme.reduceMotion
            val slide = with(androidx.compose.ui.platform.LocalDensity.current) { 48.dp.roundToPx() }
            AnimatedContent(
                targetState = index,
                transitionSpec = {
                    if (reduce) {
                        fadeIn(tween(150)) togetherWith fadeOut(tween(150))
                    } else {
                        val dir = if (targetState >= initialState) 1 else -1
                        val sign = if (rtl) -dir else dir
                        (slideInHorizontally(tween(240, easing = JamaaMotion.Decel)) { sign * slide } + fadeIn(tween(240))) togetherWith
                            (slideOutHorizontally(tween(240, easing = JamaaMotion.Standard)) { -sign * slide } + fadeOut(tween(200)))
                    }
                },
                label = "introCard",
                modifier = Modifier.weight(1f),
            ) { i ->
                Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    HowToScene(meta.id, i, Modifier.fillMaxWidth().height(200.dp), size = 96.dp)
                    Spacer(Modifier.height(16.dp))
                    meta.howToKeys.getOrNull(i)?.let { Text(keyText(it), style = JamaaTheme.type.displayS, color = JamaaColors.Text, textAlign = TextAlign.Center, maxLines = 2) }
                }
            }
            if (flow.isLast) {
                JamaaButton(stringResource(R.string.setup__got_it), { flow.onOk(); onClose() }, Modifier.focusRequester(gotIt), kind = ButtonKind.Primary)
                InitialFocus(gotIt)
            } else {
                Text(stringResource(R.string.setup__intro_hint), style = JamaaTheme.type.caption, color = JamaaColors.TextMuted)
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                repeat(flow.cardCount) { i -> Box(Modifier.width(48.dp).height(4.dp).background(if (i <= index) JamaaColors.Accent else JamaaColors.Outline, JamaaShapes.pill)) }
            }
        }
        val members = room.members.filter { !it.left }
        if (members.size < meta.minPlayers) {
            Column(Modifier.align(Alignment.TopEnd), horizontalAlignment = Alignment.CenterHorizontally) {
                QrCode(room.joinUrl, panel = 144.dp)
                RoomCode(room.roomCode, Modifier.width(144.dp).height(32.dp), centered = true)
            }
            // Top-start, opposite the join chip: clear of the progress segments and the hint / "Got it" at the bottom.
            Row(Modifier.align(Alignment.TopStart).padding(top = 28.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for (m in members) Character(m.color, 48.dp, CharacterRules.expression(m, null, null))
            }
        }
    }
}
