package app.mishana.tv

import android.app.Application
import app.cash.turbine.test
import app.mishana.tv.game.GameDeps
import app.mishana.tv.game.GameViewModel
import app.mishana.tv.game.TvEvent
import app.mishana.tv.game.TvUiState
import app.mishana.tv.net.ConnState
import app.mishana.tv.net.RoomConnection
import app.mishana.tv.protocol.ActionMsg
import app.mishana.tv.protocol.ClientMessage
import app.mishana.tv.protocol.CreateRoomResponse
import app.mishana.tv.protocol.ErrorMsg
import app.mishana.tv.protocol.Phase
import app.mishana.tv.protocol.Points
import app.mishana.tv.protocol.PublicPlayer
import app.mishana.tv.protocol.RoleMode
import app.mishana.tv.protocol.ServerMessage
import app.mishana.tv.protocol.Settings
import app.mishana.tv.protocol.Start
import app.mishana.tv.protocol.StateMsg
import app.mishana.tv.protocol.TieBreak
import app.mishana.tv.protocol.TvView
import app.mishana.tv.protocol.WinRule
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
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

    private fun deps() = GameDeps(
        serverUrl = { "https://mish-ana.example.workers.dev" },
        appLocale = { "fr" },
        createRoom = { url, locale ->
            createCalls += url to locale
            val code = codes.removeFirst()
            CreateRoomResponse(code, "0123456789abcdef0123456789abcdef", "https://mish-ana.example.workers.dev/$code", "/parties/room/$code")
        },
        newConnection = { _, _ -> FakeConnection().also { connections += it } },
        clock = { 1_790_000_000_000L },
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
        assertEquals("https://mish-ana.example.workers.dev/KXRT", s.joinUrl)
        assertEquals(listOf("https://mish-ana.example.workers.dev" to "fr"), createCalls)
        assertEquals("KXRT" to "0123456789abcdef0123456789abcdef", connections.single().connectedWith)
    }

    @Test
    fun appliesOnlyIncreasingSeqAndTracksClockOffset() = runTest(dispatcher) {
        val vm = newVm()
        val conn = connections.single()
        conn.state.value = ConnState.OPEN
        advanceUntilIdle()
        vm.ui.test {
            assertEquals(ConnState.OPEN, (awaitItem() as TvUiState.InRoom).conn)
            conn.incoming.emit(StateMsg(seq = 5, serverNow = 1_790_000_002_000L, view = view(round = 1)))
            val a = awaitItem() as TvUiState.InRoom
            assertEquals(1, a.view!!.round)
            assertEquals(2_000L, a.clockOffsetMs)
            conn.incoming.emit(StateMsg(seq = 4, serverNow = 1_790_000_003_000L, view = view(round = 99))) // stale
            conn.incoming.emit(StateMsg(seq = 5, serverNow = 1_790_000_003_000L, view = view(round = 98))) // duplicate
            conn.incoming.emit(StateMsg(seq = 6, serverNow = 1_790_000_001_000L, view = view(round = 2)))
            val b = awaitItem() as TvUiState.InRoom
            assertEquals(2, b.view!!.round)
            assertEquals(2_000L, b.clockOffsetMs) // largest of the samples
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun sendWrapsInActionMsgOnlyWhenOpen() = runTest(dispatcher) {
        val vm = newVm()
        val conn = connections.single()
        vm.send(Start)
        assertTrue(conn.sent.isEmpty())
        conn.state.value = ConnState.OPEN
        advanceUntilIdle()
        vm.send(Start)
        vm.send(Start)
        assertEquals(listOf(ActionMsg(id = "1", a = Start), ActionMsg(id = "2", a = Start)), conn.sent)
    }

    @Test
    fun roomExpiredInAnEmptyLobbyRecreatesTheRoom() = runTest(dispatcher) {
        val vm = newVm()
        vm.events.test {
            val first = connections.single()
            first.state.value = ConnState.OPEN
            advanceUntilIdle()
            first.incoming.emit(StateMsg(seq = 1, serverNow = 1_790_000_000_000L, view = view(players = emptyList())))
            advanceUntilIdle()
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

    @Test
    fun roomExpiredMidGameIsFatal() = runTest(dispatcher) {
        val vm = newVm()
        val conn = connections.single()
        conn.state.value = ConnState.OPEN
        advanceUntilIdle()
        conn.incoming.emit(StateMsg(seq = 1, serverNow = 1L, view = view(phase = Phase.CLUES, players = listOf(player("p_0a1b2c3d4e5f60718293a4b5")))))
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
            createRoom = { _, _ -> throw app.mishana.tv.net.CreateRoomException(429, "RATE_LIMITED") },
            newConnection = { _, _ -> FakeConnection() },
        )
        val vm = GameViewModel(Application(), failing)
        advanceUntilIdle()
        assertEquals(TvUiState.CreateFailed("error.rateLimited"), vm.ui.value)
    }

    private fun player(id: String) = PublicPlayer(
        id = id, name = "Rami", color = "coral", seat = 0, connected = true, alive = true, left = false,
        isHost = true, ready = false, spoke = false, hasVoted = false, revealedRole = null, score = 0,
    )

    private fun view(round: Int = 0, phase: Phase = Phase.LOBBY, players: List<PublicPlayer> = emptyList()) = TvView(
        kind = "tv", roomCode = "KXRT", joinUrl = "https://mish-ana.example.workers.dev/KXRT", phase = phase,
        gameNumber = 0, round = round,
        settings = Settings(
            winRule = WinRule.OFFICIAL, revealRoles = false, roleMode = RoleMode.AUTO, undercoverCount = 1, blankCount = 1,
            clueSeconds = 45, voteSeconds = 90, revealSeconds = 30, guessSeconds = 45, tieBreak = TieBreak.RANDOM,
            blankGuess = true, wordLocale = "en", packIds = emptyList(), difficulties = listOf(1, 2, 3),
            familyFilter = true, swapSides = true, points = Points(2, 10, 6),
        ),
        players = players, hostPlayerId = null, roleCounts = null, canStart = false, startBlocker = "NOT_ENOUGH_PLAYERS",
        speakingOrder = emptyList(), currentSpeakerId = null, revote = false, tieCandidates = emptyList(), deadline = null,
        votesCast = 0, votesExpected = 0, lastVote = null, eliminated = null, guess = null, result = null,
        history = emptyList(), availablePacks = emptyList(),
    )
}
