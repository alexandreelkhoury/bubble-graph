package app.jamaa.tv.platform

import app.jamaa.tv.games.GameCatalog
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** JAMAA-PLATFORM §3.2 HUB-06 and §3.6: overlay back stack, rules content and the pause menu rows. */
class OverlaysTest {
    private val rulesFromMenu = Overlay.Rules("mishana", RulesOrigin.PAUSE_MENU, RulesContext.GAME)

    @Test
    fun rulesFromThePauseMenuCloseStraightToTheGame() {
        val st = OverlayStack()
        st.open(Overlay.PauseMenu)
        st.open(rulesFromMenu)
        st.back()
        assertTrue(st.isEmpty)
        // From the INFO key or the top bar, Back closes the sheet only.
        st.open(Overlay.PauseMenu)
        st.open(Overlay.Rules("mishana", RulesOrigin.INFO_KEY, RulesContext.GAME))
        st.back()
        assertEquals(listOf<Overlay>(Overlay.PauseMenu), st.items)
    }

    @Test
    fun aHostDialogClosesTheRulesSheet() {
        val st = OverlayStack()
        st.open(Overlay.Rules("mishana", RulesOrigin.TOP_BAR, RulesContext.HUB))
        st.open(Overlay.Rules("bluff", RulesOrigin.TOP_BAR, RulesContext.HUB)) // already open: nothing
        assertEquals(1, st.items.size)
        st.open(Overlay.CloseConfirm)
        assertNull(st.rules)
        assertEquals(Overlay.CloseConfirm, st.top)
        // A non-host overlay (hub settings) does not close it.
        val st2 = OverlayStack()
        st2.open(Overlay.Rules("mishana", RulesOrigin.TOP_BAR, RulesContext.HUB))
        st2.open(Overlay.HubSettings)
        assertTrue(st2.rules != null)
    }

    @Test
    fun youAreHereSectionsComeFirstAndSheetWidths() {
        val s = RulesContent.sections(GameCatalog.MISHANA, "VOTING")
        assertEquals("vote", s.first().spec.id)
        assertTrue(s.first().youAreHere)
        assertEquals(1, s.count { it.youAreHere })
        assertEquals(GameCatalog.MISHANA.ruleSections.size, s.size)
        assertTrue(RulesContent.sections(GameCatalog.MISHANA, null).none { it.youAreHere })
        assertEquals(listOf("roles", "words"), RulesContent.sections(GameCatalog.MISHANA, "ROLE_REVEAL").filter { it.youAreHere }.map { it.spec.id })
        assertEquals(420, RulesContent.widthDp(RulesContext.HUB))
        assertEquals(420, RulesContent.widthDp(RulesContext.SETUP))
        assertEquals(360, RulesContent.widthDp(RulesContext.GAME))
        assertTrue(RulesContent.showsHowJamaaWorks(RulesContext.HUB))
        assertFalse(RulesContent.showsHowJamaaWorks(RulesContext.SETUP))
    }

    @Test
    fun pauseMenuRows() {
        val rows = PauseMenuModel.rows(GameCatalog.MISHANA, "CLUES", over = false)
        assertEquals(PauseRow.Resume, rows.first())
        assertEquals(PauseRow.Quit, rows.last())
        val skip = rows.filterIsInstance<PauseRow.GameItem>().single()
        assertTrue(skip.enabled)
        assertEquals("HOST_ADVANCE", skip.item.intent)
        assertFalse(PauseMenuModel.rows(GameCatalog.MISHANA, "RESULTS", over = false).filterIsInstance<PauseRow.GameItem>().single().enabled)
        // A finished game: no host items, no Quit.
        assertEquals(listOf(PauseRow.Resume, PauseRow.Rules, PauseRow.Sound), PauseMenuModel.rows(GameCatalog.MISHANA, "RESULTS", over = true))
        // Bluff's items in declared order, each only in its phases.
        val bluff = PauseMenuModel.rows(GameCatalog.BLUFF, "VOTING", false).filterIsInstance<PauseRow.GameItem>()
        assertEquals(listOf("skipPrompt", "hideOption", "next", "endGame"), bluff.map { it.item.id })
        assertEquals(listOf(false, true, false, false), bluff.map { it.enabled })
    }
}
