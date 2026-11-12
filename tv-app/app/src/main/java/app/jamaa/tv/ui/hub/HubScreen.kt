package app.jamaa.tv.ui.hub

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.game.Names
import app.jamaa.tv.games.GameCatalog
import app.jamaa.tv.net.ServerUrls
import app.jamaa.tv.platform.CharacterRules
import app.jamaa.tv.platform.HubFocus
import app.jamaa.tv.platform.HubModel
import app.jamaa.tv.platform.ReactionTracker
import app.jamaa.tv.platform.RemoteKey
import app.jamaa.tv.platform.TicketState
import app.jamaa.tv.platform.TopBarItem
import app.jamaa.tv.protocol.GameCard
import app.jamaa.tv.protocol.MemberPublic
import app.jamaa.tv.protocol.RoomPublic
import app.jamaa.tv.ui.characters.Character
import app.jamaa.tv.ui.components.AvatarState
import app.jamaa.tv.ui.components.FitText
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.JamaaFocusSurface
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.components.QrCode
import app.jamaa.tv.ui.components.RoomCode
import app.jamaa.tv.ui.components.Wordmark
import app.jamaa.tv.ui.components.WordmarkVariant
import app.jamaa.tv.ui.components.tryFocus
import app.jamaa.tv.ui.motion.LocalPortalOrigins
import app.jamaa.tv.ui.platform.BarButton
import app.jamaa.tv.ui.platform.RoundIconButton
import app.jamaa.tv.ui.platform.keyText
import app.jamaa.tv.ui.platform.remoteKey
import app.jamaa.tv.ui.platform.repeats
import app.jamaa.tv.ui.screens.langNameRes
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaMotion
import app.jamaa.tv.ui.theme.JamaaShapes
import app.jamaa.tv.ui.theme.JamaaTheme
import app.jamaa.tv.ui.theme.WorldStage
import app.jamaa.tv.ui.theme.worldOf
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** What the hub screen asks the room / overlays to do. Local navigation stays inside the screen. */
class HubActions(
    val onFocusGame: (String) -> Unit,
    val onOpenGame: (GameCard) -> Unit,
    val onRules: () -> Unit,
    val onCup: () -> Unit,
    val onPass: (() -> Unit)?,
    val onSettings: () -> Unit,
    val onMember: (MemberPublic) -> Unit,
)

// DESIGN-JAMAA §2.1 zones, in the safe area's coordinates (the screen sits inside the 48 / 27 dp safe-area padding).
private val BAR_H = 44.dp // y 27–71
private val ROW_X = 12.dp // x 60
private val ROW_Y = 68.dp // y 95–289
private val ROW_W = 608.dp // 4 × 140 + 3 × 16
private val INFO_Y = 277.dp // y 304–392
private val INFO_W = 620.dp // x 60–680
private val INFO_H = 88.dp
private val TICKET_X = 656.dp // x 704–912
private val TICKET_Y = 56.dp // y 83–427
private val TICKET_H = 344.dp
private val STRIP_Y = 402.dp // y 429–513 (the toast lane y 399–431 above it is AppRoot's)
private val STRIP_H = 84.dp

/**
 * HUB-02 (JAMAA-PLATFORM §3.2, DESIGN-JAMAA §2.1): top bar, all four game posters in one row with the 40 % world tint,
 * the focused game's info block, the join ticket (gathering / compact, same width) and the members strip. Remote-only:
 * the focus graph is [HubModel.move] (wrap, Up → ⓘ always, Down → the last-focused member; RTL mirrored); Back is
 * handled by AppRoot (the "Close JAMAA?" confirm).
 */
@Composable
fun HubScreen(
    room: RoomPublic,
    focusedGameId: String?,
    lastPlayed: String?,
    launchedAt: Long,
    showPass: Boolean,
    reactions: ReactionTracker,
    actions: HubActions,
    /** Games the server offers that this build cannot render (§2.5 `GET /api/config` `games`): "Update JAMAA" slots. */
    missingGames: List<String> = emptyList(),
) {
    val cards = remember(room.games) { HubModel.cards(room) }
    val strip = HubModel.strip(room)
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val topBar = HubModel.topBar(HubModel.showCup(room.cup), showPass)
    val scope = rememberCoroutineScope()

    // The poster index: the raw choice is state, the clamp to the current cards is derived (never written in composition).
    var chosenIndex by remember { mutableIntStateOf(HubModel.initialIndex(cards, lastPlayed, focusedGameId)) }
    val cardCount = cards.size
    val posterIndex by remember(cardCount) { derivedStateOf { chosenIndex.coerceIn(0, (cardCount - 1).coerceAtLeast(0)) } }
    var focus by remember { mutableStateOf<HubFocus>(HubFocus.Poster(posterIndex)) }
    val posterFocus = remember(cards.size) { List(cards.size) { FocusRequester() } }
    val barFocus = remember { TopBarItem.entries.associateWith { FocusRequester() } }
    // Members' requesters live by id (a join or leave never hands a slot's requester to someone else).
    val memberFocus = remember { HashMap<String, FocusRequester>() }
    fun memberRequester(id: String): FocusRequester = memberFocus.getOrPut(id) { FocusRequester() }
    var focusedMemberId by remember { mutableStateOf<String?>(null) }
    var lastMemberId by remember { mutableStateOf<String?>(null) }
    var lastMoveAt by remember { mutableLongStateOf(0L) }
    val focusedCard = cards.getOrNull(posterIndex)
    val world = worldOf(GameCatalog.meta(focusedCard?.id)?.world)
    val scrolls = HubModel.scrolls(cards.size, missingGames.size)
    val lazy = rememberLazyListState()

    // Gathering → compact once 60 s have passed with 3+ members; one timer, and compact latches (never flips back).
    var gatheringOver by remember { mutableStateOf(System.currentTimeMillis() - launchedAt >= HubModel.GATHERING_MS) }
    LaunchedEffect(launchedAt) {
        if (!gatheringOver) {
            delay((HubModel.GATHERING_MS - (System.currentTimeMillis() - launchedAt)).coerceAtLeast(0))
            gatheringOver = true
        }
    }
    var compact by rememberSaveable { mutableStateOf(false) }
    val ticket = HubModel.ticketState(strip.size, if (gatheringOver) HubModel.GATHERING_MS else 0L, compact)
    LaunchedEffect(ticket) { if (ticket == TicketState.COMPACT) compact = true }

    fun requester(f: HubFocus): FocusRequester? = when (f) {
        is HubFocus.Poster -> posterFocus.getOrNull(if (f.index < 0) posterIndex else f.index)
        is HubFocus.TopBar -> barFocus[f.item]
        is HubFocus.Member -> strip.getOrNull(f.index)?.let { memberRequester(it.id) }
    }

    /** What the user is on now (a member by id, since the strip may have shifted). */
    fun current(): HubFocus {
        val f = focus
        if (f !is HubFocus.Member) return f
        val i = strip.indexOfFirst { it.id == focusedMemberId }
        return if (i >= 0) HubFocus.Member(i) else HubFocus.Poster(-1)
    }

    fun focusTo(target: HubFocus) {
        if (target is HubFocus.Poster && scrolls) {
            // Scrolling fallback: bring the poster (and one before it, the pivot) into view, then focus it once composed.
            val i = if (target.index < 0) posterIndex else target.index
            scope.launch {
                if (lazy.layoutInfo.visibleItemsInfo.none { it.index == i }) {
                    lazy.scrollToItem((i - 1).coerceAtLeast(0))
                    withFrameNanos { }
                }
                posterFocus.getOrNull(i)?.tryFocus()
            }
            return
        }
        requester(target)?.tryFocus()
    }

    // The focused member left: focus their neighbour (same place in the strip), else the focused poster.
    val ids = strip.map { it.id }
    LaunchedEffect(ids) {
        memberFocus.keys.retainAll(ids.toSet())
        val f = focus
        val gone = focusedMemberId
        if (f is HubFocus.Member && gone != null && gone !in ids) {
            focusedMemberId = null
            val next = strip.getOrNull(f.index.coerceAtMost(strip.size - 1))
            if (next != null) memberRequester(next.id).tryFocus() else focusTo(HubFocus.Poster(-1))
        }
    }

    Box(Modifier.fillMaxSize()) {
        WorldStage(world, tint = HubModel.WORLD_TINT)
        Box(
            Modifier
                .fillMaxSize()
                .onPreviewKeyEvent { e ->
                    if (e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                    val k = e.remoteKey()
                    if (k != RemoteKey.UP && k != RemoteKey.DOWN && k != RemoteKey.LEFT && k != RemoteKey.RIGHT) return@onPreviewKeyEvent false
                    // Held Left/Right: drop auto-repeats closer than 150 ms (the stage tint and props keep up).
                    val now = System.currentTimeMillis()
                    if ((k == RemoteKey.LEFT || k == RemoteKey.RIGHT) && e.repeats > 0 && now - lastMoveAt < HubModel.KEY_REPEAT_MS) return@onPreviewKeyEvent true
                    val lastMember = strip.indexOfFirst { it.id == lastMemberId }.coerceAtLeast(0)
                    val next = HubModel.move(current(), k, rtl, cards.size, strip.size, topBar, lastMember) ?: return@onPreviewKeyEvent true
                    lastMoveAt = now
                    focusTo(next)
                    true
                },
        ) {
            // ---- top bar (y 27–71)
            Row(Modifier.fillMaxWidth().height(BAR_H), verticalAlignment = Alignment.CenterVertically) {
                // جماعة is the Arabic primary (web /brand/wordmark-ar.svg); Arabic is the only RTL UI language.
                Wordmark(112.dp, variant = if (rtl) WordmarkVariant.Arabic else WordmarkVariant.Latin)
                Spacer(Modifier.weight(1f))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    for (item in topBar) {
                        val m = Modifier.focusRequester(barFocus.getValue(item)).onFocusChanged { if (it.isFocused) focus = HubFocus.TopBar(item) }
                        when (item) {
                            TopBarItem.CUP -> CupChip(room, m, actions.onCup)
                            TopBarItem.INFO -> RoundIconButton(JamaaIcons.Info, stringResource(R.string.hub__rules), actions.onRules, m)
                            TopBarItem.PASS -> BarButton(stringResource(R.string.hub__pass), { actions.onPass?.invoke() }, m, icon = JamaaIcons.Gem, accent = true)
                            TopBarItem.SETTINGS -> RoundIconButton(JamaaIcons.Settings, stringResource(R.string.hub__settings), actions.onSettings, m)
                        }
                    }
                }
            }
            // ---- posters (x 60–668, y 95–289)
            PosterRow(
                cards = cards,
                index = posterIndex,
                room = room,
                showPass = showPass,
                requesters = posterFocus,
                onFocused = { i ->
                    chosenIndex = i
                    focus = HubFocus.Poster(i)
                    actions.onFocusGame(cards[i].id)
                },
                onOpen = actions.onOpenGame,
                missing = missingGames,
                scrolls = scrolls,
                lazy = lazy,
            )
            // ---- focused game (x 60–680, y 304–392)
            focusedCard?.let {
                InfoBlock(it, cards, strip.size, room, Modifier.offset(x = ROW_X, y = INFO_Y).size(INFO_W, INFO_H))
            }
            // ---- join ticket (x 704–912, y 83–427)
            JoinTicket(room, ticket, Modifier.offset(x = TICKET_X, y = TICKET_Y))
            // ---- members strip (y 429–513)
            MembersStrip(
                members = strip,
                minPlayers = focusedCard?.minPlayers ?: HubModel.GATHERING_MIN_MEMBERS,
                reactions = reactions,
                requester = ::memberRequester,
                onFocused = { i, m ->
                    focus = HubFocus.Member(i)
                    focusedMemberId = m.id
                    lastMemberId = m.id
                },
                onMember = actions.onMember,
                modifier = Modifier.offset(y = STRIP_Y),
            )
        }
    }
    // First focus on the poster; after any overlay closes, back to what the user was on.
    posterFocus.getOrNull(posterIndex)?.let { InitialFocus(it, restore = { requester(current()) }) }
}

@Composable
private fun PosterRow(
    cards: List<GameCard>,
    index: Int,
    room: RoomPublic,
    showPass: Boolean,
    requesters: List<FocusRequester>,
    onFocused: (Int) -> Unit,
    onOpen: (GameCard) -> Unit,
    missing: List<String>,
    scrolls: Boolean,
    lazy: LazyListState,
) {
    val origins = LocalPortalOrigins.current
    val reduce = JamaaTheme.reduceMotion
    // §3.10 A "press": OK dips the focused poster 1.06 → 1.03 while the portal starts (back up if the open is refused).
    var pressed by remember { mutableStateOf<String?>(null) }
    val dip by animateFloatAsState(if (pressed != null && !reduce) 1.03f / HubModel.POSTER_FOCUS_SCALE else 1f, tween(120, easing = JamaaMotion.Standard), label = "press")
    LaunchedEffect(pressed) {
        if (pressed != null) {
            delay(600)
            pressed = null
        }
    }

    @Composable
    fun PosterAt(i: Int, card: GameCard) {
        Poster(
            card = card,
            room = room,
            showPass = showPass,
            focused = i == index,
            onClick = {
                pressed = card.id
                onOpen(card)
            },
            modifier = Modifier
                .onGloballyPositioned { if (i == index) origins.put(card.id, it.boundsInRoot()) }
                .graphicsLayer {
                    val k = if (pressed == card.id) dip else 1f
                    scaleX = k
                    scaleY = k
                }
                .focusRequester(requesters[i])
                .onFocusChanged { if (it.isFocused) onFocused(i) },
        )
    }

    val gap = Arrangement.spacedBy(HubModel.POSTER_GAP_DP.dp)
    if (!scrolls) {
        // Every slot fits: a plain row, no scrolling and no clipping (the 1.06 scale and the ring stay in the gaps).
        Row(
            Modifier.offset(x = ROW_X, y = ROW_Y).size(ROW_W, HubModel.POSTER_H_DP.dp),
            horizontalArrangement = gap,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            cards.forEachIndexed { i, card -> key(card.id) { PosterAt(i, card) } }
            // Never focusable: a game this build cannot render ("Update JAMAA"), then — while the row has a free slot —
            // a closed shop shutter so a lone poster does not float on the stage (web `tvposter--shutter`).
            for (id in missing) UpdateSlot(id)
            if (HubModel.showShutter(cards.size, missing.size)) ShutterSlot()
        }
    } else {
        // More games than slots: a remote-driven scrolling row; its padding leaves room for the focus scale and ring.
        val pad = 12.dp
        LazyRow(
            Modifier.offset(y = ROW_Y - pad).size(ROW_X + ROW_W + pad, HubModel.POSTER_H_DP.dp + pad * 2),
            state = lazy,
            contentPadding = PaddingValues(start = ROW_X, end = pad, top = pad, bottom = pad),
            horizontalArrangement = gap,
            verticalAlignment = Alignment.CenterVertically,
            userScrollEnabled = false,
        ) {
            itemsIndexed(cards, key = { _, c -> c.id }) { i, card -> PosterAt(i, card) }
            for (id in missing) item(key = "missing:$id") { UpdateSlot(id) }
        }
    }
}

/** A game the server offers that this build lacks: its world, its title, "Update JAMAA to play this game". */
@Composable
private fun UpdateSlot(gameId: String) {
    val meta = GameCatalog.meta(gameId)
    val world = worldOf(meta?.world)
    Column(
        Modifier
            .size(HubModel.POSTER_W_DP.dp, HubModel.POSTER_H_DP.dp)
            .alpha(0.55f)
            .background(world.deep, JamaaShapes.tile)
            .padding(10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(gameTitle(gameId), style = JamaaTheme.type.titleS, color = world.accentText, textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Ellipsis)
        Spacer(Modifier.height(8.dp))
        Text(stringResource(R.string.hub__game_unsupported), style = JamaaTheme.type.caption, color = JamaaColors.TextSecondary, textAlign = TextAlign.Center)
    }
}

/** The room prop in an empty poster slot: a closed shutter (web `tvposter--shutter`, drawn on a 210 × 290 grid, at 55 %). */
@Composable
private fun ShutterSlot() {
    Canvas(Modifier.size(HubModel.POSTER_W_DP.dp, HubModel.POSTER_H_DP.dp).alpha(0.55f)) {
        val u = size.width / 210f
        drawRoundRect(Color(0xFF3B3A44), Offset(6f * u, 10f * u), Size(198f * u, 274f * u), CornerRadius(10f * u))
        drawLine(Color(0xFF55545F), Offset(6f * u, 22f * u), Offset(204f * u, 22f * u), 10f * u)
        for (k in 0 until 16) drawLine(Color(0xFF2A2932), Offset(10f * u, (40f + k * 15f) * u), Offset(200f * u, (40f + k * 15f) * u), 3f * u)
        drawRoundRect(Color(0xFF55545F), Offset(88f * u, 262f * u), Size(34f * u, 12f * u), CornerRadius(3f * u))
        val lock = Path().apply {
            moveTo(98f * u, 262f * u)
            lineTo(98f * u, 255f * u)
            cubicTo(98f * u, 249f * u, 112f * u, 249f * u, 112f * u, 255f * u)
            lineTo(112f * u, 262f * u)
        }
        drawPath(lock, Color(0xFF8C8A96), style = Stroke(3f * u))
    }
}

/**
 * The focused game under the posters: title (world accent), tagline, and "Needs 3+ · 6–10 min · EN" with the room's
 * content language as one chip. Crossfades 120 ms when the game changes; "Needs" recolours in place (no crossfade).
 */
@Composable
private fun InfoBlock(card: GameCard, cards: List<GameCard>, present: Int, room: RoomPublic, modifier: Modifier) {
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    // 88 dp for three lines: Arabic keeps its taller lines but slightly tightened (34 / 28) to fit.
    val titleStyle = if (rtl) JamaaTheme.type.title.copy(lineHeight = 34.sp) else JamaaTheme.type.title
    val bodyStyle = if (rtl) JamaaTheme.type.body.copy(lineHeight = 28.sp) else JamaaTheme.type.body
    Crossfade(card.id, modifier, animationSpec = tween(120), label = "info") { id ->
        val c = cards.firstOrNull { it.id == id } ?: return@Crossfade
        val meta = GameCatalog.meta(id)
        Column {
            Text(gameTitle(id), style = titleStyle, color = worldOf(meta?.world).accentText, maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis)
            meta?.let { Text(keyText(it.taglineKey), style = bodyStyle, color = JamaaColors.TextSecondary, maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis) }
            val m = HubModel.metaLine(c, present)
            val players = if (m.needs) stringResource(R.string.hub__needs_players, m.minPlayers) else stringResource(R.string.hub__players, m.minPlayers.toString(), m.maxPlayers.toString())
            val minutes = stringResource(R.string.hub__minutes, m.minMinutes.toString(), m.maxMinutes.toString())
            val caption = JamaaTheme.type.caption.copy(lineHeight = 1.2.em)
            Row(Modifier.height(HubChipHeight), verticalAlignment = Alignment.CenterVertically) {
                Text(players, style = caption, color = if (m.needs) JamaaColors.Danger else JamaaColors.TextSecondary, maxLines = 1)
                Text("  ·  $minutes  ·  ", style = caption, color = JamaaColors.TextSecondary, maxLines = 1)
                // Only the room's current content language (web `tvlangchip`, filled).
                HubChip(room.contentLocale.uppercase(), fill = JamaaColors.TextSecondary, ink = JamaaColors.Bg)
            }
        }
    }
}

@Composable
private fun CupChip(room: RoomPublic, modifier: Modifier, onClick: () -> Unit) {
    val top = HubModel.cupTop(room.cup, room.members, n = 3)
    BarButton(stringResource(R.string.cup__title), onClick, modifier, icon = JamaaIcons.Trophy, accent = true) {
        Row(horizontalArrangement = Arrangement.spacedBy((-10).dp)) {
            for ((m, _) in top) Character(m.color, 32.dp, app.jamaa.tv.platform.Expression.IDLE)
        }
    }
}

/**
 * The join ticket (never focusable), 208 dp wide in both states: "Join on your phone", the QR on cream (a 192 dp panel;
 * compact draws it at 176 by scale, so nothing reflows), the code, the short URL (or the host alone when it cannot fit).
 */
@Composable
private fun JoinTicket(room: RoomPublic, state: TicketState, modifier: Modifier) {
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val qrScale by animateFloatAsState(HubModel.panelScale(state), tween(400, easing = JamaaMotion.Standard), label = "ticketQr")
    val gap = if (rtl) 4.dp else 6.dp
    Column(
        modifier
            .size(HubModel.TICKET_W_DP.dp, TICKET_H)
            .background(JamaaColors.Surface, JamaaShapes.tile)
            .padding(vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(gap, Alignment.CenterVertically),
    ) {
        Text(
            stringResource(R.string.hub__join_on_phone),
            style = JamaaTheme.type.body,
            color = JamaaColors.Text,
            textAlign = TextAlign.Center,
            maxLines = 1,
            softWrap = false,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 8.dp),
        )
        QrCode(
            room.joinUrl,
            Modifier.graphicsLayer {
                scaleX = qrScale
                scaleY = qrScale
            },
            panel = HubModel.PANEL_GATHERING_DP.dp,
        )
        RoomCode(room.roomCode, Modifier.fillMaxWidth().padding(horizontal = 8.dp).height(44.dp), centered = true, glow = true)
        JoinUrl(room, Modifier.fillMaxWidth().padding(horizontal = 8.dp))
    }
}

/** "play.jamaa…/KXQP" at 20 → 16 sp; the host alone when even 16 sp would not fit. Always LTR. */
@Composable
private fun JoinUrl(room: RoomPublic, modifier: Modifier) {
    val host = ServerUrls.displayHost(room.joinUrl)
    val full = host + "/" + room.roomCode
    val style = JamaaTheme.type.caption.copy(lineHeight = 1.2.em, letterSpacing = 0.em)
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    BoxWithConstraints(modifier) {
        val minStyle = style.copy(fontSize = with(density) { 16.dp.toSp() })
        val fits = remember(full, constraints.maxWidth) { measurer.measure(full, minStyle, softWrap = false, maxLines = 1).size.width <= constraints.maxWidth }
        FitText(
            if (fits) full else host,
            style = style,
            color = JamaaColors.TextMuted,
            maxSize = 20.dp,
            minSize = 16.dp,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )
    }
}

/**
 * Members as 48 dp characters in 72 dp slots with names (≤ 7 / ≤ 5 graphemes, then ellipsis), the VIP crown, the
 * reaction burst; OK → Kick / Cancel. Dashed ghost seats fill up to max(3, the focused game's minPlayers), followed by
 * "Waiting for the gang…" (nobody yet) or "{n} more to play". Live join (§2.1): a newcomer drops in (−0.5 body, then
 * `spring.bouncy`) and keeps a glow ring until the next join (the "… is with us!" toast is AppRoot's, above the strip).
 */
@Composable
private fun MembersStrip(
    members: List<MemberPublic>,
    minPlayers: Int,
    reactions: ReactionTracker,
    requester: (String) -> FocusRequester,
    onFocused: (Int, MemberPublic) -> Unit,
    onMember: (MemberPublic) -> Unit,
    modifier: Modifier,
) {
    val reduce = JamaaTheme.reduceMotion
    // Join diff: the first snapshot only records (no drop for the people already here when the hub opens).
    val seen = remember { arrayOfNulls<Set<String>>(1) }
    var newest by remember { mutableStateOf<String?>(null) }
    val ids = members.map { it.id }
    val prev = seen[0]
    val arrived = if (prev == null) emptyList() else ids.filter { it !in prev }
    SideEffect {
        seen[0] = ids.toSet()
        if (arrived.isNotEmpty()) newest = arrived.last()
    }
    val ghosts = HubModel.ghostSeats(members.size, minPlayers)
    val nameStyle = JamaaTheme.type.caption
    Row(modifier.fillMaxWidth().height(STRIP_H), verticalAlignment = Alignment.CenterVertically) {
        val max = HubModel.captionGraphemes(members.size)
        members.forEachIndexed { i, m ->
            key(m.id) {
                val isNew = m.id == (arrived.lastOrNull() ?: newest)
                val drop = remember { Animatable(if (m.id in arrived && !reduce) -24f else 0f) }
                LaunchedEffect(Unit) { if (drop.value != 0f) drop.animateTo(0f, spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMediumLow)) }
                JamaaFocusSurface(
                    onClick = { onMember(m) },
                    modifier = Modifier.width(72.dp).focusRequester(requester(m.id)).onFocusChanged { if (it.isFocused) onFocused(i, m) },
                    container = Color.Transparent,
                ) {
                    Column(Modifier.fillMaxWidth().padding(vertical = 2.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        val active = reactions.activeFor(m.id, System.currentTimeMillis())
                        val expression = CharacterRules.expression(m, null, active)
                        Box(
                            Modifier
                                .graphicsLayer { translationY = drop.value.dp.toPx() }
                                .then(if (isNew) Modifier.drawBehind { drawCircle(Brush.radialGradient(listOf(JamaaColors.Accent.copy(alpha = 0.55f), Color.Transparent)), size.minDimension * 0.62f) } else Modifier),
                        ) {
                            Character(m.color, 48.dp, expression, state = AvatarState(host = m.isHost, away = !m.connected), burst = active, burstKey = m.reaction?.n ?: 0)
                        }
                        Text(
                            Names.ellipsize(m.name, max),
                            style = nameStyle,
                            color = JamaaColors.TextSecondary,
                            maxLines = 1,
                            softWrap = false,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.padding(horizontal = 2.dp),
                        )
                    }
                }
            }
        }
        repeat(ghosts) {
            Column(Modifier.width(72.dp).padding(vertical = 2.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                GhostSeat()
                Spacer(Modifier.height(with(LocalDensity.current) { nameStyle.lineHeight.toDp() }))
            }
        }
        val hint = when {
            members.isEmpty() -> stringResource(R.string.hub__waiting_gang)
            ghosts > 0 -> pluralStringResource(R.plurals.hub__more_to_play, ghosts, ghosts)
            else -> null
        }
        if (hint != null) {
            Text(
                hint,
                style = JamaaTheme.type.body,
                color = JamaaColors.TextSecondary,
                maxLines = 1,
                softWrap = false,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f, fill = false).padding(start = 8.dp, bottom = with(LocalDensity.current) { nameStyle.lineHeight.toDp() }),
            )
        }
    }
}

/** A dashed 48 dp ghost seat (cream at 32 %), waiting for someone. */
@Composable
private fun GhostSeat() {
    Canvas(Modifier.size(48.dp)) {
        val w = 2.dp.toPx()
        drawCircle(
            Color(0xFFFFF7EC).copy(alpha = 0.32f),
            radius = size.minDimension / 2f - w / 2f,
            style = Stroke(width = w, pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx()))),
        )
    }
}

/** A game's title in the UI language (posters, setup title, rules header). */
@Composable
fun gameTitle(gameId: String): String = GameCatalog.meta(gameId)?.let { keyText(it.titleKey) } ?: gameId

/** The language name of a content locale ("No Arabic yet"). */
@Composable
fun languageName(locale: String): String = stringResource(langNameRes(locale))
