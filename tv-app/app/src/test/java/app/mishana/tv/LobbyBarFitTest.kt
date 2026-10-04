package app.mishana.tv

import app.mishana.tv.ui.screens.LobbyMetrics
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.awt.Font
import java.awt.font.FontRenderContext
import java.io.File

/**
 * PAYMENTS-SPEC §4.4 fit rule (the measurement half of §4.9 StoreLayoutTest that runs on the JVM): the lobby bar
 * "Premium · Settings · Language · Start" must fit 542 dp (x 370 dp to the end margin) in EN/FR/AR with the real Cairo
 * Bold metrics of the button label (20 sp; tracking 0.02 em in Latin, 0 in Arabic). If the labelled Premium button
 * does not fit, LobbyMetrics.barVariant must drop labels (Premium first, then Language) until it does.
 * The labels are the generated strings (the strings_generated.xml of each locale), read here so a copy change re-runs the check.
 */
class LobbyBarFitTest {
    private fun font(name: String): Font {
        val file = listOf("src/main/res/font/$name", "app/src/main/res/font/$name", "tv-app/app/src/main/res/font/$name")
            .map(::File).firstOrNull { it.isFile } ?: error("font $name not found from ${File(".").absolutePath}")
        return Font.createFont(Font.TRUETYPE_FONT, file).deriveFont(1000f)
    }

    private fun strings(dir: String): Map<String, String> {
        val file = listOf("src/main/res/$dir/strings_generated.xml", "app/src/main/res/$dir/strings_generated.xml")
            .map(::File).first { it.isFile }
        return Regex("<string name=\"([a-z_0-9]+)\">([^<]*)</string>").findAll(file.readText()).associate { it.groupValues[1] to it.groupValues[2] }
    }

    private val bold = font("cairo_bold.ttf")

    private fun em(text: String, arabic: Boolean): Double {
        val gv = bold.createGlyphVector(FontRenderContext(null, false, true), text)
        val tracking = if (arabic) 0.0 else 0.02 * text.length
        return gv.logicalBounds.width / 1000.0 + tracking
    }

    @Test
    fun lobbyBarFitsInEveryLocale() {
        for ((lang, dir) in listOf("en" to "values", "fr" to "values-fr", "ar" to "values-ar")) {
            val s = strings(dir)
            val ar = lang == "ar"
            val premium = em(s.getValue("lobby__premium"), ar)
            val settings = em(s.getValue("lobby__settings"), ar)
            val language = em(s.getValue("lang__$lang"), ar)
            val start = em(s.getValue("lobby__start_game"), ar)
            fun width(v: LobbyMetrics.BarVariant) =
                LobbyMetrics.barDp(if (v.premiumIconOnly) null else premium, settings, if (v.languageIconOnly) null else language, start)
            val widths = LobbyMetrics.BarVariant.entries.associateWith { width(it) }
            println("lobby bar $lang: " + widths.entries.joinToString { "${it.key}=${"%.1f".format(it.value)} dp" } + " (budget ${LobbyMetrics.BAR_WIDTH_DP})")
            val richest = LobbyMetrics.BarVariant.entries.firstOrNull { widths.getValue(it) <= LobbyMetrics.BAR_WIDTH_DP }
            assertEquals("barVariant($lang) must be the richest variant that fits", richest, LobbyMetrics.barVariant(lang))
            assertTrue("bar $lang = ${widths.getValue(LobbyMetrics.barVariant(lang))} dp", widths.getValue(LobbyMetrics.barVariant(lang)) <= LobbyMetrics.BAR_WIDTH_DP)
        }
    }
}
