package app.mishana.tv

import android.app.Activity
import android.app.Application
import app.mishana.tv.billing.BillingEvent
import app.mishana.tv.billing.RoomBilling
import app.mishana.tv.billing.StoreEntry
import app.mishana.tv.billing.StoreOrigin
import app.mishana.tv.billing.StoreUiState
import app.mishana.tv.game.BillingToast
import app.mishana.tv.game.GameDeps
import app.mishana.tv.game.GameViewModel
import app.mishana.tv.game.TvEvent
import app.mishana.tv.game.TvUiState
import app.mishana.tv.net.ConnState
import app.mishana.tv.net.RoomConnection
import app.mishana.tv.protocol.ActionMsg
import app.mishana.tv.protocol.ClientMessage
import app.mishana.tv.protocol.CreateRoomResponse
import app.mishana.tv.protocol.EntitlementMsg
import app.mishana.tv.protocol.ErrorMsg
import app.mishana.tv.protocol.LockedPackInfo
import app.mishana.tv.protocol.LocalizedTitle
import app.mishana.tv.protocol.Phase
import app.mishana.tv.protocol.ServerMessage
import app.mishana.tv.protocol.SettingsPatch
import app.mishana.tv.protocol.StateMsg
import app.mishana.tv.protocol.StoreOpenMsg
import app.mishana.tv.protocol.TvView
import app.mishana.tv.protocol.UpdateSettings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/** PAYMENTS-SPEC §4.3 / §4.4: the ViewModel's side of billing (entitlement and storeOpen sends, Store, toasts). */
@OptIn(ExperimentalCoroutinesApi::class)
class GameViewModelBillingTest {
    private val dispatcher = StandardTestDispatcher()

    private class FakeConnection : RoomConnection {
        override val state = MutableStateFlow<ConnState>(ConnState.CONNECTING)
        override val incoming = MutableSharedFlow<ServerMessage>(extraBufferCapacity = 64)
        override val attempt = MutableStateFlow(0)
        val sent = mutableListOf<ClientMessage>()
        override fun connect(code: String, tvToken: String) = Unit
        override fun send(msg: ClientMessage): Boolean {
            if (state.value != ConnState.OPEN) return false
            sent += msg
            return true
        }
        override fun retryNow() = Unit
        override fun disconnect() = Unit
    }

    private class FakeBilling : RoomBilling {
        override val state = MutableStateFlow(StoreUiState())
        override val events = MutableSharedFlow<BillingEvent>(extraBufferCapacity = 16)
        var token: String? = "stored-token"
        val createStatuses = mutableListOf<String?>()
        val inRoom = mutableListOf<Boolean>()
        var opened = 0
        var closed = 0
        val bought = mutableListOf<Triple<String, String?, StoreOrigin>>()
        override fun tokenForCreate(): String? = token
        override fun onCreateRoomEntitlement(status: String?) {
            createStatuses += status
        }
        override fun setInRoom(inRoom: Boolean) {
            this.inRoom += inRoom
        }
        override fun openStore(lockedPacks: List<LockedPackInfo>) {
            opened += 1
            state.update { it.copy(storeVisible = true) }
        }
        override fun closeStore() {
            closed += 1
            state.update { it.copy(storeVisible = false) }
        }
        override fun buy(activity: Activity, productId: String, basePlanId: String?, origin: StoreOrigin) {
            bought += Triple(productId, basePlanId, origin)
        }
        override fun restorePurchases() = Unit
    }

    private val connections = mutableListOf<FakeConnection>()
    private val createTokens = mutableListOf<String?>()
    private val billing = FakeBilling()

    @Before fun setUp() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun TestScope.newVm(billingEnabled: Boolean = true): GameViewModel {
        val vm = GameViewModel(
            Application(),
            GameDeps(
                serverUrl = { "https://mish-ana.example.workers.dev" },
                appLocale = { "en" },
                createRoom = { _, _, token ->
                    createTokens += token
                    CreateRoomResponse("KXRT", "0123456789abcdef0123456789abcdef", "https://x/KXRT", "/parties/room/KXRT", "INVALID")
                },
                newConnection = { _, _ -> FakeConnection().also { connections += it } },
                clock = { 1_790_000_000_000L },
                billing = billing,
                billingEnabled = { billingEnabled },
            ),
        )
        advanceUntilIdle()
        return vm
    }

    private var seq = 0L
    private suspend fun FakeConnection.state(view: TvView) = incoming.emit(StateMsg(seq = ++seq, serverNow = 1_790_000_000_000L, view = view))

    private val lobby: TvView get() = TvFixtures.view("lobby")

    @Test
    fun createRoomSendsTheStoredTokenAndReportsTheStatus() = runTest(dispatcher) {
        newVm()
        assertEquals(listOf<String?>("stored-token"), createTokens)
        assertEquals(listOf<String?>("INVALID"), billing.createStatuses)
        assertEquals(true, billing.inRoom.last())
    }

    /** Server BILLING_ENABLED off (`GET /api/config` → billing:false): a free-game room, nothing billing goes out. */
    @Test
    fun billingOffSendsNoTokenNoBillingMessagesAndOpensNoStore() = runTest(dispatcher) {
        val vm = newVm(billingEnabled = false)
        assertEquals(listOf<String?>(null), createTokens)
        assertTrue(billing.createStatuses.isEmpty())
        val conn = connections.single()
        conn.state.value = ConnState.OPEN
        conn.state(lobby)
        advanceUntilIdle()
        assertEquals(false, (vm.ui.value as TvUiState.InRoom).billingEnabled)
        billing.events.emit(BillingEvent.Token("t1"))
        vm.openStore(StoreEntry(null, StoreOrigin.LOBBY_BUTTON))
        advanceUntilIdle()
        assertEquals(0, billing.opened)
        assertNull((vm.ui.value as TvUiState.InRoom).store)
        assertTrue(conn.sent.none { it is EntitlementMsg || it is StoreOpenMsg })
    }

    @Test
    fun entitlementIsQueuedUntilTheFirstStateAfterHello() = runTest(dispatcher) {
        newVm()
        val conn = connections.single()
        billing.events.emit(BillingEvent.Token("t1"))
        advanceUntilIdle()
        assertTrue(conn.sent.isEmpty())
        conn.state.value = ConnState.OPEN
        advanceUntilIdle()
        assertTrue("OPEN alone is not enough (hello may not be out yet)", conn.sent.isEmpty())
        conn.state(lobby)
        advanceUntilIdle()
        assertEquals(listOf<ClientMessage>(EntitlementMsg(token = "t1")), conn.sent)
        // Ready session: sent at once.
        billing.events.emit(BillingEvent.Token("t2"))
        advanceUntilIdle()
        assertEquals(EntitlementMsg(token = "t2"), conn.sent.last())
    }

    @Test
    fun storeOpenFollowsBusyAndIsResentEvery4Minutes() = runTest(dispatcher) {
        val vm = newVm()
        val conn = connections.single()
        conn.state.value = ConnState.OPEN
        conn.state(lobby)
        advanceUntilIdle()
        vm.openStore(StoreEntry(null, StoreOrigin.LOBBY_BUTTON))
        runCurrent() // not advanceUntilIdle: the 4-min re-send ticker runs until the Store closes
        assertEquals(1, billing.opened)
        assertEquals(StoreEntry(null, StoreOrigin.LOBBY_BUTTON), (vm.ui.value as TvUiState.InRoom).store)
        assertEquals(listOf<ClientMessage>(StoreOpenMsg(open = true)), conn.sent)
        advanceTimeBy(GameViewModel.STORE_OPEN_RESEND_MS + 1)
        runCurrent()
        assertEquals(2, conn.sent.count { it == StoreOpenMsg(open = true) })
        // Store closed but the Play sheet is still up: stays busy.
        billing.state.update { it.copy(purchaseInFlight = "premium") }
        vm.closeStore()
        runCurrent()
        assertTrue(conn.sent.none { it == StoreOpenMsg(open = false) })
        billing.state.update { it.copy(purchaseInFlight = null) }
        runCurrent()
        assertTrue("false is debounced", conn.sent.none { it == StoreOpenMsg(open = false) })
        advanceTimeBy(GameViewModel.STORE_CLOSE_DEBOUNCE_MS + 1)
        runCurrent()
        assertEquals(StoreOpenMsg(open = false), conn.sent.last())
        val before = conn.sent.size
        advanceTimeBy(GameViewModel.STORE_OPEN_RESEND_MS * 2)
        runCurrent()
        assertEquals("no re-sends once closed", before, conn.sent.size)
    }

    @Test
    fun closingAndReopeningTheStoreQuicklySendsNothing() = runTest(dispatcher) {
        val vm = newVm()
        val conn = connections.single()
        conn.state.value = ConnState.OPEN
        conn.state(lobby)
        advanceUntilIdle()
        vm.openStore(StoreEntry(null, StoreOrigin.LOBBY_BUTTON))
        runCurrent()
        vm.closeStore()
        runCurrent()
        advanceTimeBy(GameViewModel.STORE_CLOSE_DEBOUNCE_MS / 2)
        vm.openStore(StoreEntry(null, StoreOrigin.LOBBY_BUTTON))
        runCurrent()
        advanceTimeBy(GameViewModel.STORE_CLOSE_DEBOUNCE_MS * 2)
        runCurrent()
        assertEquals("one open, no close, no second open", listOf<ClientMessage>(StoreOpenMsg(open = true)), conn.sent)
        // The keepalive still runs from the first send.
        advanceTimeBy(GameViewModel.STORE_OPEN_RESEND_MS - GameViewModel.STORE_CLOSE_DEBOUNCE_MS * 2)
        runCurrent()
        assertEquals(2, conn.sent.count { it == StoreOpenMsg(open = true) })
        vm.closeStore()
        advanceTimeBy(GameViewModel.STORE_CLOSE_DEBOUNCE_MS + 1)
        runCurrent()
    }

    @Test
    fun anEqualSeqMetaFrameIsApplied() = runTest(dispatcher) {
        val vm = newVm()
        val conn = connections.single()
        conn.state.value = ConnState.OPEN
        conn.incoming.emit(StateMsg(seq = 7, serverNow = 1_790_000_000_000L, view = lobby.copy(premium = false)))
        advanceUntilIdle()
        // The server broadcasts the entitlement upgrade without bumping the game version.
        conn.incoming.emit(StateMsg(seq = 7, serverNow = 1_790_000_000_000L, view = lobby.copy(premium = true, lockedPacks = emptyList())))
        advanceUntilIdle()
        assertTrue((vm.ui.value as TvUiState.InRoom).view!!.premium)
        // An older frame is still dropped.
        conn.incoming.emit(StateMsg(seq = 6, serverNow = 1_790_000_000_000L, view = lobby.copy(premium = false)))
        advanceUntilIdle()
        assertTrue((vm.ui.value as TvUiState.InRoom).view!!.premium)
    }

    @Test
    fun aRateLimitedEntitlementIsResentAfterTheBackoffWithoutAToast() = runTest(dispatcher) {
        val vm = newVm()
        val events = mutableListOf<TvEvent>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.events.collect { events += it } }
        val conn = connections.single()
        conn.state.value = ConnState.OPEN
        conn.state(lobby)
        advanceUntilIdle()
        billing.events.emit(BillingEvent.Token("fresh"))
        runCurrent()
        assertEquals(EntitlementMsg(token = "fresh"), conn.sent.last())
        conn.incoming.emit(ErrorMsg(code = "RATE_LIMITED", messageKey = "error.rateLimited", ref = null))
        runCurrent()
        assertTrue("attributed to the billing send: no toast", events.none { it is TvEvent.ServerError })
        advanceTimeBy(GameViewModel.BILLING_RETRY_MS - 1)
        runCurrent()
        assertEquals(1, conn.sent.count { it == EntitlementMsg(token = "fresh") })
        advanceTimeBy(2)
        runCurrent()
        assertEquals(2, conn.sent.count { it == EntitlementMsg(token = "fresh") })
    }

    @Test
    fun aRateLimitedStoreCloseIsResent() = runTest(dispatcher) {
        val vm = newVm()
        val conn = connections.single()
        conn.state.value = ConnState.OPEN
        conn.state(lobby)
        advanceUntilIdle()
        vm.openStore(StoreEntry(null, StoreOrigin.LOBBY_BUTTON))
        runCurrent()
        vm.closeStore()
        advanceTimeBy(GameViewModel.STORE_CLOSE_DEBOUNCE_MS + 1)
        runCurrent()
        assertEquals(StoreOpenMsg(open = false), conn.sent.last())
        conn.incoming.emit(ErrorMsg(code = "RATE_LIMITED", messageKey = "error.rateLimited", ref = null))
        runCurrent()
        val before = conn.sent.size
        advanceTimeBy(GameViewModel.BILLING_RETRY_MS + 1)
        runCurrent()
        assertEquals(before + 1, conn.sent.size)
        assertEquals(StoreOpenMsg(open = false), conn.sent.last())
        advanceUntilIdle()
        assertEquals("no keepalive after close", before + 1, conn.sent.size)
    }

    @Test
    fun aRateLimitedErrorUnrelatedToBillingStillToasts() = runTest(dispatcher) {
        var now = 1_790_000_000_000L
        val vm = GameViewModel(
            Application(),
            GameDeps(
                serverUrl = { "https://mish-ana.example.workers.dev" },
                appLocale = { "en" },
                createRoom = { _, _, _ -> CreateRoomResponse("KXRT", "0123456789abcdef0123456789abcdef", "https://x/KXRT", "/parties/room/KXRT", null) },
                newConnection = { _, _ -> FakeConnection().also { connections += it } },
                clock = { now },
                billing = billing,
            ),
        )
        advanceUntilIdle()
        val events = mutableListOf<TvEvent>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.events.collect { events += it } }
        val conn = connections.single()
        conn.state.value = ConnState.OPEN
        conn.state(lobby)
        advanceUntilIdle()
        billing.events.emit(BillingEvent.Token("t"))
        runCurrent()
        now += GameViewModel.BILLING_RATE_WINDOW_MS + 1
        conn.incoming.emit(ErrorMsg(code = "RATE_LIMITED", messageKey = "error.rateLimited", ref = null))
        runCurrent()
        assertEquals(listOf("RATE_LIMITED"), events.filterIsInstance<TvEvent.ServerError>().map { it.error.code })
    }

    @Test
    fun storeOpensOnlyInLobbyAndClosesWhenThePhaseLeavesIt() = runTest(dispatcher) {
        val vm = newVm()
        val conn = connections.single()
        conn.state.value = ConnState.OPEN
        conn.state(TvFixtures.view("clues"))
        advanceUntilIdle()
        vm.openStore(StoreEntry(null, StoreOrigin.LOBBY_BUTTON))
        assertNull((vm.ui.value as TvUiState.InRoom).store)
        conn.state(lobby)
        advanceUntilIdle()
        vm.openStore(StoreEntry("premium", StoreOrigin.LOCKED_SETTING))
        assertEquals("premium", (vm.ui.value as TvUiState.InRoom).store?.focusProductId)
        runCurrent()
        conn.state(TvFixtures.view("role_reveal"))
        runCurrent()
        assertNull((vm.ui.value as TvUiState.InRoom).store)
        assertEquals(1, billing.closed)
    }

    @Test
    fun aPackBoughtFromALockedRowJoinsANonEmptyPackList() = runTest(dispatcher) {
        val vm = newVm()
        val events = mutableListOf<TvEvent>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.events.collect { events += it } }
        val conn = connections.single()
        conn.state.value = ConnState.OPEN
        val locked = LockedPackInfo("en-food-01", "en", LocalizedTitle("Food", "À table", "أكل"), 33, "all", "pack_en_food_01")
        val lockedFr = LockedPackInfo("fr-food-01", "fr", LocalizedTitle("Food", "À table", "أكل"), 33, "all", "pack_fr_food_01")
        val v = lobby.copy(settings = lobby.settings.copy(wordLocale = "en", packIds = listOf("test-en-01")), lockedPacks = listOf(locked, lockedFr))
        conn.state(v)
        advanceUntilIdle()
        billing.events.emit(BillingEvent.Granted(setOf("pack_en_food_01"), mapOf("pack_en_food_01" to StoreOrigin.LOCKED_PACK)))
        advanceUntilIdle()
        val update = conn.sent.filterIsInstance<ActionMsg>().single()
        assertEquals(UpdateSettings(SettingsPatch(packIds = listOf("test-en-01", "en-food-01"))), update.a)
        assertTrue(TvEvent.Billing(BillingToast("store.addedToGame")) in events)
        // Another word language: the hint, no settings change.
        billing.events.emit(BillingEvent.Granted(setOf("pack_fr_food_01"), mapOf("pack_fr_food_01" to StoreOrigin.LOCKED_PACK)))
        advanceUntilIdle()
        assertEquals(1, conn.sent.filterIsInstance<ActionMsg>().size)
        assertTrue(TvEvent.Billing(BillingToast("store.switchLanguage", "fr")) in events)
        // "All playable" ([]): nothing to change.
        conn.state(v.copy(settings = v.settings.copy(packIds = emptyList())))
        advanceUntilIdle()
        billing.events.emit(BillingEvent.Granted(setOf("pack_en_food_01"), mapOf("pack_en_food_01" to StoreOrigin.LOCKED_PACK)))
        advanceUntilIdle()
        assertEquals(1, conn.sent.filterIsInstance<ActionMsg>().size)
    }

    @Test
    fun billingToastsWaitForLobbyOrResults() = runTest(dispatcher) {
        val vm = newVm()
        val events = mutableListOf<TvEvent>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.events.collect { events += it } }
        val conn = connections.single()
        conn.state.value = ConnState.OPEN
        conn.state(TvFixtures.view("clues"))
        advanceUntilIdle()
        billing.events.emit(BillingEvent.Toast("store.verifyFailed"))
        billing.events.emit(BillingEvent.Toast("store.unlocked"))
        advanceUntilIdle()
        assertTrue(events.none { it is TvEvent.Billing })
        conn.state(TvFixtures.view("results"))
        advanceUntilIdle()
        assertEquals(listOf(TvEvent.Billing(BillingToast("store.unlocked"))), events.filterIsInstance<TvEvent.Billing>())
    }

    @Test
    fun premiumEndedToastWhenTheLobbyDowngrades() = runTest(dispatcher) {
        val vm = newVm()
        val events = mutableListOf<TvEvent>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.events.collect { events += it } }
        val conn = connections.single()
        conn.state.value = ConnState.OPEN
        conn.state(lobby.copy(premium = true))
        conn.state(lobby.copy(premium = false))
        advanceUntilIdle()
        assertEquals(listOf(TvEvent.Billing(BillingToast("lobby.premiumEnded"))), events.filterIsInstance<TvEvent.Billing>())
    }

    @Test
    fun settingsErrorsUseTheTvRegisterAndTvBusyIsIgnored() = runTest(dispatcher) {
        val vm = newVm()
        val events = mutableListOf<TvEvent>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { vm.events.collect { events += it } }
        val conn = connections.single()
        conn.state.value = ConnState.OPEN
        conn.incoming.emit(ErrorMsg(code = "TV_BUSY", messageKey = "error.tvBusy", ref = null))
        conn.incoming.emit(ErrorMsg(code = "PACK_LOCKED", messageKey = "error.packLocked", ref = "3"))
        advanceUntilIdle()
        val errs = events.filterIsInstance<TvEvent.ServerError>()
        assertEquals(listOf("PACK_LOCKED"), errs.map { it.error.code })
        assertEquals("tv.packLocked", GameViewModel.tvMessageKey(errs[0].error))
        assertEquals("tv.premiumRequired", GameViewModel.tvMessageKey(ErrorMsg(code = "PREMIUM_REQUIRED", messageKey = "error.premiumRequired", ref = null)))
        assertEquals("error.entitlementInvalid", GameViewModel.tvMessageKey(ErrorMsg(code = "ENTITLEMENT_INVALID", messageKey = "error.entitlementInvalid", ref = null)))
    }

    @Test
    fun buyCarriesTheStoreOrigin() = runTest(dispatcher) {
        val vm = newVm()
        val conn = connections.single()
        conn.state.value = ConnState.OPEN
        conn.state(lobby)
        advanceUntilIdle()
        vm.openStore(StoreEntry("pack_en_food_01", StoreOrigin.LOCKED_PACK))
        vm.buy(Activity(), "pack_en_food_01", null)
        assertEquals(Triple("pack_en_food_01", null, StoreOrigin.LOCKED_PACK), billing.bought.single())
        assertEquals(Phase.LOBBY, (vm.ui.value as TvUiState.InRoom).view!!.phase)
        vm.closeStore()
        runCurrent()
    }
}
