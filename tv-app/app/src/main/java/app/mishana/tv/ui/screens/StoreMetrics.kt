package app.mishana.tv.ui.screens

/**
 * PAYMENTS-SPEC §4.4 Store layout metrics (dp), Android-free so StoreLayoutFitTest can check the hard fit rule with the
 * real Cairo fonts on the JVM: the Premium card, including the longest disclosure paragraph, fits above the packs row
 * without scrolling at the 20 sp floor in EN, FR and AR (960×540 dp canvas, 48/27 dp safe margins).
 * The Compose screenshot half of §4.9 StoreLayoutTest still runs on the owner's machine.
 */
object StoreMetrics {
    const val CANVAS_W = 960
    const val CANVAS_H = 540
    const val SAFE_H = 48
    const val SAFE_V = 27
    const val CONTENT_W = CANVAS_W - 2 * SAFE_H // 864
    const val CONTENT_H = CANVAS_H - 2 * SAFE_V // 486

    const val HEADER_H = 40
    const val HEADER_GAP = 4

    const val CARD_PAD_H = 20
    const val CARD_PAD_V = 12
    const val CARD_INNER_W = CONTENT_W - 2 * CARD_PAD_H // 824
    const val CARD_GAP = 8
    const val TITLE_PITCH_GAP = 16

    /** One plan button: a single line "Yearly · $29.99 / year" (titleS), 48 dp minimum. */
    const val PLAN_W = 400
    const val PLAN_H = 52
    const val PLAN_PAD_H = 16

    /** The trial badge is a sticker on the button's top-end corner, overhanging it by this much (no label width used). */
    const val BADGE_OVERHANG = 12

    const val CARD_TO_PACKS = 6
    const val PACKS_TITLE_GAP = 0
    const val PACK_CARD_W = 232
    const val PACK_CARD_PAD_V = 8
    const val PACK_ROW_PAD_V = 4 // room for the 1.04 focus scale

    const val FOOTER_H = 48

    /** The footer's single text line (§4.4): a pending purchase notice wins over `store.help`; no email hides help. */
    enum class FooterLine { PENDING, HELP, NONE }

    fun footerLine(pending: Boolean, supportEmail: String): FooterLine = when {
        pending -> FooterLine.PENDING
        supportEmail.isNotBlank() -> FooterLine.HELP
        else -> FooterLine.NONE
    }

    /** Text lines the footer shows (at most one, so it fits FOOTER_H in every script). */
    fun footerLines(pending: Boolean, supportEmail: String): Int = if (footerLine(pending, supportEmail) == FooterLine.NONE) 0 else 1

    /** Line heights of the type scale used here (MishType: Latin / Arabic). */
    fun titleLh(arabic: Boolean) = if (arabic) 40 else 32
    fun captionLh(arabic: Boolean) = if (arabic) 30 else 26
    fun labelLh(arabic: Boolean) = if (arabic) 30 else 24
    fun titleSLh(arabic: Boolean) = if (arabic) 34 else 28

    /** A pack card: title (titleS), pairs (caption), state (label), never clipped: 94 dp Latin, 110 dp Arabic. */
    fun packCardH(arabic: Boolean): Int = 2 * PACK_CARD_PAD_V + titleSLh(arabic) + captionLh(arabic) + labelLh(arabic)

    /** Height left for the Premium card once the header, the packs row and the footer are placed. */
    fun cardBudget(arabic: Boolean): Int =
        CONTENT_H - HEADER_H - HEADER_GAP - CARD_TO_PACKS - (labelLh(arabic) + PACKS_TITLE_GAP + packCardH(arabic) + 2 * PACK_ROW_PAD_V) - FOOTER_H

    /** The Premium card's height with [pitchLines] lines of pitch and [disclosureLines] lines of disclosure. */
    fun cardHeight(arabic: Boolean, pitchLines: Int, disclosureLines: Int): Int =
        2 * CARD_PAD_V + maxOf(titleLh(arabic), pitchLines * captionLh(arabic)) + CARD_GAP + BADGE_OVERHANG + PLAN_H + CARD_GAP +
            disclosureLines * captionLh(arabic)
}
