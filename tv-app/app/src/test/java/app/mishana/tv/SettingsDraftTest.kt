package app.mishana.tv

import app.mishana.tv.game.SettingsDraft
import app.mishana.tv.game.changedSettingKeys
import app.mishana.tv.game.merge
import app.mishana.tv.game.withDraft
import app.mishana.tv.protocol.SettingsPatch
import app.mishana.tv.protocol.WinRule
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SettingsDraftTest {
    private val s = TvFixtures.view("lobby").settings

    @Test
    fun mergeAndOverlay() {
        val p = merge(SettingsPatch(clueSeconds = 60), SettingsPatch(voteSeconds = 120))
        assertEquals(60, p.clueSeconds)
        assertEquals(120, p.voteSeconds)
        val shown = s.withDraft(p)
        assertEquals(60, shown.clueSeconds)
        assertEquals(120, shown.voteSeconds)
        // A word-language change clears the packs unless the patch carries them (SPEC §4.4).
        val other = if (s.wordLocale == "fr") "en" else "fr"
        assertEquals(Constants.DEFAULT_PACK_IDS, s.copy(packIds = listOf("x")).withDraft(SettingsPatch(wordLocale = other)).packIds)
        assertNull(merge(SettingsPatch(packIds = listOf("x")), SettingsPatch(wordLocale = other)).packIds)
    }

    @Test
    fun ownEchoIsSilentAndClearsTheOverlay() {
        val d = SettingsDraft()
        d.change(SettingsPatch(clueSeconds = 60))
        val sent = d.flush()!!
        val echoed = s.withDraft(sent)
        assertTrue(d.onServerSettings(s, echoed).isEmpty())
        assertNull(d.patch)
    }

    @Test
    fun lateEchoAfterTheFallbackIsStillOurs() {
        val d = SettingsDraft()
        d.change(SettingsPatch(clueSeconds = 60))
        val sent = d.flush()!!
        d.expire() // 1.5 s without an echo
        assertNull(d.patch)
        assertTrue(d.onServerSettings(s, s.withDraft(sent)).isEmpty())
    }

    @Test
    fun someoneElsesChangeIsAnnounced() {
        val d = SettingsDraft()
        val other = s.copy(winRule = if (s.winRule == WinRule.OFFICIAL) WinRule.PARITY else WinRule.OFFICIAL, clueSeconds = s.clueSeconds + 5)
        assertEquals(setOf("game.winRule", "timers.clueSeconds"), d.onServerSettings(s, other))
        assertEquals(changedSettingKeys(s, other), d.onServerSettings(s, other))
    }

    @Test
    fun broadcastsWhileAChangeIsPendingAreIgnored() {
        val d = SettingsDraft()
        d.change(SettingsPatch(clueSeconds = 60))
        assertTrue(d.onServerSettings(s, s.copy(voteSeconds = s.voteSeconds + 15)).isEmpty())
        assertEquals(60, d.patch?.clueSeconds) // the overlay survives until it is sent and echoed
        d.expire()
        assertEquals(60, d.patch?.clueSeconds) // still pending: expire never drops an unsent change
    }
}
