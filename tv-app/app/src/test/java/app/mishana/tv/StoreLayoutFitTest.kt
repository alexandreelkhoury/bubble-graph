package app.mishana.tv

import app.mishana.tv.ui.screens.StoreMetrics
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.awt.Font
import java.awt.font.FontRenderContext
import java.io.File

/**
 * PAYMENTS-SPEC §4.4 hard fit rule, measured on the JVM with the real Cairo fonts (the Compose screenshot half of §4.9
 * StoreLayoutTest runs on the owner's machine): at 960×540 dp and the 20 sp floor, in every locale that ships
 * (`values`, `values-*` with strings_generated.xml), the Premium card (title + pitch, the "Unlock Premium · {price}"
 * button on one line, the one-time purchase line) fits above the packs row without scrolling.
 * Arabic is measured without shaping (isolated glyph advances), which over-estimates widths: conservative.
 */
class StoreLayoutFitTest {
    private fun font(name: String): Font {
        val file = listOf("src/main/res/font/$name", "app/src/main/res/font/$name").map(::File).firstOrNull { it.isFile }
            ?: error("font $name not found from ${File(".").absolutePath}")
        return Font.createFont(Font.TRUETYPE_FONT, file).deriveFont(1000f)
    }

    private val semibold = font("cairo_semibold.ttf")
    private val bold = font("cairo_bold.ttf")

    private fun xml(dir: String): String =
        listOf("src/main/res/$dir/strings_generated.xml", "app/src/main/res/$dir/strings_generated.xml").map(::File).first { it.isFile }.readText()

    /** (language, values dir) for every shipped locale: EN, FR, AR, and any newer one (e.g. ES) automatically. */
    private val locales: List<Pair<String, String>> by lazy {
        val res = listOf("src/main/res", "app/src/main/res").map(::File).first { it.isDirectory }
        val dirs = res.listFiles().orEmpty()
            .filter { (it.name == "values" || it.name.startsWith("values-")) && File(it, "strings_generated.xml").isFile }
            .map { it.name }.sorted()
        dirs.map { (if (it == "values") "en" else it.removePrefix("values-").substringBefore('-')) to it }
    }

    private fun unescape(s: String) = s.replace("\\'", "'").replace("&amp;", "&").replace("\\\"", "\"")

    private fun string(x: String, name: String): String =
        unescape(Regex("<string name=\"$name\">([^<]*)</string>").find(x)?.groupValues?.get(1) ?: error("missing $name"))

    /** The plural's `other` item (the longest form in EN/FR; AR uses one text for all counts or longer few/other). */
    private fun plural(x: String, name: String): String {
        val block = Regex("<plurals name=\"$name\">(.*?)</plurals>", RegexOption.DOT_MATCHES_ALL).find(x)?.groupValues?.get(1) ?: error("missing $name")
        val items = Regex("<item quantity=\"([a-z]+)\">([^<]*)</item>").findAll(block).associate { it.groupValues[1] to unescape(it.groupValues[2]) }
        return items.values.maxBy { it.length }
    }

    private fun em(f: Font, text: String, tracking: Double): Double {
        val gv = f.createGlyphVector(FontRenderContext(null, false, true), text)
        return gv.logicalBounds.width / 1000.0 + tracking * text.length
    }

    /** Greedy word wrap: number of lines of [text] at [sizeDp] within [widthDp]. */
    private fun lines(f: Font, text: String, sizeDp: Int, tracking: Double, widthDp: Int): Int {
        var n = 1
        var line = ""
        for (word in text.split(' ')) {
            val candidate = if (line.isEmpty()) word else "$line $word"
            if (em(f, candidate, tracking) * sizeDp <= widthDp) {
                line = candidate
            } else {
                n += 1
                line = word
            }
        }
        return n
    }

    @Test
    fun premiumCardFitsAboveThePacksRowInEveryLocale() {
        assertTrue("EN, FR, AR and ES at least: $locales", locales.map { it.first }.containsAll(listOf("en", "fr", "ar", "es")))
        // A long localised price on purpose (Play's formattedPrice is verbatim).
        val price = "US$ 299.99"
        for ((lang, dir) in locales) {
            val x = xml(dir)
            val ar = lang == "ar"
            val track = if (ar) 0.0 else 0.01
            val pitch = plural(x, "store__premium_pitch").replace("%1\$d", "14").replace("%2\$s", "450")
            val titleW = em(bold, string(x, "store__premium_title"), 0.0) * 26
            val pitchW = (StoreMetrics.CARD_INNER_W - titleW - StoreMetrics.TITLE_PITCH_GAP).toInt()
            val pitchLines = minOf(2, lines(semibold, pitch, 20, track, pitchW))
            val lifetimeLines = lines(semibold, string(x, "store__premium_lifetime"), 20, track, StoreMetrics.CARD_INNER_W)
            assertEquals("store.premiumLifetime $lang stays one line", 1, lifetimeLines)
            val h = StoreMetrics.cardHeight(ar, pitchLines, lifetimeLines)
            val budget = StoreMetrics.cardBudget(ar)
            println("store card $lang: pitch=$pitchLines line(s), lifetime=$lifetimeLines line(s), height=$h dp, budget=$budget dp")
            assertTrue("Premium card $lang is $h dp > $budget dp", h <= budget)

            // The Unlock button: "Unlock Premium · US$ 299.99" on one line, within the card (it grows with its label).
            val label = string(x, "store__unlock_premium").replace("%1\$s", price)
            val w = em(semibold, label, 0.0) * StoreMetrics.UNLOCK_LABEL_SP + 2 * StoreMetrics.UNLOCK_PAD_H
            println("unlock button $lang: ${"%.0f".format(w)} dp of ${StoreMetrics.CARD_INNER_W}")
            assertTrue("unlock button $lang is $w dp", w <= StoreMetrics.CARD_INNER_W)
            // Status labels shown in its place (pending chip, confirming with spinner, slow) fit too.
            for (key in listOf("store__pending", "store__confirming", "store__verify_failed")) {
                val sw = em(semibold, string(x, key), 0.0) * StoreMetrics.UNLOCK_LABEL_SP + 2 * StoreMetrics.UNLOCK_PAD_H + 26
                assertTrue("unlock button $lang $key is $sw dp", sw <= StoreMetrics.CARD_INNER_W)
            }
        }
        assertTrue(StoreMetrics.UNLOCK_MIN_W <= StoreMetrics.CARD_INNER_W)
        assertTrue(StoreMetrics.UNLOCK_H >= 48)
    }

    /** The footer: pending notice and `store.help` (with an email filled in) never stack into the 48 dp footer. */
    @Test
    fun footerShowsOneCaptionLineThatFitsInEveryScript() {
        val email = app.mishana.tv.billing.Products.SUPPORT_EMAIL
        for (pending in listOf(true, false)) {
            for (ar in listOf(false, true)) {
                val h = StoreMetrics.footerLines(pending, email) * StoreMetrics.captionLh(ar)
                assertTrue("footer pending=$pending ar=$ar is $h dp > ${StoreMetrics.FOOTER_H}", h <= StoreMetrics.FOOTER_H)
            }
        }
        assertEquals(StoreMetrics.FooterLine.PENDING, StoreMetrics.footerLine(true, email))
        assertEquals(StoreMetrics.FooterLine.HELP, StoreMetrics.footerLine(false, email))
        assertEquals(StoreMetrics.FooterLine.NONE, StoreMetrics.footerLine(false, ""))
        assertEquals(StoreMetrics.FooterLine.PENDING, StoreMetrics.footerLine(true, ""))
        assertEquals(StoreMetrics.FooterLine.PENDING, StoreMetrics.footerLine(true, email, ownsNothing = true))
        assertEquals(StoreMetrics.FooterLine.CARD_TIP, StoreMetrics.footerLine(false, email, ownsNothing = true))
        assertEquals(StoreMetrics.FooterLine.CARD_TIP, StoreMetrics.footerLine(false, "", ownsNothing = true))
        // Both texts exist in every locale (the help one takes the email placeholder).
        for ((_, dir) in locales) {
            val x = xml(dir)
            assertTrue(string(x, "store__pending_body").isNotBlank())
            assertTrue(string(x, "store__help").contains("%1\$s"))
        }
    }

    /** `store.cardTip` with the URL filled in stays on its one caption line (no ellipsis) in every locale. */
    @Test
    fun cardTipFitsTheFooterOnOneLine() {
        for ((lang, dir) in locales) {
            val tip = string(xml(dir), "store__card_tip").replace("%1\$s", StoreMetrics.CARD_TIP_URL)
            val w = em(semibold, tip, if (lang == "ar") 0.0 else 0.01) * 20
            println("card tip $lang: ${"%.0f".format(w)} dp of ${StoreMetrics.FOOTER_TEXT_W}")
            assertTrue("card tip $lang is $w dp", w <= StoreMetrics.FOOTER_TEXT_W)
        }
    }

    /** `store.help` with the real support email stays on its one caption line (no ellipsis) in every locale. */
    @Test
    fun helpWithTheSupportEmailFitsTheFooterOnOneLine() {
        val email = app.mishana.tv.billing.Products.SUPPORT_EMAIL
        assertTrue(email.isNotBlank())
        for ((lang, dir) in locales) {
            val help = string(xml(dir), "store__help").replace("%1\$s", email)
            val w = em(semibold, help, if (lang == "ar") 0.0 else 0.01) * 20
            println("help $lang: ${"%.0f".format(w)} dp of ${StoreMetrics.FOOTER_TEXT_W}")
            assertTrue("help $lang is $w dp", w <= StoreMetrics.FOOTER_TEXT_W)
        }
    }
}
