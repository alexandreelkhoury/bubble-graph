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
 * StoreLayoutTest runs on the owner's machine): at 960×540 dp and the 20 sp floor, in EN/FR/AR, the Premium card with
 * the longest disclosure paragraph (trial + cancel-before-trial) fits above the packs row without scrolling, and each
 * plan button shows its name, price and trial badge on one line.
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
        // A long localised price on purpose (Play's formattedPrice is verbatim).
        val price = "US$ 299.99"
        for ((lang, dir) in listOf("en" to "values", "fr" to "values-fr", "ar" to "values-ar")) {
            val x = xml(dir)
            val ar = lang == "ar"
            val track = if (ar) 0.0 else 0.01
            val period = string(x, "store__period_year")
            val disclosure = plural(x, "store__legal_trial_renew").replace("%1\$d", "14").replace("%2\$s", price).replace("%3\$s", period) +
                " " + string(x, "store__legal_cancel_trial")
            val pitch = plural(x, "store__premium_pitch").replace("%1\$d", "14").replace("%2\$s", "450")
            val titleW = em(bold, string(x, "store__premium_title"), if (ar) 0.0 else 0.0) * 26
            val pitchW = (StoreMetrics.CARD_INNER_W - titleW - StoreMetrics.TITLE_PITCH_GAP).toInt()
            val pitchLines = minOf(2, lines(semibold, pitch, 20, track, pitchW))
            val disclosureLines = lines(semibold, disclosure, 20, track, StoreMetrics.CARD_INNER_W)
            val h = StoreMetrics.cardHeight(ar, pitchLines, disclosureLines)
            val budget = StoreMetrics.cardBudget(ar)
            println("store card $lang: pitch=$pitchLines line(s), disclosure=$disclosureLines line(s), height=$h dp, budget=$budget dp")
            assertTrue("Premium card $lang is $h dp > $budget dp", h <= budget)

            // Plan button: "Yearly · US$ 299.99 / year" on one line in 400 dp; the trial badge (a corner sticker) fits too.
            for ((nameKey, priceKey) in listOf("store__plan_yearly" to "store__price_per_year", "store__plan_monthly" to "store__price_per_month")) {
                val label = string(x, nameKey) + "  ·  " + string(x, priceKey).replace("%1\$s", price)
                val w = em(semibold, label, 0.0) * 22 + 2 * StoreMetrics.PLAN_PAD_H
                println("plan button $lang $nameKey: ${"%.0f".format(w)} dp of ${StoreMetrics.PLAN_W}")
                assertTrue("plan button $lang $nameKey is $w dp", w <= StoreMetrics.PLAN_W)
            }
            val badge = plural(x, "store__trial_days").replace("%1\$d", "14")
            val bw = em(semibold, badge, track) * 20 + 20
            println("trial badge $lang: ${"%.0f".format(bw)} dp")
            assertTrue("trial badge $lang is $bw dp", bw <= StoreMetrics.PLAN_W - 2 * StoreMetrics.PLAN_PAD_H)
        }
        assertTrue(2 * StoreMetrics.PLAN_W + 16 <= StoreMetrics.CARD_INNER_W)
    }

    /** The footer: pending notice and `store.help` (with an email filled in) never stack into the 48 dp footer. */
    @Test
    fun footerShowsOneCaptionLineThatFitsInEveryScript() {
        val email = "support@mish-ana.example" // placeholder: SUPPORT_EMAIL is empty until the owner fills it
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
        // Both texts exist in every locale (the help one takes the email placeholder).
        for (dir in listOf("values", "values-fr", "values-ar")) {
            val x = xml(dir)
            assertTrue(string(x, "store__pending_body").isNotBlank())
            assertTrue(string(x, "store__help").contains("%1\$s"))
        }
    }
}
