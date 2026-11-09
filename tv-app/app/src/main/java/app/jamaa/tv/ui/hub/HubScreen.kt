package app.jamaa.tv.ui.hub

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import app.jamaa.tv.ui.motion.LocalPortalOrigins
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
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
import app.jamaa.tv.ui.theme.worldOf
import app.jamaa.tv.protocol.GameCard
import app.jamaa.tv.protocol.MemberPublic
import app.jamaa.tv.protocol.RoomPublic
import app.jamaa.tv.ui.characters.Character
import app.jamaa.tv.ui.components.AvatarState
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.JamaaFocusSurface
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.components.QrCode
import app.jamaa.tv.ui.components.RoomCode
import app.jamaa.tv.ui.components.Wordmark
import app.jamaa.tv.ui.components.WordmarkVariant
import app.jamaa.tv.ui.components.tryFocus
import app.jamaa.tv.ui.platform.BarButton
import app.jamaa.tv.ui.platform.RoundIconButton
import app.jamaa.tv.ui.platform.remoteKey
import app.jamaa.tv.ui.screens.langNameRes
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaMotion
import app.jamaa.tv.ui.theme.JamaaShapes
import app.jamaa.tv.ui.theme.JamaaTheme
import app.jamaa.tv.ui.theme.WorldStage
import app.jamaa.tv.ui.platform.keyText
import kotlinx.coroutines.delay

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

/**
 * HUB-02 (JAMAA-PLATFORM §3.2, DESIGN-JAMAA §2.1): top bar, the game poster carousel with the 40 % world tint, the
 * join ticket (gathering / compact) and the members strip. Remote-only: the focus graph is [HubModel.move] (wrap,
 * Up → ⓘ always, Down → the strip; RTL mirrored); Back is handled by AppRoot (the "Close JAMAA?" confirm).
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
    var posterIndex by remember { mutableStateOf(HubModel.initialIndex(cards, lastPlayed, focusedGameId)) }
    posterIndex = posterIndex.coerceIn(0, (cards.size - 1).coerceAtLeast(0))
    var focus by remember { mutableStateOf<HubFocus>(HubFocus.Poster(posterIndex)) }
    val posterFocus = remember(cards.size) { List(cards.size) { FocusRequester() } }
    val barFocus = remember { TopBarItem.entries.associateWith { FocusRequester() } }
    val memberFocus = remember(strip.size) { List(strip.size) { FocusRequester() } }
    val focusedCard = cards.getOrNull(posterIndex)
    val world = worldOf(GameCatalog.meta(focusedCard?.id)?.world)

    // Gathering → compact after 60 s and 3 members; re-evaluated every second.
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) { while (true) { delay(1_000); now = System.currentTimeMillis() } }
    val ticket = HubModel.ticketState(strip.size, now - launchedAt)

    fun requester(f: HubFocus): FocusRequester? = when (f) {
        is HubFocus.Poster -> posterFocus.getOrNull(if (f.index < 0) posterIndex else f.index)
        is HubFocus.TopBar -> barFocus[f.item]
        is HubFocus.Member -> memberFocus.getOrNull(f.index)
    }

    Box(Modifier.fillMaxSize()) {
        WorldStage(world, tint = HubModel.WORLD_TINT)
        Column(
            Modifier
                .fillMaxSize()
                .onPreviewKeyEvent { e ->
                    if (e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                    val k = e.remoteKey()
                    if (k != RemoteKey.UP && k != RemoteKey.DOWN && k != RemoteKey.LEFT && k != RemoteKey.RIGHT) return@onPreviewKeyEvent false
                    val next = HubModel.move(focus, k, rtl, cards.size, strip.size, topBar) ?: return@onPreviewKeyEvent true
                    val resolved = if (next is HubFocus.Poster && next.index < 0) HubFocus.Poster(posterIndex) else next
                    requester(resolved)?.tryFocus()
                    true
                },
        ) {
            // ---- top bar (y 27–75)
            Row(Modifier.fillMaxWidth().height(48.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                // جماعة is the Arabic primary (web /brand/wordmark-ar.svg); Arabic is the only RTL UI language.
                Wordmark(120.dp, variant = if (rtl) WordmarkVariant.Arabic else WordmarkVariant.Latin)
                Spacer(Modifier.weight(1f))
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
            Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth().weight(1f)) {
                // ---- carousel (x 48–688 compact, 48–640 gathering)
                Column(Modifier.weight(1f).fillMaxHeight()) {
                    Carousel(
                        cards = cards,
                        index = posterIndex,
                        room = room,
                        showPass = showPass,
                        requesters = posterFocus,
                        onFocused = { i ->
                            posterIndex = i
                            focus = HubFocus.Poster(i)
                            actions.onFocusGame(cards[i].id)
                        },
                        onOpen = actions.onOpenGame,
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                        missing = missingGames,
                    )
                    focusedCard?.let { MetaLine(it, strip.size, room) }
                }
                Spacer(Modifier.width(24.dp))
                JoinTicket(room, ticket)
            }
            Spacer(Modifier.height(8.dp))
            // ---- members strip (y 435–513)
            MembersStrip(strip, reactions, memberFocus, onFocused = { focus = HubFocus.Member(it) }, onMember = actions.onMember)
        }
    }
    posterFocus.getOrNull(posterIndex)?.let { InitialFocus(it) }
}

@Composable
private fun Carousel(
    cards: List<GameCard>,
    index: Int,
    room: RoomPublic,
    showPass: Boolean,
    requesters: List<FocusRequester>,
    onFocused: (Int) -> Unit,
    onOpen: (GameCard) -> Unit,
    modifier: Modifier,
    missing: List<String> = emptyList(),
) {
    // The focused poster sits at the start edge + 24 dp; every poster stays composed so focus can reach it.
    val step = HubModel.POSTER_W_DP + HubModel.POSTER_GAP_DP
    val shift by animateDpAsState((-(index * step)).dp, tween(240, easing = JamaaMotion.Standard), label = "carousel")
    val origins = LocalPortalOrigins.current
    val reduce = JamaaTheme.reduceMotion
    // §3.10 A "press": OK dips the focused poster 1.08 → 1.03 while the portal starts (back up if the open is refused).
    var pressed by remember { mutableStateOf<String?>(null) }
    val dip by animateFloatAsState(if (pressed != null && !reduce) 1.03f / 1.08f else 1f, tween(120, easing = JamaaMotion.Standard), label = "press")
    LaunchedEffect(pressed) {
        if (pressed != null) {
            delay(600)
            pressed = null
        }
    }
    Box(modifier.clipToBounds(), contentAlignment = Alignment.CenterStart) {
        Row(Modifier.offset(x = shift + 24.dp), horizontalArrangement = Arrangement.spacedBy(HubModel.POSTER_GAP_DP.dp), verticalAlignment = Alignment.CenterVertically) {
            cards.forEachIndexed { i, card ->
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
            // Never focusable: a game this build cannot render ("Update JAMAA"), then — while the carousel still has
            // room — a closed shop shutter so a single poster does not float alone on the stage (web `tvposter--shutter`).
            for (id in missing) UpdateSlot(id)
            if (cards.size + missing.size < 3) ShutterSlot()
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
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(gameTitle(gameId), style = JamaaTheme.type.title, color = world.accentText, textAlign = TextAlign.Center, maxLines = 2)
        Spacer(Modifier.height(8.dp))
        Text(stringResource(R.string.hub__game_unsupported), style = JamaaTheme.type.caption, color = JamaaColors.TextSecondary, textAlign = TextAlign.Center)
    }
}

/** The room prop in an empty carousel slot: a closed shutter (web `tvposter--shutter`, 210 × 290 at 55 %). */
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

/** "3–12 players · 10–20 min · EN FR AR ES" under the focused poster (crossfades in 120 ms); "Needs 3+" in danger when short. */
@Composable
private fun MetaLine(card: GameCard, present: Int, room: RoomPublic) {
    Crossfade(card to present, animationSpec = tween(120), label = "meta") { (c, n) ->
        val m = HubModel.metaLine(c, n)
        val players = if (m.needs) stringResource(R.string.hub__needs_players, m.minPlayers) else stringResource(R.string.hub__players, m.minPlayers.toString(), m.maxPlayers.toString())
        val minutes = stringResource(R.string.hub__minutes, m.minMinutes.toString(), m.maxMinutes.toString())
        Row(Modifier.padding(start = 24.dp, top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(players, style = JamaaTheme.type.caption, color = if (m.needs) JamaaColors.Danger else JamaaColors.TextSecondary)
            Text("  ·  $minutes  ·  ", style = JamaaTheme.type.caption, color = JamaaColors.TextSecondary)
            // The content languages (web `tvlangchip`): the room's current one filled.
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                for (l in room.contentLocales) {
                    val on = l == room.contentLocale
                    Text(
                        l.uppercase(),
                        style = JamaaTheme.type.caption,
                        color = if (on) JamaaColors.Bg else JamaaColors.TextMuted,
                        maxLines = 1,
                        modifier = Modifier
                            .then(if (on) Modifier.background(JamaaColors.TextSecondary, JamaaShapes.sm) else Modifier.border(1.dp, JamaaColors.Outline, JamaaShapes.sm))
                            .padding(horizontal = 6.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun CupChip(room: RoomPublic, modifier: Modifier, onClick: () -> Unit) {
    val top = HubModel.cupTop(room.cup, room.members)
    BarButton(stringResource(R.string.cup__title), onClick, modifier, icon = JamaaIcons.Trophy, accent = true) {
        Row(horizontalArrangement = Arrangement.spacedBy((-8).dp)) {
            for ((m, _) in top) Character(m.color, 24.dp, app.jamaa.tv.platform.Expression.IDLE)
        }
    }
}

/** The join ticket (never focusable): "Join on your phone", the QR on cream, the code, the short URL. */
@Composable
private fun JoinTicket(room: RoomPublic, state: TicketState) {
    val column by animateDpAsState(HubModel.columnDp(state).dp, tween(400, easing = JamaaMotion.Standard), label = "ticketW")
    val panel = HubModel.panelDp(state).dp
    Column(
        Modifier.width(column).fillMaxHeight().background(JamaaColors.Surface, JamaaShapes.tile).padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(stringResource(R.string.hub__join_on_phone), style = JamaaTheme.type.body, color = JamaaColors.Text, textAlign = TextAlign.Center)
        QrCode(room.joinUrl, panel = panel)
        RoomCode(room.roomCode, Modifier.fillMaxWidth().height(48.dp), centered = true, glow = true)
        Text(ServerUrls.displayHost(room.joinUrl) + "/" + room.roomCode, style = JamaaTheme.type.caption, color = JamaaColors.TextMuted, maxLines = 1)
    }
}

/**
 * Members as 48 dp characters with names (≤ 8 / ≤ 6 graphemes), the VIP crown, the reaction burst; OK → Kick / Cancel.
 * Live join (§2.1): a newcomer drops in (−0.5 body, then `spring.bouncy`) and keeps a glow ring until the next join
 * (the "… is with us!" toast is AppRoot's, above the strip). Empty: three dashed ghost outlines and "Waiting for the gang…".
 */
@Composable
private fun MembersStrip(
    members: List<MemberPublic>,
    reactions: ReactionTracker,
    requesters: List<FocusRequester>,
    onFocused: (Int) -> Unit,
    onMember: (MemberPublic) -> Unit,
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
    Row(Modifier.fillMaxWidth().height(78.dp), horizontalArrangement = Arrangement.spacedBy(0.dp), verticalAlignment = Alignment.CenterVertically) {
        if (members.isEmpty()) {
            Row(Modifier.padding(start = 14.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                repeat(3) { GhostCircle() }
                Text(stringResource(R.string.hub__waiting_gang), style = JamaaTheme.type.body, color = JamaaColors.TextMuted)
            }
        }
        val max = HubModel.captionGraphemes(members.size)
        members.forEachIndexed { i, m ->
            val isNew = m.id == (arrived.lastOrNull() ?: newest)
            val drop = remember(m.id) { Animatable(if (m.id in arrived && !reduce) -24f else 0f) }
            LaunchedEffect(m.id) { if (drop.value != 0f) drop.animateTo(0f, spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMediumLow)) }
            JamaaFocusSurface(
                onClick = { onMember(m) },
                modifier = Modifier.width(72.dp).focusRequester(requesters[i]).onFocusChanged { if (it.isFocused) onFocused(i) },
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
                    Text(Names.ellipsize(m.name, max), style = JamaaTheme.type.caption, color = JamaaColors.TextSecondary, maxLines = 1)
                }
            }
        }
    }
}

/** A dashed 44 dp ghost outline (cream at 20 %), a seat waiting for someone. */
@Composable
private fun GhostCircle() {
    Canvas(Modifier.size(44.dp)) {
        val w = 2.dp.toPx()
        drawCircle(
            Color(0xFFFFF7EC).copy(alpha = 0.2f),
            radius = size.minDimension / 2f - w / 2f,
            style = Stroke(width = w, pathEffect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 4.dp.toPx()))),
        )
    }
}

/** A game's title in the UI language (posters, setup title, rules header). */
@Composable
fun gameTitle(gameId: String): String = GameCatalog.meta(gameId)?.let { keyText(it.titleKey) } ?: gameId

/** The language name of a content locale ("Not available in Arabic yet"). */
@Composable
fun languageName(locale: String): String = stringResource(langNameRes(locale))
