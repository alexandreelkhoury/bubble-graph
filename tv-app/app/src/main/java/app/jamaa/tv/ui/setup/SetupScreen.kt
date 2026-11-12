package app.jamaa.tv.ui.setup

import android.os.SystemClock
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.game.Cue
import app.jamaa.tv.game.CuePlay
import app.jamaa.tv.game.Names
import app.jamaa.tv.games.SettingFieldSpec
import app.jamaa.tv.games.TvGameMeta
import app.jamaa.tv.platform.CharacterRules
import app.jamaa.tv.platform.Expression
import app.jamaa.tv.platform.IntroFlow
import app.jamaa.tv.platform.RemoteKey
import app.jamaa.tv.platform.SetupFocus
import app.jamaa.tv.platform.SetupFocusGraph
import app.jamaa.tv.platform.SetupFocusRule
import app.jamaa.tv.platform.SetupRow
import app.jamaa.tv.platform.SetupRows
import app.jamaa.tv.platform.SetupTarget
import app.jamaa.tv.platform.steps
import app.jamaa.tv.protocol.MemberPublic
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
import app.jamaa.tv.ui.components.focusInk
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.components.LocalSounds
import app.jamaa.tv.ui.components.QrCode
import app.jamaa.tv.ui.components.RoomCode
import app.jamaa.tv.ui.components.fullBleed
import app.jamaa.tv.ui.components.tryFocus
import app.jamaa.tv.ui.hub.gameTitle
import app.jamaa.tv.ui.hub.languageName
import app.jamaa.tv.ui.platform.RoundIconButton
import app.jamaa.tv.ui.platform.keyText
import app.jamaa.tv.ui.platform.remoteKey
import app.jamaa.tv.ui.platform.repeats
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaMotion
import app.jamaa.tv.ui.theme.JamaaShapes
import app.jamaa.tv.ui.theme.JamaaSpace
import app.jamaa.tv.ui.theme.JamaaTheme
import app.jamaa.tv.ui.theme.WorldStage
import app.jamaa.tv.ui.theme.worldOf

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

/** Held Left/Right on a stepper row: at most one step per this many ms (choices and toggles ignore key repeats). */
private const val STEP_REPEAT_MS = 120L

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
    val sounds = LocalSounds.current
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
    // OK on a dimmed Start: Start shakes, the players pane's "{n} more" pulses (a counter, so every press replays).
    var nudge by remember { mutableIntStateOf(0) }
    // The physical direction of the last step (+1 Right, −1 Left): the value slides that way.
    var stepDir by remember { mutableIntStateOf(1) }
    val lastStepAt = remember { longArrayOf(Long.MIN_VALUE / 2) }
    val fields = remember(meta.id) { (meta.basic + meta.advanced).associateBy { it.key } }

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
                        // A held key: a wrapping choice / toggle would spin and flood the server with patches, so its
                        // repeats are ignored; a stepper keeps counting, one step per STEP_REPEAT_MS at most.
                        val now = SystemClock.uptimeMillis()
                        if (e.repeats > 0) {
                            if (fields[row.key] !is SettingFieldSpec.Stepper) return@onPreviewKeyEvent true
                            if (now - lastStepAt[0] < STEP_REPEAT_MS) return@onPreviewKeyEvent true
                        }
                        lastStepAt[0] = now
                        val forward = if (rtl) RemoteKey.LEFT else RemoteKey.RIGHT
                        stepDir = if (k == RemoteKey.RIGHT) 1 else -1
                        actions.onStep(row.key, if (k == forward) 1 else -1)
                        return@onPreviewKeyEvent true
                    }
                }
                val next = SetupFocusGraph.move(t, k, rtl, column.size, { i -> column.getOrNull(i)?.steps == true }, lastColumn, firstRow)
                if (next != null) requester(next)?.tryFocus()
                true
            },
        ) {
            // ---- title strip (y 27–91): hint at the start, the title truly centred, ⓘ at the end.
            Box(Modifier.fillMaxWidth().height(56.dp)) {
                Text(
                    "‹ " + stringResource(R.string.hub__title),
                    style = JamaaTheme.type.caption,
                    color = JamaaColors.TextMuted,
                    maxLines = 1,
                    modifier = Modifier.align(Alignment.CenterStart),
                )
                Text(
                    gameTitle(meta.id),
                    style = JamaaTheme.type.displayS,
                    color = world.accentText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.align(Alignment.Center).padding(horizontal = 140.dp),
                )
                RoundIconButton(
                    JamaaIcons.Info, stringResource(R.string.rules__open), actions.onRules,
                    Modifier.align(Alignment.CenterEnd).focusRequester(infoFocus).onFocusChanged { if (it.isFocused) target = SetupTarget.Info },
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
                PlayersPane(room, meta, nudge, Modifier.width(216.dp).fillMaxHeight())
                SettingsColumn(
                    column, meta, setup, rowFocus,
                    onFocused = { i ->
                        target = SetupTarget.Column(i)
                        lastColumn = i
                    },
                    actions = actions,
                    stepDir = stepDir,
                    accent = world.accent,
                    nudge = nudge,
                    onDimmedStart = {
                        nudge++
                        sounds.play(CuePlay(Cue.ERROR))
                    },
                    modifier = Modifier.weight(1f).fillMaxHeight(),
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
        // After a sheet (rules, packs, content language, Advanced) closes, focus returns to the item that opened it.
        InitialFocus(initial, key = meta.id, restore = { requester(target) })
    }
}

/**
 * Text that keeps all of a (translated) sentence: the size steps down from [style]'s size to [minSize] until it fits
 * [maxLines] in the space it is given, and only then ellipsizes. The line height scales with the size.
 */
@Composable
private fun AutoSizeText(
    text: String,
    style: TextStyle,
    color: Color,
    maxLines: Int,
    minSize: TextUnit,
    modifier: Modifier = Modifier,
    textAlign: TextAlign = TextAlign.Start,
) {
    val lineHeight = if (style.lineHeight.isSp && style.fontSize.isSp) (style.lineHeight.value / style.fontSize.value).em else style.lineHeight
    BasicText(
        text = text,
        modifier = modifier,
        style = style.copy(color = color, textAlign = textAlign, lineHeight = lineHeight),
        overflow = TextOverflow.Ellipsis,
        maxLines = maxLines,
        autoSize = TextAutoSize.StepBased(minFontSize = minSize, maxFontSize = style.fontSize, stepSize = 1.sp),
    )
}

/**
 * The collapsed How to play pane: the current card (auto-advances every 6 s while not focused, with a cross-fade),
 * dots; OK replays the full intro. Focus is the full-width row scale (1.02): a tile's 1.06 would grow this 324 × 422
 * pane into the overscan and the title strip.
 */
@Composable
private fun HowToPane(meta: TvGameMeta, index: Int, modifier: Modifier, onReplay: () -> Unit) {
    var shown by remember(meta.id) { mutableIntStateOf(index) }
    // The intro's last card wins whenever it changes (closing the intro shows where it stopped).
    LaunchedEffect(index) { shown = index }
    var focused by remember { mutableStateOf(false) }
    LaunchedEffect(meta.id, focused) {
        if (focused) return@LaunchedEffect
        while (true) {
            kotlinx.coroutines.delay(IntroFlow.AUTO_ADVANCE_MS)
            if (meta.howToKeys.isNotEmpty()) shown = (shown + 1) % meta.howToKeys.size
        }
    }
    JamaaFocusSurface(
        onClick = onReplay,
        modifier = modifier.onFocusChanged { focused = it.isFocused },
        shape = JamaaShapes.tile,
        kind = FocusKind.Row,
    ) {
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Text(stringResource(R.string.howto__title), style = JamaaTheme.type.titleS, color = JamaaColors.TextSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(12.dp))
            AnimatedContent(
                targetState = shown,
                transitionSpec = { fadeIn(tween(JamaaMotion.Base)) togetherWith fadeOut(tween(200)) },
                label = "howToCard",
                modifier = Modifier.weight(1f).fillMaxWidth(),
            ) { card ->
                Column(Modifier.fillMaxSize()) {
                    HowToScene(meta.id, card, Modifier.fillMaxWidth().height(150.dp))
                    Spacer(Modifier.height(12.dp))
                    meta.howToKeys.getOrNull(card)?.let {
                        AutoSizeText(keyText(it), JamaaTheme.type.body, JamaaColors.Text, maxLines = 5, minSize = 15.sp, modifier = Modifier.weight(1f).fillMaxWidth())
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
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

/** Pager dots: 12 dp dots, the active one a 32 × 12 pill (its width animates); centred on one line, so nothing jumps. */
@Composable
private fun Dots(n: Int, active: Int) {
    val reduce = JamaaTheme.reduceMotion
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
        repeat(n) { i ->
            val on = i == active
            val w by animateDpAsState(if (on) 32.dp else 12.dp, tween(if (reduce) 0 else JamaaMotion.Base, easing = JamaaMotion.Standard), label = "dotW")
            val c by animateColorAsState(if (on) JamaaColors.Accent else JamaaColors.OutlineStrong, tween(if (reduce) 0 else JamaaMotion.Base), label = "dotC")
            Box(Modifier.width(w).height(12.dp).background(c, JamaaShapes.pill))
        }
    }
}

/**
 * The players pane's member grid (pure, JVM-tested): how many per row and how big, so 1..12 seats always fit the room
 * left above the QR. The biggest character wins; at equal size, 3 per row (60 dp cells, names up to 6 graphemes)
 * before 4 per row (cells a quarter of the width, names up to 5 graphemes).
 */
internal object GangGrid {
    const val GAP = 4
    const val MIN_CHAR = 28
    private const val CELL_3 = 60

    data class Fit(val perRow: Int, val cell: Int, val char: Int, val graphemes: Int) {
        fun rows(n: Int) = (n + perRow - 1) / perRow
        fun height(n: Int, nameLh: Int) = rows(n).let { r -> r * (char + nameLh) + (r - 1).coerceAtLeast(0) * GAP }
        fun width() = perRow * cell + (perRow - 1) * GAP
    }

    fun fit(n: Int, width: Int, height: Int, nameLh: Int): Fit {
        val cell3 = minOf(CELL_3, (width - 2 * GAP) / 3)
        val cell4 = (width - 3 * GAP) / 4
        val candidates = buildList {
            for (c in 52 downTo MIN_CHAR step 4) {
                if (c <= cell3 - 8) add(Fit(3, cell3, c, 6))
                if (c <= cell4 - 2) add(Fit(4, cell4, c, 5))
            }
        }
        return candidates.firstOrNull { it.height(n, nameLh) <= height } ?: candidates.last()
    }
}

/** A dashed ghost outline (cream at 20 %, like the hub's), a seat waiting for someone. */
@Composable
private fun GhostCircle(size: Dp) {
    Canvas(Modifier.size(size)) {
        val w = 2.dp.toPx()
        drawCircle(
            Color(0xFFFFF7EC).copy(alpha = 0.2f),
            radius = this.size.minDimension / 2f - w / 2f,
            style = Stroke(width = w, pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx()))),
        )
    }
}

/**
 * The members on a small stage ([GangGrid] sizes them to the room left), a dashed ghost per missing player. While short
 * of players: one Accent line "Scan to join · {n} more" and a 176 dp QR; otherwise a compact QR (120 dp, 104 dp above
 * 8 members). The room code always sits at the bottom. [nudge] (OK on a dimmed Start) pulses the "{n} more" line.
 */
@Composable
private fun PlayersPane(room: RoomPublic, meta: TvGameMeta, nudge: Int, modifier: Modifier) {
    val members = room.members.filter { !it.left }.sortedBy { it.seat }
    val missing = (meta.minPlayers - members.size).coerceAtLeast(0)
    val type = JamaaTheme.type
    val density = LocalDensity.current
    Column(modifier.background(JamaaColors.Surface.copy(alpha = 0.6f), JamaaShapes.tile).padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(stringResource(R.string.setup__gang), style = type.titleS, color = JamaaColors.TextSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Spacer(Modifier.height(6.dp))
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
            val nameLh = with(density) { type.caption.lineHeight.toDp() }
            val slots: List<MemberPublic?> = members + List(missing) { null }
            val grid = GangGrid.fit(slots.size, maxWidth.value.toInt(), maxHeight.value.toInt(), nameLh.value.toInt() + 1)
            Column(verticalArrangement = Arrangement.spacedBy(GangGrid.GAP.dp)) {
                for (rowItems in slots.chunked(grid.perRow)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(GangGrid.GAP.dp)) {
                        for (s in rowItems) {
                            Column(Modifier.width(grid.cell.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                if (s != null) {
                                    Character(s.color, grid.char.dp, CharacterRules.expression(s, null, null), state = AvatarState(host = s.isHost))
                                    Text(
                                        Names.ellipsize(s.name, grid.graphemes),
                                        style = type.caption,
                                        color = JamaaColors.TextSecondary,
                                        maxLines = 1,
                                        softWrap = false,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                } else {
                                    GhostCircle(grid.char.dp)
                                }
                            }
                        }
                    }
                }
            }
        }
        if (missing > 0) {
            val pulse = remember { Animatable(1f) }
            LaunchedEffect(nudge) {
                if (nudge == 0) return@LaunchedEffect
                pulse.snapTo(1f)
                pulse.animateTo(1.1f, tween(120, easing = JamaaMotion.Standard))
                pulse.animateTo(1f, tween(120, easing = JamaaMotion.Standard))
            }
            AutoSizeText(
                pluralStringResource(R.plurals.setup__scan_more, missing, missing),
                type.label,
                JamaaColors.Accent,
                maxLines = 2,
                minSize = 16.sp,
                modifier = Modifier.fillMaxWidth().graphicsLayer { scaleX = pulse.value; scaleY = pulse.value },
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(4.dp))
            QrCode(room.joinUrl, panel = 176.dp)
        } else {
            QrCode(room.joinUrl, panel = if (members.size > 8) 104.dp else 120.dp)
        }
        RoomCode(room.roomCode, Modifier.fillMaxWidth().height(52.dp), centered = true)
    }
}

/**
 * Content, the rows and Advanced in a scrolling column (a focused row scrolls into view), then the blocker line and
 * Start pinned at the bottom (one vertical focus column; Down from Start → nothing).
 */
@Composable
private fun SettingsColumn(
    column: List<SetupRow>,
    meta: TvGameMeta,
    setup: RoomSetup,
    focus: List<FocusRequester>,
    onFocused: (Int) -> Unit,
    actions: SetupActions,
    stepDir: Int,
    accent: Color,
    nudge: Int,
    onDimmedStart: () -> Unit,
    modifier: Modifier,
) {
    fun focusOf(i: Int) = Modifier.focusRequester(focus[i]).onFocusChanged { if (it.isFocused) onFocused(i) }
    val reduce = JamaaTheme.reduceMotion
    Column(modifier) {
        Column(
            Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            column.forEachIndexed { i, row ->
                when (row) {
                    is SetupRow.Content -> SettingRow(
                        label = stringResource(R.string.setup__content_label),
                        value = languageName(row.locale),
                        modifier = focusOf(i).fillMaxWidth().height(48.dp),
                        onClick = actions.onContentLanguage,
                        end = RowEnd.OPENS,
                    )
                    is SetupRow.Step -> {
                        val value = row.valueKey?.let { keyText(it) } ?: row.valueText.orEmpty()
                        val label = keyText(row.labelKey) + if (row.premium) "  ◆" else ""
                        val item = @Composable { m: Modifier ->
                            SettingRow(
                                label = label,
                                value = if (row.locked) "$value · " + stringResource(R.string.hub__pass_chip) else value,
                                modifier = m,
                                onClick = { if (row.locked) actions.onLockedSetting?.invoke() },
                                end = if (row.locked) RowEnd.NONE else RowEnd.STEPS,
                                dim = row.locked,
                                // A stepper at its limit: that chevron dims (choices wrap, toggles flip: never).
                                canBack = !row.locked && SetupRows.step(meta, setup, row.key, -1) != null,
                                canForward = !row.locked && SetupRows.step(meta, setup, row.key, 1) != null,
                                stepDir = stepDir,
                            )
                        }
                        if (row.inline) {
                            // An inline sub-row (Mish Ana! Custom counts): indented 24 dp behind a 2 dp world-accent bar.
                            Row(Modifier.fillMaxWidth().height(40.dp)) {
                                Spacer(Modifier.width(10.dp))
                                Box(Modifier.width(2.dp).fillMaxHeight().background(accent, JamaaShapes.pill))
                                Spacer(Modifier.width(12.dp))
                                item(focusOf(i).weight(1f).fillMaxHeight())
                            }
                        } else {
                            item(focusOf(i).fillMaxWidth().height(48.dp))
                        }
                    }
                    is SetupRow.Packs -> SettingRow(
                        label = keyText(row.labelKey),
                        value = pluralStringResource(R.plurals.setup__pack_count, row.selected, row.selected),
                        modifier = focusOf(i).fillMaxWidth().height(48.dp),
                        onClick = { actions.onPacks(row) },
                        end = RowEnd.OPENS,
                    )
                    SetupRow.Advanced -> SettingRow(
                        label = stringResource(R.string.setup__advanced),
                        value = null,
                        modifier = focusOf(i).fillMaxWidth().height(40.dp),
                        onClick = actions.onAdvanced,
                        end = RowEnd.OPENS,
                    )
                    is SetupRow.Start -> Unit
                }
            }
        }
        val startIndex = column.indexOfFirst { it is SetupRow.Start }
        val start = column.getOrNull(startIndex) as? SetupRow.Start ?: return@Column
        blockerText(setup)?.let {
            Text(
                it, style = JamaaTheme.type.label, color = JamaaColors.Danger, textAlign = TextAlign.Center, maxLines = 2,
                overflow = TextOverflow.Ellipsis, modifier = Modifier.fillMaxWidth(),
            )
        }
        Spacer(Modifier.height(6.dp))
        // OK on a dimmed Start: ±8 dp, 3 cycles in 300 ms; skipped under reduced motion (the sound and the pulse remain).
        val shake = remember { Animatable(0f) }
        LaunchedEffect(nudge) {
            if (nudge == 0 || reduce) return@LaunchedEffect
            shake.snapTo(0f)
            shake.animateTo(
                0f,
                keyframes {
                    durationMillis = 300
                    8f at 25
                    -8f at 75
                    8f at 125
                    -8f at 175
                    8f at 225
                    -8f at 275
                },
            )
        }
        val canStart by rememberUpdatedState(start.canStart)
        JamaaButton(
            stringResource(R.string.setup__start),
            { if (canStart) actions.onStart() else onDimmedStart() },
            focusOf(startIndex).fillMaxWidth().height(56.dp).graphicsLayer { translationX = shake.value.dp.toPx() },
            kind = ButtonKind.Primary,
            icon = JamaaIcons.Play,
            dimmed = !start.canStart,
            focusKind = FocusKind.Row,
        )
    }
}

/** What a settings row shows at its end: nothing, an "opens something" chevron, or ‹ › steppers (focused only). */
private enum class RowEnd { NONE, OPENS, STEPS }

/**
 * One settings row: the label (start, ellipsized) and the value (end, ≤ 150 dp, ellipsized, 8 dp from the label).
 * A stepping row shows its ‹ › chevrons only while focused (Accent, 20 dp; one dims to 30 % at a stepper's limit) and
 * its value in Accent; unfocused, the value is TextSecondary. A new value slides 16 dp in the step's direction (160 ms;
 * a fade under reduced motion).
 */
@Composable
private fun SettingRow(
    label: String,
    value: String?,
    modifier: Modifier,
    onClick: () -> Unit,
    end: RowEnd,
    dim: Boolean = false,
    canBack: Boolean = true,
    canForward: Boolean = true,
    stepDir: Int = 1,
) {
    var focused by remember { mutableStateOf(false) }
    val reduce = JamaaTheme.reduceMotion
    val slide = with(LocalDensity.current) { 16.dp.roundToPx() }
    JamaaFocusSurface(onClick = onClick, modifier = modifier.onFocusChanged { focused = it.isFocused }, kind = FocusKind.Row) {
        Row(Modifier.fillMaxSize().padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(label, style = JamaaTheme.type.titleS, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            val stepping = end == RowEnd.STEPS && focused
            if (value != null) {
                Spacer(Modifier.width(8.dp))
                if (stepping) Chevron(JamaaIcons.ChevronBack, canBack)
                // focusInk: on the cream focus fill, Accent/TextSecondary would be unreadable.
                val color = focusInk(
                    when {
                        dim -> JamaaColors.TextMuted
                        focused -> JamaaColors.Accent
                        else -> JamaaColors.TextSecondary
                    },
                )
                AnimatedContent(
                    targetState = value,
                    transitionSpec = {
                        if (reduce) {
                            fadeIn(tween(160)) togetherWith fadeOut(tween(160))
                        } else {
                            // Offsets are physical: stepDir is the physical key (+1 Right), so RTL needs no flip.
                            (slideInHorizontally(tween(160, easing = JamaaMotion.Decel)) { -stepDir * slide } + fadeIn(tween(160))) togetherWith
                                (slideOutHorizontally(tween(160, easing = JamaaMotion.Standard)) { stepDir * slide } + fadeOut(tween(120)))
                        }
                    },
                    contentAlignment = Alignment.CenterEnd,
                    label = "rowValue",
                    modifier = Modifier.widthIn(max = 150.dp),
                ) { v ->
                    Text(v, style = JamaaTheme.type.titleS, color = color, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                if (stepping) Chevron(JamaaIcons.ChevronForward, canForward)
            }
            if (end == RowEnd.OPENS) {
                Spacer(Modifier.width(4.dp))
                Icon(JamaaIcons.ChevronForward, contentDescription = null, tint = focusInk(if (focused) JamaaColors.Accent else JamaaColors.TextSecondary), modifier = Modifier.size(20.dp))
            }
        }
    }
}

/** A stepper chevron (autoMirrored: ‹ is always the reading-start, −1 side). */
@Composable
private fun Chevron(icon: ImageVector, enabled: Boolean) {
    Icon(icon, contentDescription = null, tint = focusInk(JamaaColors.Accent).copy(alpha = if (enabled) 1f else 0.3f), modifier = Modifier.size(20.dp))
}

/**
 * The one red line above Start, for content blockers only ("No content in this language"). Too few players is not
 * repeated here: the players pane already says "Scan to join · {n} more" (in Accent, where people look to join).
 */
@Composable
private fun blockerText(setup: RoomSetup): String? = when (setup.blocker) {
    null, StartBlocker.NOT_ENOUGH_PLAYERS -> null
    StartBlocker.NO_CONTENT_AVAILABLE, StartBlocker.NO_WORDS_AVAILABLE -> stringResource(R.string.setup__blocker_content)
    else -> keyText(app.jamaa.tv.game.GameViewModel.errorMessageKey(setup.startBlocker ?: "INTERNAL"))
}

/**
 * The full-screen first-time intro (DESIGN-JAMAA §2.5): a large scene, "1/4", one sentence, a segmented progress bar;
 * OK = next, Back = skip, the last card shows "Got it" and never auto-dismisses; any D-pad pauses auto-advance. While
 * the room is short of players a corner join chip and the members row keep gathering possible. The scrim bleeds to the
 * screen edges (content stays in the safe area) and enters with a fade + scale from 0.92 (300 ms, decel).
 */
@Composable
private fun IntroOverlay(meta: TvGameMeta, flow: IntroFlow, room: RoomPublic, onIndex: (Int) -> Unit, onClose: () -> Unit) {
    var index by remember { mutableIntStateOf(flow.index) }
    val gotIt = remember { FocusRequester() }
    val reduce = JamaaTheme.reduceMotion
    val appear = remember { Animatable(0f) }
    LaunchedEffect(Unit) { appear.animateTo(1f, tween(300, easing = JamaaMotion.Decel)) }
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
        Modifier
            .fillMaxSize()
            .fullBleed()
            .graphicsLayer {
                alpha = appear.value
                val s = if (reduce) 1f else 0.92f + 0.08f * appear.value
                scaleX = s
                scaleY = s
            }
            .background(JamaaColors.Bg.copy(alpha = 0.96f))
            .onPreviewKeyEvent { e ->
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
        Box(Modifier.fillMaxSize().padding(horizontal = JamaaSpace.SafeH, vertical = JamaaSpace.SafeV)) {
            Column(Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(stringResource(R.string.setup__intro_progress, (index + 1).toString(), flow.cardCount.toString()), style = JamaaTheme.type.label, color = JamaaColors.Accent)
                // The next card slides 48 dp in from the reading end (mirrored in RTL) with a fade, 240 ms.
                val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
                val slide = with(LocalDensity.current) { 48.dp.roundToPx() }
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
                        meta.howToKeys.getOrNull(i)?.let {
                            AutoSizeText(keyText(it), JamaaTheme.type.displayS, JamaaColors.Text, maxLines = 2, minSize = 28.sp, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
                        }
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
                    RoomCode(room.roomCode, Modifier.width(144.dp).height(52.dp), centered = true)
                }
                // Top-start, opposite the join chip: clear of the progress segments and the hint / "Got it" at the bottom.
                Row(Modifier.align(Alignment.TopStart).padding(top = 28.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (m in members) Character(m.color, 48.dp, CharacterRules.expression(m, null, null))
                }
            }
        }
    }
}
