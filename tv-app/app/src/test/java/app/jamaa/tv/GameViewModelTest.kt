package app.jamaa.tv

import android.app.Application
import app.cash.turbine.test
import app.jamaa.tv.game.Cue
import app.jamaa.tv.game.CuePlay
import app.jamaa.tv.game.GameDeps
import app.jamaa.tv.game.SoundSink
import app.jamaa.tv.game.GameViewModel
import app.jamaa.tv.game.TvEvent
import app.jamaa.tv.game.TvUiState
import app.jamaa.tv.game.ViewEvent
import app.jamaa.tv.games.GameCatalog
import app.jamaa.tv.games.UnsupportedGameView
import app.jamaa.tv.games.mishana.MishanaGameView
import app.jamaa.tv.games.mishana.MishanaTv
import app.jamaa.tv.net.ConnState
import app.jamaa.tv.net.RoomConnection
import app.jamaa.tv.platform.GateDecision
import app.jamaa.tv.platform.Overlay
import app.jamaa.tv.platform.RemoteKey
import app.jamaa.tv.platform.RulesContext
import app.jamaa.tv.platform.RulesOrigin
import app.jamaa.tv.platform.SetupRows
import app.jamaa.tv.protocol.AbortGame
import app.jamaa.tv.protocol.ActionMsg
import app.jamaa.tv.protocol.ClientIntent
import app.jamaa.tv.protocol.ClientMessage
import app.jamaa.tv.protocol.CreateRoomResponse
import app.jamaa.tv.protocol.ErrorMsg
import app.jamaa.tv.protocol.HubFocus
import app.jamaa.tv.protocol.OpenGame
import app.jamaa.tv.protocol.Replay
import app.jamaa.tv.protocol.RoomView
import app.jamaa.tv.protocol.ServerMessage
import app.jamaa.tv.protocol.SetContentLocale
import app.jamaa.tv.protocol.SettingsPatch
import app.jamaa.tv.protocol.StartGame
import app.jamaa.tv.protocol.StateMsg
import app.jamaa.tv.protocol.UpdateGameSettings
import app.jamaa.tv.settings.MemoryPlatformPrefs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class GameViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    private class FakeConnection : RoomConnection {
        override val state = MutableStateFlow<ConnState>(ConnState.CONNECTING)
        override val incoming = MutableSharedFlow<ServerMessage>(extraBufferCapacity = 64)
        override val attempt = MutableStateFlow(0)
        val sent = mutableListOf<ClientMessage>()
        var connectedWith: Pair<String, String>? = null
        var disconnected = false
        override fun connect(code: String, tvToken: String) {
            connectedWith = code to tvToken
        }
        override fun send(msg: ClientMessage): Boolean {
            sent += msg
            return true
        }
        override fun retryNow() = Unit
        override fun disconnect() {
            disconnected = true
        }
    }

    private val connections = mutableListOf<FakeConnection>()
    private val createCalls = mutableListOf<Pair<String, String>>()
    private val codes = ArrayDeque(listOf("KXRT", "WXYZ", "ABCD"))

    private var now = 1_790_000_000_000L
    private val prefs = MemoryPlatformPrefs()
    private val played = mutableListOf<CuePlay>()
    private var savedMuted: Boolean? = null
    private val sink = object : SoundSink {
        override fun play(p: CuePlay) { played += p }
        override fun stopAll() = Unit
        override fun release() = Unit
    }

    private fun deps() = GameDeps(
        serverUrl = { "https://play.example.workers.dev" },
        appLocale = { "fr" },
        createRoom = { url, locale, _ ->
            createCalls += url to locale
            val code = codes.removeFirst()
            CreateRoomResponse(code, "0123456789abcdef0123456789abcdef", "https://play.example.workers.dev/$code", "/parties/room/$code")
        },
        newConnection = { _, _ -> FakeConnection().also { connections += it } },
        clock = { now },
        sound = sink,
        loadMuted = { false },
        saveMuted = { savedMuted = it },
        prefs = prefs,
    )

    @Before fun setUp() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun TestScope.newVm(): GameViewModel {
        val vm = GameViewModel(Application(), deps())
        advanceUntilIdle()
        return vm
    }

    @Test
    fun createLeadsToInRoom() = runTest(dispatcher) {
        val vm = newVm()
        val s = vm.ui.value
        assertTrue(s is TvUiState.InRoom)
        s as TvUiState.InRoom
        assertEquals("KXRT", s.code)
        assertEquals("https://play.example.workers.dev/KXRT", s.joinUrl)
        assertEquals(listOf("https://play.example.workers.dev" to "fr"), createCalls)
        assertEquals("KXRT" to "0123456789abcdef0123456789abcdef", connections.single().connectedWith)
    }

    private fun open(vm: GameViewModel): FakeConnection {
        val conn = connections.last()
        conn.state.value = ConnState.OPEN
        return conn
    }

    private val hub = TvFixtures.room("hub")
    private val setup = TvFixtures.room("setup.mishana")
    private val voting = TvFixtures.room("playing.mishana.voting")
    private val results = TvFixtures.room("playing.mishana.results")

    private fun RoomView.members(n: Int) = copy(room = room.copy(members = room.members.take(n)))
    private fun RoomView.locale(l: String) = copy(room = room.copy(contentLocale = l))

    private suspend fun TestScope.emit(conn: FakeConnection, v: RoomView, seq: Long) {
        conn.incoming.emit(StateMsg(seq = seq, serverNow = now, view = v))
        advanceUntilIdle()
    }

    private fun intents(conn: FakeConnection) = conn.sent.filterIsInstance<ActionMsg>().map { it.a }

    @Test
    fun broadcastsPlayTheirCuesUnlessMuted() = runTest(dispatcher) {
        val vm = newVm()
        val conn = open(vm)
        emit(conn, hub.members(3), 1)
        assertTrue(played.isEmpty()) // the first view is silent
        emit(conn, hub, 2)
        assertEquals(listOf(Cue.JOIN), played.map { it.cue })
        vm.setSoundMuted(true)
        assertEquals(true, savedMuted)
        assertTrue(vm.soundMuted.value)
        emit(conn, hub.members(3), 3)
        assertEquals(1, played.size)
    }

    @Test
    fun dropsOnlyOlderSeqAndTracksClockOffset() = runTest(dispatcher) {
        val vm = newVm()
        val conn = connections.single()
        conn.state.value = ConnState.OPEN
        advanceUntilIdle()
        vm.ui.test {
            assertEquals(ConnState.OPEN, (awaitItem() as TvUiState.InRoom).conn)
            conn.incoming.emit(StateMsg(seq = 5, serverNow = 1_790_000_002_000L, view = hub.locale("fr")))
            val a = awaitItem() as TvUiState.InRoom
            assertEquals("fr", a.view!!.room.contentLocale)
            assertEquals(2_000L, a.clockOffsetMs)
            conn.incoming.emit(StateMsg(seq = 4, serverNow = 1_790_000_003_000L, view = hub.locale("ar"))) // stale
            // Equal seq: a meta-only broadcast (premium / tvBusy / hub focus) reuses the version; frames on one socket
            // arrive in order, so it is applied (PAYMENTS-SPEC §3.11 broadcasts).
            conn.incoming.emit(StateMsg(seq = 5, serverNow = 1_790_000_002_000L, view = hub.locale("es")))
            assertEquals("es", (awaitItem() as TvUiState.InRoom).view!!.room.contentLocale)
            conn.incoming.emit(StateMsg(seq = 6, serverNow = 1_790_000_001_000L, view = hub.locale("en")))
            val b = awaitItem() as TvUiState.InRoom
            assertEquals("en", b.view!!.room.contentLocale)
            assertEquals(2_000L, b.clockOffsetMs) // largest of the samples
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun sendWrapsInActionMsgOnlyWhenOpen() = runTest(dispatcher) {
        val vm = newVm()
        val conn = connections.single()
        vm.send(StartGame)
        assertTrue(conn.sent.isEmpty())
        conn.state.value = ConnState.OPEN
        advanceUntilIdle()
        vm.send(StartGame)
        vm.send(StartGame)
        assertEquals(listOf(ActionMsg(id = "1", a = StartGame), ActionMsg(id = "2", a = StartGame)), conn.sent)
    }

    @Test
    fun theActiveGameIsDecodedByItsPackage() = runTest(dispatcher) {
        val vm = newVm()
        val conn = open(vm)
        emit(conn, voting, 1)
        val s = vm.ui.value as TvUiState.InRoom
        assertTrue(s.game is MishanaGameView)
        assertEquals("نور", (s.game as MishanaGameView).view.players[2].name)
        // An envelope this build cannot draw: the update card, never a crash.
        emit(conn, voting.copy(game = voting.game!!.copy(gameId = "karaoke")), 2)
        assertTrue((vm.ui.value as TvUiState.InRoom).game is UnsupportedGameView)
        emit(conn, hub, 3)
        assertNull((vm.ui.value as TvUiState.InRoom).game)
    }

    @Test
    fun roomExpiredInAnEmptyHubRecreatesTheRoom() = runTest(dispatcher) {
        val vm = newVm()
        vm.events.test {
            val first = open(vm)
            advanceUntilIdle()
            emit(first, TvFixtures.room("hub.empty"), 1)
            first.state.value = ConnState.CLOSED_FATAL(4010)
            advanceUntilIdle()
            assertEquals(TvEvent.NewCode("WXYZ"), awaitItem())
            cancelAndIgnoreRemainingEvents()
        }
        assertEquals(2, createCalls.size)
        assertEquals(2, connections.size)
        assertTrue(connections[0].disconnected)
        assertEquals("WXYZ", (vm.ui.value as TvUiState.InRoom).code)
    }

    /** TV-13e (SPEC §7.5): a lost room between games (HUB, SETUP, a finished game; 4010 or 4004) is re-created silently. */
    private suspend fun TestScope.assertSilentRecreate(view: RoomView, code: Int, errorCode: String) {
        val vm = newVm()
        vm.events.test {
            val first = open(vm)
            advanceUntilIdle()
            emit(first, view, 1)
            first.incoming.emit(ErrorMsg(code = errorCode, messageKey = "error.x", ref = null))
            advanceUntilIdle()
            first.state.value = ConnState.CLOSED_FATAL(code)
            advanceUntilIdle()
            val events = cancelAndConsumeRemainingEvents().mapNotNull { (it as? app.cash.turbine.Event.Item)?.value }
            assertTrue("no error toast before the new code: $events", events.none { it is TvEvent.ServerError })
            assertEquals(TvEvent.NewCode("WXYZ"), events.last())
        }
        assertEquals(2, createCalls.size)
        assertTrue(connections[0].disconnected)
        assertEquals("WXYZ", (vm.ui.value as TvUiState.InRoom).code)
    }

    @Test
    fun roomExpiredInASetupWithPlayersRecreatesTheRoom() = runTest(dispatcher) {
        assertSilentRecreate(setup, 4010, "ROOM_EXPIRED")
    }

    @Test
    fun roomExpiredOnResultsRecreatesTheRoom() = runTest(dispatcher) {
        assertSilentRecreate(results, 4010, "ROOM_EXPIRED")
    }

    @Test
    fun roomNotFoundInTheHubRecreatesTheRoom() = runTest(dispatcher) {
        assertSilentRecreate(hub, 4004, "ROOM_NOT_FOUND")
    }

    @Test
    fun roomNotFoundMidGameIsFatal() = runTest(dispatcher) {
        val vm = newVm()
        val conn = open(vm)
        advanceUntilIdle()
        emit(conn, voting, 1)
        conn.state.value = ConnState.CLOSED_FATAL(4004)
        advanceUntilIdle()
        assertEquals(TvUiState.Fatal("error.roomNotFound"), vm.ui.value)
        assertEquals(1, createCalls.size)
    }

    @Test
    fun recreatesRoomOnlyBetweenGames() {
        assertTrue(GameViewModel.recreatesRoom(null))
        assertTrue(GameViewModel.recreatesRoom(hub))
        assertTrue(GameViewModel.recreatesRoom(setup))
        assertTrue(GameViewModel.recreatesRoom(results)) // over = true
        assertFalse(GameViewModel.recreatesRoom(voting))
    }

    @Test
    fun repeatedIdenticalServerErrorsAreEachEmittedOnce() = runTest(dispatcher) {
        val vm = newVm()
        vm.events.test {
            val conn = open(vm)
            advanceUntilIdle()
            val err = ErrorMsg(code = "WRONG_PHASE", messageKey = "error.wrongPhase", ref = null)
            conn.incoming.emit(err)
            advanceUntilIdle()
            conn.incoming.emit(err.copy())
            advanceUntilIdle()
            assertEquals(err, (awaitItem() as TvEvent.ServerError).error)
            assertEquals(err, (awaitItem() as TvEvent.ServerError).error)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun roomExpiredMidGameIsFatal() = runTest(dispatcher) {
        val vm = newVm()
        val conn = open(vm)
        advanceUntilIdle()
        conn.incoming.emit(StateMsg(seq = 1, serverNow = 1L, view = TvFixtures.room("playing.mishana.clues")))
        conn.incoming.emit(ErrorMsg(code = "ROOM_EXPIRED", messageKey = "error.roomExpired", ref = null))
        advanceUntilIdle()
        conn.state.value = ConnState.CLOSED_FATAL(4010)
        advanceUntilIdle()
        assertEquals(TvUiState.Fatal("error.roomExpired"), vm.ui.value)
        assertEquals(1, createCalls.size)
    }

    @Test
    fun replacedIsFatal() = runTest(dispatcher) {
        val vm = newVm()
        val conn = connections.single()
        conn.state.value = ConnState.CLOSED_FATAL(4005)
        advanceUntilIdle()
        assertEquals(TvUiState.Fatal("error.replaced"), vm.ui.value)
    }

    @Test
    fun createFailureShowsTheServerError() = runTest(dispatcher) {
        val failing = GameDeps(
            serverUrl = { "http://x" },
            appLocale = { "en" },
            createRoom = { _, _, _ -> throw app.jamaa.tv.net.CreateRoomException(429, "RATE_LIMITED") },
            newConnection = { _, _ -> FakeConnection() },
        )
        val vm = GameViewModel(Application(), failing)
        advanceUntilIdle()
        assertEquals(TvUiState.CreateFailed("error.rateLimited"), vm.ui.value)
    }

    @Test
    fun mishanaSettingsChangesAreDebouncedIntoOnePatchAndTheLanguageIsARoomSetting() = runTest(dispatcher) {
        val vm = newVm()
        val conn = open(vm)
        advanceUntilIdle()
        emit(conn, setup, 1)
        vm.changeSettings(SettingsPatch(clueSeconds = 60))
        advanceTimeBy(100)
        vm.changeSettings(SettingsPatch(voteSeconds = 120, wordLocale = "fr"))
        assertEquals(60, vm.settingsDraft.value?.clueSeconds) // shown at once
        advanceTimeBy(GameViewModel.SETTINGS_DEBOUNCE_MS + 1)
        assertEquals(
            listOf(
                SetContentLocale("fr"),
                UpdateGameSettings("mishana", JsonObject(mapOf("clueSeconds" to JsonPrimitive(60), "voteSeconds" to JsonPrimitive(120)))),
            ),
            intents(conn),
        )
        advanceTimeBy(GameViewModel.SETTINGS_FALLBACK_MS + 1) // never echoed: back to the server values
        assertEquals(null, vm.settingsDraft.value)
    }

    @Test
    fun setupRowStepsGoThroughTheDraft() = runTest(dispatcher) {
        val vm = newVm()
        val conn = open(vm)
        advanceUntilIdle()
        emit(conn, setup, 1)
        vm.stepSetting("timers", +1) // normal → fast
        assertEquals("fast", SetupRows.timerPreset(vm.effectiveSetup()!!.settings))
        advanceTimeBy(GameViewModel.SETTINGS_DEBOUNCE_MS + 1)
        val sent = intents(conn).single() as UpdateGameSettings
        assertEquals("mishana", sent.gameId)
        assertEquals(setOf("clueSeconds", "voteSeconds", "revealSeconds", "guessSeconds"), sent.patch.keys)
    }

    @Test
    fun viewDiffsAreEmittedAsEvents() = runTest(dispatcher) {
        val vm = newVm()
        vm.events.test {
            val conn = open(vm)
            advanceUntilIdle()
            emit(conn, hub.members(0), 1)
            emit(conn, hub.members(1), 2)
            assertEquals(TvEvent.Game(ViewEvent.PlayerJoined("Rami")), awaitItem())
            // The VIP (Rami) changes a Mish Ana! setting on the phone: toast + row flash.
            emit(conn, setup, 3)
            awaitItem() // Léa, نور, Sam join
            awaitItem()
            awaitItem()
            val s = setup.room.setup!!
            val changed = setup.copy(room = setup.room.copy(setup = s.copy(settings = JsonObject(s.settings + ("clueSeconds" to JsonPrimitive(60))))))
            emit(conn, changed, 4)
            assertEquals(TvEvent.SettingsChanged(setOf("timers.clueSeconds"), "Rami"), awaitItem())
            cancelAndIgnoreRemainingEvents()
        }
    }

    // ---------------------------------------------------------------- JAMAA-PLATFORM §2.5 / §3 (TV acceptance item 6)

    @Test
    fun hubFocusIsDebouncedToOneMessagePerRest() = runTest(dispatcher) {
        val vm = newVm()
        val conn = open(vm)
        advanceUntilIdle()
        val cards = hub.copy(room = hub.room.copy(games = hub.room.games + hub.room.games[0].copy(id = "bluff")))
        emit(conn, cards, 1)
        vm.focusGame("bluff")
        advanceTimeBy(100)
        vm.focusGame("mishana")
        advanceTimeBy(100)
        vm.focusGame("bluff")
        assertEquals("bluff", vm.focusedGameId.value) // local focus is instant
        assertTrue(intents(conn).isEmpty())
        advanceTimeBy(Constants.HUB_FOCUS_DEBOUNCE_MS + 1)
        assertEquals(listOf(HubFocus("bluff")), intents(conn))
        // Resting back on the server's focus sends nothing; outside the hub nothing is sent.
        vm.focusGame("mishana")
        advanceTimeBy(Constants.HUB_FOCUS_DEBOUNCE_MS + 1)
        assertEquals(listOf<ClientIntent>(HubFocus("bluff"), HubFocus("mishana")), intents(conn))
        emit(conn, setup, 2)
        vm.focusGame("bluff")
        advanceTimeBy(Constants.HUB_FOCUS_DEBOUNCE_MS + 1)
        assertEquals(2, intents(conn).size)
    }

    /** §3.10 E test: OK pressed 3 times within 300 ms on a poster ends on HUB-03, never on PLAYING. */
    @Test
    fun okMashedOnAPosterLandsOnSetupNeverStartsTheGame() = runTest(dispatcher) {
        val vm = newVm()
        val conn = open(vm)
        advanceUntilIdle()
        emit(conn, hub, 1)
        // OK #1 opens the game and starts the portal.
        assertEquals(GateDecision.PASS, vm.gateKey(RemoteKey.OK))
        vm.openGame("mishana")
        assertEquals("portal", vm.moment.value!!.moment.id) // first open this session: 1 100 ms
        now += 100
        assertEquals(GateDecision.COMPLETE, vm.gateKey(RemoteKey.OK)) // OK #2 only completes the portal
        assertTrue(vm.moment.value!!.completed)
        now += 100
        assertEquals(GateDecision.CONSUME, vm.gateKey(RemoteKey.OK)) // OK #3 falls in the input guard
        emit(conn, setup, 2) // the server confirms SETUP: the running portal is kept, not restarted
        assertEquals(listOf<ClientIntent>(OpenGame("mishana")), intents(conn))
        vm.momentEnded(vm.moment.value!!.seq)
        assertNull(vm.moment.value)
        // D-pad is ignored during the guard too; afterwards OK reaches Start.
        assertEquals(GateDecision.CONSUME, vm.gateKey(RemoteKey.DOWN))
        now += Constants.INPUT_GUARD_MS
        assertEquals(GateDecision.PASS, vm.gateKey(RemoteKey.OK))
    }

    @Test
    fun okMashedThroughTheResultsNeverReplays() = runTest(dispatcher) {
        val vm = newVm()
        val conn = open(vm)
        advanceUntilIdle()
        emit(conn, voting, 1)
        vm.momentEnded(vm.moment.value!!.seq) // the entrance ended
        now += 1_000
        emit(conn, results.copy(room = voting.room.copy(cup = results.room.cup)), 2)
        assertEquals("cup", vm.moment.value!!.moment.id)
        assertEquals(GateDecision.COMPLETE, vm.gateKey(RemoteKey.OK))
        now += 50
        assertEquals(GateDecision.CONSUME, vm.gateKey(RemoteKey.OK))
        assertEquals(GateDecision.CONSUME, vm.gateKey(RemoteKey.OK, repeatCount = 3))
        assertEquals(1, vm.finishedGames)
        assertTrue(intents(conn).none { it is Replay })
        // A repeated OK never activates a button even after the guard; a repeated D-pad may still move focus.
        now += Constants.INPUT_GUARD_MS + 1
        assertEquals(GateDecision.CONSUME, vm.gateKey(RemoteKey.OK, repeatCount = 1))
        assertEquals(GateDecision.MOVE_ONLY, vm.gateKey(RemoteKey.LEFT, repeatCount = 1))
    }

    @Test
    fun portalIs1100msTheFirstTimeThen700msAndCalmIsACrossfade() = runTest(dispatcher) {
        val vm = newVm()
        val conn = open(vm)
        advanceUntilIdle()
        emit(conn, hub, 1)
        emit(conn, setup, 2) // opened from the VIP phone: the TV still plays the portal
        assertEquals(1_100L, vm.moment.value!!.moment.totalMs)
        emit(conn, hub, 3)
        assertEquals(600L, vm.moment.value!!.moment.totalMs) // the reverse portal
        emit(conn, setup, 4)
        assertEquals(704L, vm.moment.value!!.moment.totalMs) // 1 100 × 0.64
        emit(conn, hub, 5)
        vm.setCalmMotion(true)
        assertTrue(prefs.calmMotion)
        emit(conn, setup, 6)
        assertEquals(150L, vm.moment.value!!.moment.totalMs)
        // Setup → game plays the world entrance (≤ 2 000 ms, inside ENTRANCE_GRACE_MS).
        vm.setCalmMotion(false)
        emit(conn, voting, 7)
        assertEquals("entrance", vm.moment.value!!.moment.id)
        assertTrue(vm.moment.value!!.moment.totalMs <= 2_000L && vm.moment.value!!.moment.totalMs < Constants.ENTRANCE_GRACE_MS)
    }

    @Test
    fun overlaysFollowTheRoom() = runTest(dispatcher) {
        val vm = newVm()
        val conn = open(vm)
        advanceUntilIdle()
        emit(conn, hub, 1)
        vm.openOverlay(Overlay.CloseConfirm)
        emit(conn, voting, 2) // the VIP started a game: hub dialogs go
        assertTrue(vm.overlays.value.isEmpty())
        vm.openOverlay(Overlay.PauseMenu)
        vm.openOverlay(Overlay.Rules("mishana", RulesOrigin.PAUSE_MENU, RulesContext.GAME))
        vm.overlayBack() // a sheet opened from the pause menu returns straight to the game
        assertTrue(vm.overlays.value.isEmpty())
        vm.openOverlay(Overlay.PauseMenu)
        emit(conn, results, 3) // the game ended: its pause menu goes
        assertTrue(vm.overlays.value.isEmpty())
    }

    @Test
    fun rulesSheetYieldsToTheGuessOverrideHostDialog() = runTest(dispatcher) {
        val vm = newVm()
        val conn = open(vm)
        advanceUntilIdle()
        val elim = TvFixtures.room("playing.mishana.elimination")
        emit(conn, elim, 1)
        vm.openOverlay(Overlay.Rules("mishana", RulesOrigin.INFO_KEY, RulesContext.GAME))
        val pub = elim.game!!.public
        fun withGuess(status: String) = elim.copy(game = elim.game!!.copy(phase = "MR_WHITE_GUESS", public = JsonObject(pub +
            ("phase" to JsonPrimitive("MR_WHITE_GUESS")) +
            ("guess" to JsonObject(mapOf("playerId" to JsonPrimitive("p_3d4e5f60718293a4b5c6d7e8"), "status" to JsonPrimitive(status),
                "text" to JsonPrimitive("Bicycle"), "overridden" to JsonPrimitive(false)))))))
        emit(conn, withGuess("PENDING"), 2)
        assertNotNull(vm.overlays.value.firstOrNull { it is Overlay.Rules }) // reading on while the guess is pending
        emit(conn, withGuess("WRONG"), 3)
        assertTrue(vm.overlays.value.none { it is Overlay.Rules }) // the host must decide now
    }

    @Test
    fun pauseItemsSendTheGamesIntentAndAbortIsARoomIntent() = runTest(dispatcher) {
        val vm = newVm()
        val conn = open(vm)
        advanceUntilIdle()
        emit(conn, voting, 1)
        vm.runPauseItem(GameCatalog.MISHANA.pauseItems.single())
        vm.abortGame()
        assertEquals(listOf(MishanaTv.hostAdvance(), AbortGame), intents(conn))
    }

    @Test
    fun refusedOpenGameDropsThePortal() = runTest(dispatcher) {
        val vm = newVm()
        val conn = open(vm)
        advanceUntilIdle()
        emit(conn, hub, 1)
        vm.openGame("mishana")
        assertNotNull(vm.moment.value)
        conn.incoming.emit(ErrorMsg(code = "GAME_UNAVAILABLE", messageKey = "error.gameUnavailable", ref = "1"))
        advanceUntilIdle()
        assertNull(vm.moment.value)
        assertEquals(GateDecision.CONSUME, vm.gateKey(RemoteKey.OK)) // the guard after the bounce
    }
}
