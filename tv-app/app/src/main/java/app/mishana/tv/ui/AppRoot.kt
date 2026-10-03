package app.mishana.tv.ui

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.EnterExitState
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.mishana.tv.ui.components.fullBleed
import app.mishana.tv.BuildConfig
import app.mishana.tv.R
import app.mishana.tv.game.GameViewModel
import app.mishana.tv.game.TvEvent
import app.mishana.tv.game.TvUiState
import app.mishana.tv.i18n.isolate
import app.mishana.tv.i18n.messageKeyRes
import app.mishana.tv.net.ConnState
import app.mishana.tv.protocol.BackToLobby
import app.mishana.tv.protocol.GuessStatus
import app.mishana.tv.protocol.HistoryCause
import app.mishana.tv.protocol.HostAdvance
import app.mishana.tv.protocol.Kick
import app.mishana.tv.protocol.Phase
import app.mishana.tv.protocol.PlayAgain
import app.mishana.tv.protocol.TvView
import app.mishana.tv.settings.DebugPrefs
import app.mishana.tv.ui.components.ButtonKind
import app.mishana.tv.ui.components.CenterStage
import app.mishana.tv.ui.components.FocusTrap
import app.mishana.tv.ui.components.InitialFocus
import app.mishana.tv.ui.components.LocalFocusBlocked
import app.mishana.tv.ui.components.MishBackground
import app.mishana.tv.ui.components.MishButton
import app.mishana.tv.ui.components.MishIcons
import app.mishana.tv.ui.components.PauseMenu
import app.mishana.tv.ui.components.StatusBanner
import app.mishana.tv.ui.components.ToastHost
import app.mishana.tv.ui.components.ToastState
import app.mishana.tv.ui.components.TopBar
import app.mishana.tv.ui.screens.BlankGuessScreen
import app.mishana.tv.ui.screens.CluesScreen
import app.mishana.tv.ui.screens.DebugSettingsScreen
import app.mishana.tv.ui.screens.EliminationScreen
import app.mishana.tv.ui.screens.FatalScreen
import app.mishana.tv.ui.screens.HomeScreen
import app.mishana.tv.ui.screens.HomeStatus
import app.mishana.tv.ui.screens.LobbyScreen
import app.mishana.tv.ui.screens.ResultsScreen
import app.mishana.tv.ui.screens.RoleRevealScreen
import app.mishana.tv.ui.screens.SettingsCategory
import app.mishana.tv.ui.screens.SettingsScreen
import app.mishana.tv.ui.screens.VotingScreen
import app.mishana.tv.ui.screens.roleLabelRes
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishMotion
import app.mishana.tv.ui.theme.MishSpace
import app.mishana.tv.ui.theme.MishTheme
import kotlinx.coroutines.delay

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

/** Which full screen is showing; CLUES and TIE_BREAK share one screen (the tie is an overlay). */
private enum class ScreenKey { Loading, Lobby, Settings, RoleReveal, Clues, Voting, Elimination, Guess, Results }

private data class Frame(val key: ScreenKey, val view: TvView?)

private fun screenKeyFor(view: TvView?, settingsOpen: Boolean): ScreenKey = when (view?.phase) {
    null -> ScreenKey.Loading
    Phase.LOBBY -> if (settingsOpen) ScreenKey.Settings else ScreenKey.Lobby
    Phase.ROLE_REVEAL -> ScreenKey.RoleReveal
    Phase.CLUES, Phase.TIE_BREAK -> ScreenKey.Clues
    Phase.VOTING -> ScreenKey.Voting
    Phase.ELIMINATION -> ScreenKey.Elimination
    Phase.MR_WHITE_GUESS -> ScreenKey.Guess
    Phase.RESULTS -> ScreenKey.Results
}

/** Phase → screen switch, the pause overlay, Back handling, connection states and toasts (SPEC §9.3, DESIGN §7). */
@Composable
fun AppRoot(vm: GameViewModel) {
    val ui by vm.ui.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val toasts = remember { ToastState() }
    var debugOpen by remember { mutableStateOf(false) }

    LaunchedEffect(vm) {
        vm.events.collect { e ->
            when (e) {
                is TvEvent.NewCode -> toasts.show(context.getString(R.string.tv__new_code, e.code), MishColors.Accent)
                is TvEvent.ServerError -> toasts.show(context.getString(messageKeyRes(e.error.messageKey)), MishColors.Danger)
            }
        }
    }

    val s = ui
    val gv = (s as? TvUiState.InRoom)?.view
    val guessStatus = gv?.guess?.status
    val darkRoom = gv != null && gv.phase == Phase.MR_WHITE_GUESS &&
        (guessStatus == GuessStatus.PENDING || guessStatus == GuessStatus.CORRECT)
    val base by animateColorAsState(if (darkRoom) MishColors.BgDark else MishColors.Bg, tween(600), label = "roomLight")

    MishBackground(base = base, pattern = s !is TvUiState.InRoom) {
        Box(Modifier.fillMaxSize().padding(horizontal = MishSpace.SafeH, vertical = MishSpace.SafeV)) {
            when (s) {
                TvUiState.CreatingRoom -> HomeScreen(HomeStatus.Busy(R.string.tv__creating_room), vm::createRoom) { debugOpen = true }
                is TvUiState.CreateFailed -> HomeScreen(HomeStatus.Failed(s.messageKey), vm::createRoom) { debugOpen = true }
                is TvUiState.InRoom -> RoomRoot(s, vm, toasts) { debugOpen = true }
                is TvUiState.Fatal -> FatalScreen(s.messageKey, vm::createRoom)
            }
            // The Lobby draws its own toast zone (never over the code or QR); everywhere else: bottom start.
            if (toasts.screenHosts == 0) ToastHost(toasts, Modifier.align(Alignment.BottomStart).padding(bottom = 64.dp))
        }
        if (debugOpen && BuildConfig.DEBUG) {
            val prefs = remember { DebugPrefs(context) }
            DebugSettingsScreen(prefs, onClose = { debugOpen = false }, onSaved = {
                debugOpen = false
                vm.createRoom()
            })
        }
    }
}

@Composable
private fun RoomRoot(s: TvUiState.InRoom, vm: GameViewModel, toasts: ToastState, onOpenDebug: () -> Unit) {
    val context = LocalContext.current
    val view = s.view
    val attempt by vm.reconnectAttempt.collectAsStateWithLifecycle()
    var settingsOpen by remember { mutableStateOf(false) }
    var settingsCategory by remember { mutableStateOf(SettingsCategory.Game) }
    var settingsAfterPlayAgain by remember { mutableStateOf(false) }
    val reduce = MishTheme.reduceMotion
    val rise = with(LocalDensity.current) { 24.dp.roundToPx() }

    // Settings is reachable only in the lobby; leaving the lobby closes it.
    LaunchedEffect(view?.phase) {
        if (view?.phase != Phase.LOBBY) settingsOpen = false
        if (view?.phase == Phase.LOBBY && settingsAfterPlayAgain) {
            settingsAfterPlayAgain = false
            settingsCategory = SettingsCategory.Game
            settingsOpen = true
        }
        if (view?.phase == Phase.LOBBY && s.paused) vm.setPaused(false)
    }

    // ---- connection state timers (TV-13a/b/f) ----
    val degraded = s.conn != ConnState.OPEN
    var offlineSince by remember { mutableLongStateOf(0L) }
    var offlineLong by remember { mutableStateOf(false) }
    LaunchedEffect(degraded) {
        offlineLong = false
        if (degraded) {
            offlineSince = System.currentTimeMillis()
            delay(30_000)
            offlineLong = true
        }
    }
    val inGame = view != null && view.phase != Phase.LOBBY && view.phase != Phase.RESULTS
    val phonesAsleepNow = inGame && view.players.none { it.connected && !it.left }
    var phonesAsleep by remember { mutableStateOf(false) }
    LaunchedEffect(phonesAsleepNow) {
        phonesAsleep = false
        if (phonesAsleepNow) {
            delay(60_000)
            phonesAsleep = true
        }
    }

    // ---- informational toasts (server errors arrive as one-shot TvEvent.ServerError, collected in AppRoot) ----
    ForfeitAndAwayToasts(view, toasts)

    // ---- Back (TV-DB): Lobby is root → exit; in a game / on Results → pause menu ----
    val activity = context.findActivity()
    BackHandler(enabled = view != null && !settingsOpen && !s.paused) {
        if (view?.phase == Phase.LOBBY) activity?.finish() else vm.setPaused(true)
    }

    val key = screenKeyFor(view, settingsOpen)
    val overlayOpen = s.paused || (offlineLong && view != null)
    Box(Modifier.fillMaxSize()) {
    CompositionLocalProvider(LocalFocusBlocked provides overlayOpen) {
        Column(Modifier.fillMaxSize()) {
            val showTopBar = view != null && key != ScreenKey.Lobby && key != ScreenKey.Settings && key != ScreenKey.Results && key != ScreenKey.Loading
            if (showTopBar) {
                TopBar(view, degraded)
                Spacer(Modifier.height(12.dp))
            }
            AnimatedContent(
                targetState = Frame(key, view),
                contentKey = { it.key },
                transitionSpec = {
                    if (reduce) {
                        fadeIn(tween(MishMotion.Fast)) togetherWith fadeOut(tween(MishMotion.Fast))
                    } else {
                        (fadeIn(tween(MishMotion.Slow, easing = MishMotion.Decel)) + slideInVertically(tween(MishMotion.Slow, easing = MishMotion.Decel)) { rise }) togetherWith
                            (fadeOut(tween(MishMotion.Base, easing = MishMotion.Accel)) + scaleOut(tween(MishMotion.Base, easing = MishMotion.Accel), targetScale = 0.98f))
                    }
                },
                modifier = Modifier.weight(1f),
                label = "phase",
            ) { frame ->
                val leaving = transition.targetState != EnterExitState.Visible
                CompositionLocalProvider(LocalFocusBlocked provides (overlayOpen || leaving)) {
                    Box(Modifier.fillMaxSize()) {
                        val v = frame.view
                        val send: (app.mishana.tv.protocol.ClientIntent) -> Unit = vm::send
                        when {
                            v == null -> HomeScreen(HomeStatus.Busy(R.string.conn__connecting), vm::createRoom, onOpenDebug)
                            frame.key == ScreenKey.Lobby -> LobbyScreen(v, send, { c -> settingsCategory = c; settingsOpen = true }, toasts)
                            frame.key == ScreenKey.Settings -> SettingsScreen(v, send, { settingsOpen = false }, settingsCategory, toasts)
                            frame.key == ScreenKey.RoleReveal -> RoleRevealScreen(v, s.clockOffsetMs, send)
                            frame.key == ScreenKey.Clues -> CluesScreen(v, s.clockOffsetMs, s.paused, send, toasts)
                            frame.key == ScreenKey.Voting -> VotingScreen(v, s.clockOffsetMs, send)
                            frame.key == ScreenKey.Elimination -> EliminationScreen(v, s.clockOffsetMs, s.paused, send)
                            frame.key == ScreenKey.Guess -> BlankGuessScreen(v, s.clockOffsetMs, send)
                            frame.key == ScreenKey.Results -> ResultsScreen(
                                v,
                                send,
                                onChangeSettings = {
                                    settingsAfterPlayAgain = true
                                    vm.send(PlayAgain)
                                },
                                onNewRoom = vm::createRoom,
                            )
                        }
                    }
                }
            }
        }

        // TV-13a: the stage stays visible but frozen under a 40 % scrim, with a top banner and an attempt counter.
        if (degraded && view != null && !offlineLong) {
            Box(Modifier.fillMaxSize().fullBleed().background(MishColors.Bg.copy(alpha = 0.4f)))
            StatusBanner(
                stringResource(R.string.conn__tv_reconnecting),
                Modifier.align(Alignment.TopCenter),
                spinner = true,
                trailing = if (attempt > 0) "#$attempt" else null,
            )
        }
        // TV-13f
        AnimatedVisibility(phonesAsleep && !degraded, Modifier.align(Alignment.TopCenter), enter = fadeIn(), exit = fadeOut()) {
            StatusBanner(stringResource(R.string.conn__phones_asleep), icon = MishIcons.Phone)
        }
    }
    }

    // TV-13b: still offline after 30 s.
    if (offlineLong && view != null && degraded && !s.paused) {
        ConnectionLost(
            onRetry = vm::retryConnectionNow,
            onBack = { if (view.phase == Phase.LOBBY) activity?.finish() else vm.setPaused(true) },
        )
    }

    // TV-12 pause menu.
    if (s.paused && view != null) {
        PauseMenu(
            players = view.players,
            canSkip = view.phase != Phase.RESULTS && view.phase != Phase.LOBBY,
            onResume = { vm.setPaused(false) },
            onSkip = { vm.send(HostAdvance) },
            onKick = { p -> vm.send(Kick(p.id)) },
            onEndGame = { vm.send(BackToLobby) },
            onExit = { activity?.finish() },
        )
    }
}

/** TV-13b full screen: wifi-off, `conn.lost`, `conn.tvLostBody`, (• Try again). Auto-retry continues underneath. */
@Composable
private fun ConnectionLost(onRetry: () -> Unit, onBack: () -> Unit) {
    val retry = remember { FocusRequester() }
    Box(Modifier.fillMaxSize().fullBleed().background(MishColors.Bg.copy(alpha = 0.96f))) {
        FocusTrap(onBack = onBack) {
        CenterStage {
            Icon(MishIcons.WifiOff, contentDescription = null, tint = MishColors.Danger, modifier = Modifier.size(96.dp))
            Spacer(Modifier.height(20.dp))
            Text(stringResource(R.string.conn__lost), style = MishTheme.type.displayS, color = MishColors.Text, textAlign = TextAlign.Center)
            Spacer(Modifier.height(8.dp))
            Text(stringResource(R.string.conn__tv_lost_body), style = MishTheme.type.body, color = MishColors.TextSecondary, textAlign = TextAlign.Center)
            Spacer(Modifier.height(28.dp))
            MishButton(stringResource(R.string.common__retry), onRetry, Modifier.focusRequester(retry), kind = ButtonKind.Primary, icon = MishIcons.Refresh, minWidth = 220.dp)
        }
        }
    }
    InitialFocus(retry)
}

/** `elim.forfeit` for in-game LEAVE/KICK (role revealed) and `conn.playerAway` when someone drops mid-game (TV-13c). */
@Composable
private fun ForfeitAndAwayToasts(view: TvView?, toasts: ToastState) {
    val context = LocalContext.current
    val prev = remember { mutableStateOf<TvView?>(null) }
    LaunchedEffect(view) {
        val before = prev.value
        prev.value = view
        if (view == null || before == null || before.gameNumber != view.gameNumber) return@LaunchedEffect
        if (view.history.size > before.history.size) {
            for (h in view.history.drop(before.history.size)) {
                if (h.cause != HistoryCause.LEAVE && h.cause != HistoryCause.KICK) continue
                val p = view.players.firstOrNull { it.id == h.eliminatedId } ?: continue
                val role = h.role?.let { context.getString(roleLabelRes(it)) } ?: continue
                toasts.show(context.getString(R.string.elim__forfeit, isolate(p.name), role), MishColors.Undercover)
            }
        }
        if (view.phase != Phase.LOBBY) {
            for (p in view.players) {
                val old = before.players.firstOrNull { it.id == p.id } ?: continue
                if (old.connected && !p.connected && !p.left) {
                    toasts.show(context.getString(R.string.conn__player_away, isolate(p.name)), MishColors.Danger)
                }
            }
        }
    }
}
