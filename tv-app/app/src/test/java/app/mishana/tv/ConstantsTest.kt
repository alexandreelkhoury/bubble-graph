package app.mishana.tv

import app.mishana.tv.game.GameViewModel
import app.mishana.tv.net.ServerUrls
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.PlayerSwatch
import androidx.compose.ui.graphics.toArgb
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ConstantsTest {
    @Test
    fun swatchesMatchSpecColors() {
        assertEquals(12, Constants.COLORS.size)
        assertEquals(Constants.COLORS.map { it.id }, PlayerSwatch.entries.map { it.id })
        for ((c, s) in Constants.COLORS.zip(PlayerSwatch.entries)) {
            assertEquals(c.id, c.argb.toInt(), s.color.toArgb())
            assertEquals(c.id, c.shape, s.shape)
            assertEquals(c.id, if (c.glyphIsCream) MishColors.Text else MishColors.Ink, s.glyph)
        }
    }

    @Test
    fun roomCodeAlphabet() {
        assertEquals(23, Constants.ROOM_CODE_ALPHABET.length)
        assertTrue(Constants.ROOM_CODE_ALPHABET.none { it in "ILO" })
        assertTrue(Constants.ROOM_CODE_REGEX.matches("KXRT"))
        assertTrue(!Constants.ROOM_CODE_REGEX.matches("KXIT"))
    }

    @Test
    fun wsUrls() {
        assertEquals(
            "wss://mish-ana.example.workers.dev/parties/room/KXRT?_pk=a&cid=b",
            ServerUrls.wsUrl("https://mish-ana.example.workers.dev/", "KXRT", pk = "a", cid = "b"),
        )
        assertEquals("ws://192.168.1.20:8787/parties/room/ABCD?_pk=a&cid=b", ServerUrls.wsUrl("http://192.168.1.20:8787", "ABCD", "a", "b"))
        assertEquals("mish-ana.example.workers.dev", ServerUrls.displayHost("https://mish-ana.example.workers.dev/KXRT"))
        assertEquals("192.168.1.20:8787", ServerUrls.displayHost("http://192.168.1.20:8787/KXRT"))
    }

    @Test
    fun errorMessageKeys() {
        assertEquals("error.roomExpired", GameViewModel.errorMessageKey("ROOM_EXPIRED"))
        assertEquals("error.tvAuthFailed", GameViewModel.errorMessageKey("TV_AUTH_FAILED"))
        assertEquals("error.replaced", GameViewModel.errorMessageKey("REPLACED"))
        assertEquals("error.rateLimited", GameViewModel.errorMessageKey("RATE_LIMITED"))
    }
}
