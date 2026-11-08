package app.jamaa.tv

import app.jamaa.tv.ui.components.BrandPaths
import app.jamaa.tv.ui.screens.LobbyMetrics
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** The JAMAA rename (JAMAA-PLATFORM §1.3, §1.7 item 4) and the generated wordmark geometry (DESIGN-JAMAA §1.3). */
class BrandTest {
    private fun res(path: String): File =
        listOf("src/main/res/$path", "app/src/main/res/$path", "tv-app/app/src/main/res/$path")
            .map(::File).firstOrNull { it.isFile } ?: error("res/$path not found from ${File(".").absolutePath}")

    @Test
    fun platformNameIsJamaa() {
        assertEquals("JAMAA", Brand.NAME)
        assertEquals("جماعة", Brand.NAME_AR)
    }

    @Test
    fun latinWordmarkHasThreeHeadsInsideTheLetters() {
        val d = BrandPaths.LATIN_DOTS
        assertEquals(6, d.size)
        val b = BrandPaths.LATIN_BOUNDS
        for (i in d.indices step 2) {
            val x = d[i]
            val y = d[i + 1]
            assertTrue("head $i x=$x outside the letters", x - BrandPaths.LATIN_DOT_R > b[0] && x + BrandPaths.LATIN_DOT_R < b[2])
            assertTrue("head $i y=$y outside the cap band", y - BrandPaths.LATIN_DOT_R > b[1] && y + BrandPaths.LATIN_DOT_R < b[3])
        }
        // left to right, on one line (the three A's)
        assertTrue(d[0] < d[2] && d[2] < d[4])
        assertEquals(d[1], d[3], 0.01f)
        assertEquals(d[3], d[5], 0.01f)
    }

    @Test
    fun wordmarksFitTheirArtboards() {
        val lb = BrandPaths.LATIN_BOUNDS
        assertTrue(lb[0] >= 0f && lb[2] <= BrandPaths.LATIN_W && lb[1] >= 0f && lb[3] <= BrandPaths.LATIN_H)
        val ab = BrandPaths.ARABIC_BOUNDS
        assertTrue(ab[0] >= 0f && ab[2] <= BrandPaths.ARABIC_W && ab[1] >= 0f && ab[3] <= BrandPaths.ARABIC_H)
        val (x, y) = BrandPaths.ARABIC_DOT.let { it[0] to it[1] }
        val r = BrandPaths.ARABIC_DOT_R
        assertTrue(x - r >= 0f && x + r <= BrandPaths.ARABIC_W && y - r >= 0f && y + r <= BrandPaths.ARABIC_H)
        assertTrue(BrandPaths.LATIN.startsWith("M") && BrandPaths.ARABIC.startsWith("M"))
    }

    @Test
    fun lobbyWordmarkFitsItsHeightBudget() {
        // LobbyScreen budgets 58 dp of height for the Latin wordmark at WORDMARK_DP wide (pad 20 artboard units).
        val b = BrandPaths.LATIN_BOUNDS
        val aspect = (b[3] - b[1] + 40f) / (b[2] - b[0] + 40f)
        assertTrue("lobby wordmark is ${aspect * LobbyMetrics.WORDMARK_DP} dp tall", aspect * LobbyMetrics.WORDMARK_DP <= 58f)
    }

    @Test
    fun launcherIconAndBannerAreTheGeneratedJamaaArt() {
        val icon = res("mipmap-anydpi-v26/ic_launcher.xml").readText()
        for (layer in listOf("ic_launcher_background", "ic_launcher_foreground", "ic_launcher_monochrome")) {
            assertTrue("$layer missing from ic_launcher.xml", icon.contains("@drawable/$layer"))
            assertTrue(res("drawable/$layer.xml").readText().contains("gen_brand.py"))
        }
        for (banner in listOf("drawable/banner.xml", "drawable-ar/banner.xml", "drawable/ic_mark.xml")) {
            val xml = res(banner).readText()
            assertTrue("$banner is not the JAMAA art", xml.contains("JAMAA") && xml.contains("gen_brand.py"))
        }
    }
}
