package app.jamaa.tv.platform

import app.jamaa.tv.TvFixtures
import app.jamaa.tv.games.GameCatalog
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** HUB-02 / HUB-03 focus graphs, ticket states, QR math and the ≤ 4-row setup column (JAMAA-PLATFORM §3.2, §3.5). */
class HubAndSetupTest {
    private val bar = HubModel.topBar(showCup = true, showPass = true)

    @Test
    fun hubFocusGraph() {
        fun mv(f: HubFocus, k: RemoteKey, rtl: Boolean = false) = HubModel.move(f, k, rtl, posters = 4, members = 3, topBar = bar)
        assertEquals(HubFocus.Poster(1), mv(HubFocus.Poster(0), RemoteKey.RIGHT))
        assertEquals(HubFocus.Poster(0), mv(HubFocus.Poster(3), RemoteKey.RIGHT)) // wraps
        assertEquals(HubFocus.Poster(3), mv(HubFocus.Poster(0), RemoteKey.LEFT))
        assertEquals(HubFocus.Poster(3), mv(HubFocus.Poster(0), RemoteKey.RIGHT, rtl = true)) // mirrored
        assertEquals(HubFocus.TopBar(TopBarItem.INFO), mv(HubFocus.Poster(2), RemoteKey.UP)) // Up → ⓘ, always
        assertEquals(HubFocus.Member(0), mv(HubFocus.Poster(2), RemoteKey.DOWN))
        // Down returns to the member focused last (clamped to the strip).
        assertEquals(HubFocus.Member(2), HubModel.move(HubFocus.Poster(0), RemoteKey.DOWN, false, 4, 3, bar, lastMember = 2))
        assertEquals(HubFocus.Member(2), HubModel.move(HubFocus.Poster(0), RemoteKey.DOWN, false, 4, 3, bar, lastMember = 7))
        assertEquals(HubFocus.Poster(-1), mv(HubFocus.Member(1), RemoteKey.UP)) // back to the focused poster
        assertNull(mv(HubFocus.Member(2), RemoteKey.RIGHT))
        assertEquals(HubFocus.TopBar(TopBarItem.PASS), mv(HubFocus.TopBar(TopBarItem.INFO), RemoteKey.RIGHT))
        assertEquals(HubFocus.TopBar(TopBarItem.CUP), mv(HubFocus.TopBar(TopBarItem.INFO), RemoteKey.LEFT))
        assertEquals(HubFocus.Poster(-1), mv(HubFocus.TopBar(TopBarItem.SETTINGS), RemoteKey.DOWN))
        assertNull(mv(HubFocus.TopBar(TopBarItem.SETTINGS), RemoteKey.UP))
        assertNull(HubModel.move(HubFocus.Poster(0), RemoteKey.DOWN, false, 1, 0, bar)) // nobody on the strip
        assertEquals(listOf(TopBarItem.INFO, TopBarItem.SETTINGS), HubModel.topBar(showCup = false, showPass = false))
    }

    @Test
    fun ticketStatesAndQrModules() {
        assertEquals(TicketState.GATHERING, HubModel.ticketState(5, 30_000)) // first 60 s
        assertEquals(TicketState.GATHERING, HubModel.ticketState(2, 120_000)) // fewer than 3
        assertEquals(TicketState.COMPACT, HubModel.ticketState(3, 60_000))
        assertEquals(TicketState.COMPACT, HubModel.ticketState(1, 120_000, wasCompact = true)) // latched: never back
        assertEquals(5, HubModel.qrModuleDp(HubModel.panelDp(TicketState.GATHERING), 29)) // version-3 code
        assertEquals(4, HubModel.qrModuleDp(HubModel.panelDp(TicketState.COMPACT), 29))
        assertEquals(184f / 200f, HubModel.panelScale(TicketState.COMPACT), 1e-6f)
        // The QR tile is exactly the ticket's inner width (it fills the card edge to edge, padding aside).
        assertEquals(app.jamaa.tv.ui.components.JoinPanelMetrics.HUB_QR_DP, HubModel.PANEL_GATHERING_DP)
        assertEquals(app.jamaa.tv.ui.components.JoinPanelMetrics.HUB_TICKET_W_DP, HubModel.TICKET_W_DP)
        assertEquals(1f, HubModel.panelScale(TicketState.GATHERING), 1e-6f)
        assertEquals(7, HubModel.captionGraphemes(8))
        assertEquals(5, HubModel.captionGraphemes(9))
    }

    @Test
    fun posterRowGeometryFitsTheSafeArea() {
        // Safe-area coordinates (864 × 486). Four posters + three gaps fill x 10–628; the 1.06 focus scale plus the 5 dp
        // ring (2 dp offset + 3 dp stroke) stays inside the 14 dp gaps, the safe area and clear of the ticket (x 648).
        val row = 4 * HubModel.POSTER_W_DP + 3 * HubModel.POSTER_GAP_DP
        assertEquals(618, row)
        val growX = HubModel.POSTER_W_DP * (HubModel.POSTER_FOCUS_SCALE - 1f) / 2f + 5f
        val growY = HubModel.POSTER_H_DP * (HubModel.POSTER_FOCUS_SCALE - 1f) / 2f + 5f
        val lift = HubModel.POSTER_LIFT_DP
        assertTrue(growX < HubModel.POSTER_GAP_DP)
        assertTrue(HubModel.ROW_X_DP - growX >= 0 && HubModel.ROW_X_DP + row + growX < HubModel.TICKET_X_DP)
        // Lifted and scaled: below the top bar, above the info block.
        assertTrue(HubModel.ROW_Y_DP - growY - lift > HubModel.BAR_H_DP)
        assertTrue(HubModel.ROW_Y_DP + HubModel.POSTER_H_DP + growY - lift < HubModel.INFO_Y_DP)
        // The zones tile the whole safe area: info above the strip, the strip ends on the safe area's bottom edge.
        assertTrue(HubModel.INFO_Y_DP + HubModel.INFO_H_DP <= HubModel.STRIP_Y_DP)
        assertEquals(HubModel.SAFE_H_DP, HubModel.STRIP_Y_DP + HubModel.STRIP_H_DP)
        assertEquals(HubModel.SAFE_W_DP, HubModel.TICKET_X_DP + HubModel.TICKET_W_DP)
        // The ticket (8 + 34 header + 200 QR + 58 code + ~25 address + 8) ends above the strip.
        assertTrue(HubModel.TICKET_Y_DP + 8 + 34 + HubModel.PANEL_GATHERING_DP + 58 + 25 + 8 < HubModel.STRIP_Y_DP)
        // 12 members in 72 dp slots still fit the strip's width.
        assertTrue(12 * 72 <= HubModel.SAFE_W_DP)
        assertEquals(app.jamaa.tv.ui.components.JamaaFocus.TILE_SCALE, HubModel.POSTER_FOCUS_SCALE, 0f)
        assertTrue(!HubModel.scrolls(4, 0) && HubModel.scrolls(4, 1))
        assertTrue(HubModel.showShutter(2, 1) && !HubModel.showShutter(3, 1) && !HubModel.showShutter(4, 0))
    }

    @Test
    fun ghostSeats() {
        assertEquals(3, HubModel.ghostSeats(0, 3))
        assertEquals(1, HubModel.ghostSeats(2, 1)) // at least three seats
        assertEquals(2, HubModel.ghostSeats(2, 4)) // up to the focused game's minPlayers
        assertEquals(0, HubModel.ghostSeats(5, 4))
    }

    @Test
    fun cardsCupAndMetaLine() {
        val room = TvFixtures.room("setup.bluff").room
        assertEquals(listOf("mishana", "bluff", "likely", "trivia", "taqriban"), HubModel.cards(room).map { it.id })
        assertEquals(1, HubModel.initialIndex(HubModel.cards(room), lastPlayed = null, focused = "bluff"))
        assertEquals(0, HubModel.initialIndex(HubModel.cards(room), lastPlayed = "karaoke", focused = null))
        val trivia = HubModel.metaLine(room.games.first { it.id == "trivia" }, 0)
        assertEquals(listOf(1, 12, 5, 10), listOf(trivia.minPlayers, trivia.maxPlayers, trivia.minMinutes, trivia.maxMinutes))
        assertTrue(trivia.needs)
        val hub = TvFixtures.room("hub").room
        assertTrue(HubModel.cupTop(hub.cup, hub.members).isEmpty())
        val cup = TvFixtures.room("hub.cup").room
        assertTrue(HubModel.showCup(cup.cup))
        assertEquals(listOf("Rami", "Léa", "نور"), HubModel.cupTop(cup.cup, cup.members).map { it.first.name })
        assertNull(HubModel.cupLeader(cup.cup)) // three-way tie: no crown
        assertEquals("p1", HubModel.cupLeader(cup.cup.copy(stars = mapOf("p1" to 5, "p2" to 3))))
    }

    @Test
    fun setupFocusGraph() {
        val steps = { i: Int -> i == 1 || i == 2 }
        fun mv(f: SetupTarget, k: RemoteKey, rtl: Boolean = false, last: Int? = null) =
            SetupFocusGraph.move(f, k, rtl, columnSize = 5, steps = steps, lastColumn = last, firstRow = 1)
        assertEquals(SetupTarget.Info, mv(SetupTarget.Column(0), RemoteKey.UP))
        assertEquals(SetupTarget.Column(2), mv(SetupTarget.Column(1), RemoteKey.DOWN))
        assertNull(mv(SetupTarget.Column(4), RemoteKey.DOWN)) // Down from Start → nothing
        assertEquals(SetupTarget.HowTo, mv(SetupTarget.Column(4), RemoteKey.LEFT)) // Start → how-to
        assertNull(mv(SetupTarget.Column(1), RemoteKey.LEFT)) // a stepping row keeps Left/Right
        assertEquals(SetupTarget.HowTo, mv(SetupTarget.Column(0), RemoteKey.RIGHT, rtl = true))
        assertEquals(SetupTarget.Column(3), mv(SetupTarget.HowTo, RemoteKey.RIGHT, last = 3))
        assertEquals(SetupTarget.Column(1), mv(SetupTarget.HowTo, RemoteKey.RIGHT))
        assertEquals(SetupTarget.Info, mv(SetupTarget.HowTo, RemoteKey.UP))
        // ⓘ → Down onto the column below it (the row focus came from, else Content), never diagonally to the how-to pane.
        assertEquals(SetupTarget.Column(0), mv(SetupTarget.Info, RemoteKey.DOWN))
        assertEquals(SetupTarget.Column(3), mv(SetupTarget.Info, RemoteKey.DOWN, last = 3))
        assertEquals(SetupTarget.Column(4), mv(SetupTarget.Info, RemoteKey.DOWN, last = 9)) // clamped to the column
        // The toward-how-to key from ⓘ reaches the how-to pane (Left in LTR, Right in RTL); the other one does nothing.
        assertEquals(SetupTarget.HowTo, mv(SetupTarget.Info, RemoteKey.LEFT))
        assertEquals(SetupTarget.HowTo, mv(SetupTarget.Info, RemoteKey.RIGHT, rtl = true))
        assertNull(mv(SetupTarget.Info, RemoteKey.RIGHT))
        assertNull(mv(SetupTarget.Info, RemoteKey.UP))
    }

    @Test
    fun mishanaSetupColumn() {
        val room = TvFixtures.room("setup.mishana").room
        val setup = room.setup!!
        val col = SetupRows.column(GameCatalog.MISHANA, setup, room.contentLocale, premium = false)
        // Content, Impostors (Custom → two inline steppers), Timers, Advanced, Start. Packs hidden: one playable pack
        // and one locked pack would be 2 options → shown.
        assertEquals(listOf("contentLocale", "roleMode", "undercoverCount", "blankCount", "timers", "packIds", "advanced", "start"), col.map { it.key })
        assertTrue(col.filterIsInstance<SetupRow.Step>().filter { it.inline }.size == 2)
        assertEquals("game.mishana.settings.timersNormal", (col.first { it.key == "timers" } as SetupRow.Step).valueKey)
        assertEquals(SetupRow.Start(true, null), col.last())
        // Timers: normal → fast writes all four seconds; a custom set shows "Custom" and steps to a preset.
        val fast = SetupRows.step(GameCatalog.MISHANA, setup, "timers", +1)!!
        assertEquals(JsonPrimitive(30), fast["clueSeconds"])
        val custom = setup.copy(settings = JsonObject(setup.settings + ("clueSeconds" to JsonPrimitive(50))))
        assertEquals("custom", SetupRows.timerPreset(custom.settings))
        assertEquals(JsonPrimitive(45), SetupRows.step(GameCatalog.MISHANA, custom, "timers", +1)!!["clueSeconds"])
        // Choices wrap; steppers clamp; nothing changes → null.
        assertEquals(JsonPrimitive("auto"), SetupRows.step(GameCatalog.MISHANA, setup, "roleMode", +1)!!["roleMode"])
        assertNull(SetupRows.step(GameCatalog.MISHANA, setup.copy(settings = JsonObject(setup.settings + ("blankCount" to JsonPrimitive(0)))), "blankCount", -1))
        // Only one pack in total: the packs row is hidden.
        val onePack = setup.copy(lockedPacks = emptyList())
        assertTrue(SetupRows.column(GameCatalog.MISHANA, onePack, "en", false).none { it.key == "packIds" })
    }

    @Test
    fun genericColumnsCapAtFourRowsAndStepTimers() {
        val bluff = TvFixtures.room("setup.bluff").room.setup!!
        val col = SetupRows.column(GameCatalog.BLUFF, bluff, "en", premium = false)
        assertEquals(listOf("contentLocale", "length", "pace", "start"), col.map { it.key }) // no packs → hidden; no Advanced
        assertEquals(JsonPrimitive("long"), SetupRows.step(GameCatalog.BLUFF, bluff, "length", +1)!!["length"])
        val s = app.jamaa.tv.games.SettingFieldSpec.Stepper("clueSeconds", "x", 10, 120, 5, off = 0)
        assertEquals(0, SetupRows.stepInt(10, -1, s)) // below min → off
        assertEquals(10, SetupRows.stepInt(0, +1, s))
        assertEquals(0, SetupRows.stepInt(0, -1, s))
        assertEquals(120, SetupRows.stepInt(120, +1, s))
        for (m in GameCatalog.ALL) assertTrue(m.id, m.basic.size <= SetupRows.MAX_BASIC_ROWS)
    }
}
